import { toObjectRecord } from "@/lib/data/http/object-guards";
import { zStringArrayFromUnknown } from "@/lib/data/http/schema-coerce";
import type {
  StripeConnectClientConfig,
  StripeConnectStatus,
} from "@/lib/data/http/stripe-connect.types";
import { z } from "zod";

export const stripeConnectStatusSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(
    (row): StripeConnectStatus => ({
      stripeAccountId: row.stripeAccountId == null ? null : String(row.stripeAccountId),
      chargesEnabled: Boolean(row.chargesEnabled),
      payoutsEnabled: Boolean(row.payoutsEnabled),
      requirementsCurrentlyDue: zStringArrayFromUnknown.parse(row.requirementsCurrentlyDue),
      disabledReason: row.disabledReason == null ? null : String(row.disabledReason),
      ready: Boolean(row.ready),
      ...(row.syncDegraded === true ? { syncDegraded: true as const } : {}),
    }),
  ) as z.ZodType<StripeConnectStatus>;

export const stripeConnectClientConfigSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(
    (row): StripeConnectClientConfig => ({
      publishableKey: row.publishableKey == null ? null : String(row.publishableKey),
      connectEnforced: Boolean(row.connectEnforced),
    }),
  ) as z.ZodType<StripeConnectClientConfig>;

export const stripeConnectAccountSessionSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row) => ({ clientSecret: String(row.clientSecret ?? "") })) as z.ZodType<{
  clientSecret: string;
}>;

export const stripeConnectUrlSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row) => ({ url: String(row.url ?? "") })) as z.ZodType<{ url: string }>;
