import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  componentNames,
  formatFailureSummary,
  orderComponents,
  redactLine,
  summariseFailure,
} from "./report-deploy-failure.mjs";

const deployment = {
  spec: {
    services: [
      { name: "api" },
      { name: "account" },
      { name: "art-identity" },
      { name: "shop" },
      { name: "shop-api" },
    ],
    jobs: [{ name: "migrate" }],
  },
  progress: {
    steps: [
      { name: "build", status: "SUCCESS" },
      {
        name: "deploy",
        status: "ERROR",
        steps: [
          {
            name: "api-deploy",
            status: "ERROR",
            reason: {
              code: "DeployContainerExitNonZero",
              message: "Invalid environment variables",
            },
          },
          { name: "shop-api-deploy", status: "SUCCESS" },
        ],
      },
    ],
  },
};

describe("componentNames", () => {
  it("covers every spec component, including account, art and art-identity", () => {
    const names = componentNames([deployment], { art: "x" });
    for (const name of ["api", "account", "art-identity", "art", "migrate", "shop-api"]) {
      assert.ok(names.includes(name), name);
    }
  });
});

describe("summariseFailure", () => {
  const components = componentNames([deployment]);

  it("names the failed component by longest prefix, with its reason", () => {
    const summary = summariseFailure([deployment], components);
    assert.deepEqual(summary.failedComponents, ["api"]);
    assert.match(
      formatFailureSummary("ERROR", summary),
      /Failed components: api\n.*Invalid environment variables/,
    );
  });

  it("orders failed components first", () => {
    assert.deepEqual(orderComponents(["shop", "api", "web"], ["api"]), ["api", "shop", "web"]);
  });

  it("reports when no step identifies a component", () => {
    const summary = summariseFailure({ progress: { steps: [] } }, components);
    assert.match(formatFailureSummary("ERROR", summary), /not identified/);
  });
});

describe("redactLine", () => {
  it("masks secret-looking values but keeps variable names", () => {
    assert.equal(redactLine("SESSION_SECRET=abc123 missing"), "SESSION_SECRET= *** missing");
    assert.equal(redactLine("postgres://user:pw@host/db"), "postgres://***@host/db");
    assert.equal(
      redactLine("Invalid environment variables: STRIPE_KEY"),
      "Invalid environment variables: STRIPE_KEY",
    );
  });
});
