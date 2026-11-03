import { emailHash } from "@auction/email";
import type { ReactivateEmailAddressJobData } from "@auction/queues";
import type pino from "pino";
import type {
  IEmailAddressLookup,
  IEmailProviderSuppression,
} from "../interfaces/email-provider-suppression.js";

type Deps = {
  addresses: IEmailAddressLookup;
  provider: IEmailProviderSuppression;
  /** The provider's message streams the address may be blocked on. */
  streams: readonly string[];
  log: pino.Logger;
};

/**
 * After staff lift a block, asks the provider to stop blocking the address on every stream. A
 * provider failure throws so the queue retries and, when attempts run out, the job lands in
 * Failed jobs. A block the provider keeps (a spam complaint) is logged, not retried.
 */
export async function reactivateEmailAddressUseCase(
  { addresses, provider, streams, log }: Deps,
  data: ReactivateEmailAddressJobData,
): Promise<void> {
  const email = await addresses.findEmail(data.userId);
  // The person changed their address since the lift: the one that was unblocked is not theirs now.
  if (!email || emailHash(email) !== data.emailHash) {
    log.info({ userId: data.userId }, "email reactivation skipped: address no longer current");
    return;
  }
  for (const stream of streams) {
    const result = await provider.reactivate(email, stream);
    log.info({ userId: data.userId, stream, result }, "email provider reactivation");
  }
}
