import {
  CONSIGNOR_CHANGE_REASON_MAX,
  type Consignor,
  type ConsignorLink,
} from "@auction/artwork-register-contracts";
import type {
  AdminArtworkConsignor,
  AdminConsignor,
  AdminConsignorChange,
} from "@auction/shop-contracts";
import type { ShopStaffCapability } from "@auction/shop-domain";
import { FieldValidationError } from "../../errors/field-validation-error.js";
import { notFound } from "../../errors/shop-api-error.js";
import { StaleVersionError } from "../../errors/stale-version-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import type {
  ArtworkConsignorReads,
  ArtworkConsignorWritesFor,
} from "../ports/artwork-consignor.ports.js";
import type { ShopUnitOfWorkFactory } from "../ports/shop-unit-of-work.js";
import type { StaffNameReader } from "../ports/staff-name.reader.js";
import { presentAgreement } from "./consignor-agreement.service.js";

const MANAGE: ShopStaffCapability = "consignor_agreement.manage";
const STAFF_PREFIX = "staff:";

/** How many consignor changes the record shows; older ones are counted as "more". */
export const CONSIGNOR_HISTORY_LIMIT = 20;

/** What a 409 says when the consignor changed after the page read it and none was set then. */
const NONE_SET = "none";

export type ArtworkConsignorServiceDeps = {
  uow: ShopUnitOfWorkFactory;
  reads: ArtworkConsignorReads;
  writesFor: ArtworkConsignorWritesFor;
  /** Who set each consignor, by name; a person without one reads as LAX staff on the page. */
  staffNames: StaffNameReader;
  clock?: () => Date;
};

type Actor = { actorSubjectId: string; idempotencyKey: string };

const staffSubject = (actor: string) =>
  actor.startsWith(STAFF_PREFIX) ? actor.slice(STAFF_PREFIX.length) : null;

const partyOf = (consignor: Consignor) => (consignor.kind === "client" ? consignor.partyId : null);

/** What an audit row keeps of a consignor: the kind and the client, and whether a reason was given. */
const auditView = (link: ConsignorLink) => ({
  consignor: link.consignor.kind,
  partyId: partyOf(link.consignor),
  withReason: link.changeReason !== null,
});

/** The reason as the store reads it: trimmed, empty as none, refused past the limit. */
function reasonOrRefuse(reason: string | null | undefined): string | null {
  const trimmed = reason?.trim() || null;
  if (trimmed !== null && [...trimmed].length > CONSIGNOR_CHANGE_REASON_MAX) {
    throw new FieldValidationError([
      {
        field: "reason",
        message: `Keep the reason to ${CONSIGNOR_CHANGE_REASON_MAX} characters or fewer.`,
      },
    ]);
  }
  return trimmed;
}

/**
 * The Consignor field on a From Zoho record (ZI-5, decision pack 17 November 2026, section 1,
 * option B): who consigned an original, a client or LAX itself, with the agreements of a client
 * consignor so the record can say whether one is in force. Set once; every change after the first
 * needs a reason and is kept in the history. Each write runs in one unit of work with its
 * idempotency record and its audit row. The routes check the capabilities and the recent sign-in.
 */
