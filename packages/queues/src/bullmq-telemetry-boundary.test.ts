import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  dependencies?: Record<string, string>;
  exports?: Record<string, unknown>;
};

const repoRoot = resolve(import.meta.dirname, "../../..");

function readManifest(relativePath: string): PackageManifest {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8")) as PackageManifest;
}

describe("BullMQ telemetry package boundary", () => {
  const observability = readManifest("packages/observability/package.json");
  const queues = readManifest("packages/queues/package.json");
  const auth = readManifest("apps/auth/package.json");
  const api = readManifest("apps/api/package.json");
  const worker = readManifest("apps/worker/package.json");

  it("keeps the BullMQ adapter and dependency out of observability core", () => {
    expect(observability.dependencies?.["bullmq-otel"]).toBeUndefined();
    expect(observability.exports?.["./bullmq-telemetry"]).toBeUndefined();

    const rootEntry = readFileSync(
      resolve(repoRoot, "packages/observability/src/index.ts"),
      "utf8",
    );
    expect(rootEntry).not.toContain("bullmq");
  });

  it("makes the existing queues package own the narrow telemetry subpath", () => {
    expect(queues.dependencies?.["bullmq-otel"]).toBe("^1.1.0");
    expect(queues.exports?.["./bullmq-telemetry"]).toBeDefined();
  });

  it("keeps auth outside the queue dependency graph", () => {
    expect(auth.dependencies?.["@auction/queues"]).toBeUndefined();
    expect(auth.dependencies?.["bullmq-otel"]).toBeUndefined();
    expect(api.dependencies?.["@auction/queues"]).toBe("workspace:*");
    expect(worker.dependencies?.["@auction/queues"]).toBe("workspace:*");
  });
});
