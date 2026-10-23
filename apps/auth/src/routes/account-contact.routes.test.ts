import { describe, expect, it, vi } from "vitest";
import { createAccountContactRoutes } from "./account-contact.routes.js";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER_SUBJECT = "22222222-2222-4222-8222-222222222222";
const PHONE = "%2B447700900123";

function basic(clientId: string): string {
  return `Basic ${Buffer.from(`${clientId}:client-secret`).toString("base64")}`;
}

type Limits = Partial<{
  read: number | null;
  emailChange: number | null;
  phoneSend: number | null;
  phoneNumber: number | null;
  phoneVerify: number | null;
}>;

function setup(
  overrides: { client?: string | null; introspection?: unknown; limits?: Limits } = {},
) {
  const introspect = vi
    .fn()
    .mockResolvedValue(overrides.introspection ?? { active: true, sub: SUBJECT });
  const contact = {
    read: vi.fn().mockResolvedValue({
      email: "ada@example.com",
      emailVerified: true,
      pendingEmail: null,
      phone: null,
      phoneVerified: false,
    }),
    startEmailChange: vi.fn().mockResolvedValue({ ok: true, pendingEmail: "next@example.com" }),
    cancelEmailChange: vi.fn().mockResolvedValue({ ok: true }),
  };
  const phone = {
    sendCode: vi.fn().mockResolvedValue({ ok: true }),
    verify: vi.fn().mockResolvedValue({ ok: true, phone: "+447700900123" }),
  };
  const emailChange = {
    confirm: vi.fn().mockResolvedValue({
      ok: true,
      subjectId: SUBJECT,
      completed: false,
      confirmedFor: "old",
    }),
  };
  const limits = overrides.limits ?? {};
  const onFailure = vi.fn();
  const app = createAccountContactRoutes({
    clients: {
      authenticate: async () =>
        (overrides.client === undefined ? "lax-account-web" : overrides.client) as never,
    },
    tokens: { introspect } as never,
    contact: contact as never,
    phone: phone as never,
    emailChange: emailChange as never,
    readRateLimit: async () => limits.read ?? null,
    emailChangeRateLimit: async () => limits.emailChange ?? null,
    phoneSendRateLimit: async () => limits.phoneSend ?? null,
    phoneNumberRateLimit: async () => limits.phoneNumber ?? null,
    phoneVerifyRateLimit: async () => limits.phoneVerify ?? null,
    onFailure,
  });
  const call = (path: string, body: string, auth = basic("lax-account-web")) =>
    app.request(path, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  return { call, contact, phone, emailChange, introspect, onFailure };
}

/** Routes that act for a signed-in person, with a valid body for each. */
const PERSON_ROUTES: [string, string][] = [
  ["/lax/account-contact", "token=t"],
  ["/lax/account-email-change", "token=t&sid=current&email=next%40example.com"],
  ["/lax/account-email-change/cancel", "token=t&sid=current"],
  ["/lax/account-phone/send-code", `token=t&sid=current&phone=${PHONE}`],
  ["/lax/account-phone/verify", `token=t&sid=current&phone=${PHONE}&code=123456`],
];

describe("account contact routes", () => {
  it.each(PERSON_ROUTES)("%s refuses every client except LAX Account", async (path, body) => {
    const { call, introspect } = setup({ client: "lax-bid-web" });
    expect((await call(path, body, basic("lax-bid-web"))).status).toBe(403);
    expect(introspect).not.toHaveBeenCalled();
  });

  it.each(PERSON_ROUTES)("%s refuses bad client credentials", async (path, body) => {
    const { call, introspect } = setup({ client: null });
    expect((await call(path, body)).status).toBe(401);
    expect(introspect).not.toHaveBeenCalled();
  });

  it.each(PERSON_ROUTES)("%s rejects an inactive token", async (path, body) => {
    const { call, contact, phone } = setup({ introspection: { active: false } });
    expect((await call(path, body)).status).toBe(401);
    for (const fn of [...Object.values(contact), ...Object.values(phone)]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it("acts only for the person who owns the access token, whatever the body names", async () => {
    const { call, contact } = setup();
    await call(
      "/lax/account-email-change",
      `token=t&sid=current&email=next%40example.com&sub=${OTHER_SUBJECT}&userId=${OTHER_SUBJECT}`,
    );
    expect(contact.startEmailChange).toHaveBeenCalledWith(SUBJECT, "current", "next@example.com");
  });

  it("reads the contact details with no-store caching", async () => {
    const { call } = setup();
    const response = await call("/lax/account-contact", "token=t");
    expect(await response.json()).toMatchObject({ email: "ada@example.com" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    ["/lax/account-contact", "read"],
    ["/lax/account-email-change", "emailChange"],
    ["/lax/account-email-change/cancel", "emailChange"],
    ["/lax/account-phone/send-code", "phoneSend"],
    ["/lax/account-phone/verify", "phoneVerify"],
  ] as const)("%s answers 429 over its own budget", async (path, limit) => {
    const body = PERSON_ROUTES.find(([p]) => p === path)?.[1] ?? "";
    const { call } = setup({ limits: { [limit]: 30 } });
    const response = await call(path, body);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
  });

  it("answers 429 when one phone number is being flooded", async () => {
    const { call, phone } = setup({ limits: { phoneNumber: 3_000 } });
    const response = await call(
      "/lax/account-phone/send-code",
      `token=t&sid=current&phone=${PHONE}`,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("3000");
    expect(phone.sendCode).not.toHaveBeenCalled();
  });

  it.each([
    ["a malformed address", "token=t&sid=current&email=not-an-email"],
    ["a missing address", "token=t&sid=current"],
    ["a missing sid", "token=t&email=next%40example.com"],
  ])("rejects an email change with %s", async (_label, body) => {
    const { call, contact } = setup();
    expect((await call("/lax/account-email-change", body)).status).toBe(400);
    expect(contact.startEmailChange).not.toHaveBeenCalled();
  });

  it.each([
    ["a number without a country code", "token=t&sid=current&phone=07700900123"],
    ["a number with letters", "token=t&sid=current&phone=%2B4477009OO123"],
    ["a missing sid", `token=t&phone=${PHONE}`],
  ])("rejects a code request with %s", async (_label, body) => {
    const { call, phone } = setup();
    expect((await call("/lax/account-phone/send-code", body)).status).toBe(400);
    expect(phone.sendCode).not.toHaveBeenCalled();
  });

  it.each([
    ["a short code", `token=t&sid=current&phone=${PHONE}&code=123`],
    ["a non-numeric code", `token=t&sid=current&phone=${PHONE}&code=abcdef`],
  ])("rejects a verification with %s", async (_label, body) => {
    const { call, phone } = setup();
    expect((await call("/lax/account-phone/verify", body)).status).toBe(400);
    expect(phone.verify).not.toHaveBeenCalled();
  });

  it.each([
    ["/lax/account-email-change", "startEmailChange", "contact"],
    ["/lax/account-email-change/cancel", "cancelEmailChange", "contact"],
    ["/lax/account-phone/send-code", "sendCode", "phone"],
    ["/lax/account-phone/verify", "verify", "phone"],
  ] as const)(
    "%s answers 403 reauth_required when step-up is needed",
    async (path, method, owner) => {
      const mocks = setup();
      const handler = (mocks[owner] as unknown as Record<string, ReturnType<typeof vi.fn>>)[method];
      handler?.mockResolvedValue({ ok: false, reason: "reauth_required" });
      const body = PERSON_ROUTES.find(([p]) => p === path)?.[1] ?? "";
      const response = await mocks.call(path, body);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "reauth_required" });
    },
  );

  it("maps an address that is taken to a 409", async () => {
    const { call, contact } = setup();
    contact.startEmailChange.mockResolvedValue({ ok: false, kind: "email_taken" });
    const response = await call(
      "/lax/account-email-change",
      "token=t&sid=current&email=taken%40example.com",
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "email_taken" });
  });

  it.each([
    ["invalid_code", 422],
    ["invalid_phone", 422],
    ["phone_taken", 409],
    ["unavailable", 503],
  ] as const)("maps the phone failure %s to HTTP %i", async (kind, status) => {
    const { call, phone } = setup();
    phone.verify.mockResolvedValue({ ok: false, kind });
    const response = await call(
      "/lax/account-phone/verify",
      `token=t&sid=current&phone=${PHONE}&code=123456`,
    );
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: kind });
  });

  it("answers 503 without leaking the cause when the work fails", async () => {
    const { call, phone, onFailure } = setup();
    phone.sendCode.mockRejectedValue(new Error("twilio auth token abc123 rejected"));
    const response = await call(
      "/lax/account-phone/send-code",
      `token=t&sid=current&phone=${PHONE}`,
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("abc123");
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});

describe("email change confirmation route", () => {
  it("needs LAX Account's client secret but no signed-in person", async () => {
    const { call, emailChange, introspect } = setup();
    const response = await call("/lax/account-email-change/confirm", "email_token=signed");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ completed: false, confirmedFor: "old" });
    expect(emailChange.confirm).toHaveBeenCalledWith("signed");
    expect(introspect).not.toHaveBeenCalled();
  });

  it("does not expose the subject to the browser-facing caller", async () => {
    const { call } = setup();
    const text = await (await call("/lax/account-email-change/confirm", "email_token=s")).text();
    expect(text).not.toContain(SUBJECT);
  });

  it("refuses other clients and bad credentials", async () => {
    const other = setup({ client: "lax-bid-web" });
    expect(
      (await other.call("/lax/account-email-change/confirm", "email_token=s", basic("lax-bid-web")))
        .status,
    ).toBe(403);
    const bad = setup({ client: null });
    expect((await bad.call("/lax/account-email-change/confirm", "email_token=s")).status).toBe(401);
    expect(other.emailChange.confirm).not.toHaveBeenCalled();
    expect(bad.emailChange.confirm).not.toHaveBeenCalled();
  });

  it("requires a token", async () => {
    const { call, emailChange } = setup();
    expect((await call("/lax/account-email-change/confirm", "")).status).toBe(400);
    expect(emailChange.confirm).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid_token", 400],
    ["stale_flow", 409],
    ["expired", 409],
    ["email_taken", 409],
  ] as const)("maps %s to HTTP %i", async (kind, status) => {
    const { call, emailChange } = setup();
    emailChange.confirm.mockResolvedValue({ ok: false, kind });
    const response = await call("/lax/account-email-change/confirm", "email_token=s");
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: kind });
  });
});
