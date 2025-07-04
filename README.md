# TypeScript Definition Change Analyzer

A command-line tool that analyzes changes between TypeScript definition files (.d.ts) to automatically determine the appropriate semantic version increment based on the nature of the changes.

## Features

- Analyzes changes between two TypeScript definition files
- Determines appropriate semantic version bump (MAJOR, MINOR, PATCH)
- Detects various types of changes:
  - Interface modifications
  - Type changes (including union types and conditional types)
  - Function signature changes
  - Export additions/removals
  - Conditional type analysis (new in v0.3.0)
  - Mapped type changes
- Provides detailed change reports in JSON format
- Includes location information for each change
- Supports CI/CD integration
- Configurable rules and behavior
- Plugin system for custom rules

## Installation

```bash
npm install -g ts-semver-detector
```

## Usage

Basic usage:

```bash
ts-semver-detector --old oldFile.d.ts --new newFile.d.ts
```

With options:

```bash
ts-semver-detector --old oldFile.d.ts --new newFile.d.ts --output report.json --config ./config.js
```

### Options

- `--old <file>`: Path to the old .d.ts file (required)
- `--new <file>`: Path to the new .d.ts file (required)
- `--format <type>`: Output format (json) (default: "json")
- `--output <file>`: Output file path
- `--verbose`: Show detailed information about changes
- `--config <file>`: Path to config file
- `--ignore-private`: Ignore private members (default: true)
- `--ignore-internal`: Ignore internal members (default: false)
- `--treat-missing-as-undefined`: Treat missing types as undefined (default: false)
- `--treat-undefined-as-any`: Treat undefined as any (default: false)

## Configuration

The tool can be configured using a configuration file. It supports the following formats:

- JavaScript file (ts-semver-detector.config.js)
- JSON file (ts-semver-detector.config.json)
- RC file (.ts-semver-detectorrc, .ts-semver-detectorrc.json, .ts-semver-detectorrc.js)

Example configuration file:

```javascript
module.exports = {
  // Patterns to ignore when analyzing files
  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/*.test.d.ts",
  ],

  // Override rule severities
  ruleOverrides: [
    {
      id: "interface-change",
      severity: "major", // Always treat interface changes as major
    },
    {
      id: "type-change",
      enabled: false, // Disable type change detection
    },
  ],

  // General options
  ignorePrivateMembers: true,
  ignoreInternalMembers: true,
  treatMissingAsUndefined: false,
  treatUndefinedAsAny: false,

  // Custom rules can be added here
  customRules: [],
};
```

### Configuration Options

#### General Options

- `ignorePatterns`: Array of glob patterns to ignore when analyzing files
- `ignorePrivateMembers`: Whether to ignore private class members (default: true)
- `ignoreInternalMembers`: Whether to ignore internal declarations (default: false)
- `treatMissingAsUndefined`: Whether to treat missing types as undefined (default: false)
- `treatUndefinedAsAny`: Whether to treat undefined as any (default: false)

#### Rule Overrides

Rule overrides allow you to customize the behavior of built-in rules:

```javascript
ruleOverrides: [
  {
    id: "rule-id", // Rule identifier
    severity: "major", // Override severity (major, minor, patch)
    enabled: true, // Enable/disable the rule
  },
];
```

Available rules:

- `interface-change`: Detects changes in interface declarations
- `type-change`: Detects changes in type aliases
- `function-change`: Detects changes in function signatures
- `class-change`: Detects changes in class declarations
- `conditional-type-change`: Detects changes in conditional types (v0.3.0+)
- `mapped-type-change`: Detects changes in mapped types

#### Custom Rules

You can add custom rules by implementing the Rule interface:

```typescript
interface Rule {
  id: string;
  description: string;
  analyze(oldNode: ts.Node, newNode: ts.Node): Change | null;
}
```

Example custom rule:

```typescript
class CustomRule implements Rule {
  id = "custom-rule";
  description = "Custom rule description";

  analyze(oldNode: ts.Node, newNode: ts.Node): Change | null {
    // Implement your rule logic here
    return {
      type: "other",
      name: "custom",
      change: this.id,
      severity: "major",
      description: "Custom change detected",
    };
  }
}

// Add to configuration
module.exports = {
  customRules: [new CustomRule()],
};
```

