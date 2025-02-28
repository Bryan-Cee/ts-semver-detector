# TypeScript Definition Change Analyzer

A command-line tool that analyzes changes between TypeScript definition files (.d.ts) to automatically determine the appropriate semantic version increment based on the nature of the changes.

## Features

- Analyzes changes between two TypeScript definition files
- Determines appropriate semantic version bump (MAJOR, MINOR, PATCH)
- Detects various types of changes:
  - Interface modifications
  - Type changes
  - Function signature changes
  - Export additions/removals
- Provides detailed change reports in multiple formats (text, JSON, HTML)
- Includes location information for each change
- Supports CI/CD integration
- Configurable rules and behavior
- Plugin system for custom rules

## Installation

```bash
npm install -g typeshift
```

## Usage

Basic usage:
```bash
typeshift --old oldFile.d.ts --new newFile.d.ts
```

With options:
```bash
typeshift --old oldFile.d.ts --new newFile.d.ts --format html --output report.html --config ./config.js
```

### Options

- `--old <file>`: Path to the old .d.ts file (required)
- `--new <file>`: Path to the new .d.ts file (required)
- `--format <type>`: Output format (json, text, html) (default: "text")
- `--output <file>`: Output file path
- `--verbose`: Show detailed information about changes
- `--config <file>`: Path to config file
- `--ignore-private`: Ignore private members (default: true)
- `--ignore-internal`: Ignore internal members (default: false)
- `--treat-missing-as-undefined`: Treat missing types as undefined (default: false)
- `--treat-undefined-as-any`: Treat undefined as any (default: false)

## Configuration

The tool can be configured using a configuration file. It supports the following formats:
- JavaScript file (typeshift.config.js)
- JSON file (typeshift.config.json)
- RC file (.typeshiftrc, .typeshiftrc.json, .typeshiftrc.js)

Example configuration file:

```javascript
module.exports = {
  // Patterns to ignore when analyzing files
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/*.test.d.ts'
  ],

  // Override rule severities
  ruleOverrides: [
    {
      id: 'interface-change',
      severity: 'major' // Always treat interface changes as major
    },
    {
      id: 'type-change',
      enabled: false // Disable type change detection
    }
  ],

  // General options
  ignorePrivateMembers: true,
  ignoreInternalMembers: true,
  treatMissingAsUndefined: false,
  treatUndefinedAsAny: false,

  // Custom rules can be added here
  customRules: []
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
    id: 'rule-id',          // Rule identifier
    severity: 'major',      // Override severity (major, minor, patch)
    enabled: true           // Enable/disable the rule
  }
]
```

Available rules:
- `interface-change`: Detects changes in interface declarations
- `type-change`: Detects changes in type aliases
- `function-change`: Detects changes in function signatures
- `class-change`: Detects changes in class declarations

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
  id = 'custom-rule';
  description = 'Custom rule description';

  analyze(oldNode: ts.Node, newNode: ts.Node): Change | null {
    // Implement your rule logic here
    return {
      type: 'other',
      name: 'custom',
      change: this.id,
      severity: 'major',
      description: 'Custom change detected'
    };
  }
}

// Add to configuration
module.exports = {
  customRules: [new CustomRule()]
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
      - '**/*.d.ts'

jobs:
  check-version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - name: Install typeshift
        run: npm install -g typeshift
      - name: Check TypeScript API changes
        run: |
          typeshift \
            --old ${{ github.event.pull_request.base.sha }}:types/index.d.ts \
            --new ${{ github.event.pull_request.head.sha }}:types/index.d.ts \
            --format json \
            --output report.json
```

### GitLab CI Example

```yaml
api-version-check:
  script:
    - npm install -g typeshift
    - typeshift \
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
git clone https://github.com/yourusername/typeshift.git
cd typeshift
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
