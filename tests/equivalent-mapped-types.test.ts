import * as path from "path";
import * as ts from "typescript";
import { TypeScriptDiffAnalyzer } from "../src/diff/analyzer";
import { TypeScriptParser } from "../src/parser/parser";

describe("Mapped Types Equivalence", () => {
  const oldFile = path.resolve(__dirname, "fixtures/mapped-old.d.ts");
  const newFile = path.resolve(__dirname, "fixtures/mapped-new.d.ts");
  let analyzer: TypeScriptDiffAnalyzer;
  let parser: TypeScriptParser;
  let oldSourceFile: ts.SourceFile;
  let newSourceFile: ts.SourceFile;

  beforeEach(() => {
    parser = new TypeScriptParser([oldFile, newFile]);
    analyzer = new TypeScriptDiffAnalyzer(parser);
    oldSourceFile = parser.getSourceFile(oldFile)!;
    newSourceFile = parser.getSourceFile(newFile)!;
  });

  it("should recognize alternative syntaxes for readonly mapped types as equivalent", () => {
    const result = analyzer.analyze(oldSourceFile, newSourceFile);
    const readOnlyChange = result.changes.find((c) => c.name === "ReadOnly");

    expect(readOnlyChange).toBeDefined();
    expect(readOnlyChange?.severity).toBe("minor");
    expect(result.recommendedVersionBump).toBe("minor");
  });

  it("should recognize alternative syntaxes for optional mapped types as equivalent", () => {
    const result = analyzer.analyze(oldSourceFile, newSourceFile);
    const optionalChange = result.changes.find((c) =>
      c.name.includes("Optional")
    );

    expect(optionalChange).toBeDefined();
    expect(optionalChange?.severity).toBe("minor");
    expect(result.recommendedVersionBump).toBe("minor");
  });
});
