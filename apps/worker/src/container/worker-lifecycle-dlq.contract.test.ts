import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const containerSource = readFileSync(
  join(import.meta.dirname, "create-worker-container.ts"),
  "utf8",
);
const registerSource = readFileSync(
  join(import.meta.dirname, "../lifecycle/register-lot-lifecycle-worker.ts"),
  "utf8",
);

describe("worker lot-lifecycle DLQ wiring", () => {
  it("registers lifecycle consumer DLQ handlers with shared registerDlqHandlers", () => {
    expect(containerSource).toContain("lotLifecycleConsumer?.dlqHandlers");
    expect(registerSource).toContain("dlqHandlers:");
  });
});
