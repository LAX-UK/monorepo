import assert from "node:assert/strict";
import test from "node:test";
import { describeRejection } from "./http-diagnostics.mjs";

test("reports both retry header spellings and a compact body", async () => {
  const response = new Response('{\n  "message": "Too many requests"\n}', {
    status: 429,
    headers: { "Retry-After": "900", "X-Retry-After": "10" },
  });

  assert.equal(
    await describeRejection(response),
    'status=429 retry-after=900 x-retry-after=10 body="{ \\"message\\": \\"Too many requests\\" }"',
  );
});

test("bounds a rejection body and reports absent retry headers", async () => {
  const response = new Response("abcdefgh", { status: 403 });

  assert.equal(
    await describeRejection(response, 5),
    'status=403 retry-after=(none) x-retry-after=(none) body="abcde…"',
  );
});
