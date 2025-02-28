# HTML Output Format Example

This example demonstrates how to use the HTML output format of the `ts-semver-detector` tool to generate a visually formatted report of breaking changes between TypeScript definition files.

## Files Included

- `v1/index.d.ts` - Original TypeScript definitions
- `v2/index.d.ts` - Updated TypeScript definitions with various changes (major, minor, and patch)
- `run-html-example.js` - Script to run the analyzer with HTML output format
- `output.html` - Generated HTML report (created when running the example)

## Running the Example

Make sure you have built the project first:

```bash
npm run build
```

Then run the example script:

```bash
node examples/html-output/run-html-example.js
```

Or make it executable and run directly:

```bash
chmod +x examples/html-output/run-html-example.js
./examples/html-output/run-html-example.js
```

The script will:
1. Analyze differences between the v1 and v2 definition files
2. Generate an HTML report
3. Save the report to `output.html` in the same directory

## Viewing the Results

Open the generated HTML file in your browser:

```bash
open examples/html-output/output.html
```

## Types of Changes Demonstrated

This example demonstrates several types of changes that will be detected:

1. **Major changes** (breaking):
   - Adding a required field (`refreshToken` in `AuthResult`)
   - Modifying return types or parameters

2. **Minor changes** (non-breaking additions):
   - Adding optional fields (`avatar` in `User`)
   - Adding new types (`Pagination` interface)
   - Extending union types (`mfa` added to `AuthMethod`)

3. **Patch changes** (non-breaking modifications):
   - Documentation changes
   - Adding optional nested fields

## Output Format Differences

### HTML Output (Rich Visual Diffs)

HTML output is now the only format that displays detailed, rich visual diffs of type changes. This format is ideal for:

- Reviewing changes with stakeholders
- Documentation purposes
- When you need visual context of exactly what changed and where

To use HTML output in your own projects:

```bash
ts-semver-detector analyze oldFile.d.ts newFile.d.ts --format html --output report.html --show-types
```

### Text and JSON Output (Simplified)

Text and JSON outputs now provide simplified type information without detailed diffs. These formats focus on:

- The change description and location
- Severity of the change
- Basic type information when using `--show-types`

This makes the outputs more concise and easier to parse programmatically while still providing all the essential information.

## Showing Type Differences

The example demonstrates the use of the `--show-types` option, which displays the actual type differences in the output. This provides a more detailed view of what changed between versions.

### Full Context for Nested Types

When displaying changes to nested types (like properties inside interfaces), the tool now shows the full parent context. This makes it easier to understand where in the hierarchy the change occurred.

For example, when a property is added to an interface, you'll see the entire interface with the new property highlighted, rather than just the property itself. This provides better context for understanding the change.

### Diff Highlighting

When used with HTML output, the type differences are displayed as diff-highlighted code blocks:
- Full type declarations are shown, including export statements and comments
- Added code is highlighted with a green background
- Removed code is highlighted with a red background
- Unchanged code is shown in normal text for context
- For nested types, the specific property that changed is specially highlighted

#### Improved Property Highlighting

The latest version includes improved diff highlighting for properties in objects:

1. **Selective highlighting**: Only the specific property name and its value are highlighted, not the entire line
2. **Contextual diffs**: The entire type is shown with normal formatting, and only the added/removed parts are highlighted
3. **Word-level diffing**: Instead of line-by-line diffs, the tool now uses more precise word-level diffing
4. **Visual distinction**: Property names are highlighted in amber, while their values use green/red for added/removed

For example, when a property `avatar` is added to a `User` interface:

```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  active: boolean;
  avatar?: string;  // Only 'avatar' and 'string' will be highlighted
}
```

For changes to existing types, only the specific modifications are highlighted:

```typescript
// Before
export type AuthMethod = 'password' | 'oauth' | 'sso';

// After - only 'mfa' is highlighted in green
export type AuthMethod = 'password' | 'oauth' | 'sso' | 'mfa';
```

This selective highlighting makes it much easier to identify exactly what changed, especially in complex nested types.

This option works with all output formats, but only HTML format provides the rich visual diffs.

To use this option in your own projects:

```bash
ts-semver-detector analyze oldFile.d.ts newFile.d.ts --format html --output report.html --show-types
``` 