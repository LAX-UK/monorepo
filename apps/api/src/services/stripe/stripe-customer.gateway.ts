import type { ILegalEntityRepository } from "@auction/persistence";
import type Stripe from "stripe";
import type { Env } from "../../env.js";
import type { IStripeClientFactory } from "../../lib/stripe-client.js";
import { StripeClientFactory } from "../../lib/stripe-client.js";
import { executeWithStripeRetries } from "../../lib/stripe-retries.js";
import type { IStripeCustomerGateway } from "../interfaces/stripe-customer.js";

export class StripeCustomerGateway implements IStripeCustomerGateway {
  private readonly stripeFactory: IStripeClientFactory;

  constructor(
    env: Pick<Env, "STRIPE_SECRET_KEY">,
    private readonly legalEntities: ILegalEntityRepository,
    stripeFactory?: IStripeClientFactory,
  ) {
    this.stripeFactory = stripeFactory ?? new StripeClientFactory(env);
  }

  private get stripe() {
    return this.stripeFactory.get();
  }

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  async findOrCreateForLegalEntity(input: {
    legalEntityId: string;
    buyerEmail: string;
    buyerName: string;
  }): Promise<string> {
    const stripe = this.stripe;
    if (!stripe) {
      throw new Error("StripeCustomerGateway: called while not configured");
    }

    const entity = await this.legalEntities.findById(input.legalEntityId);
    if (!entity) {
      throw new Error("Buyer legal entity not found");
    }
    if (entity.stripeCustomerId) {
      return entity.stripeCustomerId;
    }

    const customer = await executeWithStripeRetries(() =>
      stripe.customers.create(
        {
          email: input.buyerEmail,
          name: input.buyerName || input.buyerEmail,
          metadata: {
            legalEntityId: input.legalEntityId,
          },
        },
        { idempotencyKey: `stripe-customer:legal-entity:${input.legalEntityId}` },
      ),
    );

    await this.legalEntities.setStripeCustomerId(input.legalEntityId, customer.id);
    return customer.id;
  }
}

export type { Stripe };
