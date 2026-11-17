// @vitest-environment jsdom
import { pinClock } from "@/test/pin-clock";
import { expectBackCloses, expectQueuePanel } from "@/test/queue-panel";
import type { AdminReleaseAlertSend, AdminReleaseAlertSendList } from "@auction/shop-contracts";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/leads/release-alerts",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));
vi.mock("@auction/ui/components/dropdown-menu", async () =>
  (await import("@/test/radix-stubs")).dropdownMenuStub(),
);
vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { ReleaseAlertSendLog } = await import("./release-alert-send-log.client");

const PATH = "/leads/release-alerts";

function release(
  id: number,
  overrides: Partial<AdminReleaseAlertSend> & Pick<AdminReleaseAlertSend, "title" | "status">,
): AdminReleaseAlertSend {
  return {
    artworkId: `0f0e0d0c-0b0a-4908-8706-00000000000${id}`,
    imageUrl: null,
    publishedAt: "2026-11-14T16:02:00.000Z",
    publishedByName: "Ada Example",
    toldSubscribers: true,
    countsKept: true,
    matched: 0,
    emailed: 0,
    waiting: 0,
    notSent: 0,
    notSentReasons: [],
    ...overrides,
  };
}

const SENT = release(1, {
  title: "Tidal study",
  status: "sent",
  matched: 412,
  emailed: 398,
  notSent: 14,
  notSentReasons: [
    { reason: "topic_off", count: 9 },
    { reason: "removed_before_sending", count: 5 },
  ],
});
const SENDING = release(2, {
  title: "Night ferry",
  status: "sending",
  matched: 1290,
  emailed: 1204,
  waiting: 86,
});
const STUCK = release(3, { title: "Salt marsh", status: "not_sent_yet", matched: 20, waiting: 20 });
const NOT_ANNOUNCED = release(4, {
  title: "Quiet harbour",
  status: "not_announced",
  toldSubscribers: false,
  publishedByName: null,
});
const QUEUED = release(5, { title: "First light", status: "queued" });
const LEGACY = release(6, {
  title: "Old pier",
  status: "counts_not_kept",
  countsKept: false,
  matched: 3,
  emailed: 3,
});

const ALL = [SENT, SENDING, STUCK, NOT_ANNOUNCED, QUEUED, LEGACY];
const PAGE: AdminReleaseAlertSendList = { items: ALL, nextCursor: "next-page" };

function renderLog(
  props: Partial<React.ComponentProps<typeof ReleaseAlertSendLog>> & {
    query?: Record<string, string>;
  } = {},
) {
  const { query = {}, ...rest } = props;
  render(
    <StaffTooltipProvider>
      <ReleaseAlertSendLog
        state={{
          ...(query.cursor ? { cursor: query.cursor } : {}),
          ...(query.release ? { open: query.release } : {}),
        }}
        page={PAGE}
        summary={{ confirmed: 412, awaitingConfirmation: 9 }}
        capabilities={["lead.read", "catalogue.read"]}
        canOpenArtwork
        {...rest}
      />
    </StaffTooltipProvider>,
  );
}

const grid = () => screen.getByRole("grid", { name: "Release alerts" });
const rowOf = (title: string) => within(grid()).getByText(title).closest("tr") as HTMLElement;

beforeEach(() => {
  push.mockReset();
  window.history.replaceState(null, "", PATH);
});

pinClock();

describe("the release-alert send log", () => {
  it("sits on the Leads page as the Release alerts tab, under the list's figures", () => {
    renderLog();
    expect(screen.getByRole("heading", { level: 1, name: "Leads" })).toBeInTheDocument();
    const tab = screen.getByRole("link", { name: "Release alerts" });
    expect(tab).toHaveAttribute("href", PATH);
    expect(tab).toHaveAttribute("aria-current", "page");
    // A history, not a queue: the tab carries no count.
    expect(tab).toHaveTextContent(/^Release alerts$/);
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/leads");
    const figures = screen.getByRole("region", { name: "Release alerts" });
    expect(within(figures).getByText("Release alert subscribers")).toBeInTheDocument();
    expect(within(figures).getByText("412")).toBeInTheDocument();
  });

  it("gives each release its status in words", () => {
    renderLog();
    expect(within(rowOf("Tidal study")).getByText("Sent")).toBeInTheDocument();
    expect(within(rowOf("Night ferry")).getByText("Sending")).toBeInTheDocument();
    expect(within(rowOf("Salt marsh")).getByText("Not sent yet")).toBeInTheDocument();
    expect(within(rowOf("Quiet harbour")).getByText("Not announced")).toBeInTheDocument();
    expect(within(rowOf("First light")).getByText("Queued")).toBeInTheDocument();
    expect(within(rowOf("Old pier")).getByText("Counts not kept")).toBeInTheDocument();
  });

  it("shows the counts, the London time and who published it", () => {
    renderLog();
    const row = rowOf("Night ferry");
    for (const count of ["1,290", "1,204", "86"]) {
      expect(within(row).getByText(count)).toBeInTheDocument();
    }
    const time = within(row).getByText("14 Nov 2026, 16:02");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", "2026-11-14T16:02:00.000Z");
    expect(within(row).getByText("by Ada Example")).toBeInTheDocument();
    expect(within(rowOf("Quiet harbour")).queryByText(/^by /)).toBeNull();
  });

  it("links each row to its own panel, on the page shown", () => {
    renderLog({ query: { cursor: "page-2" } });
    expect(within(rowOf("Tidal study")).getByRole("link", { name: "Tidal study" })).toHaveAttribute(
      "href",
      `${PATH}?cursor=page-2&release=${SENT.artworkId}`,
    );
  });

  it("pages with the read's cursor and back to the first page", () => {
    renderLog({ query: { cursor: "page-2" } });
    expect(screen.getByText("6 releases on this page")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Next/ })).toHaveAttribute(
      "href",
      `${PATH}?cursor=next-page`,
    );
    expect(screen.getByRole("link", { name: /First page/ })).toHaveAttribute("href", PATH);
  });

  it("offers the artwork from the row menu only to roles that can open it", () => {
    renderLog();
    expect(
      within(rowOf("Tidal study")).getByRole("link", { name: "Open artwork" }),
    ).toHaveAttribute("href", `/artworks/${SENT.artworkId}`);
  });

  it("leaves the artwork out for a role that cannot open artworks", () => {
    renderLog({ canOpenArtwork: false, capabilities: ["lead.read"] });
    expect(within(rowOf("Tidal study")).queryByRole("link", { name: "Open artwork" })).toBeNull();
  });
});

