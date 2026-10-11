import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import Stripe from "stripe";
import type {
  CreateOriginalSaleInvoiceInput,
  CreateOriginalSaleInvoiceResult,
  InvoiceGateway,
} from "../application/ports/invoice.gateway.js";
import { ShopApiError } from "../errors/shop-api-error.js";

export function createStripeShopInvoiceGateway(options: {
  secretKey: string | undefined;
}): InvoiceGateway {
  const stripe = options.secretKey ? new Stripe(options.secretKey, { typescript: true }) : null;

  return {
    async createAndFinalizeOriginalSaleInvoice(
      input: CreateOriginalSaleInvoiceInput,
    ): Promise<CreateOriginalSaleInvoiceResult> {
      if (!stripe) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.INTERNAL,
          "Stripe is not configured for invoicing",
          501,
        );
      }

      const customer = await stripe.customers.create({
        email: input.buyerEmail,
        ...(input.buyerName ? { name: input.buyerName } : {}),
        metadata: {
          shop_original_sale_id: input.originalSaleId,
        },
      });

      await stripe.invoiceItems.create({
        customer: customer.id,
        amount: input.amountPence,
        currency: input.currency,
        description: input.description,
      });

      const invoice = await stripe.invoices.create({
        customer: customer.id,
        collection_method: "send_invoice",
        days_until_due: 14,
        metadata: input.metadata,
      });

      if (!invoice.id) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Stripe invoice missing id", 500);
      }
      const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
      if (!finalized.id) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Stripe invoice missing id", 500);
      }
      await stripe.invoices.sendInvoice(finalized.id);

      return {
        stripeInvoiceId: finalized.id,
        hostedInvoiceUrl: finalized.hosted_invoice_url ?? null,
      };
    },
  };
}
