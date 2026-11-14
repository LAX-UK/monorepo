import { runInNewContext } from "node:vm";
import { type StepUpAnswer, stepUpCompleteScript } from "@/lib/step-up-complete";
import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { GET as GET_SCRIPT } from "./script/route";

const page = (query = "") =>
  GET(new Request(`https://account.test/api/auth/step-up-complete${query}`));
const script = (query = "") =>
  GET_SCRIPT(new Request(`https://account.test/api/auth/step-up-complete/script${query}`));

function runScript(opener: unknown, answer?: StepUpAnswer) {
  const close = vi.fn();
  runInNewContext(stepUpCompleteScript(answer), {
    window: { location: { origin: "https://account.test" }, opener, close },
  });
  return close;
}

describe("GET /api/auth/step-up-complete", () => {
  it("is never cached and loads its script from Account itself, not inline", async () => {
    const response = page();
    expect(response.headers.get("cache-control")).toBe("no-store");
    const html = await response.text();
    expect(html).toContain('<script src="/api/auth/step-up-complete/script" defer></script>');
    expect(html.match(/<script/g)).toHaveLength(1);
  });

  it("never claims a confirmation, since anyone can open it without signing in", async () => {
    const html = await page().text();
    expect(html).toContain("<h1>You can close this window</h1>");
    expect(html).not.toMatch(/confirmed/i);
    expect(html).toContain('<a href="/account">Back to LAX Account</a>');
  });

  it("loads the signed-out script for the signed-out answer, and ignores any other status", async () => {
    const signedOut = await page("?status=signed_out").text();
    expect(signedOut).toContain(
      '<script src="/api/auth/step-up-complete/script?status=signed_out" defer></script>',
    );
    expect(signedOut).toContain("You're signed out of LAX Account.");
    const other = await page("?status=%3Cscript%3E").text();
    expect(other).toContain('<script src="/api/auth/step-up-complete/script" defer></script>');
    expect(other).not.toContain("%3Cscript");
  });

  it("serves the script as JavaScript, never cached", async () => {
    const response = script();
    expect(response.headers.get("content-type")).toContain("text/javascript");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await script("?status=signed_out").text()).toContain('status: "signed_out"');
    expect(await script("?status=nope").text()).toContain('status: "ok"');
  });
});

describe("the completion script", () => {
  it("tells the opener only that it worked, addressed to Account's own origin, then closes", () => {
    const opener = { closed: false, postMessage: vi.fn() };
    const close = runScript(opener);
    expect(opener.postMessage).toHaveBeenCalledWith(
      { type: "lax-step-up", status: "ok" },
      "https://account.test",
    );
    expect(close).toHaveBeenCalled();
  });

  it("tells the opener when nobody was signed in to confirm", () => {
    const opener = { closed: false, postMessage: vi.fn() };
    runScript(opener, "signed_out");
    expect(opener.postMessage).toHaveBeenCalledWith(
      { type: "lax-step-up", status: "signed_out" },
      "https://account.test",
    );
  });

  it("does nothing without an opener, so the page's link leads back", () => {
    expect(runScript(null)).not.toHaveBeenCalled();
    expect(runScript({ closed: true, postMessage: vi.fn() })).not.toHaveBeenCalled();
  });
});
