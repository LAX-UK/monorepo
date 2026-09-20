import assert from "node:assert/strict";
import { test } from "node:test";
import { workspaceSourceAliases } from "./workspace-source-aliases.mjs";

test("maps @auction/marketing-ui root and MediaImage subpath exports to src", () => {
  const aliases = workspaceSourceAliases(["@auction/marketing-ui"]);
  const root = aliases.find((a) => a.find === "@auction/marketing-ui");
  assert.ok(root, "root alias");
  assert.match(root.replacement, /marketing-ui\/src\/index\.ts$/);

  assert.equal(aliases.filter((a) => a.find.startsWith("@auction/marketing-ui")).length, 1);
});

test("maps irregular @auction/ui typography and shell exports", () => {
  const aliases = workspaceSourceAliases(["@auction/ui"]);
  const typography = aliases.find((a) => a.find === "@auction/ui/components/typography");
  assert.ok(typography);
  assert.match(typography.replacement, /components\/typography\.tsx$/);

  const shell = aliases.find((a) => a.find === "@auction/ui/shell");
  assert.ok(shell);
  assert.match(shell.replacement, /shell\/index\.ts$/);

  const datetime = aliases.find((a) => a.find === "@auction/ui/lib/datetime");
  assert.ok(datetime);
  assert.match(datetime.replacement, /lib\/datetime\/index\.ts$/);
});
