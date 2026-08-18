import { createHash } from "node:crypto";
import type { ContainerForgotPasswordSlice } from "../../container/container-slices.js";
import type { IAuthAuditPublisher } from "../interfaces/auth-audit-publisher.js";
import { requestMagicLinkForEmail } from "./request-magic-link.service.js";

const SUPPORTED_SOCIAL_PROVIDERS = new Set(["google", "apple"]);

function authAggregateId(parts: string): string {
  return createHash("sha256").update(parts).digest("hex").slice(0, 32);
}

/** Side-effects for `POST /auth/forgot-password` (constant-time HTTP body; work is async). */
export async function runForgotPasswordSideEffects(args: {
  email: string;
  webOrigin: string;
  container: ContainerForgotPasswordSlice;
  clientIp?: string | undefined;
  authAudit?: IAuthAuditPublisher | undefined;
}): Promise<void> {
  const { email, webOrigin, container, clientIp, authAudit } = args;
  const auditId = authAggregateId(`forgot:${email.toLowerCase()}:${clientIp ?? ""}`);
  void authAudit
    ?.publish({
      eventType: "auth.forgot_password_requested",
      aggregateType: "auth",
      aggregateId: auditId,
      payload: {},
    })
    .catch(() => {});

  const found = await container.identityIssuer.findSubjectByEmail(email);
  if (!found) return;

  const summary = await container.identityIssuer.credentialSummary(found.id);
  const social = summary.linkedProviders.find((provider) =>
    SUPPORTED_SOCIAL_PROVIDERS.has(provider),
  );

  if (summary.hasPassword) {
    await container.identityIssuer.requestPasswordReset({
      email: found.email,
      redirectTo: `${webOrigin}/reset-password`,
    });
    return;
  }

  if (social && (social === "google" || social === "apple")) {
    await container.emailService.enqueue({
      template: "oauth-account-reset-attempt",
      to: found.email,
      userId: found.id,
      category: "auth",
      vars: {
        provider: social,
        signInUrl: `${webOrigin}/login`,
        settingsUrl: `${webOrigin}/dashboard/settings?tab=security`,
        userEmail: found.email,
        userName: found.name,
      },
    });
    return;
  }

  await requestMagicLinkForEmail({
    identityIssuer: container.identityIssuer,
    email: found.email,
    webOrigin,
  });
}
