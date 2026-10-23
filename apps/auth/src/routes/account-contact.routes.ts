import { createHash } from "node:crypto";
import {
  ACCOUNT_CONTACT_PATH,
  ACCOUNT_EMAIL_CHANGE_CANCEL_PATH,
  ACCOUNT_EMAIL_CHANGE_CONFIRM_PATH,
  ACCOUNT_EMAIL_CHANGE_PATH,
  ACCOUNT_PHONE_SEND_CODE_PATH,
  ACCOUNT_PHONE_VERIFY_PATH,
  ACCOUNT_REAUTH_REQUIRED,
  accountEmailSchema,
  accountPhoneCodeSchema,
  accountPhoneSchema,
} from "@auction/identity-contracts";
import { type Context, Hono } from "hono";
import type { AccountContactService } from "../services/account-contact.service.js";
import type { AccountPhoneService } from "../services/account-phone.service.js";
import type { EmailChangeFailure, EmailChangeService } from "../services/email-change.service.js";
import {
  type AccountCallerDeps,
  authenticateAccountCaller,
  authenticateAccountClient,
} from "./account-caller.js";

export type AccountContactRouteDeps = Omit<AccountCallerDeps, "rateLimit"> & {
  contact: Pick<AccountContactService, "read" | "startEmailChange" | "cancelEmailChange">;
  phone: Pick<AccountPhoneService, "sendCode" | "verify">;
  emailChange: Pick<EmailChangeService, "confirm">;
  /** Budget for reading the contact details. */
  readRateLimit: AccountCallerDeps["rateLimit"];
  /** Budget for starting or cancelling an email change; each start sends two emails. */
  emailChangeRateLimit: AccountCallerDeps["rateLimit"];
  /** Per person: each code is a paid SMS. */
  phoneSendRateLimit: AccountCallerDeps["rateLimit"];
  /** Per phone number (keyed by a hash of it), so one number cannot be flooded from many accounts. */
  phoneNumberRateLimit: (numberHash: string) => Promise<number | null>;
  /** Per person: caps guessing of the six-digit code. */
  phoneVerifyRateLimit: AccountCallerDeps["rateLimit"];
  onFailure?: (error: unknown) => void;
};

const EMAIL_FAILURE_STATUS: Record<EmailChangeFailure, 400 | 401 | 409 | 503> = {
  subject_not_found: 401,
  same_email: 409,
  email_taken: 409,
  none_in_progress: 409,
  invalid_token: 400,
  stale_flow: 409,
  expired: 409,
  channel_unavailable: 503,
};

const PHONE_FAILURE_STATUS = {
  invalid_phone: 422,
  invalid_code: 422,
  phone_taken: 409,
  rate_limited: 429,
  unavailable: 503,
} as const;

function reauthRequired(c: Context): Response {
  return c.json({ error: ACCOUNT_REAUTH_REQUIRED }, 403);
}

/**
 * Lets LAX Account show and change a person's email address and phone number, so the contact
 * details live in one place instead of in each product.
 *
 * Authorisation is described on authenticateAccountCaller. Starting an email change and
 * sending or checking a phone code also carry `sid` and need a recent sign-in: a stolen or
 * stale session must not be able to redirect account recovery to an address it controls.
 * Confirming an email change is the one call with no person attached: the emailed, signed
 * link is the proof, so it is authenticated as LAX Account only.
 */
export function createAccountContactRoutes(deps: AccountContactRouteDeps) {
  const app = new Hono();
  const callers = {
    read: { ...deps, rateLimit: deps.readRateLimit },
    emailChange: { ...deps, rateLimit: deps.emailChangeRateLimit },
    phoneSend: { ...deps, rateLimit: deps.phoneSendRateLimit },
    phoneVerify: { ...deps, rateLimit: deps.phoneVerifyRateLimit },
  } satisfies Record<string, AccountCallerDeps>;

  /** Runs the handler, mapping an unexpected failure to a generic 503 that leaks nothing. */
  async function guarded(c: Context, run: () => Promise<Response>): Promise<Response> {
    try {
      return await run();
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  }

  app.post(ACCOUNT_CONTACT_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, callers.read);
    if (caller instanceof Response) return caller;
    return guarded(c, async () => {
      const contact = await deps.contact.read(caller.subjectId);
      return contact ? c.json(contact) : c.json({ error: "invalid_token" }, 401);
    });
  });

  app.post(ACCOUNT_EMAIL_CHANGE_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, callers.emailChange);
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    const email = accountEmailSchema.safeParse(caller.params.get("email"));
    if (!sid || !email.success) return c.json({ error: "invalid_request" }, 400);
    return guarded(c, async () => {
      const result = await deps.contact.startEmailChange(caller.subjectId, sid, email.data);
      if ("reason" in result) return reauthRequired(c);
      return result.ok
        ? c.json({ pendingEmail: result.pendingEmail })
        : c.json({ error: result.kind }, EMAIL_FAILURE_STATUS[result.kind]);
    });
  });

  app.post(ACCOUNT_EMAIL_CHANGE_CANCEL_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, callers.emailChange);
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    if (!sid) return c.json({ error: "invalid_request" }, 400);
    return guarded(c, async () => {
      const result = await deps.contact.cancelEmailChange(caller.subjectId, sid);
      if ("reason" in result) return reauthRequired(c);
      return result.ok
        ? c.json({ cancelled: true })
        : c.json({ error: result.kind }, EMAIL_FAILURE_STATUS[result.kind]);
    });
  });

  app.post(ACCOUNT_EMAIL_CHANGE_CONFIRM_PATH, async (c) => {
    const client = await authenticateAccountClient(c, deps);
    if (client instanceof Response) return client;
    const token = client.params.get("email_token");
    if (!token) return c.json({ error: "invalid_request" }, 400);
    return guarded(c, async () => {
      const result = await deps.emailChange.confirm(token);
      return result.ok
        ? c.json({ completed: result.completed, confirmedFor: result.confirmedFor })
        : c.json({ error: result.kind }, EMAIL_FAILURE_STATUS[result.kind]);
    });
  });

  app.post(ACCOUNT_PHONE_SEND_CODE_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, callers.phoneSend);
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    const phone = accountPhoneSchema.safeParse(caller.params.get("phone"));
    if (!sid || !phone.success) return c.json({ error: "invalid_request" }, 400);
    const byNumber = await deps.phoneNumberRateLimit(
      createHash("sha256").update(phone.data, "utf8").digest("hex"),
    );
    if (byNumber !== null) {
      c.header("Retry-After", String(byNumber));
      return c.json({ error: "rate_limited" }, 429);
    }
    return guarded(c, async () => {
      const result = await deps.phone.sendCode(caller.subjectId, sid, phone.data);
      if ("reason" in result) return reauthRequired(c);
      return result.ok
        ? c.json({ sent: true })
        : c.json({ error: result.kind }, PHONE_FAILURE_STATUS[result.kind]);
    });
  });

  app.post(ACCOUNT_PHONE_VERIFY_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, callers.phoneVerify);
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    const phone = accountPhoneSchema.safeParse(caller.params.get("phone"));
    const code = accountPhoneCodeSchema.safeParse(caller.params.get("code"));
    if (!sid || !phone.success || !code.success) return c.json({ error: "invalid_request" }, 400);
    return guarded(c, async () => {
      const result = await deps.phone.verify(caller.subjectId, sid, phone.data, code.data);
      if ("reason" in result) return reauthRequired(c);
      return result.ok
        ? c.json({ phone: result.phone, verified: true })
        : c.json({ error: result.kind }, PHONE_FAILURE_STATUS[result.kind]);
    });
  });

  return app;
}
