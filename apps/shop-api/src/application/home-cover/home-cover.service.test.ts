import { describe, expect, it } from "vitest";
import { HomeCoverRejectedError } from "../../errors/home-cover-rejected-error.js";
import {
  BUSY_MID_ZONES,
  WIDE_PICTURE,
  createInMemoryHomeCover,
} from "../../test-support/in-memory-home-cover.js";
import { HOME_COVER_MIN_WIDTH } from "./home-cover.rules.js";

const actor = { actorSubjectId: "staff-1", idempotencyKey: "key-1" };
const command = {
  mediaKey: "shop/artwork/a.jpg",
  alt: "A river at dusk",
  focal: { x: 0.7, y: 0.4 },
};

describe("HomeCoverService.save", () => {
  it("measures the picture for the side away from the subject and publishes it, audited", async () => {
    const { service, addPicture, audit, measured, state } = createInMemoryHomeCover();
    addPicture(command.mediaKey);

    const saved = await service.save({ ...actor, ...command });

    expect(measured).toHaveLength(1);
    expect(measured[0]).toMatchObject({
      focal: { x: 0.7, y: 0.4 },
      zoom: 1,
      textSide: "left",
      breakpoints: ["desktop", "wide"],
    });
    expect(saved).toMatchObject({
      mediaKey: command.mediaKey,
      width: WIDE_PICTURE.width,
      height: WIDE_PICTURE.height,
      alt: "A river at dusk",
      focal: { x: 0.7, y: 0.4 },
    });
    expect(state.saved).toEqual(saved);
    expect(audit).toEqual([
      {
        actorSubjectId: "staff-1",
        capability: "editorial.publish",
        action: "home_cover.save",
        targetType: "shop_home_cover",
        targetId: "home",
        beforeJson: {},
        afterJson: { mediaKey: command.mediaKey, alt: "A river at dusk", focal: command.focal },
      },
    ]);
  });

  it("records what the cover was before in the audit when it is replaced", async () => {
    const { service, addPicture, audit } = createInMemoryHomeCover();
    addPicture("shop/artwork/a.jpg");
    addPicture("shop/artwork/b.jpg");
    await service.save({ ...actor, ...command });
    await service.save({
      ...actor,
      idempotencyKey: "key-2",
      mediaKey: "shop/artwork/b.jpg",
      alt: "Another view",
      focal: { x: 0.3, y: 0.5 },
    });
    expect(audit[1]?.beforeJson).toEqual({
      mediaKey: "shop/artwork/a.jpg",
      alt: "A river at dusk",
      focal: command.focal,
    });
  });

  it("trims the alt text and rounds the focal point", async () => {
    const { service, addPicture } = createInMemoryHomeCover();
    addPicture(command.mediaKey);
    const saved = await service.save({
      ...actor,
      ...command,
      alt: "  A river at dusk  ",
      focal: { x: 0.123456, y: 0.987654 },
    });
    expect(saved.alt).toBe("A river at dusk");
    expect(saved.focal).toEqual({ x: 0.123, y: 0.988 });
  });

  it("replays a repeated idempotency key without writing again", async () => {
    const { service, addPicture, audit } = createInMemoryHomeCover();
    addPicture(command.mediaKey);
    const first = await service.save({ ...actor, ...command });
    const second = await service.save({ ...actor, ...command });
    expect(second).toEqual(first);
    expect(audit).toHaveLength(1);
  });

  it("refuses a picture that is not one of the Shop's, writing nothing", async () => {
    const { service, audit, state } = createInMemoryHomeCover();
    const attempt = service.save({ ...actor, ...command });
    await expect(attempt).rejects.toBeInstanceOf(HomeCoverRejectedError);
    await expect(attempt).rejects.toMatchObject({
      statusCode: 400,
      issues: [{ field: "mediaKey", reason: "picture_unknown" }],
    });
    expect(state.saved).toBeNull();
    expect(audit).toEqual([]);
  });

  it("names every problem when the alt text is missing and the picture is too small", async () => {
    const { service, addPicture } = createInMemoryHomeCover();
    addPicture(command.mediaKey, { width: HOME_COVER_MIN_WIDTH - 1, height: 1000 });
    await expect(service.save({ ...actor, ...command, alt: " " })).rejects.toMatchObject({
      issues: [
        { field: "alt", reason: "alt_missing" },
        { field: "mediaKey", reason: "picture_too_narrow" },
      ],
    });
  });

  it("refuses a picture the headline cannot be read on, so nothing unreadable is published", async () => {
    const { service, addPicture, state } = createInMemoryHomeCover({ zones: BUSY_MID_ZONES });
    addPicture(command.mediaKey);
    await expect(service.save({ ...actor, ...command })).rejects.toMatchObject({
      issues: [{ field: "mediaKey", reason: "picture_cannot_carry_type" }],
    });
    expect(state.saved).toBeNull();
  });
});

describe("HomeCoverService.clear", () => {
  it("removes the cover, audited with what it was", async () => {
    const { service, addPicture, audit, state } = createInMemoryHomeCover();
    addPicture(command.mediaKey);
    await service.save({ ...actor, ...command });

    await service.clear({ ...actor, idempotencyKey: "key-2" });

    expect(state.saved).toBeNull();
    expect(audit[1]).toMatchObject({
      action: "home_cover.clear",
      beforeJson: { mediaKey: command.mediaKey },
      afterJson: {},
    });
  });

  it("is harmless when there is no cover", async () => {
    const { service, state } = createInMemoryHomeCover();
    await expect(service.clear(actor)).resolves.toBeNull();
    expect(state.saved).toBeNull();
  });
});
