import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const workflow = readFileSync(
  resolve(import.meta.dirname, "../../.github/workflows/e2e-pr.yml"),
  "utf8",
);

test("browser-gates always reports so the required check never stays pending", () => {
  const trigger = workflow.slice(workflow.indexOf("on:"), workflow.indexOf("jobs:"));
  assert.doesNotMatch(trigger, /paths:/);
  assert.match(workflow, /uses: dorny\/paths-filter@v3/);
  assert.match(
    workflow,
    /browser-gates:\n\s+needs: changes\n\s+if: needs\.changes\.outputs\.browser == 'true'/,
  );
});
