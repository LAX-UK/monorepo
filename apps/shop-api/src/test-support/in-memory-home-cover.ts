import type { CoverImageAnalyser } from "@auction/image-processing";
import type { CoverTextLine, CoverZoneSample } from "@auction/types";
import type {
  HomeCoverRecord,
  HomeCoverTx,
  StoredHomeCover,
} from "../application/home-cover/home-cover.ports.js";
import { createHomeCoverService } from "../application/home-cover/home-cover.service.js";
import type { ShopAdminAuditRecord } from "../application/ports/shop-admin-audit.writer.js";
import { createAdminHomeCoverPort } from "../presenters/home-cover.presenter.js";

const LINES: CoverTextLine[] = ["eyebrow", "title", "sub", "link", "credit"];

function zones(brightest: string, darkest: string): Record<CoverTextLine, CoverZoneSample> {
  return Object.fromEntries(LINES.map((line) => [line, { brightest, darkest }])) as Record<
    CoverTextLine,
    CoverZoneSample
  >;
}

/** What the analyser reports for a deep, even picture: white type reads easily on it. */
export const CALM_DARK_ZONES = zones("#1c1c22", "#101014");
/** A mid-grey picture with no calm area: neither tone reaches contrast. */
export const BUSY_MID_ZONES = zones("#ffffff", "#000000");

export const WIDE_PICTURE = { width: 3200, height: 1600 };

/**
 * The cover over one in-memory store: the pictures staff may use, the saved cover, the audit trail
 * and replayable commands. The real service and presenters run on top, so tests exercise the rules.
 */
export function createInMemoryHomeCover(
  options: { now?: Date; saved?: StoredHomeCover | null; zones?: ReturnType<typeof zones> } = {},
) {
  const state = { saved: options.saved ?? (null as StoredHomeCover | null) };
  const pictures = new Map<string, { bytes: Buffer; width: number; height: number }>();
  const audit: ShopAdminAuditRecord[] = [];
  const completed = new Map<string, unknown>();
  const locks: number[] = [];
  const measured: Parameters<CoverImageAnalyser["measure"]>[0][] = [];
  const now = options.now ?? new Date("2026-11-12T10:00:00.000Z");
  const sampled = { zones: options.zones ?? CALM_DARK_ZONES };

  const analyser: CoverImageAnalyser = {
    measure: async (request) => {
      measured.push(request);
      return {
        dominant: [24, 28, 40],
        deepest: [12, 14, 20],
        blurDataURL: "data:image/webp;base64,AAAA",
        zones: { desktop: sampled.zones, wide: sampled.zones },
      };
    },
  };

  const read = async () => state.saved;
  const tx: HomeCoverTx = {
    store: {
      read,
      lock: async () => {
        locks.push(1);
      },
      save: async (record: HomeCoverRecord, _actor, at) => {
        state.saved = { ...record, updatedAt: at.toISOString() };
      },
      clear: async () => {
        state.saved = null;
      },
    },
    audit: {
      append: async (record) => {
        audit.push(record);
      },
    },
    commands: {
      begin: async ({ idempotencyKey }) =>
        completed.has(idempotencyKey)
          ? { kind: "replay", result: completed.get(idempotencyKey) }
          : { kind: "started" },
      complete: async ({ idempotencyKey, result }) => {
        completed.set(idempotencyKey, result);
      },
    },
  };
  const service = createHomeCoverService({
    uow: { run: (fn) => fn(tx) },
    reader: { read },
    pictures: {
      load: async (key) => pictures.get(key)?.bytes ?? null,
      search: async () => [],
    },
    measuring: {
      analyser,
      probe: {
        analyze: async (bytes) => {
          const found = [...pictures.values()].find((picture) => picture.bytes === bytes);
          if (!found) throw new Error("unreadable");
          return { width: found.width, height: found.height };
        },
      },
    },
    clock: { now: () => now },
  });
  const addPicture = (key: string, size = WIDE_PICTURE) => {
    pictures.set(key, { bytes: Buffer.from(key), ...size });
  };
  const port = createAdminHomeCoverPort(service, (value) =>
    value ? `https://media.test/${value}` : null,
  );
  return { service, port, addPicture, audit, measured, locks, state, sampled };
}
