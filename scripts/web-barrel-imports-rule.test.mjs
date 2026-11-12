import assert from "node:assert/strict";
import { test } from "node:test";
import { barrelImports } from "./web-barrel-imports-rule.mjs";

test("flags named, type, re-export, dynamic and mock references to a barrel", () => {
  const source = [
    'import { cn } from "@auction/ui";',
    'import type { Props } from "@auction/ui/lax";',
    'export { Hang } from "@auction/marketing-ui";',
    'const lazy = import("@auction/marketing-ui");',
    'vi.mock("@auction/ui", () => ({}));',
  ].join("\n");
  assert.deepEqual(barrelImports(source), [
    "@auction/ui",
    "@auction/ui/lax",
    "@auction/marketing-ui",
    "@auction/marketing-ui",
    "@auction/ui",
  ]);
});

test("accepts narrow subpaths and other packages", () => {
  const source = [
    'import { Button } from "@auction/ui/components/button";',
    'import { TextLink } from "@auction/ui/lax/text-link";',
    'import { MarketingHeader } from "@auction/marketing-ui/header/marketing-header";',
    'import { StaffTable } from "@auction/staff-ui";',
    'import "@auction/ui/lax-theme.css";',
  ].join("\n");
  assert.deepEqual(barrelImports(source), []);
});
