import { coverAnalysisHash } from "@auction/domain";
import type { SaleCoverSlot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type {
  CoverAnalysisOutcome,
  ICoverAnalysisJobRepository,
  PendingCoverSlot,
} from "../interfaces/cover-analysis-job.repository.js";
import type { CoverImageAnalyser } from "../lib/cover-image-analyser.js";
import { analyseSaleCoversJob } from "./analyse-sale-covers.js";

const log = { info: vi.fn(), warn: vi.fn() } as never;

function slot(key: string, overrides: Partial<SaleCoverSlot> = {}): SaleCoverSlot {
  const draft = {
    key,
    width: 3200,
    height: 1400,
    focal: { x: 0.7, y: 0.5 },
    zoom: 1,
    alt: "A harbour",
    ...overrides,
  };
  return { ...draft, analysisHash: coverAnalysisHash("default", draft) };
}

const zones = Object.fromEntries(
  ["eyebrow", "title", "sub", "link", "credit"].map((line) => [
    line,
    { brightest: "#303030", darkest: "#101010" },
  ]),
) as never;

function setup(pending: PendingCoverSlot[], objects: Record<string, Buffer | null>) {
  const saved: { hash: string; outcome: CoverAnalysisOutcome }[] = [];
  const repo: ICoverAnalysisJobRepository = {
    listPending: async () => pending,
    save: async (hash, outcome) => {
      saved.push({ hash, outcome });
    },
  };
  const storage = {
    headObject: vi.fn(async (key: string) => {
      const found = objects[key];
      return found ? { contentType: "image/jpeg", byteSize: found.byteLength, etag: "e" } : null;
    }),
    getObjectBytes: vi.fn(async (key: string) => objects[key] ?? null),
  } as never;
  const measure = vi.fn<CoverImageAnalyser["measure"]>(async () => ({
    dominant: [60, 50, 40],
    deepest: [20, 20, 20],
    blurDataURL: "data:image/jpeg;base64,AAAA",
    zones: { desktop: zones, wide: zones },
  }));
  return { saved, deps: { repo, storage, analyser: { measure }, log }, measure };
}

describe("analysing sale covers", () => {
  it("measures each pending slot and stores the solved scrim under its fingerprint", async () => {
    const stored = slot("uploads/cover.jpg");
    const { saved, deps, measure } = setup([{ saleId: "s1", name: "default", slot: stored }], {
      "uploads/cover.jpg": Buffer.from("bytes"),
    });
    const result = await analyseSaleCoversJob(deps);
    expect(result).toEqual({ ready: 1, failed: 0 });
    expect(saved).toHaveLength(1);
    expect(saved[0]?.hash).toBe(stored.analysisHash);
    const outcome = saved[0]?.outcome;
    expect(outcome?.status).toBe("ready");
    if (outcome?.status === "ready") {
      expect(outcome.analysis.breakpoints.desktop?.recommended).toBe("light");
      expect(outcome.analysis.field).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(measure.mock.calls[0]?.[0]).toMatchObject({
      textSide: "left",
      zoom: 1,
      breakpoints: ["desktop", "wide"],
    });
  });

  it("measures the wide slot at the wide size only and the phone slot at none", async () => {
    const wide = slot("uploads/wide.jpg");
    const phone = slot("uploads/phone.jpg");
    const { deps, measure } = setup(
      [
        { saleId: "s1", name: "wide", slot: wide },
        { saleId: "s1", name: "phone", slot: phone },
      ],
      { "uploads/wide.jpg": Buffer.from("w"), "uploads/phone.jpg": Buffer.from("p") },
    );
    await analyseSaleCoversJob(deps);
    expect(measure.mock.calls.map(([request]) => request.breakpoints)).toEqual([["wide"], []]);
  });

  it("uses the text side the slot asks for and a lot detail's pre-crop", async () => {
    const { key: _upload, ...withoutKey } = slot("ignored", { focal: { x: 0.2, y: 0.5 } });
    const detail: SaleCoverSlot = {
      ...withoutKey,
      fromLot: {
        lotId: "lot-1",
        imageKey: "uploads/lot.jpg",
        crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
      },
    };
    const { deps, measure } = setup([{ saleId: "s1", name: "default", slot: detail }], {
      "uploads/lot.jpg": Buffer.from("bytes"),
    });
    await analyseSaleCoversJob(deps);
    expect(measure.mock.calls[0]?.[0]).toMatchObject({
      textSide: "right",
      preCrop: { x: 0, y: 0, width: 0.5, height: 0.5 },
    });
  });

  it("records a missing picture as failed so it is not retried every minute", async () => {
    const stored = slot("uploads/gone.jpg");
    const { saved, deps, measure } = setup([{ saleId: "s1", name: "default", slot: stored }], {});
    expect(await analyseSaleCoversJob(deps)).toEqual({ ready: 0, failed: 1 });
    expect(saved).toEqual([{ hash: stored.analysisHash, outcome: { status: "failed" } }]);
    expect(measure).not.toHaveBeenCalled();
  });

  it("records a picture that cannot be decoded as failed and carries on with the rest", async () => {
    const bad = slot("uploads/bad.jpg");
    const good = slot("uploads/good.jpg", { focal: { x: 0.6, y: 0.5 } });
    const { saved, deps, measure } = setup(
      [
        { saleId: "s1", name: "default", slot: bad },
        { saleId: "s2", name: "default", slot: good },
      ],
      { "uploads/bad.jpg": Buffer.from("x"), "uploads/good.jpg": Buffer.from("y") },
    );
    measure.mockRejectedValueOnce(new Error("Input buffer contains unsupported image format"));
    expect(await analyseSaleCoversJob(deps)).toEqual({ ready: 1, failed: 1 });
    expect(saved.map((entry) => [entry.hash, entry.outcome.status])).toEqual([
      [bad.analysisHash, "failed"],
      [good.analysisHash, "ready"],
    ]);
  });

  it("lets a storage error stop the run so the queue tries again", async () => {
    const stored = slot("uploads/cover.jpg");
    const { saved, deps } = setup([{ saleId: "s1", name: "default", slot: stored }], {});
    (deps.storage as { headObject: unknown }).headObject = vi
      .fn()
      .mockRejectedValue(new Error("503"));
    await expect(analyseSaleCoversJob(deps)).rejects.toThrow("503");
    expect(saved).toEqual([]);
  });

  it("does nothing when nothing is pending", async () => {
    const { saved, deps } = setup([], {});
    expect(await analyseSaleCoversJob(deps)).toEqual({ ready: 0, failed: 0 });
    expect(saved).toEqual([]);
  });
});
