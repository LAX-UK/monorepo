import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { PayoutStatementOutcome } from "../services/interfaces/finance-routes/finance-payout-statement.js";
import type { AppLogger } from "./logger.js";
import { mapPayoutStatementOutcomeToHttp } from "./payout-statement-http.js";

function serve(outcome: PayoutStatementOutcome) {
  const warn = vi.fn();
  const log = () => ({ warn }) as unknown as AppLogger;
  const app = new Hono();
  app.get("/statement.pdf", (c) => mapPayoutStatementOutcomeToHttp(c, outcome, undefined, log));
  return { res: app.request("/statement.pdf"), warn };
}

describe("mapPayoutStatementOutcomeToHttp", () => {
  it("says a statement failed without handing the stored error to the client", async () => {
    const stored = "S3 PutObject denied for bucket lax-private at /statements/abc";
    const { res, warn } = serve({ kind: "generation_failed", detail: stored });
    const answer = await res;
    expect(answer.status).toBe(422);
    const body = await answer.json();
    expect(body).toEqual({ error: "statement_generation_failed" });
    expect(JSON.stringify(body)).not.toContain("S3");
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ detail: stored }),
      "payout_statement_generation_failed_served",
    );
  });

  it("answers a missing payout as not found", async () => {
    const { res } = serve({ kind: "not_found" });
    const answer = await res;
    expect(answer.status).toBe(404);
    expect(await answer.json()).toEqual({ error: "payout_not_found" });
  });

  it("asks the client to retry while the statement is being made", async () => {
    const { res } = serve({ kind: "pending" });
    const answer = await res;
    expect(answer.status).toBe(503);
    expect(answer.headers.get("Retry-After")).toBe("5");
  });
});
