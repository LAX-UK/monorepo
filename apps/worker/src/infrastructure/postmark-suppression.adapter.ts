import postmark from "postmark";
import type {
  IEmailProviderSuppression,
  ProviderReactivation,
} from "../interfaces/email-provider-suppression.js";

/**
 * Postmark keeps its own block list per message stream. A bounce or a manual block can be
 * deleted through the API; a spam complaint cannot, so it is reported rather than retried.
 */
export class PostmarkSuppressionAdapter implements IEmailProviderSuppression {
  private readonly client: postmark.ServerClient;

  constructor(serverToken: string) {
    this.client = new postmark.ServerClient(serverToken);
  }

  async reactivate(email: string, stream: string): Promise<ProviderReactivation> {
    const { Suppressions: current } = await this.client.getSuppressions(stream, {
      emailAddress: email,
    } as postmark.Models.SuppressionFilteringParameters);
    const entry = current.find((s) => s.EmailAddress.toLowerCase() === email.toLowerCase());
    if (!entry) return "not_blocked";
    if (entry.SuppressionReason === "SpamComplaint") return "still_blocked";

    const { Suppressions: results } = await this.client.deleteSuppressions(stream, {
      Suppressions: [{ EmailAddress: email }],
    });
    const result = results.find((r) => r.EmailAddress.toLowerCase() === email.toLowerCase());
    if (result?.Status === "Deleted") return "reactivated";
    throw new Error(`Postmark did not reactivate the address: ${result?.Message ?? "no answer"}`);
  }
}
