import type { Auth } from "@auction/auth/server";
import type { createDb } from "@auction/db";
import type { IEmailService } from "@auction/email";
import type {
  IAuthCredentialReader,
  IUserEmailChangeRepository,
} from "@auction/persistence/interfaces";
import type {
  ContainerCredentialSetupSlice,
  ContainerForgotPasswordSlice,
} from "../../container/container-slices.js";
import type { Env } from "../../env.js";
import { createAppLogger } from "../../lib/logger.js";
import { setupCredentialPassword } from "../auth/credential-setup.service.js";
import type { EmailChangeDeps } from "../auth/email-change.service.js";
import {
  clearEmailChangeInProgress,
  confirmEmailChangeFromToken,
  requestEmailChange,
} from "../auth/email-change.service.js";
import { runForgotPasswordSideEffects } from "../auth/forgot-password.service.js";
import { stampReauthWithPassword, stampSessionPasswordProofNow } from "../auth/reauth.service.js";
import type { IAuthAuditPublisher } from "../interfaces/auth-audit-publisher.js";
import type { IIdentityAccountSecurityHttpApplicationService } from "../interfaces/identity-routes/identity-account-security-http.js";
import type { IdentityHttpJson } from "../interfaces/identity-routes/identity-route-http.js";
import type { SessionRevocationService } from "../session-revocation.service.js";
import type { UserService } from "../user.service.js";

export type IdentityAccountSecurityDeps = {
  env: Env;
  authDb: ContainerCredentialSetupSlice["authDb"];
  auth: Auth;
  db: ReturnType<typeof createDb>;
  userService: UserService;
  userEmailChangeRepository: IUserEmailChangeRepository;
  emailService: IEmailService;
  sessionRevocation: SessionRevocationService;
  authAuditPublisher: IAuthAuditPublisher;
  authCredentialReader: IAuthCredentialReader;
};