## Change Classification

The tool classifies changes according to semantic versioning principles:

### MAJOR Version Bump (Breaking Changes)

- Removing exported declarations
- Narrowing type definitions
- Adding required properties to interfaces
- Incompatible function signature changes
- Removing implemented interfaces
- Changing public members to private/protected

### MINOR Version Bump (Backwards-Compatible Additions)

- Adding new exports
- Adding optional properties
- Broadening type definitions
- Adding optional parameters
- Adding new public members
- Adding implemented interfaces

### PATCH Version Bump

- Documentation changes
- Formatting changes
- No functional changes
- Equivalent type reformatting

## Conditional Type Analysis (New in v0.3.0)

The tool now provides comprehensive analysis of conditional type changes, which are critical for maintaining type safety in complex TypeScript libraries.

### Conditional Type Changes

Conditional types follow the pattern `T extends U ? X : Y` and changes to them are classified as follows:

#### MAJOR Changes (Breaking)

- **Narrowed conditions**: Making the condition more restrictive

  ```typescript
  // Old: More permissive condition
  type IsString<T> = T extends string | number ? true : false;

  // New: More restrictive condition (MAJOR)
  type IsString<T> = T extends string ? true : false;
  ```

- **Changed default branch to `never`**: Making the fallback case more restrictive

  ```typescript
  // Old: Fallback returns the original type
  type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

  // New: Fallback returns never (MAJOR)
  type UnwrapPromise<T> = T extends Promise<infer U> ? U : never;
  ```

#### MINOR Changes (Backwards-Compatible)

- **Broadened conditions**: Making the condition more permissive

  ```typescript
  // Old: More restrictive condition
  type IsString<T> = T extends string ? true : false;

  // New: More permissive condition (MINOR)
  type IsString<T> = T extends string | number ? true : false;
  ```

- **Enhanced true/false branches**: Adding more specific return types

  ```typescript
  // Old: Simple boolean return
  type IsString<T> = T extends string ? true : false;

  // New: More specific return types (MINOR)
  type IsString<T> = T extends string ? "string" : "not-string";
  ```

The analyzer automatically detects these patterns and classifies them appropriately, helping you maintain semantic versioning compliance when working with complex conditional types.

## Output Formats

### Text Output

```
TypeScript Definition Changes Analysis

Recommended Version Bump:
MAJOR

Changes:
MAJOR interface: Added required property 'language' to interface 'UserSettings'
MINOR interface: Added optional property 'age' to interface 'User'
...

Summary:
Major Changes: 1
Minor Changes: 1
Patch Changes: 0
```

### JSON Output

```json
{
  "recommendedVersionBump": "major",
  "changes": [
    {
      "type": "interface",
      "name": "UserSettings",
      "change": "added-required-property",
      "severity": "major",
      "description": "Added required property 'language'",
      "location": {
        "newFile": { "line": 5, "column": 3 }
      }
    }
  ],
  "summary": {
    "majorChanges": 1,
    "minorChanges": 1,
    "patchChanges": 0
  }
}
```

## CI Integration

### GitHub Actions Example

```yaml
name: API Version Check

on:
  pull_request:
    paths:
      - "**/*.d.ts"

jobs:
  check-version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: "16"
      - name: Install ts-semver-detector
        run: npm install -g ts-semver-detector
      - name: Check TypeScript API changes
        run: |
          ts-semver-detector \
            --old ${{ github.event.pull_request.base.sha }}:types/index.d.ts \
            --new ${{ github.event.pull_request.head.sha }}:types/index.d.ts \
            --format json \
            --output report.json
```

### GitLab CI Example

```yaml
api-version-check:
  script:
    - npm install -g ts-semver-detector
    - ts-semver-detector \
      --old ${CI_MERGE_REQUEST_DIFF_BASE_SHA}:types/index.d.ts \
      --new ${CI_MERGE_REQUEST_TARGET_BRANCH_SHA}:types/index.d.ts \
      --format json \
      --output changes.json
  only:
    - merge_requests
  changes:
    - "**/*.d.ts"
```

## Development

### Setup

```bash
git clone https://github.com/yourusername/ts-semver-detector.git
cd ts-semver-detector
npm install
```

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
