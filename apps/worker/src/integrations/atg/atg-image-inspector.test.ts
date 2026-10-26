import { describe, expect, it } from "vitest";
import {
  ATG_MAX_IMAGE_BYTES,
  HttpAtgImageInspector,
  atgImageProblem,
} from "./atg-image-inspector.js";

describe("atgImageProblem", () => {
  it("accepts JPGs under 10 MB", () => {
    expect(
      atgImageProblem({ contentType: "image/jpeg", bytes: ATG_MAX_IMAGE_BYTES - 1, error: null }),
    ).toBeNull();
  });

  it.each([
    [{ contentType: "image/webp", bytes: 1_000, error: null }, "must be a JPG (is image/webp)"],
    [{ contentType: null, bytes: 1_000, error: null }, "must be a JPG (is an unknown type)"],
    [{ contentType: "image/jpeg", bytes: null, error: null }, "has an unknown size"],
    [
      { contentType: "image/jpeg", bytes: ATG_MAX_IMAGE_BYTES, error: null },
      "must be under 10 MB (is 10.0 MB)",
    ],
    [{ contentType: null, bytes: null, error: "HTTP 404" }, "couldn't be checked (HTTP 404)"],
  ])("rejects %j", (facts, problem) => {
    expect(atgImageProblem(facts)).toBe(problem);
  });
});

describe("HttpAtgImageInspector", () => {
  const inspector = (respond: () => Promise<Response>) =>
    new HttpAtgImageInspector(1_000, (async () => respond()) as typeof fetch);

  it("reads type and size from a HEAD response", async () => {
    const facts = await inspector(
      async () =>
        new Response(null, {
          headers: { "content-type": "image/jpeg; charset=binary", "content-length": "2048" },
        }),
    ).inspect("https://media.example/a.jpg");

    expect(facts).toEqual({ contentType: "image/jpeg", bytes: 2048, error: null });
  });

  it("reports failed responses and network errors instead of throwing", async () => {
    expect(
      await inspector(async () => new Response(null, { status: 403 })).inspect("https://x/a.jpg"),
    ).toMatchObject({ error: "HTTP 403" });
    expect(
      await inspector(async () => {
        throw new TypeError("fetch failed");
      }).inspect("https://x/a.jpg"),
    ).toMatchObject({ error: "TypeError" });
  });
});