describe("the send log's states", () => {
  it("says what will appear when nothing has been published yet (L5)", () => {
    renderLog({ page: { items: [], nextCursor: null } });
    expect(screen.getByText("No release alerts yet")).toBeInTheDocument();
    expect(
      screen.getByText("When you publish an edition and tick Tell subscribers, it appears here."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/on this page/)).toBeNull();
  });

  it("says the log did not load and tries the same page again (L5)", () => {
    renderLog({ page: { items: [], nextCursor: null }, loadFailed: true, query: { cursor: "p2" } });
    expect(screen.getByText("Release alerts could not be loaded")).toBeInTheDocument();
    expect(screen.queryByText("No release alerts yet")).toBeNull();
    screen.getByRole("button", { name: "Try again" }).click();
    expect(push).toHaveBeenCalledWith(`${PATH}?cursor=p2`, { scroll: false });
  });

  it("shows no figures when they could not be read, and still lists the releases", () => {
    renderLog({ summary: null });
    expect(screen.queryByText("Release alert subscribers")).toBeNull();
    expect(rowOf("Tidal study")).toBeInTheDocument();
  });
});

describe("a release's panel", () => {
  it("is the record: opens from its URL with the counts and why some were not sent", async () => {
    renderLog({ query: { release: SENT.artworkId } });
    const panel = await screen.findByRole("dialog", { name: /Tidal study/ });
    expect(within(panel).getByText("Sent")).toBeInTheDocument();
    expect(within(panel).getByText("14 Nov 2026, 16:02")).toBeInTheDocument();
    expect(within(panel).getByText("Ada Example")).toBeInTheDocument();
    expect(within(panel).getByText("398")).toBeInTheDocument();
    expect(
      within(panel).getByText("9 people had turned off emails about new editions."),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText("5 people were removed from the list before it went."),
    ).toBeInTheDocument();
    // No page of its own; the way on is the artwork.
    expect(within(panel).queryByRole("link", { name: "Open full page" })).toBeNull();
    expect(within(panel).getByRole("link", { name: "Open artwork" })).toHaveAttribute(
      "href",
      `/artworks/${SENT.artworkId}`,
    );
    // Counts only: nobody on the list is named.
    expect(within(panel).queryByText(/@/)).toBeNull();
  });

  it("says the publisher chose not to tell subscribers", async () => {
    renderLog({ query: { release: NOT_ANNOUNCED.artworkId } });
    const panel = await screen.findByRole("dialog", { name: /Quiet harbour/ });
    expect(within(panel).getByText("Publisher chose not to tell subscribers.")).toBeInTheDocument();
    expect(within(panel).getByText("Not recorded")).toBeInTheDocument();
  });

  it("flags a release stuck for more than a day", async () => {
    renderLog({ query: { release: STUCK.artworkId } });
    const panel = await screen.findByRole("dialog", { name: /Salt marsh/ });
    expect(within(panel).getByText(/still unsent more than a day after/)).toBeInTheDocument();
  });

  it("says when the details are no longer kept in full", async () => {
    renderLog({ query: { release: LEGACY.artworkId } });
    const panel = await screen.findByRole("dialog", { name: /Old pier/ });
    expect(within(panel).getByText(/^Details no longer kept in full/)).toBeInTheDocument();
  });

  it("has no artwork link for a role that cannot open artworks", async () => {
    renderLog({ query: { release: SENT.artworkId }, canOpenArtwork: false });
    const panel = await screen.findByRole("dialog", { name: /Tidal study/ });
    expect(within(panel).queryByRole("link", { name: "Open artwork" })).toBeNull();
  });

  it("opens from the row with the release in the URL, steps with J and K, and Esc returns", async () => {
    renderLog();
    await expectQueuePanel({
      grid: "Release alerts",
      path: PATH,
      param: "release",
      first: { link: "Tidal study", panel: /Tidal study/, id: SENT.artworkId },
      second: { link: "Night ferry", panel: /Night ferry/, id: SENDING.artworkId },
      total: ALL.length,
    });
  });

  it("closes on Back", async () => {
    renderLog();
    await expectBackCloses({
      grid: "Release alerts",
      path: PATH,
      record: { link: "Night ferry", panel: /Night ferry/, id: SENDING.artworkId },
    });
  });
});
