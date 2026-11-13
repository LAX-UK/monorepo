import { describe, expect, it } from "vitest";
import { createShopApiApp } from "../../app.js";
import { createPublicHomeCoverReader } from "../../presenters/home-cover.presenter.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";
import { createInMemoryHomeCover } from "../../test-support/in-memory-home-cover.js";

async function appWith(homeCover: { read(): Promise<unknown> }) {
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      catalogue: { ...base.catalogue, homeCover: homeCover as never },
    }),
    logger: false,
  });
  await app.ready();
  return app;
}

describe("GET /v1/home-cover", () => {
  it("has no cover until staff choose one, and is never cached", async () => {
    const app = await appWith({ read: async () => ({ cover: null }) });
    const response = await app.inject({ method: "GET", url: "/v1/home-cover" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ cover: null });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("gives the chosen cover as the slot the shared cover reads", async () => {
    const harness = createInMemoryHomeCover();
    harness.addPicture("shop/artwork/a.jpg");
    await harness.service.save({
      actorSubjectId: "staff-1",
      idempotencyKey: "key-1",
      mediaKey: "shop/artwork/a.jpg",
      alt: "A river at dusk",
      focal: { x: 0.7, y: 0.4 },
    });
    const app = await appWith(
      createPublicHomeCoverReader(harness.service, (key) => `https://media.test/${key}`),
    );
    const response = await app.inject({ method: "GET", url: "/v1/home-cover" });
    expect(response.json().cover).toMatchObject({
      src: "https://media.test/shop/artwork/a.jpg",
      alt: "A river at dusk",
      analysisStatus: "ready",
      scrim: { desktop: { tone: "light" } },
    });
  });
});
