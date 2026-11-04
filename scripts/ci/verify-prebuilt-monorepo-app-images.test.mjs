import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseArgs,
  planVerification,
  verifyRepository,
} from "./verify-prebuilt-monorepo-app-images.mjs";

const sha = (c) => c.repeat(40);

describe("parseArgs and planVerification", () => {
  it("expects one SHA for every default component", () => {
    const plan = planVerification(parseArgs(["--environment", "test", "--sha", sha("a")]));
    assert.deepEqual(plan.map(([repository]) => repository).sort(), [
      "lax-test-api",
      "lax-test-migrate",
      "lax-test-web",
      "lax-test-worker",
      "lax-test-ws",
    ]);
    assert.ok(plan.every(([, pinned]) => pinned === sha("a")));
  });

  it("checks each component against its own pin when SHAs differ", () => {
    const plan = planVerification(
      parseArgs(["--environment", "test", "--pin", `web=${sha("6")}`, "--pin", `ws=${sha("2")}`]),
    );
    assert.deepEqual(plan, [
      ["lax-test-web", sha("6")],
      ["lax-test-ws", sha("2")],
    ]);
  });

  it("rejects mixing --pin with --sha and malformed pins", () => {
    assert.throws(
      () => parseArgs(["--environment", "test", "--sha", sha("a"), "--pin", `web=${sha("b")}`]),
      /mutually exclusive/,
    );
    assert.throws(() => parseArgs(["--environment", "test", "--pin", "web=abc"]), /--pin must be/);
  });

  it("fails when a selected component has no pin", () => {
    assert.throws(
      () =>
        planVerification(
          parseArgs(["--environment", "test", "--pin", `web=${sha("a")}`, "--component", "ws"]),
        ),
      /No --pin given for component "ws"/,
    );
  });
});

describe("verifyRepository", () => {
  const tags = {
    "lax-test-web": [{ tag: sha("6"), manifest_digest: "sha256:web" }],
    "lax-test-ws": [{ tag: sha("2"), manifest_digest: "sha256:ws" }],
  };
  const deps = {
    list: (repository) => tags[repository] ?? [],
    digestFor: (list, tag) => list.find((entry) => entry.tag === tag)?.manifest_digest ?? null,
    log: () => {},
  };

  it("passes when every component has its own SHA tag, even if the SHAs differ", async () => {
    const wait = async () => {
      throw new Error("should not wait");
    };
    assert.equal(await verifyRepository("lax-test-web", sha("6"), { ...deps, wait }), "sha256:web");
    assert.equal(await verifyRepository("lax-test-ws", sha("2"), { ...deps, wait }), "sha256:ws");
  });

  it("fails clearly when a component image is missing", async () => {
    const wait = async (repository, missing) => {
      throw new Error(`DOCR ${repository} is missing immutable tag ${missing}`);
    };
    await assert.rejects(
      verifyRepository("lax-test-ws", sha("6"), { ...deps, wait }),
      /lax-test-ws is missing immutable tag 6{40}/,
    );
  });
});
