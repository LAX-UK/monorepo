import type { FramingOption } from "@auction/shop-contracts";
import type { FramingPrices } from "@auction/shop-domain";
import type {
  FramingOptionFields,
  FramingTx,
  StoredFramingOption,
} from "../application/framing/framing.ports.js";
import { createFramingService } from "../application/framing/framing.service.js";
import type { ShopAdminAuditRecord } from "../application/ports/shop-admin-audit.writer.js";
import { notFound } from "../errors/shop-api-error.js";

export const OAK_PRICES: FramingPrices = {
  up_to_40x50: 14000,
  up_to_60x80: 22500,
  up_to_80x100: 29500,
};

/** An option as the catalogue holds it when a test starts: a draft with a placeholder in every band. */
export function seededOption(
  overrides: Partial<StoredFramingOption> & { id: string },
): StoredFramingOption {
  return {
    code: "natural-oak",
    name: "Natural oak frame",
    frame: "natural_oak",
    mount: "window_conservation",
    glazing: "uv_acrylic",
    hanging: "d_rings_cord",
    leadTimeMinDays: 10,
    leadTimeMaxDays: 15,
    pricesPence: OAK_PRICES,
    status: "draft",
    placeholderBands: ["up_to_40x50", "up_to_60x80", "up_to_80x100"],
    updatedAt: new Date("2026-11-01T09:00:00.000Z"),
    ...overrides,
  };
}

/**
 * The framing catalogue over one in-memory store: options, the audit trail and replayable
 * commands. The real service runs on top, so tests exercise its rules.
 */
export function createInMemoryFraming(
  options: {
    options?: StoredFramingOption[];
    editions?: Record<string, number>;
    now?: () => Date;
  } = {},
) {
  const stored = new Map((options.options ?? []).map((option) => [option.id, option]));
  const editions = options.editions ?? {};
  const audit: ShopAdminAuditRecord[] = [];
  const completed = new Map<string, unknown>();
  const now = options.now ?? (() => new Date("2026-11-02T12:00:00.000Z"));
  let nextId = 1;

  const present = (option: StoredFramingOption): FramingOption => {
    const { updatedAt, ...rest } = option;
    return { ...rest, editionCount: editions[option.id] ?? 0, version: updatedAt.toISOString() };
  };
  const list = async () => ({ items: [...stored.values()].map(present) });

  const tx: FramingTx = {
    framing: {
      lock: async (id) => stored.get(id) ?? null,
      lockCodes: async () => {},
      codeTaken: async (code) => [...stored.values()].some((option) => option.code === code),
      insert: async (code, fields: FramingOptionFields) => {
        const id = `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;
        stored.set(id, { id, code, ...fields, updatedAt: now() });
        return { id };
      },
      update: async (id, fields) => {
        const current = stored.get(id);
        if (!current) throw notFound("Framing option not found");
        stored.set(id, { ...current, ...fields, updatedAt: now() });
      },
      get: async (id) => {
        const option = stored.get(id);
        if (!option) throw notFound("Framing option not found");
        return present(option);
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

  const service = createFramingService({ uow: { run: (fn) => fn(tx) }, lists: { list } });
  return { service, stored, audit };
}
