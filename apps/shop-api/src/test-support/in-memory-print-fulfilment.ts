import type { EditionFacts, EditionRunSpec } from "@auction/shop-domain";
import { LAX_STANDARD_RUN } from "@auction/shop-domain";
import type { ShopAdminAuditRecord } from "../application/ports/shop-admin-audit.writer.js";
import type { ShopDomainEventRecord } from "../application/ports/shop-domain-event.writer.js";
import type {
  CertificateAuthority,
  HorsCommerceListing,
  NewCertificate,
  PackLine,
  PackPrint,
  PrintEvent,
  PrintFulfilmentTx,
  PrintFulfilmentUnitOfWork,
  PrintSwappedNotice,
  RunPrint,
  StoredCertificate,
  SwapMove,
} from "../application/print-fulfilment/print-fulfilment.ports.js";

export type MemoryPrint = PackPrint & {
  listingStatus: "authorised" | "sold" | "withdrawn" | "not_authorised";
  saleAuthorisedAt: Date | null;
};

type MemoryLine = Omit<PackLine, "print" | "swappedFrom"> & {
  printId: string;
  swappedFromId: string | null;
  unitPricePence: number;
};

/**
 * One artwork's prints and the order lines sold from them, held in memory, behind the same ports
 * the packing use cases use. Writes apply at once (there is no rollback), which is enough to test
 * what the use cases decide and record.
 */
