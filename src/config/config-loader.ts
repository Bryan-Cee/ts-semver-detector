import { cosmiconfig } from 'cosmiconfig';
import { AnalyzerConfig } from '../types';

const CONFIG_FILE_NAMES = [
  'ts-semver-detector.config.js',
  'ts-semver-detector.config.json',
  '.ts-semver-detector',
  '.ts-semver-detector.json',
  '.ts-semver-detector.js',
];

const DEFAULT_CONFIG: AnalyzerConfig = {
  ignorePatterns: [],
  customRules: [],
  ruleOverrides: [],
  ignorePrivateMembers: true,
  ignoreInternalMembers: false,
  treatMissingAsUndefined: false,
  treatUndefinedAsAny: false,
};

export class ConfigLoader {
  private static instance: ConfigLoader;
  private explorer: ReturnType<typeof cosmiconfig>;

  private constructor() {
    this.explorer = cosmiconfig('ts-semver-detector', {
      searchPlaces: CONFIG_FILE_NAMES,
      transform: (result) => {
        if (result === null) {
          return { config: DEFAULT_CONFIG, filepath: '' };
        }
        return result;
      },
    });
  }

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  public async loadConfig(configPath?: string): Promise<AnalyzerConfig> {
    try {
      let result;

      if (configPath) {
        // Load from specific path
        result = await this.explorer.load(configPath);
      } else {
        // Search for config file
        result = await this.explorer.search();
      }

      const config = result?.config || {};
      return this.validateAndMergeConfig(config);
    } catch (error) {
      throw new Error(
        `Failed to load configuration: ${(error as Error).message}`
      );
    }
  }

  private validateAndMergeConfig(
    config: Partial<AnalyzerConfig>
  ): AnalyzerConfig {
    // Merge with default config
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      // Deep merge arrays
      ignorePatterns: [
        ...(DEFAULT_CONFIG.ignorePatterns || []),
        ...(config.ignorePatterns || []),
      ],
      customRules: [
        ...(DEFAULT_CONFIG.customRules || []),
        ...(config.customRules || []),
      ],
      ruleOverrides: [
        ...(DEFAULT_CONFIG.ruleOverrides || []),
        ...(config.ruleOverrides || []),
      ],
    };

    // Validate rule overrides
    if (mergedConfig.ruleOverrides) {
      mergedConfig.ruleOverrides.forEach((override) => {
        if (!override.id) {
          throw new Error('Rule override must have an id');
        }
        if (
          override.severity &&
          !['major', 'minor', 'patch'].includes(override.severity)
        ) {
          throw new Error(
            `Invalid severity '${override.severity}' in rule override for '${override.id}'`
          );
        }
      });
    }

    // Validate ignore patterns
    if (mergedConfig.ignorePatterns) {
      mergedConfig.ignorePatterns = mergedConfig.ignorePatterns.filter(
        (pattern) => {
          if (typeof pattern !== 'string') {
            console.warn(
              `Invalid ignore pattern: ${pattern}, must be a string`
            );
            return false;
          }
          return true;
        }
      );
    }

    return mergedConfig;
  }

  public static getDefaultConfig(): AnalyzerConfig {
    return { ...DEFAULT_CONFIG };
  }
}
