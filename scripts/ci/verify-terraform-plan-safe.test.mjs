import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import test from "node:test";

const script = resolve(import.meta.dirname, "verify-terraform-plan-safe.mjs");

function verify(resourceChanges, allowed = [], padding = "") {
  const directory = mkdtempSync(join(tmpdir(), "terraform-plan-safe-"));
  try {
    const terraform = join(directory, "terraform");
    writeFileSync(terraform, `#!/bin/sh\ncat '${join(directory, "plan.json")}'\n`);
    chmodSync(terraform, 0o755);
    writeFileSync(
      join(directory, "plan.json"),
      JSON.stringify({ resource_changes: resourceChanges, padding }),
    );
    return spawnSync(process.execPath, [script, "fixture.tfplan"], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${directory}${delimiter}${process.env.PATH ?? ""}`,
        TF_ALLOWED_DELETE_ADDRESSES: JSON.stringify(allowed),
      },
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("blocks an unapproved deletion", () => {
  const result = verify([{ address: "module.app.resource.old", change: { actions: ["delete"] } }]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /module\.app\.resource\.old: delete/);
});

test("allows only an exact approved deletion", () => {
  const address = 'module.postgres_rbac.postgresql_default_privileges.app_tables["shop_app"]';
  const result = verify([{ address, change: { actions: ["delete"] } }], [address]);
  assert.equal(result.status, 0, result.stderr);
});

test("blocks replacement even when its address is approved for deletion", () => {
  const address = 'module.postgres_rbac.postgresql_default_privileges.app_tables["shop_app"]';
  const result = verify([{ address, change: { actions: ["delete", "create"] } }], [address]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /app_tables\["shop_app"\]: replace/);
});

test("accepts Terraform JSON plans larger than spawnSync's default buffer", () => {
  const result = verify([], [], "x".repeat(2 * 1024 * 1024));
  assert.equal(result.status, 0, result.stderr);
});
