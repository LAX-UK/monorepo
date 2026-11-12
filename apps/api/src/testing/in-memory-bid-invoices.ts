import type { SellerTermsSnapshot } from "@auction/domain";
import { InvoiceRaiser } from "@auction/finance-runtime";
import type {
  BidInvoiceRecord,
  CreatePaymentRow,
  IBidInvoiceRaiseRepository,
  IBidInvoiceReader,
  ISaleRepository,
  PaymentRecord,
  RaisedInvoice,
} from "@auction/persistence/interfaces";

/**
 * Invoices kept in memory for service tests. The payment row itself is created by the function
 * given, so a test keeps asserting on its own `payments.create` double.
 */
export class InMemoryBidInvoices implements IBidInvoiceReader, IBidInvoiceRaiseRepository {
  readonly invoices: BidInvoiceRecord[] = [];
  private readonly invoiceByPayment = new Map<string, BidInvoiceRecord>();
  /** What the seller is paid for each payment raised, as the store keeps it with the payment. */
  readonly sellerTermsByPayment = new Map<string, SellerTermsSnapshot>();

  constructor(
    private readonly createPayment: (row: CreatePaymentRow) => Promise<PaymentRecord>,
    /** Gives a payment the test never raised an invoice for, as the migration backfill would. */
    private readonly backfill?: (paymentId: string) => BidInvoiceRecord,
  ) {}

  async findLiveByLotAndBuyerAccount(lotId: string, buyerLegalEntityId: string) {
    return (
      this.invoices.find(
        (i) => i.lotId === lotId && i.buyerLegalEntityId === buyerLegalEntityId && !i.voidedAt,
      ) ?? null
    );
  }

  async findByPaymentIds(paymentIds: readonly string[]) {
    return new Map(
      paymentIds.flatMap((id) => {
        const invoice = this.invoiceByPayment.get(id) ?? this.backfill?.(id);
        return invoice ? [[id, invoice] as const] : [];
      }),
    );
  }

  async raise(input: Parameters<IBidInvoiceRaiseRepository["raise"]>[0]): Promise<RaisedInvoice> {
    const existing = await this.findLiveByLotAndBuyerAccount(
      input.invoice.lotId,
      input.invoice.buyerLegalEntityId,
    );
    const invoice: BidInvoiceRecord = existing ?? {
      id: `invoice-${this.invoices.length + 1}`,
      ...input.invoice,
      number: null,
      source: "raised",
      voidedAt: null,
    };
    if (!existing) this.invoices.push(invoice);
    const payment = await this.createPayment({
      ...input.payment,
      amount: (invoice.totalPence / 100).toFixed(2),
      invoiceId: invoice.id,
    });
    this.invoiceByPayment.set(payment.id, invoice);
    this.sellerTermsByPayment.set(payment.id, input.sellerTerms);
    return { invoice, payment, invoiceCreated: !existing };
  }
}

/** A raiser over in-memory invoices, whose payments are created by `createPayment`. */
export function inMemoryInvoiceRaiser(
  createPayment: (row: CreatePaymentRow) => Promise<PaymentRecord>,
  sales: Pick<ISaleRepository, "findById"> | null = null,
  now?: () => Date,
) {
  const invoices = new InMemoryBidInvoices(createPayment);
  return { invoices, raiser: new InvoiceRaiser({ invoices, sales, ...(now ? { now } : {}) }) };
}
