import pino from "pino";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import type { IMediaAssetProcessorRepository } from "../interfaces/media-asset-processor.repository.js";
import { SharpImageProcessor } from "../lib/sharp-image-processor.js";
import { measureExternalPicturesJob } from "./measure-external-pictures.js";

const log = pino({ level: "silent" });

describe("measureExternalPicturesJob", () => {
  it("stores the size of each readable picture under its address and remembers the failures", async () => {
    const bytes = await sharp({
      create: { width: 40, height: 30, channels: 3, background: "#336699" },
    })
      .png()
      .toBuffer();
    const upsertProcessed = vi.fn(async () => undefined);
    const listUnmeasuredExternalLotPictures = vi.fn(async () => [
      "https://images.example.com/ok.png",
      "https://images.example.com/gone.png",
    ]);
    const repo: IMediaAssetProcessorRepository = {
      upsertProcessed,
      listUnmeasuredExternalLotPictures,
    };
    const failed = new Set<string>();
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith("ok.png")
        ? new Response(new Uint8Array(bytes))
        : new Response("missing", { status: 404 }),
    );

    const result = await measureExternalPicturesJob({
      repo,
      processor: new SharpImageProcessor(),
      log,
      failed,
      fetching: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        resolveHost: async () => ["151.101.1.1"],
      },
    });

    expect(result).toEqual({ measured: 1, failed: 1 });
    expect(upsertProcessed).toHaveBeenCalledWith(
      expect.objectContaining({ key: "https://images.example.com/ok.png", width: 40, height: 30 }),
    );
    expect([...failed]).toEqual(["https://images.example.com/gone.png"]);

    expect(listUnmeasuredExternalLotPictures).toHaveBeenCalledWith(10, []);
  });
});
