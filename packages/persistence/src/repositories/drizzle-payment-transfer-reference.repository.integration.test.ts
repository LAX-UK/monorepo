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
  const reference = `REF-${run}`.toUpperCase();
  const paymentId = randomUUID();

  afterAll(async () => {
    await db
      .delete(paymentTransferReference)
      .where(eq(paymentTransferReference.stripePaymentIntentId, intent));
  });

  it("records a reference once: recording it again changes nothing", async () => {
    await store.remember({
      stripePaymentIntentId: intent,
      reference,
      paymentId,
      paymentGroupId: null,
    });
    await store.remember({
      stripePaymentIntentId: intent,
      reference: "SOMETHING-ELSE",
      paymentId: null,
      paymentGroupId: randomUUID(),
    });
    expect(await store.findByPaymentIntent(intent)).toEqual({
      stripePaymentIntentId: intent,
      reference,
      paymentId,
      paymentGroupId: null,
    });
  });

  it("finds the payment a reference was issued for, without regard to case", async () => {
    const found = await store.findByReference(` ${reference.toLowerCase()} `);
    expect(found).toMatchObject({ stripePaymentIntentId: intent, paymentId });
    expect(await store.findByReference("REF-UNKNOWN")).toBeNull();
    expect(await store.findByPaymentIntent("pi_unknown")).toBeNull();
  });
});
