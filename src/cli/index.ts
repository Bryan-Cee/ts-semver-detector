#!/usr/bin/env node

import { Command } from "commander";
import * as path from "path";
import * as fs from "fs";
import { TypeScriptDiffAnalyzer } from "../diff/analyzer";
import { TypeScriptParser } from "../parser/parser";
import { AnalysisResult, Change, Severity, ChangeType } from "../types";
import { ConfigLoader } from "../config/config-loader";

const program = new Command();

program
  .name("ts-semver-detector")
  .description("Analyze changes between TypeScript definition files")
  .version("1.0.0")
  .requiredOption("--old <file>", "Path to the old .d.ts file")
  .requiredOption("--new <file>", "Path to the new .d.ts file")
  .option("--format <type>", "Output format (json)", "json")
  .option("--output <file>", "Output file path")
  .option("--verbose", "Show detailed information about changes")
  .option("--show-types", "Display the actual type differences in the output")
  .option("--config <file>", "Path to config file")
  .option("--ignore-private", "Ignore private members", true)
  .option("--ignore-internal", "Ignore internal members", false)
  .option(
    "--treat-missing-as-undefined",
    "Treat missing types as undefined",
    false
  )
  .option("--treat-undefined-as-any", "Treat undefined as any", false)
  .parse(process.argv);

const options = program.opts();

// Enable verbose logging if requested
if (options.verbose) {
  // Set a global flag that can be checked by other modules
  process.env.TS_SEMVER_VERBOSE = "true";
  console.log("Verbose logging enabled");
}

function validateFile(filePath: string): string {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  return resolvedPath;
}

function formatOutput(
  result: AnalysisResult,
  options: { format: string; showTypes?: boolean }
): string {
  // Only JSON format is supported
  const jsonResult = {
    ...result,
    changes: result.changes.map((change) => {
      // Include basic type info but not the full declarations
      const { oldType, newType, ...rest } = change;

      // Only include summary type information if --show-types is enabled
      if (options.showTypes) {
        return {
          ...rest,
          typeInfo: {
            hasOldType: !!oldType,
            hasNewType: !!newType,
            // Extract just the first line to give a hint about the type
            oldTypeSummary: oldType
              ? oldType.split("\n")[0] + (oldType.includes("\n") ? "..." : "")
              : undefined,
            newTypeSummary: newType
              ? newType.split("\n")[0] + (newType.includes("\n") ? "..." : "")
              : undefined,
          },
        };
      }

      return rest;
    }),
  };

  return JSON.stringify(jsonResult, null, 2);
}

async function main() {
  try {
    const oldFile = validateFile(options.old);
    const newFile = validateFile(options.new);

    // Load configuration
    const configLoader = ConfigLoader.getInstance();
    const config = await configLoader.loadConfig(options.config);

    // Merge CLI options with config
    const analyzerOptions = {
      ...config,
      ignorePrivateMembers:
        options.ignorePrivate ?? config.ignorePrivateMembers,
      ignoreInternalMembers:
        options.ignoreInternal ?? config.ignoreInternalMembers,
      treatMissingAsUndefined:
        options.treatMissingAsUndefined ?? config.treatMissingAsUndefined,
      treatUndefinedAsAny:
        options.treatUndefinedAsAny ?? config.treatUndefinedAsAny,
    };

    // Create parser to get source files
    const parser = new TypeScriptParser([oldFile, newFile], analyzerOptions);
    const oldSourceFile = parser.getSourceFile(oldFile);
    const newSourceFile = parser.getSourceFile(newFile);

    if (!oldSourceFile || !newSourceFile) {
      throw new Error("Could not find source files");
    }

    // Create analyzer with parser
    const analyzer = new TypeScriptDiffAnalyzer(parser, analyzerOptions);

    // Call analyze with source files
    const result = analyzer.analyze(oldSourceFile, newSourceFile);

    const output = formatOutput(result, {
      format: "json", // Always JSON format
      showTypes: options.showTypes,
    });

    if (options.output) {
      fs.writeFileSync(options.output, output);
      console.log(`Analysis result written to ${options.output}`);
    } else {
      console.log(output);
    }

    // Exit with non-zero code if major changes are detected
    process.exit(result.summary.majorChanges > 0 ? 1 : 0);
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
}

main();