export function createInMemoryPrintFulfilment(options?: {
  run?: EditionRunSpec;
  facts?: EditionFacts | null;
  authority?: CertificateAuthority;
  /** Parties whose payout is LAX's own. */
  laxParties?: readonly string[];
}) {
  const prints = new Map<string, MemoryPrint>();
  const lines = new Map<string, MemoryLine>();
  const certificates: StoredCertificate[] = [];
  const events: PrintEvent[] = [];
  const audit: ShopAdminAuditRecord[] = [];
  const domainEvents: ShopDomainEventRecord[] = [];
  const notices: PrintSwappedNotice[] = [];
  const payouts = new Map<string, { ownerPartyId: string | null; status: string }>();
  const commands = new Map<string, unknown>();
  const hc = new Map<string, HorsCommerceListing>();
  const state = {
    run: options?.run ?? LAX_STANDARD_RUN,
    facts: options?.facts ?? null,
    authority: options?.authority ?? null,
  };
  let sequence = 0;

  function addPrint(print: Partial<MemoryPrint> & { stockRef: number }): MemoryPrint {
    const row: MemoryPrint = {
      editionId: `e${print.stockRef}`,
      editionNumber: print.stockRef,
      proofNumber: null,
      labelCode: `CODE${print.stockRef}`,
      storageLocation: null,
      custodyStatus: "stored",
      ownerPartyId: "artist",
      listingStatus: "authorised",
      saleAuthorisedAt: new Date("2026-10-01T00:00:00Z"),
      ...print,
    };
    prints.set(row.editionId, row);
    return row;
  }

  /** A paid order line for `stockRef`, sold by `sellerPartyId` to buyer party "buyer". */
  function sell(stockRef: number, extra: Partial<MemoryLine> = {}): MemoryLine {
    const print = prints.get(`e${stockRef}`);
    if (!print) throw new Error(`no print ${stockRef}`);
    sequence += 1;
    const line: MemoryLine = {
      orderLineId: `line${sequence}`,
      orderId: "order1",
      orderReference: "LAX-S-10482",
      buyerIdentitySubjectId: "buyer-subject",
      buyerFallbackEmail: null,
      artworkId: "art1",
      artworkTitle: "Harbour at dusk",
      sellerPartyId: print.ownerPartyId,
      released: false,
      paid: true,
      confirmedAt: null,
      confirmedBy: null,
      printId: print.editionId,
      swappedFromId: null,
      unitPricePence: 42_000,
      ...extra,
    };
    print.listingStatus = "sold";
    print.ownerPartyId = "buyer";
    lines.set(line.orderLineId, line);
    if (line.sellerPartyId && !(options?.laxParties ?? []).includes(line.sellerPartyId)) {
      payouts.set(line.orderLineId, { ownerPartyId: line.sellerPartyId, status: "pending" });
    }
    return line;
  }

  function present(line: MemoryLine): PackLine {
    const { printId, swappedFromId, unitPricePence: _price, ...rest } = line;
    const print = prints.get(printId);
    if (!print) throw new Error("missing print");
    const from = swappedFromId ? prints.get(swappedFromId) : undefined;
    return {
      ...rest,
      print: { ...print },
      swappedFrom: from ? { ...from } : null,
    };
  }

  const tx: PrintFulfilmentTx = {
    lines: {
      async lock(orderLineId) {
        const line = lines.get(orderLineId);
        return line ? present(line) : null;
      },
      async forOrder(orderId) {
        return [...lines.values()].filter((l) => l.orderId === orderId).map(present);
      },
      async runContext() {
        return { run: state.run, facts: state.facts, authority: state.authority };
      },
      async confirm(input) {
        const line = lines.get(input.orderLineId);
        if (!line) throw new Error("missing line");
        line.confirmedAt = input.at;
        line.confirmedBy = input.actorSubjectId;
      },
    },
    swaps: {
      async lockRunPrints(_artworkId, exceptEditionId): Promise<RunPrint[]> {
        return [...prints.values()]
          .filter((p) => p.editionId !== exceptEditionId)
          .sort((a, b) => a.stockRef - b.stockRef)
          .map((p) => ({
            editionId: p.editionId,
            stockRef: p.stockRef,
            editionNumber: p.editionNumber,
            proofNumber: p.proofNumber,
            labelCode: p.labelCode,
            ownerPartyId: p.ownerPartyId,
            saleAuthorisedAt: p.saleAuthorisedAt,
            freeToSell: p.listingStatus === "authorised",
          }));
      },
      async move(move: SwapMove) {
        const line = lines.get(move.line.orderLineId);
        const from = prints.get(move.line.print.editionId);
        const to = prints.get(move.to.editionId);
        if (!line || !from || !to) throw new Error("missing");
        if (to.listingStatus !== "authorised") throw new Error("not free");
        to.listingStatus = "sold";
        to.ownerPartyId = from.ownerPartyId;
        from.listingStatus = "withdrawn";
        from.ownerPartyId = line.sellerPartyId;
        const moved = line.sellerPartyId !== move.to.ownerPartyId;
        line.printId = to.editionId;
        line.swappedFromId = from.editionId;
        const payout = payouts.get(line.orderLineId);
        const newSeller = move.to.ownerPartyId;
        const toLax = newSeller !== null && (options?.laxParties ?? []).includes(newSeller);
        if (moved) {
          if (toLax) payouts.delete(line.orderLineId);
          else payouts.set(line.orderLineId, { ownerPartyId: newSeller, status: "pending" });
        }
        line.sellerPartyId = newSeller;
        return { payoutMoved: moved && (payout !== undefined || !toLax) };
      },
    },
    certificates: {
      async forEditions(ids) {
        return certificates.filter((c) => ids.includes(c.editionId));
      },
      async insert(certificate: NewCertificate) {
        const stored: StoredCertificate = {
          certificateId: `cert${certificates.length + 1}`,
          editionId: certificate.editionId,
          orderLineId: certificate.orderLineId,
          reference: `LAX-C-${certificates.length + 1}`,
          printLabel: certificate.printLabel,
          issuer: certificate.issuer,
          form: certificate.form,
          issuedAt: certificate.issuedAt,
        };
        certificates.push(stored);
        return stored;
      },
      async lock(id) {
        return certificates.find((c) => c.certificateId === id) ?? null;
      },
      async markSent({ certificateId, at }) {
        const found = certificates.find((c) => c.certificateId === certificateId);
        if (found) found.issuedAt = at;
      },
      async listToSend() {
        return certificates
          .filter((c) => c.issuedAt === null)
          .map((c) => ({
            certificateId: c.certificateId,
            orderId: "order1",
            orderReference: "LAX-S-10482",
            artworkTitle: "Harbour at dusk",
            printLabel: c.printLabel ?? "",
            issuer: c.issuer,
            form: c.form,
            createdAt: new Date("2026-11-01T00:00:00Z"),
          }));
      },
    },
    events: { append: async (event) => void events.push(event) },
    domainEvents: { append: async (event) => void domainEvents.push(event) },
    horsCommerce: {
      async lock(artworkId) {
        return hc.get(artworkId) ?? null;
      },
      async approve({ artworkId, actorSubjectId, at }) {
        const listing = hc.get(artworkId);
        if (listing) {
          listing.approvedAt = at;
          listing.approvedBy = actorSubjectId;
        }
      },
    },
    notifier: { printSwapped: async (notice) => void notices.push(notice) },
    audit: { append: async (record) => void audit.push(record) },
    commands: {
      async begin(input) {
        const id = `${input.commandType}:${input.actorSubjectId}:${input.idempotencyKey}`;
        return commands.has(id)
          ? { kind: "replay", result: commands.get(id) }
          : { kind: "started" };
      },
      async complete(input) {
        commands.set(
          `${input.commandType}:${input.actorSubjectId}:${input.idempotencyKey}`,
          input.result,
        );
      },
    },
  };

  const uow: PrintFulfilmentUnitOfWork = { run: (fn) => fn(tx) };

  return {
    uow,
    tx,
    state,
    prints,
    lines,
    certificates,
    events,
    domainEvents,
    audit,
    notices,
    payouts,
    hc,
    addPrint,
    sell,
    pickList: {
      forOrder: async (orderId: string) => {
        const orderLines = [...lines.values()].filter((l) => l.orderId === orderId).map(present);
        return {
          lines: orderLines,
          contexts: new Map([
            ["art1", { run: state.run, facts: state.facts, authority: state.authority }],
          ]),
          certificates: [...certificates],
        };
      },
    },
  };
}
