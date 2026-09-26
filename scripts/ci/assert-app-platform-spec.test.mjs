import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAppPlatformSpec,
  assertPinnedImageTags,
  collectReleaseEnvOverrides,
} from "./assert-app-platform-spec.mjs";

test("collectReleaseEnvOverrides finds spec env that overrides image release", () => {
  const violations = collectReleaseEnvOverrides({
    services: [
      {
        name: "web",
        envs: [{ key: "SENTRY_RELEASE", value: "71875a257736a60b0c95449a140d1a1b738d0484" }],
        image: { tag: "900209c503cc13fb97891d88cfea4f45e3b822d7" },
      },
    ],
  });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].component, "web");
});

test("assertAppPlatformSpec pre mode rejects release override", () => {
  assert.throws(
    () =>
      assertAppPlatformSpec({
        mode: "pre",
        expectedTag: "",
        spec: {
          services: [
            {
              name: "web",
              envs: [{ key: "SENTRY_RELEASE", value: "old" }],
            },
          ],
        },
      }),
    /spec overrides image-owned release/,
  );
});

test("assertPinnedImageTags reports tag mismatches", () => {
  const mismatches = assertPinnedImageTags(
    {
      services: [
        { name: "web", image: { tag: "aaa", registry: "lax-bid", repository: "lax-test-web" } },
      ],
    },
    "bbb",
  );
  assert.equal(mismatches.length, 1);
  assert.equal(mismatches[0].name, "web");
});
