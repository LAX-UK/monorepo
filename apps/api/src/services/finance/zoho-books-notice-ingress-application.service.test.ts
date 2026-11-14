import { describe, expect, it, vi } from "vitest";

// Spy on the comparison the signature check makes, keeping Node's own implementation.
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

const crypto = await import("node:crypto");
const { zohoBooksSignature, zohoBooksSignedText, verifyZohoBooksSignature } = await import(
  "../../lib/zoho-books-notice-signature.js"
);
const { ZOHO_BOOKS_NOTICE_MAX_BYTES, ZohoBooksNoticeIngressApplicationService } = await import(
  "./zoho-books-notice-ingress-application.service.js"
);

/** A made-up test value; Books' real secret is set only in the environment. */
const SECRET = "books-notice-test-secret-0123456789abcdef"; // gitleaks:allow
const NOW = new Date("2026-11-14T02:00:30.000Z");
const PARAMS: [string, string][] = [
  ["source", "books"],
  ["kind", "invoice"],
];

const notice = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    organization_id: "20091234567",
    module: "invoice",
    entity_id: "5000000000123",
    event_time: "2026-11-14T01:59:00Z",
    ...over,
  });

function setup(options: { secret?: string | undefined; enqueueFails?: boolean } = {}) {
  const stored = new Map<string, { source: string; payload: unknown }>();
  const webhookEvents = {
    tryClaimEvent: vi.fn(async (input: { source: string; eventKey: string; payload: unknown }) => {
      if (stored.has(input.eventKey)) return { claimed: false };
      stored.set(input.eventKey, { source: input.source, payload: input.payload });
      return { claimed: true };
    }),
  };
  const producer = {
    enqueue: vi.fn(async () => {
      if (options.enqueueFails) throw new Error("redis down");
    }),
  };
  const alerts = { signatureFailed: vi.fn() };
  const service = new ZohoBooksNoticeIngressApplicationService(
    "secret" in options ? options.secret : SECRET,
    webhookEvents as never,
    producer,
    alerts,
    () => NOW,
  );
  return { service, webhookEvents, producer, alerts, stored };
}

const signed = (rawBody: string, params = PARAMS, secret = SECRET) => ({
  rawBody,
  params,
  signature: zohoBooksSignature(params, rawBody, secret),
});

describe("the Books signature", () => {
  it("signs the parameters sorted by name, each name then its value, with the raw JSON appended", () => {
    expect(
      zohoBooksSignedText(
        [
          ["b", "2"],
          ["a", "1"],
          ["a", "0"],
        ],
        '{"x":1}',
      ),
    ).toBe('a0a1b2{"x":1}');
    const expected = crypto
      .createHmac("sha256", SECRET)
      .update('kindinvoicesourcebooks{"x":1}')
      .digest("base64");
    expect(zohoBooksSignature(PARAMS, '{"x":1}', SECRET)).toBe(expected);
  });

  it("compares in constant time, with Node's timingSafeEqual, for a well-formed signature", () => {
    const compare = vi.mocked(crypto.timingSafeEqual);
    compare.mockClear();
    const body = notice();
    const good = zohoBooksSignature(PARAMS, body, SECRET);
    expect(verifyZohoBooksSignature(PARAMS, body, good, SECRET)).toBe(true);
    const wrong = zohoBooksSignature(PARAMS, body, `${SECRET}-other`);
    expect(verifyZohoBooksSignature(PARAMS, body, wrong, SECRET)).toBe(false);
    // Both decisions came from the constant-time comparison, never from string equality.
    expect(compare).toHaveBeenCalledTimes(2);
  });

  it("refuses a missing, malformed or wrong-length signature, and an empty secret", () => {
    const body = notice();
    const good = zohoBooksSignature(PARAMS, body, SECRET);
    expect(verifyZohoBooksSignature(PARAMS, body, undefined, SECRET)).toBe(false);
    expect(verifyZohoBooksSignature(PARAMS, body, "not base64!", SECRET)).toBe(false);
    expect(verifyZohoBooksSignature(PARAMS, body, "AAAA", SECRET)).toBe(false);
    expect(verifyZohoBooksSignature(PARAMS, body, good, "")).toBe(false);
  });

  it("is bound to the body and to the parameters", () => {
    const body = notice();
    const good = zohoBooksSignature(PARAMS, body, SECRET);
    expect(
      verifyZohoBooksSignature(PARAMS, notice({ entity_id: "5000000000999" }), good, SECRET),
    ).toBe(false);
    expect(verifyZohoBooksSignature([["source", "other"]], body, good, SECRET)).toBe(false);
  });
});

