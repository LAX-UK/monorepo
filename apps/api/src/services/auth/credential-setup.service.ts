import type { ContainerCredentialSetupSlice } from "../../container/container-slices.js";
import { IdentityIssuerClientError } from "../../infrastructure/http-identity-issuer.client.js";
import type { IAuthAuditPublisher } from "../interfaces/auth-audit-publisher.js";

export async function setupCredentialPassword(args: {
  container: ContainerCredentialSetupSlice;
  userId: string;
  password: string;
  sessionTokenFromCookie?: string | undefined;
  authAudit?: IAuthAuditPublisher | undefined;
}): Promise<{ ok: true } | { ok: false; kind: "user_not_found" | "already_set" | "db_error" }> {
  const { container, userId, password, authAudit } = args;

  try {
    await container.identityIssuer.setupPassword({
      subjectId: userId,
      password,
      ...(args.sessionTokenFromCookie ? { sessionToken: args.sessionTokenFromCookie } : {}),
    });
  } catch (error) {
    if (error instanceof IdentityIssuerClientError && error.code === "subject_not_found") {
      return { ok: false, kind: "user_not_found" };
    }
    if (error instanceof IdentityIssuerClientError && error.code === "already_set") {
      return { ok: false, kind: "already_set" };
    }
    return { ok: false, kind: "db_error" };
  }

  void authAudit
    ?.publish({
      eventType: "auth.password_credential_enabled",
      aggregateId: userId,
      payload: {},
      actorUserId: userId,
    })
    .catch(() => {});

  return { ok: true };
}
