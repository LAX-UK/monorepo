import { type Page, test } from "@playwright/test";
import {
  type StaffSession,
  type StaffTheme,
  administratorAccount,
  closeStaffSession,
  e2eEnabled,
  openStaffSession,
} from "./support/page-session.js";
import {
  BADGE_LABEL,
  BADGE_STATES,
  FIXTURE_ARTWORKS,
  FIXTURE_ORDERS,
  type MirrorState,
  expectBadgeDetails,
  expectNoBadge,
  recordsByState,
  requireFixture,
} from "./support/zoho-mirror.js";

/**
 * The "Mirrored to Zoho" badge (docs/design/staff-gaps-delivery-zoho-alerts.md, Z1–Z3) on the
 * order page and on the artwork's From Zoho record. It opens a record in each state at a desk and
 * on a phone: the fixtures the CI stack seeds (`pnpm --filter @auction/shop-api
 * seed:zoho-mirror-badge`), and otherwise whatever the environment holds, found with one batched
 * status read. In CI a state with no record fails the run rather than skipping, so no badge can
 * pass the gate unopened. The Orders list's Zoho column is in zoho-mirror-orders-column.spec.ts.
 */
const account = administratorAccount();
const themes: readonly StaffTheme[] = ["light", "dark"];

/** One order per state, from the fixtures and the first page of orders. */
async function ordersByState(page: Page): Promise<Map<MirrorState, string>> {
  const orders = await page.request.get("/api/admin/orders");
  const body = orders.ok()
    ? ((await orders.json()) as { items?: Array<{ orderId?: string }> })
    : { items: [] };
  const listed = (body.items ?? []).flatMap((item) => (item.orderId ? [item.orderId] : []));
  return recordsByState(page, "order", [...FIXTURE_ORDERS, ...listed]);
}

/** One artwork per state, from the fixtures and the first page of From Zoho › All. */
async function artworksByState(page: Page): Promise<Map<MirrorState, string>> {
  const register = await page.request.get("/api/admin/artwork-register/all");
  const body = register.ok()
    ? ((await register.json()) as { items?: Array<{ registerId?: string }> })
    : { items: [] };
  const listed = (body.items ?? []).flatMap((item) => (item.registerId ? [item.registerId] : []));
  return recordsByState(page, "artwork", [...FIXTURE_ARTWORKS, ...listed]);
}

const SURFACES = [
  { name: "order page", what: "order", find: ordersByState, path: (id: string) => `/orders/${id}` },
  {
    name: "artwork record",
    what: "artwork",
    find: artworksByState,
    path: (id: string) => `/from-zoho/${id}`,
  },
] as const;

for (const surface of SURFACES) {
  for (const theme of themes) {
    test.describe(`LAX Admin ${surface.name}, Zoho badge, ${theme} @a11y`, () => {
      test.describe.configure({ mode: "serial" });
      test.setTimeout(180_000);
      test.skip(
        !e2eEnabled || !account,
        "Set PLAYWRIGHT_E2E=1 and administrator credentials (SHOP_ADMIN_ACCEPTANCE_* or PLAYWRIGHT_STAFF_*).",
      );

      let session: StaffSession | undefined;
      let byState = new Map<MirrorState, string>();

      test.beforeAll(async ({ browser, baseURL }) => {
        if (!account || !baseURL) return;
        session = await openStaffSession({
          browser,
          baseURL,
          account,
          theme,
          viewport: { width: 1440, height: 1000 },
        });
        byState = await surface.find(session.page);
      });

      test.afterAll(async () => {
        if (session) await closeStaffSession(session);
      });

      for (const state of BADGE_STATES) {
        test(`${BADGE_LABEL[state]}: a button in the header that opens its details`, async () => {
          if (!session) throw new Error("Not signed in");
          const id = requireFixture(byState.get(state), `${surface.what}: ${BADGE_LABEL[state]}`);
          await expectBadgeDetails(session.page, surface.path(id), state);
        });
      }

      test(`an ${surface.what} with nothing to mirror has no Zoho badge`, async () => {
        if (!session) throw new Error("Not signed in");
        const id = requireFixture(byState.get("not_applicable"), `${surface.what}: not mirrored`);
        await expectNoBadge(session.page, surface.path(id));
      });
    });
  }
}
