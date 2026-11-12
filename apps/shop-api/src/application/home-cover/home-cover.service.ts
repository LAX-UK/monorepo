import { assembleCoverAnalysis } from "@auction/domain";
import type { AdminHomeCoverIssue, AdminHomeCoverPictureCandidate } from "@auction/shop-contracts";
import { HOME_COVER_EDIT_CAPABILITY } from "@auction/shop-domain";
import type { UnitPoint } from "@auction/types";
import { HomeCoverRejectedError } from "../../errors/home-cover-rejected-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import type {
  HomeCoverMeasuring,
  HomeCoverPictures,
  HomeCoverReader,
  HomeCoverRecord,
  HomeCoverUnitOfWork,
  StoredHomeCover,
} from "./home-cover.ports.js";
import {
  HOME_COVER_MEASURED_SIZES,
  homeCoverCanCarryType,
  homeCoverInputIssues,
  homeCoverSide,
} from "./home-cover.rules.js";

export type SaveHomeCoverCommand = {
  mediaKey: string;
  alt: string;
  focal: UnitPoint;
  actorSubjectId: string;
  idempotencyKey: string;
};

export type ClearHomeCoverCommand = {
  actorSubjectId: string;
  idempotencyKey: string;
};

const round3 = (value: number) => Math.round(value * 1000) / 1000;

function reject(...issues: AdminHomeCoverIssue[]): never {
  throw new HomeCoverRejectedError(issues);
}

/**
 * The picture that leads the Shop home's first screen. Reading is open. A save checks the words
 * and the picture's size, reads the picture and measures it (the colours and the scrim that keep
 * the headline readable), and refuses a picture the type cannot be read on, so what is published
 * is always something that was checked. It is applied at once, audited with the picture before and
 * after, and replayed for a repeated idempotency key. Removing it returns the home to its newest
 * edition.
 */
export function createHomeCoverService(deps: {
  uow: HomeCoverUnitOfWork;
  reader: HomeCoverReader;
  pictures: HomeCoverPictures;
  measuring: HomeCoverMeasuring;
  clock: { now(): Date };
}) {
  async function measure(command: SaveHomeCoverCommand): Promise<HomeCoverRecord> {
    const bytes = await deps.pictures.load(command.mediaKey);
    if (!bytes) return reject({ field: "mediaKey", reason: "picture_unknown" });

    let width: number;
    let height: number;
    try {
      ({ width, height } = await deps.measuring.probe.analyze(bytes));
    } catch {
      return reject({ field: "mediaKey", reason: "picture_unreadable" });
    }

    const found = homeCoverInputIssues({ alt: command.alt, width });
    if (found.length > 0) {
      return reject(
        ...found.map((reason) => ({
          field: reason === "alt_missing" ? ("alt" as const) : ("mediaKey" as const),
          reason,
        })),
      );
    }

    const focal = { x: round3(command.focal.x), y: round3(command.focal.y) };
    const side = homeCoverSide(focal);
    let analysis: ReturnType<typeof assembleCoverAnalysis>;
    try {
      const measurements = await deps.measuring.analyser.measure({
        bytes,
        focal,
        zoom: 1,
        textSide: side,
        breakpoints: HOME_COVER_MEASURED_SIZES,
      });
      analysis = assembleCoverAnalysis(measurements, side);
    } catch {
      return reject({ field: "mediaKey", reason: "picture_unreadable" });
    }
    if (!homeCoverCanCarryType(analysis)) {
      return reject({ field: "mediaKey", reason: "picture_cannot_carry_type" });
    }
    return {
      mediaKey: command.mediaKey,
      width,
      height,
      blurDataUrl: analysis.blurDataURL,
      focal,
      alt: command.alt.trim(),
      analysis,
    };
  }

  const summary = (cover: StoredHomeCover | null) =>
    cover ? { mediaKey: cover.mediaKey, alt: cover.alt, focal: cover.focal } : {};

  return {
    read(): Promise<StoredHomeCover | null> {
      return deps.reader.read();
    },

    searchPictures(query: { q?: string; limit: number }): Promise<
      AdminHomeCoverPictureCandidate[]
    > {
      return deps.pictures.search(query);
    },

    async save(command: SaveHomeCoverCommand): Promise<StoredHomeCover> {
      // The picture is read before the transaction so no database work waits on image work.
      const record = await measure(command);
      return deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "home_cover.save",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: { mediaKey: command.mediaKey, alt: command.alt, focal: command.focal },
          run: async () => {
            const at = deps.clock.now();
            await tx.store.lock();
            const before = await tx.store.read();
            await tx.store.save(record, command.actorSubjectId, at);
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: HOME_COVER_EDIT_CAPABILITY,
              action: "home_cover.save",
              targetType: "shop_home_cover",
              targetId: "home",
              beforeJson: summary(before),
              afterJson: summary({ ...record, updatedAt: at.toISOString() }),
            });
            const saved = await tx.store.read();
            if (!saved) throw new Error("home cover missing after save");
            return saved;
          },
        }),
      );
    },

    clear(command: ClearHomeCoverCommand): Promise<null> {
      return deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "home_cover.clear",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: {},
          run: async () => {
            await tx.store.lock();
            const before = await tx.store.read();
            await tx.store.clear();
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: HOME_COVER_EDIT_CAPABILITY,
              action: "home_cover.clear",
              targetType: "shop_home_cover",
              targetId: "home",
              beforeJson: summary(before),
              afterJson: {},
            });
            return null;
          },
        }),
      );
    },
  };
}

export type HomeCoverService = ReturnType<typeof createHomeCoverService>;
