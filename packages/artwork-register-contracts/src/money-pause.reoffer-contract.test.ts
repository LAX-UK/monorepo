import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MONEY_PAUSE_ACTIONS } from "./money-pause.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const reofferDir = "apps/api/src/services/reoffer";

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

/**
 * The re-offer steps that move money live in two api services. Each must ask the pause guard
 * with its own step name, and the container must hand both the real guard (never an allow-all).
 * Behaviour is covered in the api tests; this fails if the call or the wiring is removed.
 */
describe("re-offer services and the money pause", () => {
  it("names both re-offer steps among the pause actions", () => {
    expect(MONEY_PAUSE_ACTIONS).toEqual(expect.arrayContaining(["reoffer_send", "reoffer_accept"]));
  });

  it.each([
    ["reoffer-offer.service.ts", "reoffer_send"],
    ["reoffer-response.service.ts", "reoffer_accept"],
  ])("%s asks the pause guard with %s", (file, step) => {
    expect(read(`${reofferDir}/${file}`)).toContain(`moneyPause.assertNotPaused("${step}"`);
  });

  it("the guard adapter calls assertMoneyNotPaused with the step it is given", () => {
    expect(read(`${reofferDir}/register-money-pause.guard.ts`)).toMatch(
      /assertMoneyNotPaused\([^)]*\bstep\b\s*\)/s,
    );
  });

  it("the container wires the real guard into both services, with no allow-all fallback", () => {
    const container = read("apps/api/src/container/create-reoffer-services.ts");
    expect(container).toContain("new RegisterMoneyPauseGuard(");
    expect(container).not.toMatch(/allow-?all/i);
    expect(container).toMatch(/new ReofferOfferService\(\{[^}]*\bmoneyPause\b[^}]*\}\)/s);
    expect(container).toMatch(/new ReofferResponseService\(\{[^}]*\bmoneyPause\b[^}]*\}\)/s);
  });
});
