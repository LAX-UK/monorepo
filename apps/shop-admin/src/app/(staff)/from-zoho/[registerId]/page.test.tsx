import type { StaffToolsAnswer } from "@/server/ports/staff-tools-access";
import { describe, expect, it, vi } from "vitest";

const { fetchAdminJson, loadAdminSession, toolsFor, redirect, notFound } = vi.hoisted(() => ({
  fetchAdminJson: vi.fn(),
  loadAdminSession: vi.fn(),
  toolsFor: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));
vi.mock("@/server/application/load-admin-data", () => ({ fetchAdminJson, loadAdminSession }));
vi.mock("@/server/application/load-bid-admin-url", () => ({ loadBidAdminUrl: async () => null }));
// The real "may this person open Failed jobs" path, down to Bid's answer for the session.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "session-1" }) }),
}));
vi.mock("@/server/container", () => ({
  getShopAdminContainer: () => ({
    config: {
      NODE_ENV: "test",
      bidPublicUrl: "https://bid.example.test",
      crmRecordUrlTemplate: null,
    },
    sessions: { get: async () => ({ subject: "staff-1", idToken: "id-token" }) },
    staffTools: { toolsFor },
  }),
}));
vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/components/from-zoho/from-zoho-record.client", () => ({ FromZohoRecord: () => null }));

const { default: FromZohoRecordPage } = await import("./page");

const REGISTER_ID = "2a0e5d00-0000-4000-8000-0000000000a1";
const DETAIL_PATH = `artwork-register/${REGISTER_ID}`;
const STATUS_PATH = `zoho-mirror/status?entity=artwork&id=${REGISTER_ID}`;
const DETAIL = {
  registerId: REGISTER_ID,
  title: "Fixture",
  zohoProductId: "p-1",
  zohoModule: null,
};

function mirror(state: string) {
  return {
    entity: "artwork",
    id: REGISTER_ID,
    state,
    consumer: "zoho_artwork_writeback",
    notApplicableReason: state === "not_applicable" ? "not_in_register" : null,
    mode: "live",
    lastAttemptAt: "2026-11-14T16:02:00.000Z",
    nextRetryAt: null,
    attempts: 1,
    providerReference: state === "mirrored" ? "Product:SEED-ZM-1" : null,
    error: null,
  };
}

const ADMINISTRATOR: StaffToolsAnswer = {
  status: "ok",
  tools: ["bid-admin", "lax-admin"],
  failedJobSources: ["background_jobs", "integrations.zoho"],
};
const SPECIALIST: StaffToolsAnswer = {
  status: "ok",
  tools: ["bid-admin", "lax-admin"],
  failedJobSources: [],
};

const session = (capabilities: string[]) => ({ status: "ok", data: { capabilities } });

function respond(status: { status: string; data?: unknown }) {
  vi.clearAllMocks();
  toolsFor.mockResolvedValue(ADMINISTRATOR);
  loadAdminSession.mockResolvedValue(session(["artwork_register.read"]));
  fetchAdminJson.mockImplementation(async (path: string) =>
    path === STATUS_PATH ? status : { status: "ok", data: DETAIL },
  );
}

type RecordProps = {
  zohoMirror: { state: string; label: string; failedJobsHref: string | null } | null;
};

async function zohoMirrorProp() {
  const element = (await FromZohoRecordPage({
    params: Promise.resolve({ registerId: REGISTER_ID }),
  })) as { props: RecordProps };
  return element.props.zohoMirror;
}

describe("From Zoho record page, the Zoho badge", () => {
  it("reads the artwork's Zoho status alongside the record, not after it", async () => {
    respond({ status: "ok", data: mirror("mirrored") });
    let detailInFlight = 0;
    const seenWhileDetailInFlight: string[] = [];
    fetchAdminJson.mockImplementation(async (path: string) => {
      if (path === DETAIL_PATH) {
        detailInFlight++;
        await new Promise((resolve) => setTimeout(resolve, 0));
        detailInFlight--;
        return { status: "ok", data: DETAIL };
      }
      if (detailInFlight > 0) seenWhileDetailInFlight.push(path);
      return { status: "ok", data: mirror("mirrored") };
    });
    expect(await zohoMirrorProp()).toMatchObject({
      state: "mirrored",
      label: "Mirrored to Zoho",
      failedJobsHref: null,
    });
    expect(seenWhileDetailInFlight).toContain(STATUS_PATH);
    expect(fetchAdminJson.mock.calls.filter(([path]) => path === STATUS_PATH)).toHaveLength(1);
    // Bid is asked only when the artwork is not in Zoho.
    expect(toolsFor).not.toHaveBeenCalled();
  });

  it.each([
    ["pending", "Sending to Zoho"],
    ["dry_run", "Zoho dry run"],
  ])("gives the record a %s badge", async (state, label) => {
    respond({ status: "ok", data: mirror(state) });
    expect(await zohoMirrorProp()).toMatchObject({ state, label, failedJobsHref: null });
  });

  it("links Not in Zoho to Failed jobs only for people Bid shows its Zoho rows to", async () => {
    respond({ status: "ok", data: mirror("failed") });
    expect(await zohoMirrorProp()).toMatchObject({
      state: "failed",
      label: "Not in Zoho",
      failedJobsHref: "https://bid.example.test/admin/failed-jobs?source=integrations",
    });
    respond({ status: "ok", data: mirror("failed") });
    toolsFor.mockResolvedValue(SPECIALIST);
    expect(await zohoMirrorProp()).toMatchObject({ state: "failed", failedJobsHref: null });
  });

  it.each(["failed", "forbidden", "not_found"])(
    "still shows the record, without a badge, when the Zoho read is %s",
    async (status) => {
      respond({ status });
      expect(await zohoMirrorProp()).toBeNull();
    },
  );

  it("draws no badge for an artwork with nothing to mirror", async () => {
    respond({ status: "ok", data: mirror("not_applicable") });
    expect(await zohoMirrorProp()).toBeNull();
  });
});

describe("From Zoho record page, the Consignor section", () => {
  async function consignorPanel(kind: string, capabilities: string[]) {
    respond({ status: "ok", data: mirror("mirrored") });
    fetchAdminJson.mockImplementation(async (path: string) =>
      path === STATUS_PATH
        ? { status: "ok", data: mirror("mirrored") }
        : { status: "ok", data: { ...DETAIL, kind } },
    );
    loadAdminSession.mockResolvedValue(session(capabilities));
    const element = (await FromZohoRecordPage({
      params: Promise.resolve({ registerId: REGISTER_ID }),
    })) as { props: { consignorPanel: unknown } };
    return element.props.consignorPanel;
  }

  it("shows the section on an original to people who can read consignor agreements", async () => {
    expect(
      await consignorPanel("original", ["artwork_register.read", "consignor_agreement.read"]),
    ).not.toBeNull();
  });

  it("leaves the section out for people who cannot read consignor agreements", async () => {
    expect(await consignorPanel("original", ["artwork_register.read"])).toBeNull();
    expect(fetchAdminJson.mock.calls.map(([path]) => path)).not.toContain(
      `${DETAIL_PATH}/consignor`,
    );
  });

  it("leaves the section out on a print", async () => {
    expect(
      await consignorPanel("print", ["artwork_register.read", "consignor_agreement.read"]),
    ).toBeNull();
  });
});
