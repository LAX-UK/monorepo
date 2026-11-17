import type {
  AgreementChangeRefusal,
  AgreementTerms,
  ConsignorAgreement,
} from "@auction/artwork-register-contracts";
import type { ShopTransactionEffects } from "./shop-unit-of-work.js";

/** A client who can consign works: any party except LAX itself. */
export type ConsignorParty = { partyId: string; displayName: string };

/** What LAX Admin reads about a consignor's agreements, outside any write. */
export type ConsignorAgreementReads = {
  /** The client, or null when there is no such client (or the party is LAX itself). */
  consignorParty(partyId: string): Promise<ConsignorParty | null>;
  /** Current versions first, then retired ones, newest first; replaced versions left out. */
  listAgreements(partyId: string): Promise<ConsignorAgreement[]>;
  /** Every version of an agreement, oldest first; empty when there is no such agreement. */
  listVersions(agreementId: string): Promise<ConsignorAgreement[]>;
  findAgreementVersion(id: string): Promise<ConsignorAgreement | null>;
};

/**
 * The agreement store bound to one unit of work, so the new version, the old one marked replaced,
 * the LAX Admin audit row and the idempotency record commit together or not at all.
 */
export type ConsignorAgreementWrites = {
  addAgreement(input: {
    partyId: string;
    terms: AgreementTerms;
    actor: string;
    now: Date;
  }): Promise<
    { ok: true; agreement: ConsignorAgreement } | { ok: false; reason: "party_not_found" }
  >;
  replaceAgreement(input: {
    agreementId: string;
    expectedVersion: number;
    terms: AgreementTerms;
    actor: string;
    now: Date;
  }): Promise<AgreementChange>;
  retireAgreement(input: {
    agreementId: string;
    expectedVersion: number;
    actor: string;
    now: Date;
  }): Promise<AgreementChange>;
};

export type AgreementChange =
  | { ok: true; agreement: ConsignorAgreement }
  | { ok: false; reason: AgreementChangeRefusal };

export type ConsignorAgreementWritesFor = (tx: ShopTransactionEffects) => ConsignorAgreementWrites;

/** Why an uploaded file cannot be the signed agreement. */
export type AgreementFileRefusal = "missing" | "wrong_type" | "too_large" | "not_this_client";

/**
 * Where signed agreements are kept: the shop's object storage, under a private prefix per client
 * (only `shop/*` is public). Files go up with a short-lived signed PUT and come down with a
 * short-lived signed GET; neither link is stored.
 */
export type ConsignorAgreementFiles = {
  /** A key for a new file of the client's, and where to PUT it. */
  createUpload(input: {
    partyId: string;
    contentType: string;
    byteSize: number;
  }): Promise<{ key: string; uploadUrl: string; requiredHeaders: Record<string, string> }>;
  /** Whether `key` is an uploaded file of this client's that can be a signed agreement. */
  check(input: {
    partyId: string;
    key: string;
  }): Promise<{ ok: true } | { ok: false; reason: AgreementFileRefusal }>;
  /** A link to download the file, valid for a few minutes. */
  downloadLink(input: { key: string; fileName: string }): Promise<{ url: string; expiresAt: Date }>;
};
