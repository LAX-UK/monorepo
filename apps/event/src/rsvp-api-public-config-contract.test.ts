import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The event microsite is a standalone Vite bundle with no runtime dependency
 * on `@auction/types` (see apps/event/package.json), so `OnsiteEventPublicConfig`
 * and `OnsiteEventPublicListItem` are hand-duplicated here from
 * `packages/types/src/onsite-event.ts`. This test parses both files with the
 * TypeScript compiler API and fails loudly if a field is added/removed on one
 * side but not the other, since that drift is otherwise silent (both are
 * plain type aliases with no runtime shape check).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CANONICAL_TYPES_PATH = path.resolve(__dirname, "../../../packages/types/src/onsite-event.ts");
const LOCAL_RSVP_API_PATH = path.resolve(__dirname, "./rsvp-api.ts");

function extractFieldNames(filePath: string, typeName: string): string[] {
  const source = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);

  let fields: string[] | null = null;

  function visit(node: ts.Node): void {
    if (
      ts.isTypeAliasDeclaration(node) &&
      node.name.text === typeName &&
      ts.isTypeLiteralNode(node.type)
    ) {
      fields = node.type.members
        .filter(ts.isPropertySignature)
        .map((member) => (member.name as ts.Identifier).text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (!fields) {
    throw new Error(`Could not find type alias "${typeName}" in ${filePath}`);
  }
  return fields;
}

describe("event microsite public config contract", () => {
  it.each(["OnsiteEventPublicConfig", "OnsiteEventPublicListItem"])(
    "%s field names match the canonical @auction/types definition",
    (typeName) => {
      const canonicalFields = extractFieldNames(CANONICAL_TYPES_PATH, typeName).sort();
      const localFields = extractFieldNames(LOCAL_RSVP_API_PATH, typeName).sort();
      expect(localFields).toEqual(canonicalFields);
    },
  );
});
