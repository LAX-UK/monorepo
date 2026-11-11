import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { paymentTransferReference } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { DrizzlePaymentTransferReferenceRepository } from "./drizzle-payment-transfer-reference.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("payment transfer reference store (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const store = new DrizzlePaymentTransferReferenceRepository(db);
  const run = randomUUID().slice(0, 8);
  const intent = `pi_ptr_${run}`;
  const customer = `cus_ptr_${run}`;
  const reference = `REF-${run}`.toUpperCase();
  const paymentId = randomUUID();
  const record = {
    stripePaymentIntentId: intent,
    reference,
    stripeCustomerId: customer,
    paymentId,
    paymentGroupId: null,
    memberPaymentIds: [randomUUID()],
    privateSaleDealId: null,
    privateSaleDealPaymentId: null,
  };

  afterAll(async () => {
    await db
      .delete(paymentTransferReference)
      .where(eq(paymentTransferReference.stripePaymentIntentId, intent));
  });

  it("records a reference once: recording it again changes nothing", async () => {
    await store.remember(record);
    await store.remember({ ...record, reference: "SOMETHING-ELSE", paymentId: null });
    expect(await store.findByPaymentIntent(intent)).toEqual(record);
  });

  it("lists only one buyer's references", async () => {
    expect(await store.listForCustomer(customer, 10)).toEqual([record]);
    expect(await store.listForCustomer("cus_someone_else", 10)).toEqual([]);
    expect(await store.findByPaymentIntent("pi_unknown")).toBeNull();
  });
});
