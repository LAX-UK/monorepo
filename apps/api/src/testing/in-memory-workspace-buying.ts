import type { DeliveryQuoteStatus } from "@auction/domain";
import type {
  AccountPurchaseFactsRow,
  AccountRecordsScope,
  AccountRegistrationRow,
  DeliveryQuoteRow,
  DeliveryQuoteWrite,
  IAccountPurchaseFactsReader,
  IAccountRegistrationsReader,
  IDeliveryQuoteRepository,
} from "@auction/persistence/interfaces";

export const BUYING_ACCOUNT = "11111111-1111-4111-8111-111111111111";
export const OTHER_ACCOUNT = "22222222-2222-4222-8222-222222222222";
export const LOTS = {
  paid: "aaaaaaaa-0000-4000-8000-000000000001",
  due: "aaaaaaaa-0000-4000-8000-000000000002",
  overdue: "aaaaaaaa-0000-4000-8000-000000000003",
  agentWin: "aaaaaaaa-0000-4000-8000-000000000004",
  otherAccount: "aaaaaaaa-0000-4000-8000-000000000005",
} as const;
export const NOW = new Date("2026-11-20T12:00:00Z");
const DAY = 86_400_000;

function purchase(
  lotId: string,
  over: Partial<AccountPurchaseFactsRow> & { account?: string },
): AccountPurchaseFactsRow & { account: string } {
  return {
    account: BUYING_ACCOUNT,
    lotId,
    buyerAccountKind: "organisation",
    lotTitle: `Lot ${lotId.slice(-1)}`,
    lotNumber: Number(lotId.slice(-1)),
    saleId: "sale-1",
    saleTitle: "Spring Modern British",
    hammerPrice: "1000.00",
    wonBy: { userId: "owner-1", name: "Maya Okafor" },
    wonAt: new Date(NOW.getTime() - 2 * DAY),
    payment: null,
    fulfilment: null,
    quote: null,
    ...over,
  };
}

/** Lots won for the account, with one each way an invoice can stand. */
export function seedPurchases() {
  return [
    purchase(LOTS.paid, {
      payment: {
        id: "pay-1",
        status: "captured",
        amount: "1250.00",
        raisedAt: new Date(NOW.getTime() - 3 * DAY),
      },
    }),
    purchase(LOTS.due, {
      payment: {
        id: "pay-2",
        status: "pending",
        amount: "600.10",
        raisedAt: new Date(NOW.getTime() - 2 * DAY),
      },
    }),
    purchase(LOTS.overdue, {
      payment: {
        id: "pay-3",
        status: "pending",
        amount: "400.00",
        raisedAt: new Date(NOW.getTime() - 10 * DAY),
      },
    }),
    purchase(LOTS.agentWin, {
      wonBy: { userId: "buyer_agent-1", name: "Tom Whitfield" },
      payment: {
        id: "pay-4",
        status: "pending",
        amount: "300.00",
        raisedAt: new Date(NOW.getTime() - DAY),
      },
    }),
    purchase(LOTS.otherAccount, { account: OTHER_ACCOUNT }),
  ];
}

export class InMemoryPurchaseFacts implements IAccountPurchaseFactsReader {
  constructor(
    readonly rows = seedPurchases(),
    private readonly quotes?: InMemoryDeliveryQuotes,
  ) {}

  async list(
    scope: AccountRecordsScope & { lotIds?: readonly string[]; limit: number; offset: number },
  ): Promise<AccountPurchaseFactsRow[]> {
    return this.rows
      .filter((r) => r.account === scope.legalEntityId)
      .filter((r) => !scope.memberUserId || r.wonBy?.userId === scope.memberUserId)
      .filter((r) => !scope.lotIds || scope.lotIds.includes(r.lotId))
      .slice(scope.offset, scope.offset + scope.limit)
      .map(({ account: _a, ...row }) => ({
        ...row,
        quote: this.quotes?.latest(row.lotId, scope.legalEntityId) ?? row.quote,
      }));
  }
}

export class InMemoryDeliveryQuotes implements IDeliveryQuoteRepository {
  readonly rows: DeliveryQuoteRow[] = [];
  private seq = 0;

  latest(lotId: string, account: string): DeliveryQuoteRow | null {
    const mine = this.rows.filter((q) => q.lotId === lotId && q.buyerLegalEntityId === account);
    return mine.find((q) => q.status !== "withdrawn") ?? mine.at(-1) ?? null;
  }

  async findLatest(lotId: string, account: string) {
    return this.latest(lotId, account);
  }

  async insertRequested(input: {
    lotId: string;
    buyerLegalEntityId: string;
    destination: string;
    currency: string;
    requestedByUserId: string;
  }) {
    const live = this.latest(input.lotId, input.buyerLegalEntityId);
    if (live && live.status !== "withdrawn") return null;
    const row: DeliveryQuoteRow = {
      id: `quote-${++this.seq}`,
      ...input,
      status: "requested",
      amount: null,
      quoteNote: null,
      requestedAt: NOW,
      quotedAt: null,
      decidedByUserId: null,
      decidedAt: null,
    };
    this.rows.push(row);
    return row;
  }

  async transition(id: string, from: DeliveryQuoteStatus, write: DeliveryQuoteWrite) {
    const row = this.rows.find((q) => q.id === id);
    if (!row || row.status !== from) return null;
    row.status = write.status;
    if (write.status === "quoted") {
      row.amount = write.amount ?? row.amount;
      row.quoteNote = write.quoteNote ?? row.quoteNote;
      row.quotedAt = NOW;
    } else {
      row.decidedByUserId = write.actorUserId;
      row.decidedAt = NOW;
    }
    return { ...row };
  }
}

export class InMemoryRegistrations implements IAccountRegistrationsReader {
  readonly rows: (AccountRegistrationRow & { account: string })[] = [
    {
      account: BUYING_ACCOUNT,
      id: "reg-1",
      saleId: "sale-1",
      saleTitle: "Spring Modern British",
      saleStartsAt: NOW,
      saleEndsAt: NOW,
      status: "approved",
      paddleNumber: 12,
      bidLimit: null,
      requestedAt: NOW,
      decidedAt: NOW,
      registeredBy: { userId: "owner-1", name: "Maya Okafor" },
    },
    {
      account: BUYING_ACCOUNT,
      id: "reg-2",
      saleId: "sale-1",
      saleTitle: "Spring Modern British",
      saleStartsAt: NOW,
      saleEndsAt: NOW,
      status: "pending",
      paddleNumber: null,
      bidLimit: null,
      requestedAt: NOW,
      decidedAt: null,
      registeredBy: { userId: "buyer_agent-1", name: "Tom Whitfield" },
    },
  ];

  async list(scope: AccountRecordsScope) {
    return this.rows
      .filter((r) => r.account === scope.legalEntityId)
      .filter((r) => !scope.memberUserId || r.registeredBy.userId === scope.memberUserId)
      .map(({ account: _a, ...row }) => row);
  }
}