export class IdentityAccountSecurityHttpApplicationService
  implements IIdentityAccountSecurityHttpApplicationService
{
  constructor(private readonly deps: IdentityAccountSecurityDeps) {}

  private emailChangeDeps(): EmailChangeDeps {
    return {
      userService: this.deps.userService,
      emailChange: this.deps.userEmailChangeRepository,
      emailService: this.deps.emailService,
      env: this.deps.env,
      authDb: this.deps.authDb,
      sessionRevocation: this.deps.sessionRevocation,
    };
  }

  private credentialSetupSlice(): ContainerCredentialSetupSlice {
    return {
      userService: this.deps.userService,
      auth: this.deps.auth,
      authDb: this.deps.authDb,
      emailService: this.deps.emailService,
    };
  }

  private forgotPasswordSlice(): ContainerForgotPasswordSlice {
    return {
      db: this.deps.db,
      authDb: this.deps.authDb,
      auth: this.deps.auth,
      emailService: this.deps.emailService,
      env: this.deps.env,
    };
  }

  async reauth(input: {
    userId: string | undefined;
    password: string;
    sessionTokenFromCookie: string | undefined;
  }): Promise<IdentityHttpJson> {
    const userId = input.userId;
    if (!userId) {
      return { status: 401, body: { error: "Unauthorized", code: "session_required" } };
    }
    const out = await stampReauthWithPassword({
      authDb: this.deps.authDb,
      userId,
      password: input.password,
      sessionTokenFromCookie: input.sessionTokenFromCookie ?? null,
    });
    if (out === "ok") {
      void this.deps.authAuditPublisher
        .publish({
          eventType: "auth.reauth_success",
          aggregateId: userId,
          payload: {},
          actorUserId: userId,
        })
        .catch(() => {});
      return { status: 200, body: { ok: true } };
    }
    if (out === "invalid_password") {
      return { status: 401, body: { error: "Incorrect password", code: "invalid_credentials" } };
    }
    if (out === "no_credential") {
      return {
        status: 400,
        body: {
          error: "Password re-authentication is not available for this sign-in method.",
          code: "credential_required",
        },
      };
    }
    return { status: 401, body: { error: "Session not found", code: "session_required" } };
  }

  async forgotPassword(input: {
    email: string;
    webOrigin: string;
    clientIp?: string;
  }): Promise<IdentityHttpJson> {
    void runForgotPasswordSideEffects({
      email: input.email,
      webOrigin: input.webOrigin,
      container: this.forgotPasswordSlice(),
      clientIp: input.clientIp,
      authAudit: this.deps.authAuditPublisher,
    }).catch((err) => {
      const logEnv = {
        LOG_LEVEL: this.deps.env.LOG_LEVEL ?? "info",
        NODE_ENV: this.deps.env.NODE_ENV ?? "production",
      };
      createAppLogger(logEnv).error(
        {
          err: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined,
        },
        "forgot_password_side_effect_failed",
      );
    });
    return { status: 200, body: { ok: true } };
  }

  async setupPassword(input: {
    userId: string | undefined;
    password: string;
    sessionTokenFromCookie: string | undefined;
  }): Promise<IdentityHttpJson> {
    const userId = input.userId;
    if (!userId) {
      return { status: 401, body: { error: "Unauthorized", code: "session_required" } };
    }
    const result = await setupCredentialPassword({
      container: this.credentialSetupSlice(),
      userId,
      password: input.password,
      authAudit: this.deps.authAuditPublisher,
    });
    if (result.ok) {
      void stampSessionPasswordProofNow({
        authDb: this.deps.authDb,
        userId,
        sessionTokenFromCookie: input.sessionTokenFromCookie ?? null,
      }).catch(() => {});
      return { status: 200, body: { ok: true } };
    }
    if (result.kind === "user_not_found") {
      return { status: 404, body: { error: "User not found", code: "user_not_found" } };
    }
    if (result.kind === "already_set") {
      return {
        status: 409,
        body: {
          error: "A password is already set on this account.",
          code: "credential_already_set",
        },
      };
    }
    return {
      status: 500,
      body: { error: "Could not set password.", code: "setup_password_failed" },
    };
  }

  async requestEmailChange(input: {
    userId: string | undefined;
    body: import("@auction/validators").RequestEmailChangeInput;
  }): Promise<IdentityHttpJson> {
    const userId = input.userId;
    if (!userId) {
      return { status: 401, body: { error: "Unauthorized", code: "session_required" } };
    }
    const out = await requestEmailChange({
      deps: this.emailChangeDeps(),
      userId,
      body: input.body,
      authAudit: this.deps.authAuditPublisher,
    });
    if (out.ok) return { status: 200, body: { ok: true } };
    if (out.kind === "user_not_found") {
      return { status: 404, body: { error: "User not found", code: "user_not_found" } };
    }
    if (out.kind === "same_email") {
      return {
        status: 400,
        body: {
          error: "New email must differ from your current address",
          code: "email_change_same_email",
        },
      };
    }
    return {
      status: 409,
      body: { error: "That email is already in use", code: "email_change_email_taken" },
    };
  }

  async clearEmailChange(input: { userId: string | undefined }): Promise<IdentityHttpJson> {
    const userId = input.userId;
    if (!userId) {
      return { status: 401, body: { error: "Unauthorized", code: "session_required" } };
    }
    const out = await clearEmailChangeInProgress({
      deps: this.emailChangeDeps(),
      userId,
      authAudit: this.deps.authAuditPublisher,
    });
    if (out.ok) return { status: 200, body: { ok: true } };
    return {
      status: 400,
      body: { error: "No email change is in progress", code: "email_change_none_in_progress" },
    };
  }

  async confirmEmailChange(input: { token: string }): Promise<IdentityHttpJson> {
    const result = await confirmEmailChangeFromToken({
      deps: this.emailChangeDeps(),
      token: input.token,
      authAudit: this.deps.authAuditPublisher,
    });

    if (result.ok && result.completed) {
      return { status: 200, body: { ok: true, completed: true } };
    }
    if (result.ok && !result.completed) {
      return {
        status: 200,
        body: {
          ok: true,
          completed: false,
          message:
            result.confirmFor === "old"
              ? "Current address confirmed. Open the email sent to your new address and confirm there to finish."
              : "New address confirmed. Open the email sent to your current address and confirm there to finish.",
        },
      };
    }

    if (result.kind === "user_not_found") {
      return { status: 404, body: { error: "User not found", code: "user_not_found" } };
    }
    if (result.kind === "stale_flow") {
      return {
        status: 409,
        body: {
          error: "Email change token no longer matches this account",
          code: "email_change_stale",
        },
      };
    }
    if (result.kind === "expired") {
      return {
        status: 410,
        body: {
          error: "This email change request has expired. Start again from settings.",
          code: "email_change_expired",
        },
      };
    }
    if (result.kind === "email_taken") {
      return {
        status: 409,
        body: { error: "That email is already in use", code: "email_change_email_taken" },
      };
    }
    return {
      status: 400,
      body: { error: "Invalid or expired token", code: "email_change_token_invalid" },
    };
  }

  async getPasswordStatus(input: { userId: string | undefined }): Promise<IdentityHttpJson> {
    const userId = input.userId;
    if (!userId) {
      return { status: 401, body: { error: "Unauthorized", code: "session_required" } };
    }
    const hasPassword = await this.deps.authCredentialReader.hasCredentialAccount(userId);
    return { status: 200, body: { data: { hasPassword } } };
  }
}
