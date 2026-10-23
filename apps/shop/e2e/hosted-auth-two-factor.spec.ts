import { createHmac } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1 and AUTH_BASE_URL to a dev-seeded auth service.";
const issuerOrigin = (process.env.AUTH_BASE_URL ?? "http://localhost:3003").replace(/\/+$/, "");

/** Seeded customer whose email is already verified; the password is the dev seed's shared one. */
const EMAIL = "user1@lax.bid";
const PASSWORD = "Password123!";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  let bits = "";
  for (const char of input.replace(/=+$/, "").toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error(`unexpected base32 character ${char}`);
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** RFC 6238 SHA-1, 6 digits, 30 second step: what every authenticator app computes. */
function totp(secret: string, nowMs = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(nowMs / 1000 / 30)));
  const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0xf;
  const code =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    (((digest[offset + 1] ?? 0) & 0xff) << 16) |
    (((digest[offset + 2] ?? 0) & 0xff) << 8) |
    ((digest[offset + 3] ?? 0) & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

async function expectNoBlockingAxe(page: Page): Promise<void> {
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(
    axe.violations.filter((v) => ["critical", "serious", "moderate"].includes(v.impact ?? "")),
  ).toEqual([]);
}

async function signInWithPassword(page: Page): Promise<void> {
  await page.goto(`${issuerOrigin}/login`);
  await page.locator("#email").fill(EMAIL);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function signedInEmail(page: Page): Promise<string | null> {
  const response = await page.request.get(`${issuerOrigin}/api/auth/get-session`);
  const body = (await response.json().catch(() => null)) as { user?: { email?: string } } | null;
  return body?.user?.email ?? null;
}

test.describe("Hosted two-step verification @a11y", () => {
  test("enrol an authenticator, sign in with a backup code, then turn it off", async ({
    page,
    context,
  }) => {
    test.skip(!enabled, skipReason);
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "reduce" });

    // Enrol: password confirmation, QR and manual key, then a code from the "app".
    await signInWithPassword(page);
    await expect.poll(() => signedInEmail(page)).toBe(EMAIL);
    await page.goto(`${issuerOrigin}/two-factor/setup`);
    await expect(page.getByRole("heading", { name: "Set up two-step verification" })).toBeVisible();
    await expect(page.locator("#setup-password")).not.toHaveAttribute("required", "");
    await expectNoBlockingAxe(page);
    await page.locator("#setup-password").fill(PASSWORD);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.locator("#setup-secret")).toContainText("Manual key:");
    const secret = (await page.locator("#setup-secret").innerText())
      .replace("Manual key:", "")
      .replace(/\s+/g, "");
    await expectNoBlockingAxe(page);

    // A code pasted the way an app displays it ("123 456") is accepted.
    const code = totp(secret);
    await page.locator("#setup-totp-code").fill(`${code.slice(0, 3)} ${code.slice(3)}`);
    await expect(page.locator("#setup-totp-code")).toHaveValue(code);
    await page.getByRole("button", { name: "Verify and continue" }).click();

    await expect(page.locator("#setup-backup-list")).toBeVisible();
    const backupCodes = (await page.locator("#setup-backup-list").innerText())
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    expect(backupCodes.length).toBeGreaterThan(0);
    await expectNoBlockingAxe(page);

    // Challenge: a fresh browser signs in with the password, then answers with a backup code.
    const challengePage = await context
      .browser()
      ?.newContext()
      .then((c) => c.newPage());
    if (!challengePage) throw new Error("could not open a second browser context");
    await signInWithPassword(challengePage);
    await expect(challengePage).toHaveURL(
      (url) => url.origin === issuerOrigin && url.pathname === "/two-factor",
    );
    await expectNoBlockingAxe(challengePage);

    await challengePage.locator("#backup-code").fill("not-a-code");
    await challengePage.getByRole("button", { name: "Use backup code" }).click();
    await expect(challengePage.locator("#error")).toContainText(/backup code didn't work/i);
    await expect(challengePage.locator("#error")).toBeFocused();

    const firstCode = backupCodes[0] ?? "";
    await challengePage.locator("#backup-code").fill(firstCode.replace("-", " "));
    await challengePage.getByRole("button", { name: "Use backup code" }).click();
    await expect.poll(() => signedInEmail(challengePage)).toBe(EMAIL);
    await challengePage.context().close();

    // Clean up through the product's own screen so the seeded user can run this again.
    await page.goto(`${issuerOrigin}/two-factor/manage`);
    await page.locator("#manage-password").fill(PASSWORD);
    await page.getByRole("button", { name: "Turn off two-step verification" }).click();
    await expect(page.locator("#success")).toContainText("Two-step verification is off");
  });

  test("an expired sign-in challenge offers to start again", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await page.goto(`${issuerOrigin}/two-factor`);
    await page.locator("#totp-code").fill("123456");
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.locator("#error")).toContainText("Your sign-in timed out.");
    await expect(page.getByRole("link", { name: "Start again" })).toHaveAttribute(
      "href",
      /\/login/,
    );
  });
});