export function createArtworkConsignorService(deps: ArtworkConsignorServiceDeps) {
  const now = deps.clock ?? (() => new Date());

  function presentConsignor(
    consignor: Consignor,
    names: ReadonlyMap<string, string>,
  ): AdminConsignor {
    if (consignor.kind === "lax") return { kind: "lax" };
    return {
      kind: "client",
      partyId: consignor.partyId,
      displayName: names.get(consignor.partyId) ?? "Unknown client",
    };
  }

  function presentChange(
    link: ConsignorLink,
    parties: ReadonlyMap<string, string>,
    staff: ReadonlyMap<string, string>,
  ): AdminConsignorChange {
    const subject = staffSubject(link.setBy);
    return {
      id: link.id,
      consignor: presentConsignor(link.consignor, parties),
      changeReason: link.changeReason,
      setAt: link.setAt.toISOString(),
      setByName: subject ? (staff.get(subject) ?? null) : null,
    };
  }

  /** The artwork's consignor now, its history and its agreements; null when it is not on the register. */
  async function get(registerId: string): Promise<AdminArtworkConsignor | null> {
    if (!(await deps.reads.artworkExists(registerId))) return null;
    // One more than is shown, to know whether older changes exist.
    const changes = await deps.reads.listChanges(registerId, CONSIGNOR_HISTORY_LIMIT + 1);
    const shown = changes.slice(0, CONSIGNOR_HISTORY_LIMIT);
    const current = shown[0] ?? null;
    const currentParty = current ? partyOf(current.consignor) : null;
    const partyIds = [...new Set(shown.flatMap((link) => partyOf(link.consignor) ?? []))];
    const staffIds = [...new Set(shown.flatMap((link) => staffSubject(link.setBy) ?? []))];
    const [parties, staff, agreements] = await Promise.all([
      deps.reads.partyNames(partyIds),
      deps.staffNames.namesFor(staffIds),
      currentParty ? deps.reads.currentAgreements(currentParty) : Promise.resolve([]),
    ]);
    const history = shown.map((link) => presentChange(link, parties, staff));
    return {
      registerId,
      current: history[0] ?? null,
      history,
      moreHistory: changes.length > CONSIGNOR_HISTORY_LIMIT,
      agreements: agreements.map(presentAgreement),
    };
  }

  return {
    get,

    /**
     * Sets or changes who consigned the artwork. Setting the consignor it already has records
     * nothing. A change made against a consignor someone changed since is refused with 409.
     */
    async set(
      command: Actor & {
        registerId: string;
        consignor: Consignor;
        reason?: string | null | undefined;
        expectedCurrentId?: string | null | undefined;
      },
    ): Promise<AdminArtworkConsignor> {
      const reason = reasonOrRefuse(command.reason);
      await deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "artwork_consignor.set",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: {
            registerId: command.registerId,
            consignor: command.consignor,
            reason,
            expectedCurrentId: command.expectedCurrentId ?? null,
          },
          run: async () => {
            const result = await deps.writesFor(tx).setConsignor({
              registerId: command.registerId,
              consignor: command.consignor,
              reason,
              ...(command.expectedCurrentId !== undefined
                ? { expectedCurrentId: command.expectedCurrentId }
                : {}),
              actor: `staff:${command.actorSubjectId}`,
              now: now(),
            });
            if (!result.ok) {
              switch (result.reason) {
                case "artwork_not_found":
                  throw notFound("Artwork");
                case "party_not_found":
                  throw new FieldValidationError([
                    { field: "client", message: "Choose a client from the list." },
                  ]);
                case "reason_required":
                  throw new FieldValidationError([
                    { field: "reason", message: "Say why the consignor is changing." },
                  ]);
                case "reason_too_long":
                  throw new FieldValidationError([
                    {
                      field: "reason",
                      message: `Keep the reason to ${CONSIGNOR_CHANGE_REASON_MAX} characters or fewer.`,
                    },
                  ]);
                case "stale":
                  throw new StaleVersionError("The consignor", result.current?.id ?? NONE_SET);
              }
            }
            if (result.changed) {
              const before = result.previous;
              await tx.audit.append({
                actorSubjectId: command.actorSubjectId,
                capability: MANAGE,
                action: "artwork_consignor.set",
                targetType: "artwork_register",
                targetId: command.registerId,
                ...(before ? { beforeJson: auditView(before) } : {}),
                afterJson: auditView(result.link),
              });
            }
            return { linkId: result.link.id, changed: result.changed };
          },
        }),
      );
      const updated = await get(command.registerId);
      if (!updated) throw notFound("Artwork");
      return updated;
    },
  };
}

export type ArtworkConsignorService = ReturnType<typeof createArtworkConsignorService>;
