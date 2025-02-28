# TypeShift Examples

This directory contains various examples demonstrating how to use the TypeShift (ts-semver-detector) tool.

## Available Examples

- **dom-apis** - Changes to DOM-related TypeScript definitions
- **react-components** - Changes to React component type definitions
- **web-patterns** - Changes to web API pattern type definitions 
- **state-management** - Changes to state management type definitions
- **html-output** - Demonstrates using HTML output format for visual reports

## Running Examples

Each example can be run individually using:

```bash
node examples/run-examples.js <example-name>
```

For example:

```bash
node examples/run-examples.js dom-apis
```

To run all examples:

```bash
node examples/run-examples.js
```

## HTML Output Example

The HTML output example specifically demonstrates how to generate a nicely formatted HTML report of the changes. To run this example:

```bash
node examples/html-output/run-html-example.js
```

This will generate an HTML file that can be viewed in your browser.

## Creating Your Own Examples

Each example should follow this structure:

```
examples/
  └── your-example-name/
      ├── v1/
      │   └── index.d.ts    # Original TypeScript definitions
      └── v2/
          └── index.d.ts    # Modified TypeScript definitions
```

The `run-examples.js` script will automatically compare the v1 and v2 definitions and output the detected changes. 