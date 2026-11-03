import { describe, expect, it, vi } from "vitest";
import { IdentityBearerAuth } from "./export-request-auth.js";
import { HttpIdentityExportClient } from "./identity-export-client.js";

const EXPORT = "11111111-1111-4111-8111-111111111111";

function client(handler: (request: Request) => Response | Promise<Response>) {
  const calls: Request[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input as string, init);
    calls.push(request);
    if (new URL(request.url).pathname === "/internal/oauth/token") {
      return Response.json({ access_token: `t${calls.length}`, expires_in: 300 });
    }
    return handler(request);
  };
  const auth = new IdentityBearerAuth({
    baseUrl: "https://identity.test",
    clientId: "worker",
    clientSecret: "secret",
    fetchImpl,
  });
  return {
    calls,
    identity: new HttpIdentityExportClient({ baseUrl: "https://identity.test/", auth, fetchImpl }),
  };
}

describe("reporting progress to Identity", () => {
  it("posts the report to the progress route with a subject_export bearer", async () => {
    const { identity, calls } = client(() => Response.json({ result: "applied" }));
    await identity.report(EXPORT, { event: "failed", errorCode: "boom" });

    const token = calls[0] as Request;
    expect(token.headers.get("authorization")).toBe(
      `Basic ${Buffer.from("worker:secret").toString("base64")}`,
    );
    expect(await token.text()).toContain("scope=subject_export");
    const report = calls[1] as Request;
    expect(report.method).toBe("POST");
    expect(new URL(report.url).pathname).toBe(
      `/internal/identity/subject-exports/${EXPORT}/progress`,
    );
    expect(report.headers.get("authorization")).toBe("Bearer t1");
    expect(await report.json()).toEqual({ event: "failed", errorCode: "boom" });
  });

  it("treats 'ignored' for a repeated report as success", async () => {
    const { identity } = client(() => Response.json({ result: "ignored" }));
    await expect(
      identity.report(EXPORT, { event: "failed", errorCode: "x" }),
    ).resolves.toBeUndefined();
  });

  it("uses a new token once if Identity refuses the cached one", async () => {
    let first = true;
    const { identity, calls } = client(() => {
      if (first) {
        first = false;
        return new Response("no", { status: 401 });
      }
      return Response.json({ result: "applied" });
    });
    await identity.report(EXPORT, { event: "failed", errorCode: "x" });
    expect(calls.filter((c) => new URL(c.url).pathname === "/internal/oauth/token")).toHaveLength(
      2,
    );
  });

  it("retries later on 5xx and 429 but not when Identity has no such request or refuses the report", async () => {
    for (const [status, kind] of [
      [503, "transient"],
      [429, "transient"],
    ] as const) {
      const { identity } = client(() => new Response("", { status }));
      await expect(
        identity.report(EXPORT, { event: "failed", errorCode: "x" }),
      ).rejects.toMatchObject({ kind });
    }
    for (const status of [404, 422]) {
      const { identity } = client(() => new Response("", { status }));
      await expect(
        identity.report(EXPORT, { event: "failed", errorCode: "x" }),
      ).rejects.toMatchObject({
        kind: "permanent",
      });
    }
  });
});

describe("the purge routes", () => {
  it("lists what is pending and confirms a deletion", async () => {
    const key = `subject-exports/${EXPORT}/lax-data-2026-11-02.zip`;
    const handler = vi.fn((request: Request) =>
      request.method === "GET"
        ? Response.json({ items: [{ exportId: EXPORT, objectKey: key }] })
        : Response.json({ result: "applied" }),
    );
    const { identity, calls } = client(handler);
    await expect(identity.pending(50)).resolves.toEqual([{ exportId: EXPORT, objectKey: key }]);
    await identity.confirmPurged(EXPORT);
    expect(
      new URL((calls[1] as Request).url).pathname + new URL((calls[1] as Request).url).search,
    ).toBe("/internal/identity/subject-exports/purge-pending?limit=50");
    expect(new URL((calls[2] as Request).url).pathname).toBe(
      `/internal/identity/subject-exports/${EXPORT}/purged`,
    );
  });

  it("rejects an answer outside the contract", async () => {
    const { identity } = client(() => Response.json({ items: [{ exportId: "" }] }));
    await expect(identity.pending(10)).rejects.toMatchObject({ kind: "permanent" });
  });
});
