import type {
  CertificateForm,
  CertificateIssuer,
  EditionFacts,
  EditionRunSpec,
  SendCandidate,
} from "@auction/shop-domain";
import type { ShopAdminAuditWriter } from "../ports/shop-admin-audit.writer.js";
import type { ShopAdminCommandWriter } from "../ports/shop-admin-command.writer.js";
import type { ShopDomainEventWriter } from "../ports/shop-domain-event.writer.js";

/** The print an order line was sold, as packing sees it. */
export type PackPrint = {
  editionId: string;
  stockRef: number;
  editionNumber: number | null;
  proofNumber: number | null;
  labelCode: string | null;
  storageLocation: string | null;
  custodyStatus: string;
  /** The buyer once paid; before that the party that holds the print. */
  ownerPartyId: string | null;
};

export type PackLine = {
  orderLineId: string;
  orderId: string;
  orderReference: string;
  /** A LAX account, or `guest:<id>` for a guest order. */
  buyerIdentitySubjectId: string;
  /** A guest buyer's email; null for an account (resolved when mailing) or an erased guest. */
  buyerFallbackEmail: string | null;
  artworkId: string;
  artworkTitle: string;
  /** Who sold the print: the party its payout belongs to. */
  sellerPartyId: string | null;
  /** The line was released (order cancelled or expired): nothing to pack. */
  released: boolean;
  paid: boolean;
  confirmedAt: Date | null;
  confirmedBy: string | null;
  /** The print first sold on this line, when another was sent in its place. */
  swappedFrom: PackPrint | null;
  print: PackPrint;
};

/** A certificate's authority: the artist's written permission for LAX to issue it. */
export type CertificateAuthority = { reference: string; recordedAt: Date } | null;

/** What a line's run says about its prints and certificate. */
export type RunContext = {
  run: EditionRunSpec;
  facts: EditionFacts | null;
  authority: CertificateAuthority;
};

/** Reads and updates the order lines packing works on. */
export interface PackLineStore {
  /** Takes a row lock on the line, so two staff cannot pack or swap it at once. */
  lock(orderLineId: string): Promise<PackLine | null>;
  forOrder(orderId: string): Promise<PackLine[]>;
  runContext(artworkId: string): Promise<RunContext>;
  confirm(input: {
    orderLineId: string;
    actorSubjectId: string;
    at: Date;
    printLabel: string;
  }): Promise<void>;
}

/** A print of the run other than the one sold, with whether it can be sent instead. */
export type RunPrint = Omit<SendCandidate, "label"> & {
  editionNumber: number | null;
  proofNumber: number | null;
};

export type SwapMove = {
  line: PackLine;
  to: RunPrint;
  /** The label of the print sold, kept on the line's history. */
  fromLabel: string;
  toLabel: string;
  reason: string;
  actorSubjectId: string;
};

/** Moves an order line to another print. Every write runs in the caller's transaction. */
export interface PrintSwapStore {
  /**
   * Every other print of the run, locked until the transaction ends so two swaps cannot pick the
   * same one. Ordered by stock reference.
   */
  lockRunPrints(artworkId: string, exceptEditionId: string): Promise<RunPrint[]>;
  /**
   * Sends `to` in place of the print sold: the line, the production task, both prints and the
   * payout follow. Returns whether the payout moved to another party.
   */
  move(input: SwapMove): Promise<{ payoutMoved: boolean }>;
}

export type StoredCertificate = {
  certificateId: string;
  editionId: string;
  orderLineId: string | null;
  reference: string | null;
  printLabel: string | null;
  issuer: CertificateIssuer | null;
  form: CertificateForm | null;
  issuedAt: Date | null;
};

export type NewCertificate = {
  editionId: string;
  orderLineId: string;
  printLabel: string;
  issuer: CertificateIssuer;
  form: CertificateForm;
  /** Set when the certificate is issued now; null while it waits to be sent. */
  issuedAt: Date | null;
  issuedBySubjectId: string | null;
  authorityReference: string | null;
};

export type CertificateToSend = {
  certificateId: string;
  orderId: string | null;
  orderReference: string | null;
  artworkTitle: string;
  printLabel: string;
  issuer: string | null;
  form: string | null;
  createdAt: Date;
};

export interface CertificateStore {
  forEditions(editionIds: readonly string[]): Promise<StoredCertificate[]>;
  insert(certificate: NewCertificate): Promise<StoredCertificate>;
  /** Locks the certificate row; null when none has that id. */
  lock(certificateId: string): Promise<StoredCertificate | null>;
  markSent(input: { certificateId: string; actorSubjectId: string; at: Date }): Promise<void>;
  listToSend(): Promise<CertificateToSend[]>;
}

export type PrintEvent = {
  editionId: string;
  kind: "pack_confirmed" | "print_set_aside" | "print_sent_instead" | "certificate_issued";
  fromValue?: string | null;
  toValue: string;
  actorSubjectId: string;
  orderId: string;
};

export interface PrintEventWriter {
  append(event: PrintEvent): Promise<void>;
}

export type HorsCommerceListing = {
  artworkId: string;
  proofType: "ap" | "pp" | "hc" | null;
  approvedAt: Date | null;
  approvedBy: string | null;
};

export interface HorsCommerceApprovals {
  lock(artworkId: string): Promise<HorsCommerceListing | null>;
  approve(input: { artworkId: string; actorSubjectId: string; at: Date }): Promise<void>;
}

export type PrintSwappedNotice = {
  idempotencyKey: string;
  identitySubjectId: string;
  fallbackEmail: string | null;
  orderReference: string;
  artworkTitle: string;
  /** "9/24": the number the buyer now has. */
  newLabel: string;
  previousLabel: string;
};

/** Tells the buyer, in the same transaction, that their print's number changed. */
export interface PrintSwapNotifier {
  printSwapped(notice: PrintSwappedNotice): Promise<void>;
}

export type PrintFulfilmentTx = {
  lines: PackLineStore;
  swaps: PrintSwapStore;
  certificates: CertificateStore;
  events: PrintEventWriter;
  /** Domain events other systems follow; written in the same transaction as the change. */
  domainEvents: ShopDomainEventWriter;
  horsCommerce: HorsCommerceApprovals;
  notifier: PrintSwapNotifier;
  audit: ShopAdminAuditWriter;
  commands: ShopAdminCommandWriter;
};

export interface PrintFulfilmentUnitOfWork {
  run<T>(fn: (tx: PrintFulfilmentTx) => Promise<T>): Promise<T>;
}

/** Reads for the pick list: no transaction, no locks. */
export interface PickListReader {
  forOrder(orderId: string): Promise<{
    lines: PackLine[];
    contexts: ReadonlyMap<string, RunContext>;
    certificates: StoredCertificate[];
  }>;
}

/** Settings the certificate rules depend on, read when a print is confirmed. */
export interface CertificateSettingsReader {
  laxCertificatesEnabled(): boolean;
}

export type Clock = { now(): Date };

export type StaffCommand = { actorSubjectId: string; idempotencyKey: string };
