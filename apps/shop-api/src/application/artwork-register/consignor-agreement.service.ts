import {
  AGREEMENT_NOTE_MAX,
  type AgreementField,
  type AgreementIssue,
  type AgreementTerms,
  type AgreementTermsInput,
  type ConsignorAgreement,
  parseAgreementTerms,
} from "@auction/artwork-register-contracts";
import {
  type AdminConsignorAgreement,
  type AdminConsignorAgreementFileLink,
  type AdminConsignorAgreementFileUpload,
  type AdminConsignorAgreementList,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import type { ShopStaffCapability } from "@auction/shop-domain";
import { FieldValidationError } from "../../errors/field-validation-error.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { StaleVersionError } from "../../errors/stale-version-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import type {
  AgreementChange,
  AgreementFileRefusal,
  ConsignorAgreementFiles,
  ConsignorAgreementReads,
  ConsignorAgreementWritesFor,
} from "../ports/consignor-agreement.ports.js";
import type { ShopUnitOfWorkFactory } from "../ports/shop-unit-of-work.js";

const MANAGE: ShopStaffCapability = "consignor_agreement.manage";

type Actor = { actorSubjectId: string; idempotencyKey: string };

export type ConsignorAgreementServiceDeps = {
  uow: ShopUnitOfWorkFactory;
  reads: ConsignorAgreementReads;
  writesFor: ConsignorAgreementWritesFor;
  /** Null when object storage is not configured: files can be neither added nor opened. */
  files: ConsignorAgreementFiles | null;
  clock?: () => Date;
};

const iso = (date: Date) => date.toISOString();

export function presentAgreement(agreement: ConsignorAgreement): AdminConsignorAgreement {
  return {
    id: agreement.id,
    agreementId: agreement.agreementId,
    version: agreement.version,
    partyId: agreement.partyId,
    places: agreement.places,
    startsOn: agreement.startsOn,
    endsOn: agreement.endsOn,
    lowestPricePence: agreement.lowestPricePence,
    commissionBasisPoints: agreement.commissionBasisPoints,
    signedFileKey: agreement.signedFileKey,
    note: agreement.note,
    status: agreement.status,
    replacesId: agreement.replacesId,
    createdAt: iso(agreement.createdAt),
    replacedAt: agreement.replacedAt ? iso(agreement.replacedAt) : null,
    retiredAt: agreement.retiredAt ? iso(agreement.retiredAt) : null,
  };
}

/** What each refused field says, in the words the dialog shows beside it. */
const ISSUE_MESSAGES: Record<AgreementField, Record<string, string>> = {
  places: {
    required: "Choose at least one place.",
    unknown_place: "Choose from LAX Bid, lax.art and private sale.",
  },
  startsOn: { invalid_date: "Enter the day the agreement starts." },
  endsOn: {
    invalid_date: "Enter a real day, or leave it empty.",
    before_start: "The end date must be on or after the start date.",
  },
  lowestPricePence: { out_of_range: "Enter a lowest price above £0, or leave it empty." },
  commissionBasisPoints: {
    out_of_range: "Enter a commission from 0% to 100%, or leave it empty.",
  },
  signedFileKey: {
    required: "Upload the signed agreement.",
    invalid: "Upload the signed agreement again.",
  },
  note: { too_long: `Keep the note to ${AGREEMENT_NOTE_MAX} characters or fewer.` },
};

const FILE_REFUSALS: Record<AgreementFileRefusal, string> = {
  missing: "The upload did not finish. Upload the signed agreement again.",
  wrong_type: "Upload a PDF, JPEG or PNG file.",
  too_large: "Upload a file of 20 MB or less.",
  not_this_client: "Upload the signed agreement again.",
};

function issueOf(issue: AgreementIssue) {
  return {
    field: issue.field,
    message: ISSUE_MESSAGES[issue.field][issue.reason] ?? "Check this field.",
  };
}

/** The checked terms, or a 400 naming every field at fault so the dialog marks each one. */
function termsOrRefuse(input: AgreementTermsInput): AgreementTerms {
  const parsed = parseAgreementTerms(input);
  if (parsed.ok) return parsed.value;
  const [first, ...rest] = parsed.issues.map(issueOf);
  if (!first) throw new Error("parseAgreementTerms refused with no issue");
  throw new FieldValidationError([first, ...rest]);
}

const filesNotConfigured = () =>
  new ShopApiError(
    SHOP_API_ERROR_CODES.POLICY_NOT_CONFIGURED,
    "File storage is not set up, so signed agreements cannot be added or opened.",
    503,
  );

/**
 * What an audit row keeps of an agreement: the terms and where the file is, not the note's text,
 * which can name people and prices beyond the terms.
 */
const auditView = (agreement: ConsignorAgreement) => ({
  partyId: agreement.partyId,
  agreementId: agreement.agreementId,
  version: agreement.version,
  status: agreement.status,
  places: agreement.places,
  startsOn: agreement.startsOn,
  endsOn: agreement.endsOn,
  lowestPricePence: agreement.lowestPricePence,
  commissionBasisPoints: agreement.commissionBasisPoints,
  signedFileKey: agreement.signedFileKey,
  withNote: agreement.note !== null,
});

/** The file name a downloaded agreement is saved under. */
function downloadName(agreement: ConsignorAgreement): string {
  const extension = agreement.signedFileKey.split(".").pop()?.toLowerCase() ?? "pdf";
  return `Consignor agreement v${agreement.version}.${extension}`;
}

/**
 * Consignor agreements on a client's page in LAX Admin (ZI-5, decision pack 17 November 2026,
 * section 1, option B). An agreement is added, replaced by a new version (never edited in place)
 * or retired. Every write runs in one unit of work with its idempotency record and its audit row,
 * and the store's own transaction nests inside it, so a change never commits without its audit
 * row. The routes check the capability, the client and the recent sign-in.
 */
export function createConsignorAgreementService(deps: ConsignorAgreementServiceDeps) {
  const now = deps.clock ?? (() => new Date());

  /** The agreement's versions, when it is this client's; 404 otherwise. */
  async function versionsOf(partyId: string, agreementId: string) {
    const versions = await deps.reads.listVersions(agreementId);
    const latest = versions.at(-1);
    if (!latest || latest.partyId !== partyId) throw notFound("Agreement not found");
    return latest;
  }

  /** A file of the client's, checked before any lock is taken. */
  async function checkFile(partyId: string, key: string) {
    if (!deps.files) throw filesNotConfigured();
    const checked = await deps.files.check({ partyId, key });
    if (!checked.ok) {
      throw new FieldValidationError([
        { field: "signedFileKey", message: FILE_REFUSALS[checked.reason] },
      ]);
    }
  }

  function refuseChange(result: Exclude<AgreementChange, { ok: true }>, version: number): never {
    switch (result.reason) {
      case "not_found":
        throw notFound("Agreement not found");
      case "not_current":
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.CONFLICT,
          "This agreement has been retired, so it cannot be changed.",
          409,
        );
      case "stale":
        throw new StaleVersionError("This agreement", String(version));
    }
  }

  return {
    /** The client's agreements, or null when there is no such client. */
    async list(partyId: string): Promise<AdminConsignorAgreementList | null> {
      const party = await deps.reads.consignorParty(partyId);
      if (!party) return null;
      const items = await deps.reads.listAgreements(partyId);
      return { party, items: items.map(presentAgreement) };
    },

    /** Where to upload a signed agreement for the client. */
    async createFileUpload(input: {
      partyId: string;
      contentType: string;
      byteSize: number;
    }): Promise<AdminConsignorAgreementFileUpload> {
      if (!deps.files) throw filesNotConfigured();
      if (!(await deps.reads.consignorParty(input.partyId))) throw notFound("Client not found");
      return deps.files.createUpload(input);
    },

    /** A short-lived link to one version's signed file. */
    async fileLink(input: {
      partyId: string;
      versionId: string;
    }): Promise<AdminConsignorAgreementFileLink> {
      if (!deps.files) throw filesNotConfigured();
      const version = await deps.reads.findAgreementVersion(input.versionId);
      if (!version || version.partyId !== input.partyId) throw notFound("Agreement not found");
      const link = await deps.files.downloadLink({
        key: version.signedFileKey,
        fileName: downloadName(version),
      });
      return { url: link.url, expiresAt: iso(link.expiresAt) };
    },

    async add(
      command: Actor & { partyId: string; terms: AgreementTermsInput },
    ): Promise<AdminConsignorAgreement> {
      const terms = termsOrRefuse(command.terms);
      await checkFile(command.partyId, terms.signedFileKey);
      return deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "consignor_agreement.add",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: { partyId: command.partyId, terms },
          run: async () => {
            const result = await deps.writesFor(tx).addAgreement({
              partyId: command.partyId,
              terms,
              actor: `staff:${command.actorSubjectId}`,
              now: now(),
            });
            if (!result.ok) throw notFound("Client not found");
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: MANAGE,
              action: "consignor_agreement.add",
              targetType: "consignor_agreement",
              targetId: result.agreement.agreementId,
              afterJson: auditView(result.agreement),
            });
            return presentAgreement(result.agreement);
          },
        }),
      );
    },

    /** Adds the next version with new terms; the version staff were looking at is replaced. */
    async replace(
      command: Actor & {
        partyId: string;
        agreementId: string;
        expectedVersion: number;
        terms: AgreementTermsInput;
      },
    ): Promise<AdminConsignorAgreement> {
      const terms = termsOrRefuse(command.terms);
      const latest = await versionsOf(command.partyId, command.agreementId);
      // Keeping the file the agreement already has needs no new upload.
      if (terms.signedFileKey !== latest.signedFileKey) {
        await checkFile(command.partyId, terms.signedFileKey);
      }
      return deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "consignor_agreement.replace",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: {
            agreementId: command.agreementId,
            expectedVersion: command.expectedVersion,
            terms,
          },
          run: async () => {
            const result = await deps.writesFor(tx).replaceAgreement({
              agreementId: command.agreementId,
              expectedVersion: command.expectedVersion,
              terms,
              actor: `staff:${command.actorSubjectId}`,
              now: now(),
            });
            if (!result.ok) refuseChange(result, latest.version);
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: MANAGE,
              action: "consignor_agreement.replace",
              targetType: "consignor_agreement",
              targetId: result.agreement.agreementId,
              beforeJson: auditView(latest),
              afterJson: auditView(result.agreement),
            });
            return presentAgreement(result.agreement);
          },
        }),
      );
    },

    /** Ends the agreement early: it covers nothing from now on, and stays on the page. */
    async retire(
      command: Actor & { partyId: string; agreementId: string; expectedVersion: number },
    ): Promise<AdminConsignorAgreement> {
      const latest = await versionsOf(command.partyId, command.agreementId);
      return deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "consignor_agreement.retire",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: {
            agreementId: command.agreementId,
            expectedVersion: command.expectedVersion,
          },
          run: async () => {
            const result = await deps.writesFor(tx).retireAgreement({
              agreementId: command.agreementId,
              expectedVersion: command.expectedVersion,
              actor: `staff:${command.actorSubjectId}`,
              now: now(),
            });
            if (!result.ok) refuseChange(result, latest.version);
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: MANAGE,
              action: "consignor_agreement.retire",
              targetType: "consignor_agreement",
              targetId: result.agreement.agreementId,
              beforeJson: auditView(latest),
              afterJson: auditView(result.agreement),
            });
            return presentAgreement(result.agreement);
          },
        }),
      );
    },
  };
}

export type ConsignorAgreementService = ReturnType<typeof createConsignorAgreementService>;
