// @vitest-environment jsdom
import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import type { ZohoQueueQuery } from "@/server/domain/zoho-register.vm";
import type { AdminZohoLinkReport } from "@auction/shop-contracts";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DIFFERENT, candidate, idOf, linkedRow, report, row } from "./link-fixtures";

const { push, refresh, getReport, linkMany, setSwitch, search, preview, toastSuccess } = vi.hoisted(
  () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    getReport: vi.fn(),
    linkMany: vi.fn(),
    setSwitch: vi.fn(),
    search: vi.fn(),
    preview: vi.fn(),
    toastSuccess: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => "/from-zoho",
}));
vi.mock("@/server/application/admin-zoho-link-actions.server", () => ({
  getZohoLinkReport: (...args: unknown[]) => getReport(...args),
  linkToZoho: vi.fn(),
  linkManyToZoho: (...args: unknown[]) => linkMany(...args),
  setBlockUnlinkedPublish: (...args: unknown[]) => setSwitch(...args),
  searchZohoRecords: (...args: unknown[]) => search(...args),
  getZohoLinkPreview: (...args: unknown[]) => preview(...args),
  unlinkFromZoho: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { LinkLaxArtReport } = await import("./link-lax-art-report.client");

const EDITOR = [
  "artwork_register.read",
  "artwork_register.review",
  "catalogue.read",
  "catalogue.write",
];
const ADMIN = [...EDITOR, "settings.write", "artwork_register.unlink"];
const READ_ONLY = ["artwork_register.read", "catalogue.read"];
const COUNTS = { new: 3, decisions: 1 };

function show(
  data: AdminZohoLinkReport = report(),
  query: ZohoQueueQuery = { tab: "link" },
  capabilities: string[] = EDITOR,
) {
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={laxStaffAccess(capabilities, "Catalogue editor")}>
        <LinkLaxArtReport query={query} counts={COUNTS} report={data} />
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

const named = (n: number, title: string, artistName = "Ada Rowe", differs = false) =>
  row(
    n,
    {
      rule: n === 1 ? "stock_code" : "artist_title_and_size",
      candidates: [candidate(n, differs ? { comparison: DIFFERENT } : {})],
    },
    { title, artistName },
  );

const MATCHED = [
  named(1, "Harbour at dusk", "Ben Ilsley", true),
  named(2, "Sun disc", "Dev Patel"),
  named(3, "Blue weave"),
];
const TAKEN = candidate(5, {
  refusal: "This record is already linked to ‘Harbour at dusk’.",
  record: { linkedTo: "Harbour at dusk", title: "Harbour, early light" },
});
const CHOICE = [
  row(4, { candidates: [candidate(4), candidate(6), TAKEN], rule: null }, { title: "Quiet river" }),
];
const NONE = [
  row(7, { candidates: [], rule: null, reason: "artist_has_no_zoho_code" }, { title: "Untitled" }),
];
const LINKED = [linkedRow(8, { linkedBy: "Lena Hart" })];
const FULL = report({ matched: MATCHED, needsChoice: CHOICE, noMatch: NONE, linked: LINKED });

beforeEach(() => {
  for (const mock of [
    push,
    refresh,
    getReport,
    linkMany,
    setSwitch,
    search,
    preview,
    toastSuccess,
  ]) {
    mock.mockReset();
  }
});

describe("Link lax.art report: the parts", () => {
  it("is a list with a control for Matched, Needs a choice, No match and Linked, each with its count", () => {
    show(FULL);
    const control = screen.getByRole("group", { name: "Part of the report" });
    for (const label of ["Matched 3", "Needs a choice 1", "No match 1", "Linked 1"]) {
      expect(within(control).getByRole("radio", { name: label })).toBeInTheDocument();
    }
    expect(within(control).getByRole("radio", { name: "Matched 3" })).toBeChecked();
  });

  it("moves to another part through the address, so back and links work", () => {
    show(FULL);
    fireEvent.click(screen.getByRole("radio", { name: "Needs a choice 1" }));
    expect(push).toHaveBeenCalledWith("/from-zoho?tab=link&view=choice", { scroll: false });
  });

  it("shows the headline numbers, with how many are linked of all", () => {
    show(FULL);
    const stats = screen.getByRole("region", { name: "Link lax.art" });
    expect(within(stats).getByText("ready to confirm")).toBeInTheDocument();
    expect(stats).toHaveTextContent("of 6");
    expect(stats).toHaveTextContent("Nothing is linked until you confirm");
  });
});

describe("Matched", () => {
  it("is a table with a Matched on column, the record, and whether it differs", () => {
    show(FULL);
    const table = screen.getByRole("grid");
    for (const heading of ["lax.art listing", "Zoho record", "Matched on", "Differences"]) {
      expect(within(table).getByRole("columnheader", { name: heading })).toBeInTheDocument();
    }
    expect(within(table).getByText("Stock code")).toBeInTheDocument();
    expect(within(table).getAllByText("Artist and title").length).toBeGreaterThan(0);
    expect(within(table).getByText("2 differences")).toBeInTheDocument();
    expect(within(table).getAllByText("Same").length).toBe(2);
    expect(within(table).getByText("Ben Ilsley · Live on lax.art")).toBeInTheDocument();
  });

  it("selects rows and offers Link N… in the bulk bar, then confirms them together", async () => {
    linkMany.mockResolvedValue({
      ok: true,
      data: {
        outcomes: MATCHED.slice(0, 2).map((r) => ({
          artworkId: r.listing.artworkId,
          registerId: r.candidates[0]?.record.registerId,
          status: "linked",
          message: null,
          nowOnLaxArt: true,
          replaced: [],
        })),
      },
    });
    getReport.mockResolvedValue({ ok: true, data: report() });
    show(FULL);
    const boxes = within(screen.getByRole("grid")).getAllByRole("checkbox");
    expect(boxes.length).toBe(MATCHED.length + 1);
    expect(screen.queryByRole("button", { name: /^Link \d/ })).toBeNull();
    fireEvent.click(boxes[1] as HTMLElement);
    fireEvent.click(boxes[2] as HTMLElement);
    expect(screen.getAllByText(/2.*selected/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Link 2…" }));
    expect(await screen.findByText("Link 2 lax.art listings to Zoho?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Link 2 listings" }));
    expect(await screen.findByText("Linking finished")).toBeInTheDocument();
    expect(linkMany).toHaveBeenCalledWith([
      { artworkId: idOf(3), registerId: idOf(1003) },
      { artworkId: idOf(1), registerId: idOf(1001) },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(getReport).toHaveBeenCalled());
  });

  it("clears the selection from the bulk bar", () => {
    show(FULL);
    fireEvent.click(within(screen.getByRole("grid")).getAllByRole("checkbox")[1] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByRole("button", { name: /^Link \d/ })).toBeNull();
  });

  it("opens the review dialog, prefilled with the matched record, when a row is opened", async () => {
    show(FULL);
    fireEvent.click(
      within(screen.getByRole("grid")).getAllByText("Zoho title 1")[0] as HTMLElement,
    );
    expect(
      await screen.findByText("Harbour at dusk · Ben Ilsley · Live on lax.art"),
    ).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "What linking changes" })).toBeInTheDocument();
  });

  it("narrows by search and says so when nothing matches", () => {
    show(FULL, { tab: "link", q: "sun" });
    expect(screen.getAllByText("Sun disc").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Blue weave")).toHaveLength(0);
  });

  it("says no artworks match when a filter leaves nothing", () => {
    show(FULL, { tab: "link", q: "zzzz" });
    expect(screen.getByText("No artworks match")).toBeInTheDocument();
  });

  it("filters to one artist, one rule or live and draft", () => {
    show(FULL, { tab: "link", artist: "Dev Patel" });
    expect(screen.getAllByText("Sun disc").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Blue weave")).toHaveLength(0);
  });

  it("says when nothing is matched", () => {
    show(report({ needsChoice: CHOICE }));
    expect(screen.getByText("Nothing is matched")).toBeInTheDocument();
  });
});

describe("Needs a choice", () => {
  const query: ZohoQueueQuery = { tab: "link", view: "choice" };

  it("lists the records to choose from and says which are linked to another listing", () => {
    show(FULL, query);
    const list = screen.getAllByRole("list", {
      name: "Records that could be Quiet river",
    })[0] as HTMLElement;
    expect(within(list).getAllByRole("button", { name: /^Choose/ })).toHaveLength(2);
    expect(within(list).getByText("Linked to ‘Harbour at dusk’")).toBeInTheDocument();
  });

  it("opens the review with the chosen record selected", async () => {
    show(FULL, query);
    fireEvent.click(
      screen.getAllByRole("button", { name: /Choose LAX-ORI-AR-TM-26-0006/ })[0] as HTMLElement,
    );
    const radio = await screen.findByRole("radio", { name: /LAX-ORI-AR-TM-26-0006/ });
    expect(radio).toBeChecked();
    expect(screen.getByRole("radio", { name: /LAX-ORI-AR-TM-26-0005/ })).toBeDisabled();
  });

  it("has no checkboxes: only Matched rows are linked in bulk", () => {
    show(FULL, query);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});

describe("No match", () => {
  it("says why, and opens a search for the record", async () => {
    show(FULL, { tab: "link", view: "none" });
    expect(
      screen.getAllByText(/The artist has no Zoho artist code, and a title alone is never enough/)
        .length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Find in Zoho…" })[0] as HTMLElement);
    expect(await screen.findByLabelText("Search Zoho records")).toBeInTheDocument();
  });
});

describe("Linked", () => {
  it("lists what has been linked and who did it", () => {
    show(FULL, { tab: "link", view: "linked" });
    const table = screen.getByRole("grid");
    expect(within(table).getByRole("columnheader", { name: "Linked by" })).toBeInTheDocument();
    expect(within(table).getAllByText("Lena Hart").length).toBeGreaterThan(0);
  });

  it("says nothing is linked yet", () => {
    show(report({ matched: MATCHED }), { tab: "link", view: "linked" });
    expect(screen.getByText("Nothing is linked yet")).toBeInTheDocument();
  });
});

describe("when every original is linked", () => {
  it("says so in the empty state", () => {
    show(report({ linked: LINKED }));
    expect(screen.getByText("Every lax.art original is linked to Zoho")).toBeInTheDocument();
  });
});

describe("Check again", () => {
  it("reads the report again and shows the new result", async () => {
    getReport.mockResolvedValue({ ok: true, data: report({ matched: [MATCHED[0] as never] }) });
    show(FULL);
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.getByRole("radio", { name: "Matched 1" })).toBeInTheDocument();
  });

  it("keeps the old report and says so when it cannot check", async () => {
    getReport.mockResolvedValue(null);
    show(FULL);
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByText("Could not check again")).toBeInTheDocument();
    expect(screen.getAllByText("Sun disc").length).toBeGreaterThan(0);
  });
});

describe("the publish switch", () => {
  it("is turned on by an Administrator", async () => {
    setSwitch.mockResolvedValue({ ok: true, data: { blockUnlinkedPublish: true } });
    show(FULL, { tab: "link" }, ADMIN);
    fireEvent.click(screen.getByRole("switch", { name: "Block publishing unlinked originals" }));
    await waitFor(() => expect(setSwitch).toHaveBeenCalledWith(true));
  });

  it("can be seen but not changed by anyone else", () => {
    show(FULL);
    expect(
      screen.getByRole("switch", { name: "Block publishing unlinked originals" }),
    ).toBeDisabled();
    expect(screen.getByText(/Only an Administrator can change it/)).toBeInTheDocument();
  });
});

describe("read-only", () => {
  it("shows every part and match but no way to link", () => {
    show(FULL, { tab: "link" }, READ_ONLY);
    expect(screen.getAllByText("Harbour at dusk").length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("menuitem", { name: "Review and link…" })).toBeNull();
    expect(screen.getByText(/View only/)).toBeInTheDocument();
  });
});
