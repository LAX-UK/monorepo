import { randomUUID } from "node:crypto";
import { type Browser, type BrowserContext, type Page, expect } from "@playwright/test";
import pg from "pg";

export {
  BUYER_AGENT_BID_LIMIT,
  ORGANISATION_JOURNEY_IDS,
  ORGANISATION_JOURNEY_NAMES,
} from "../../../../packages/db/src/seed/dev/organisation-journey-ids";

const ACTING_COOKIE = "lax_acting_legal_entity_id";
const DEFAULT_BASE_URL = "http://localhost:3000";

type MenuAccount = { id: string; kind: "personal" | "organisation"; name: string };

/** A signed-in member acting for one organisation, in a context of their own. */
export type OrganisationSession = {
  context: BrowserContext;
  page: Page;
  organisation: MenuAccount;
  /** The web origin, which the proxy checks on every write. */
  origin: string;
  close: () => Promise<void>;
};

async function accountsOf(page: Page): Promise<MenuAccount[]> {
  const res = await page.request.get("/api/me/menu-context");
  expect(res.ok(), `menu context answered ${res.status()}`).toBe(true);
  const body = (await res.json()) as { accounts: MenuAccount[] | null };
  return body.accounts ?? [];
}

/**
 * Opens a member's saved session in a fresh context, acting for `organisationName`. The acting
 * account is chosen the way an earlier visit would have left it, so nobody's remembered account
 * on their profile changes for other specs.
 */
export async function openAs(
  browser: Browser,
  storageState: string,
  organisationName: string,
  baseURL?: string,
): Promise<OrganisationSession> {
  const origin = new URL(baseURL ?? DEFAULT_BASE_URL).origin;
  const context = await browser.newContext({ storageState, baseURL: origin });
  const page = await context.newPage();
  const accounts = await accountsOf(page);
  const organisation = accounts.find(
    (account) => account.kind === "organisation" && account.name === organisationName,
  );
  if (!organisation) {
    throw new Error(
      `No organisation named ${organisationName} among: ${accounts.map((a) => a.name).join(", ")}`,
    );
  }
  await context.addCookies([{ name: ACTING_COOKIE, value: organisation.id, url: origin }]);
  return { context, page, organisation, origin, close: () => context.close() };
}

/** Places a bid through the same proxy the lot page uses, for the organisation in use. */
export async function placeBid(
  session: OrganisationSession,
  lotId: string,
  amount: number,
): Promise<{ status: number; error: string; code: string | null }> {
  const res = await session.page.request.post("/api/bff/bids", {
    headers: {
      origin: session.origin,
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
      "x-legal-entity-id": session.organisation.id,
    },
    data: { lotId, amount },
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  return { status: res.status(), error: body.error ?? "", code: body.code ?? null };
}

/**
 * The link in the most recent invitation email sent to `email`. Emails are queued in the outbox
 * with their variables, so the journey reads the link from there instead of a mailbox.
 */
export async function invitationLinkFor(email: string): Promise<string> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required to read the invitation link");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<{ link: string | null }>(
      `select vars->>'actionUrl' as link
         from email_outbox
        where template = 'access-invite' and lower(vars->>'inviteeEmail') = lower($1)
        order by created_at desc
        limit 1`,
      [email],
    );
    const link = result.rows[0]?.link;
    if (!link) throw new Error(`No invitation email was queued for ${email}`);
    return link;
  } finally {
    await client.end();
  }
}

/** Switches from one organisation to another through the account switcher, as a person would. */
export async function switchOrganisation(
  page: Page,
  from: string,
  to: string,
  timeout = 10_000,
): Promise<void> {
  await page
    .getByRole("button", { name: `Account: ${from},` })
    .first()
    .click();
  await page.getByTestId("switch-account-organisation").filter({ hasText: to }).click();
  await expect(page.getByTestId("account-switcher")).toContainText(to, { timeout });
}

/** The Undo button of the toast that says `message`, so an earlier toast's Undo is not chosen. */
export function undoOf(page: Page, message: string) {
  return page
    .locator("[data-sonner-toast]")
    .filter({ hasText: message })
    .getByRole("button", { name: "Undo" });
}

/** The access page a role sees when it opens an address it may not use. */
export async function expectNoAccess(page: Page, path: string): Promise<void> {
  await page.goto(path);
  const refusal = page
    .getByText(/You don't have access to/)
    .or(page.getByText(/doesn't include its settings/));
  await expect(refusal.first(), `${path} should show the access page`).toBeVisible();
}

/** Opens a page and checks it is not the access page, so a role reaches what it should. */
export async function expectAccess(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByText(/You don't have access to/)).toHaveCount(0);
  await expect(page.getByText(/doesn't include its settings/)).toHaveCount(0);
}

/** The account switcher at the top of the sidebar: the one place that names the account and the role. */
export async function expectActingAs(
  page: Page,
  organisationName: string,
  roleLabel: string,
): Promise<void> {
  const switcher = page.getByTestId("account-switcher");
  await expect(switcher).toContainText(organisationName);
  await expect(switcher).toContainText(roleLabel);
}
