import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  patchedDependencyPathsFromManifest,
  verifyDockerfilePatchedDependencies,
  verifyRepositoryDockerPatchedDependencies,
} from "./verify-docker-patched-dependencies.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("patchedDependencies string and object forms resolve to patch files", () => {
  assert.deepEqual(
    patchedDependencyPathsFromManifest({
      pnpm: { patchedDependencies: { "better-auth@1.6.22": "patches/better-auth@1.6.22.patch" } },
    }),
    ["patches/better-auth@1.6.22.patch"],
  );
  assert.deepEqual(
    patchedDependencyPathsFromManifest({
      pnpm: {
        patchedDependencies: {
          "better-auth@1.6.22": { path: "patches/better-auth@1.6.22.patch", hash: "abc" },
        },
      },
    }),
    ["patches/better-auth@1.6.22.patch"],
  );
});

test("installing Dockerfiles that copy the root manifest must copy patches", () => {
  const patchPaths = ["patches/better-auth@1.6.22.patch"];
  assert.deepEqual(
    verifyDockerfilePatchedDependencies(
      `COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
`,
      patchPaths,
    ),
    ["missing COPY for patched dependency patches/better-auth@1.6.22.patch"],
  );
  assert.deepEqual(
    verifyDockerfilePatchedDependencies(
      `COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
`,
      patchPaths,
    ),
    [],
  );
  assert.deepEqual(
    verifyDockerfilePatchedDependencies(
      `COPY . .
RUN pnpm install --frozen-lockfile
`,
      patchPaths,
    ),
    [],
  );
  assert.deepEqual(
    verifyDockerfilePatchedDependencies(
      `FROM nginx:alpine
COPY apps/event/dist /usr/share/nginx/html
`,
      patchPaths,
    ),
    [],
  );
});

test("repository Dockerfiles include every root patchedDependencies path", () => {
  assert.deepEqual(verifyRepositoryDockerPatchedDependencies(root), []);
});
