import { createHash } from "node:crypto";
import { account, user } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
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

  const [found] = await container.db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(sql`lower(${user.email}) = ${email}`)
    .limit(1);
  if (!found) return;

  const linked = await container.authDb
    .select({ providerId: account.providerId })
    .from(account)
    .where(eq(account.userId, found.id));

  const hasCredential = linked.some((a) => a.providerId === "credential");
  const social = linked.find((a) => SUPPORTED_SOCIAL_PROVIDERS.has(a.providerId));

  if (hasCredential) {
    await container.auth.api.requestPasswordReset({
      body: { email: found.email, redirectTo: `${webOrigin}/reset-password` },
    });
    return;
  }

  if (social && (social.providerId === "google" || social.providerId === "apple")) {
    await container.emailService.enqueue({
      template: "oauth-account-reset-attempt",
      to: found.email,
      userId: found.id,
      category: "auth",
      vars: {
        provider: social.providerId,
        signInUrl: `${webOrigin}/login`,
        settingsUrl: `${webOrigin}/dashboard/settings?tab=security`,
        userEmail: found.email,
        userName: found.name,
      },
    });
    return;
  }

  const issuerBaseUrl = container.env.OIDC_ISSUER_URL ?? container.env.API_PUBLIC_URL;
  await requestMagicLinkForEmail({
    auth: container.auth as never,
    issuerBaseUrl,
    email: found.email,
    webOrigin,
  });
}