describe("ZohoBooksNoticeIngressApplicationService", () => {
  it("fails closed without a secret: 503, nothing stored, nothing read", async () => {
    const { service, webhookEvents, alerts } = setup({ secret: undefined });
    const res = await service.handle(signed(notice()));
    expect(res).toEqual({ status: 503, body: null });
    expect(webhookEvents.tryClaimEvent).not.toHaveBeenCalled();
    expect(alerts.signatureFailed).not.toHaveBeenCalled();
  });

  it("refuses a missing signature with a bare 401 and raises the alert", async () => {
    const { service, webhookEvents, alerts } = setup();
    const res = await service.handle({ rawBody: notice(), params: PARAMS, signature: undefined });
    expect(res).toEqual({ status: 401, body: null });
    expect(alerts.signatureFailed).toHaveBeenCalledWith({ reason: "missing" });
    expect(webhookEvents.tryClaimEvent).not.toHaveBeenCalled();
  });

  it("refuses a wrong signature with a bare 401, raises the alert and stores nothing", async () => {
    const { service, webhookEvents, alerts } = setup();
    const res = await service.handle(signed(notice(), PARAMS, `${SECRET}-forged`));
    expect(res).toEqual({ status: 401, body: null });
    expect(alerts.signatureFailed).toHaveBeenCalledWith({ reason: "invalid" });
    expect(webhookEvents.tryClaimEvent).not.toHaveBeenCalled();
  });

  it("refuses a signed body that was changed afterwards", async () => {
    const { service, alerts } = setup();
    const original = signed(notice());
    const res = await service.handle({
      ...original,
      rawBody: notice({ entity_id: "5000000000999" }),
    });
    expect(res.status).toBe(401);
    expect(alerts.signatureFailed).toHaveBeenCalledTimes(1);
  });

  it("stores a good notice by Books' ids only and queues it once", async () => {
    const { service, producer, stored, alerts } = setup();
    const res = await service.handle(
      signed(notice({ total: 99999.99, status: "paid", customer_name: "Somebody" })),
    );
    expect(res).toEqual({ status: 202, body: null });
    expect(alerts.signatureFailed).not.toHaveBeenCalled();
    expect(producer.enqueue).toHaveBeenCalledTimes(1);
    expect(stored.size).toBe(1);
    const [key, row] = [...stored.entries()][0] ?? [];
    expect(key).toMatch(/^zoho-books-[0-9a-f]{40}$/);
    // The notice's amounts, status and names are never kept: it is only a hint to read again.
    const routing = {
      organizationId: "20091234567",
      module: "invoice",
      entityId: "5000000000123",
      eventTime: "2026-11-14T01:59:00.000Z",
    };
    expect(row).toEqual({ source: "zoho_books", payload: { body: routing, routing } });
  });

  it("a replayed notice is stored and queued once (dedupe on Books' ids)", async () => {
    const { service, producer, stored } = setup();
    const request = signed(notice());
    expect((await service.handle(request)).status).toBe(202);
    expect((await service.handle(request)).status).toBe(202);
    // The same change spelled another way is the same notice.
    expect(
      (await service.handle(signed(notice({ event_time: "2026-11-14T01:59:00.000Z" })))).status,
    ).toBe(202);
    expect(stored.size).toBe(1);
    expect(producer.enqueue).toHaveBeenCalledTimes(1);
  });

  it("keeps notices for different documents or change times apart", async () => {
    const { service, stored } = setup();
    await service.handle(signed(notice()));
    await service.handle(signed(notice({ entity_id: "5000000000124" })));
    await service.handle(signed(notice({ event_time: "2026-11-14T02:00:00Z" })));
    expect(stored.size).toBe(3);
  });

  it("refuses a well-signed body that is not a notice, with no body", async () => {
    const { service, webhookEvents } = setup();
    for (const raw of [
      "not json",
      "[]",
      notice({ module: "contact" }),
      notice({ entity_id: "../../x" }),
      notice({ organization_id: null }),
    ]) {
      expect(await service.handle(signed(raw))).toEqual({ status: 400, body: null });
    }
    expect(webhookEvents.tryClaimEvent).not.toHaveBeenCalled();
  });

  it("refuses an oversized body before checking its signature", async () => {
    const { service, alerts } = setup();
    const big = notice({ pad: "x".repeat(ZOHO_BOOKS_NOTICE_MAX_BYTES) });
    expect(await service.handle(signed(big))).toEqual({ status: 413, body: null });
    expect(alerts.signatureFailed).not.toHaveBeenCalled();
  });

  it("still answers 202 when queuing fails: the notice is stored for the drain", async () => {
    const { service, stored } = setup({ enqueueFails: true });
    expect((await service.handle(signed(notice()))).status).toBe(202);
    expect(stored.size).toBe(1);
  });
});
