import type { ZohoCertainty, ZohoErrorKind } from "../errors.js";
import type { ZohoTokenStore } from "../ports.js";
import { type Reply, tokenReply } from "./fake-transport.js";
import type { ClientHarness } from "./harness.js";

/** The slice of a test runner the contract needs, so this file does not import vitest. */
export interface TestApi {
  readonly describe: (name: string, body: () => void) => void;
  readonly it: (name: string, body: () => Promise<void> | void) => void;
  readonly expect: (value: unknown) => {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
  };
}

export interface ClassificationCase {
  readonly name: string;
  readonly reply: Reply;
  readonly kind: ZohoErrorKind;
  /** What the domain must be told: `rejected` (Zoho did not act) or `unknown` (it may have). */
  readonly certainty: ZohoCertainty;
}

/**
 * How the client must read a Books reply. This table is the contract between the HTTP client and
 * whatever maps its errors into domain outcomes: an adapter test may iterate it to check its own
 * mapping stays aligned.
 */
export const CLASSIFICATION_CASES: readonly ClassificationCase[] = [
  { name: "401", reply: { status: 401, body: { code: 57 } }, kind: "auth", certainty: "rejected" },
  { name: "403", reply: { status: 403, body: { code: 4 } }, kind: "auth", certainty: "rejected" },
  {
    name: "400",
    reply: { status: 400, body: { code: 1002 } },
    kind: "validation",
    certainty: "rejected",
  },
  {
    name: "422",
    reply: { status: 422, body: { code: 1 } },
    kind: "validation",
    certainty: "rejected",
  },
  {
    name: "404",
    reply: { status: 404, body: { code: 1002 } },
    kind: "not_found",
    certainty: "rejected",
  },
  { name: "409", reply: { status: 409, body: {} }, kind: "conflict", certainty: "rejected" },
  {
    name: "429",
    reply: { status: 429, body: {}, headers: { "retry-after": "3600" } },
    kind: "rate_limited",
    certainty: "rejected",
  },
  { name: "500", reply: { status: 500, body: {} }, kind: "server", certainty: "unknown" },
  { name: "503", reply: { status: 503, body: {} }, kind: "server", certainty: "unknown" },
  {
    name: "200 with a Zoho error code",
    reply: { status: 200, body: { code: 3062, message: "x" } },
    kind: "validation",
    certainty: "rejected",
  },
  {
    name: "200 that is not JSON",
    reply: { status: 200, raw: "<html>" },
    kind: "unknown",
    certainty: "unknown",
  },
  { name: "redirect", reply: { status: 302, raw: "" }, kind: "unknown", certainty: "unknown" },
  {
    name: "connection reset",
    reply: { fail: new Error("ECONNRESET") },
    kind: "network",
    certainty: "unknown",
  },
];

/**
 * Registers the contract tests against a harness factory. Each write method gets each reply
 * once (retries disabled so one reply is one outcome).
 */
export function runZohoBooksClientContract(api: TestApi, makeHarness: () => ClientHarness): void {
  const { describe, it, expect } = api;
  describe("Zoho Books client contract", () => {
    for (const method of ["POST", "PUT", "DELETE"] as const) {
      for (const testCase of CLASSIFICATION_CASES) {
        it(`${method}: ${testCase.name} -> ${testCase.kind} (${testCase.certainty})`, async () => {
          const h = makeHarness();
          await h.connect();
          const isApi = (r: { url: string }) => !r.url.includes("/oauth/v2/token");
          const unauthorized = "status" in testCase.reply && testCase.reply.status === 401;
          h.transport.enqueue(testCase.reply, isApi);
          if (unauthorized) {
            // One refresh and replay is allowed after a 401; the replay is refused too.
            h.transport.enqueue(tokenReply("access-token-2"), (r) => !isApi(r));
            h.transport.enqueue(testCase.reply, isApi);
          }
          const call =
            method === "DELETE"
              ? h.client.delete("20091234567", "/invoices/1")
              : method === "POST"
                ? h.client.post("20091234567", "/invoices", { reference_number: "LAX-SHOP-INV-1" })
                : h.client.put("20091234567", "/invoices/1", {
                    reference_number: "LAX-SHOP-INV-1",
                  });
          const result = await h.clock.settle(call);
          expect(result.ok).toBe(false);
          if (result.ok) return;
          expect(result.error.kind).toBe(testCase.kind);
          expect(result.error.certainty).toBe(testCase.certainty);
          // A write is never sent twice because of a 5xx, a timeout or an unreadable reply.
          const sent = h.transport.requests.filter(isApi);
          expect(sent.length).toBe(unauthorized ? 2 : 1);
        });
      }
    }
  });
}

/**
 * What every `ZohoTokenStore` adapter must do. The writes that follow a read are compare-and-set on
 * `version`: a refresh that started before a reconnect must not overwrite or flag the new connection.
 */
export function runZohoTokenStoreContract(api: TestApi, makeStore: () => ZohoTokenStore): void {
  const { describe, it, expect } = api;
  const ORG = "20091234567";
  describe("Zoho token store contract", () => {
    it("loads nothing for an organisation that is not connected", async () => {
      expect(await makeStore().load(ORG)).toBe(null);
    });

    it("saves a refresh against the version that was read and changes the version", async () => {
      const store = makeStore();
      await store.saveConnection(ORG, "v1:refresh");
      const before = await store.load(ORG);
      const applied = await store.saveRefreshed(ORG, before?.version ?? "", {
        accessTokenSealed: "v1:access",
        accessTokenExpiresAtMs: 123,
      });
      expect(applied).toBe(true);
      const after = await store.load(ORG);
      expect(after?.accessTokenSealed).toBe("v1:access");
      expect(after?.refreshTokenSealed).toBe("v1:refresh");
      expect(after?.version === before?.version).toBe(false);
    });

    it("refuses a refresh and a reauth flag written against a version a reconnect has replaced", async () => {
      const store = makeStore();
      await store.saveConnection(ORG, "v1:refresh-1");
      const stale = (await store.load(ORG))?.version ?? "";
      await store.saveConnection(ORG, "v1:refresh-2");
      expect(
        await store.saveRefreshed(ORG, stale, {
          accessTokenSealed: "v1:stale-access",
          accessTokenExpiresAtMs: 1,
        }),
      ).toBe(false);
      expect(await store.markNeedsReauth(ORG, stale, "zoho_books_invalid_grant")).toBe(false);
      const row = await store.load(ORG);
      expect(row?.refreshTokenSealed).toBe("v1:refresh-2");
      expect(row?.accessTokenSealed).toBe(null);
      expect(row?.status).toBe("healthy");
    });

    it("flags needs_reauth against the current version, and a reconnect clears it", async () => {
      const store = makeStore();
      await store.saveConnection(ORG, "v1:refresh");
      const current = (await store.load(ORG))?.version ?? "";
      expect(await store.markNeedsReauth(ORG, current, "zoho_books_invalid_grant")).toBe(true);
      expect((await store.load(ORG))?.status).toBe("needs_reauth");
      await store.saveConnection(ORG, "v1:refresh-new");
      expect((await store.load(ORG))?.status).toBe("healthy");
    });
  });
}
