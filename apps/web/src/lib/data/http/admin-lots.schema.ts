import type {
  AdminLotLifecyclePayload,
  AdminLotLifecycleSummary,
  AdminLotListRow,
  AdminLotPickerRow,
  LotArtistBackfillReviewTask,
  LotDeleteEligibility,
  LotWithdrawalRequestTask,
} from "@/lib/data/http/admin-lots.types";
import { lotSchema } from "@/lib/data/http/lot.schema";
import { isIndexableObject, toObjectRecord } from "@/lib/data/http/object-guards";
import { zCoerceDate, zNullableStringFromEmpty } from "@/lib/data/http/schema-coerce";
import { z } from "zod";

export const lotDeleteEligibilitySchema = z
  .preprocess((raw) => raw, z.unknown())
  .transform((raw): LotDeleteEligibility | null => {
    if (!isIndexableObject(raw)) return null;
    const blockers = Array.isArray(raw.blockers) ? raw.blockers.map(String) : [];
    return {
      canDelete: raw.canDelete === true,
      confirmationPhrase: zNullableStringFromEmpty.parse(raw.confirmationPhrase),
      blockers,
    };
  });

const adminLotLifecycleSummarySchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminLotLifecycleSummary | undefined => {
    if (typeof row.lastEventType !== "string" || typeof row.lastEventAt !== "string") {
      return undefined;
    }
    return {
      lastEventType: row.lastEventType,
      lastEventAt: row.lastEventAt,
      returnCount: Number(row.returnCount ?? 0),
    };
  });

export const adminLotListRowSchema = z
  .preprocess((raw) => raw, z.unknown())
  .transform((raw): AdminLotListRow => {
    const row = isIndexableObject(raw) ? raw : {};
    const lot = lotSchema.parse(raw);
    const lifecycleSummary = adminLotLifecycleSummarySchema.parse(row.lifecycleSummary);
    const deleteEligibility = lotDeleteEligibilitySchema.parse(row.deleteEligibility);
    const connectRequired =
      row.connectRequired === true ? true : row.connectRequired === false ? false : undefined;
    return {
      ...lot,
      ...(lifecycleSummary ? { lifecycleSummary } : {}),
      ...(deleteEligibility != null ? { deleteEligibility } : {}),
      ...(connectRequired !== undefined ? { connectRequired } : {}),
    };
  }) as z.ZodType<AdminLotListRow>;

export const adminLotListRowsSchema = z.array(adminLotListRowSchema) as z.ZodType<
  AdminLotListRow[]
>;

const adminLotDetailPayloadSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row) => {
    const deleteEligibility = lotDeleteEligibilitySchema.parse(row.deleteEligibility);
    const { deleteEligibility: _omit, ...lotRaw } = row;
    return {
      auction: lotSchema.parse(lotRaw),
      deleteEligibility,
    };
  });

export const adminLotDetailEnvelopeSchema = adminLotDetailPayloadSchema as z.ZodType<{
  auction: import("@auction/types").Lot;
  deleteEligibility: LotDeleteEligibility | null;
}>;

const lotPickerLifecycleKinds = ["new_draft", "returned"] as const;

export const adminLotPickerRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminLotPickerRow => {
    const lifecycleRaw = isIndexableObject(row.lifecycle) ? row.lifecycle : {};
    const kindRaw = lifecycleRaw.kind;
    const kind =
      typeof kindRaw === "string" &&
      (lotPickerLifecycleKinds as readonly string[]).includes(kindRaw)
        ? (kindRaw as AdminLotPickerRow["lifecycle"]["kind"])
        : "new_draft";
    return {
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      lifecycle: {
        kind,
        returnedAt: zNullableStringFromEmpty.parse(lifecycleRaw.returnedAt),
        lastSaleId: zNullableStringFromEmpty.parse(lifecycleRaw.lastSaleId),
        lastSaleName: zNullableStringFromEmpty.parse(lifecycleRaw.lastSaleName),
        returnCount: Number(lifecycleRaw.returnCount ?? 0),
      },
    };
  });

export const adminLotPickerRowsSchema = z.array(adminLotPickerRowSchema) as z.ZodType<
  AdminLotPickerRow[]
>;

const adminLotLifecycleSnapshotSchema = z
  .preprocess((raw) => raw, z.unknown())
  .transform((raw) => {
    if (!isIndexableObject(raw)) return null;
    return {
      currentStatus: String(raw.currentStatus ?? ""),
      lastEventType: String(raw.lastEventType ?? ""),
      lastEventAt: String(raw.lastEventAt ?? ""),
      lastSaleId: zNullableStringFromEmpty.parse(raw.lastSaleId),
      returnCount: Number(raw.returnCount ?? 0),
    };
  });

const adminLotLifecycleEventSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row) => ({
    eventType: String(row.eventType ?? ""),
    occurredAt: String(row.occurredAt ?? ""),
    saleTitle: row.saleTitle == null ? null : String(row.saleTitle),
  }));

export const adminLotLifecyclePayloadSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(
    (row): AdminLotLifecyclePayload => ({
      snapshot: adminLotLifecycleSnapshotSchema.parse(row.snapshot),
      events: z.array(adminLotLifecycleEventSchema).parse(row.events),
    }),
  ) as z.ZodType<AdminLotLifecyclePayload>;

const adminLotTaskRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row) => ({
    id: String(row.id ?? ""),
    kind: String(row.kind ?? ""),
    status: String(row.status ?? ""),
    targetLotId: row.targetLotId == null ? null : String(row.targetLotId),
    payload: isIndexableObject(row.payload) ? row.payload : {},
    createdAt: zCoerceDate.parse(row.createdAt),
  }));

export const lotWithdrawalRequestTaskSchema = adminLotTaskRowSchema.transform(
  (row): LotWithdrawalRequestTask => row,
);

export const lotArtistBackfillReviewTaskSchema = adminLotTaskRowSchema.transform(
  (row): LotArtistBackfillReviewTask => row,
);

export const lotWithdrawalRequestTasksSchema = z.array(lotWithdrawalRequestTaskSchema) as z.ZodType<
  LotWithdrawalRequestTask[]
>;
export const lotArtistBackfillReviewTasksSchema = z.array(
  lotArtistBackfillReviewTaskSchema,
) as z.ZodType<LotArtistBackfillReviewTask[]>;

export function parseLotDeleteEligibility(raw: unknown): LotDeleteEligibility | null {
  return lotDeleteEligibilitySchema.parse(raw);
}

type _AdminLotListRowInfer = z.infer<typeof adminLotListRowSchema>;
const _adminLotListRowGuard = null as unknown as _AdminLotListRowInfer satisfies AdminLotListRow;
void _adminLotListRowGuard;
