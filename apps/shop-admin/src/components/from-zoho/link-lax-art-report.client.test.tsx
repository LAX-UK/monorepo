// @vitest-environment jsdom
import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DIFFERENT, candidate, idOf, report, row } from "./link-fixtures";

const { refresh, getReport, link, linkMany, setSwitch, search, preview, toastSuccess } = vi.hoisted(
  () => ({
    refresh: vi.fn(),
    getReport: vi.fn(),
    link: vi.fn(),
    linkMany: vi.fn(),
    setSwitch: vi.fn(),
    search: vi.fn(),
    preview: vi.fn(),
    toastSuccess: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
  usePathname: () => "/from-zoho",
}));
vi.mock("@/server/application/admin-zoho-link-actions.server", () => ({
  getZohoLinkReport: (...args: unknown[]) => getReport(...args),
  linkToZoho: (...args: unknown[]) => link(...args),
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

function show(data = report(), capabilities: string[] = EDITOR) {
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={laxStaffAccess(capabilities, "Catalogue editor")}>
        <LinkLaxArtReport query={{ tab: "link" }} counts={COUNTS} report={data} />
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

const MATCHED = row(1, { candidates: [candidate(1, { differences: [...DIFFERENT] })] });
const CHOICE = row(2, {
  candidates: [candidate(2), candidate(3)],
  rule: null,
});
const NONE = row(
  4,
  { candidates: [], rule: null, reason: "artist_has_no_zoho_code" },
  {
    artistCode: null,
  },
);

beforeEach(() => {
  for (const mock of [
    refresh,
    getReport,
    link,
    linkMany,
    setSwitch,
    search,
    preview,
    toastSuccess,
  ]) {
    mock.mockReset();
  }
});

describe("Link lax.art report", () => {
  it("groups every unlinked original as Matched, Needs a choice or No match", () => {
    show(report({ matched: [MATCHED], needsChoice: [CHOICE], noMatch: [NONE] }));
    expect(screen.getByRole("heading", { name: /Matched \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Needs a choice \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /No match \(1\)/ })).toBeInTheDocument();
    const choice = screen.getByRole("list", { name: "Records that could be lax.art work 2" });
    expect(within(choice).getAllByRole("listitem")).toHaveLength(2);
    expect(
      screen.getByText(/The artist has no Zoho artist code, and a title alone is never enough/),
    ).toBeInTheDocument();
  });

  it("says why a matched row matched and flags that it differs from Zoho", () => {
    show(report({ matched: [MATCHED] }));
    expect(screen.getByText("Same artist and title")).toBeInTheDocument();
    expect(screen.getByText(/Differs from Zoho: title, year/)).toBeInTheDocument();
  });

  it("shows the register's refusal on a matched row that is held elsewhere", () => {
    const held = row(5, {
      candidates: [
        candidate(5, {
          refusal: "This artwork is in a LAX Bid sale. Withdraw the lot there first.",
        }),
      ],
    });
    show(report({ matched: [held] }));
    expect(screen.getByText(/This artwork is in a LAX Bid sale/)).toBeInTheDocument();
  });

  it("hides the tab content and says so when every original is linked", () => {
    show(report());
    expect(screen.getByText("Every lax.art original is linked to Zoho")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check again" })).not.toBeInTheDocument();
  });

  it("has nothing to confirm for a group that is empty", () => {
    show(report({ noMatch: [NONE] }));
    expect(screen.getByText("Nothing matched yet.")).toBeInTheDocument();
    expect(screen.getByText("Nothing needs a choice.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Link \d+ matched/ })).not.toBeInTheDocument();
  });
});

describe("Check again", () => {
  it("reads the report again and shows the new result", async () => {
    getReport.mockResolvedValue({ ok: true, data: report({ matched: [row(7), row(8)] }) });
    show(report({ noMatch: [NONE] }));
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByRole("heading", { name: /Matched \(2\)/ })).toBeInTheDocument();
    expect(getReport).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the old report and says so when it cannot check", async () => {
    getReport.mockResolvedValue({ ok: false, kind: "failed", message: "Could not check again." });
    show(report({ matched: [MATCHED] }));
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByText("Could not check again.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Matched \(1\)/ })).toBeInTheDocument();
  });
});

describe("linking one artwork", () => {
  it("shows what Zoho will change, with lax.art's old value struck through, before confirming", () => {
    show(report({ matched: [MATCHED] }));
    fireEvent.click(screen.getByRole("button", { name: "Review and link…" }));
    const dialog = screen.getByRole("dialog");
    const title = within(dialog).getByText("Tidal margin IV");
    expect(title).toBeInTheDocument();
    const old = within(dialog).getByText("Tidal Margin 4");
    expect(old.closest(".line-through")).not.toBeNull();
    expect(dialog.querySelector('[data-difference="year"]')).not.toBeNull();
    expect(within(dialog).getByText(/The web address is kept/)).toBeInTheDocument();
    expect(link).not.toHaveBeenCalled();
  });

  it("links on confirm and reads the report again", async () => {
    link.mockResolvedValue({
      ok: true,
      data: {
        status: "linked",
        artworkId: idOf(1),
        registerId: idOf(1001),
        message: null,
        nowOnLaxArt: true,
        replaced: [],
      },
    });
    getReport.mockResolvedValue({ ok: true, data: report() });
    show(report({ matched: [MATCHED] }));
    fireEvent.click(screen.getByRole("button", { name: "Review and link…" }));
    fireEvent.click(screen.getByRole("button", { name: "Link artwork" }));
    await waitFor(() =>
      expect(link).toHaveBeenCalledWith({ artworkId: idOf(1), registerId: idOf(1001) }),
    );
    await waitFor(() => expect(getReport).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith("Linked to the Zoho record");
  });

  it("shows the register's words when the link is refused, and stays open", async () => {
    link.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "This artwork is in a LAX Bid sale. Withdraw the lot there first.",
    });
    show(report({ matched: [MATCHED] }));
    fireEvent.click(screen.getByRole("button", { name: "Review and link…" }));
    fireEvent.click(screen.getByRole("button", { name: "Link artwork" }));
    expect(await screen.findByText(/This artwork is in a LAX Bid sale/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(getReport).not.toHaveBeenCalled();
  });

  it("offers no Link button when the record is held elsewhere", () => {
    const held = row(5, { candidates: [candidate(5, { refusal: "Sold in the gallery." })] });
    show(report({ matched: [held] }));
    fireEvent.click(screen.getByRole("button", { name: "Review and link…" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Sold in the gallery.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Link artwork" })).not.toBeInTheDocument();
  });

  it("lets staff choose between candidates, one at a time", () => {
    show(report({ needsChoice: [CHOICE] }));
    fireEvent.click(
      screen.getByRole("button", {
        name: `Choose ${candidate(3).record.stockCode} for lax.art work 2`,
      }),
    );
    expect(
      within(screen.getByRole("dialog")).getByText(candidate(3).record.title),
    ).toBeInTheDocument();
  });
});

describe("linking Matched rows in bulk", () => {
  const two = [MATCHED, row(6)];

  it("lists what will change on each, differing rows first, and leaves out refused rows with the reason", () => {
    const held = row(9, { candidates: [candidate(9, { refusal: "Sold in the gallery." })] });
    show(report({ matched: [row(6), MATCHED, held] }));
    fireEvent.click(screen.getByRole("button", { name: "Link 2 matched…" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("1 of 2 differ from Zoho, shown first.")).toBeInTheDocument();
    expect(within(dialog).getByText(/1 matched artwork will be left out/)).toBeInTheDocument();
    expect(within(dialog).getByText(/lax.art work 9: Sold in the gallery\./)).toBeInTheDocument();
    const items = within(dialog)
      .getAllByRole("listitem")
      .filter((li) => li.matches("ul.flex > li"));
    expect(items[0]?.textContent).toContain("lax.art work 1");
    expect(linkMany).not.toHaveBeenCalled();
  });

  it("links only the Matched rows and reports each outcome", async () => {
    linkMany.mockResolvedValue({
      ok: true,
      data: {
        outcomes: [
          {
            artworkId: idOf(1),
            registerId: idOf(1001),
            status: "linked",
            message: null,
            nowOnLaxArt: true,
            replaced: [],
          },
          {
            artworkId: idOf(6),
            registerId: idOf(1006),
            status: "refused",
            message: "Reserved in Zoho.",
            nowOnLaxArt: false,
            replaced: [],
          },
        ],
      },
    });
    getReport.mockResolvedValue({ ok: true, data: report() });
    show(report({ matched: two, needsChoice: [CHOICE] }));
    fireEvent.click(screen.getByRole("button", { name: "Link 2 matched…" }));
    fireEvent.click(screen.getByRole("button", { name: "Link 2 artworks" }));
    expect(await screen.findByText("Linking finished")).toBeInTheDocument();
    expect(linkMany).toHaveBeenCalledWith([
      { artworkId: idOf(1), registerId: idOf(1001) },
      { artworkId: idOf(6), registerId: idOf(1006) },
    ]);
    expect(screen.getByText(/lax.art work 6: Reserved in Zoho\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(getReport).toHaveBeenCalled());
  });

  it("keeps the confirmation open with the reason when the request fails", async () => {
    linkMany.mockResolvedValue({ ok: false, kind: "failed", message: "Could not link." });
    show(report({ matched: two }));
    fireEvent.click(screen.getByRole("button", { name: "Link 2 matched…" }));
    fireEvent.click(screen.getByRole("button", { name: "Link 2 artworks" }));
    expect(await screen.findByText("Could not link.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("No match: Find in Zoho", () => {
  it("searches the register and previews the chosen record before linking", async () => {
    search.mockResolvedValue({
      ok: true,
      data: { items: [candidate(4).record], more: false },
    });
    preview.mockResolvedValue({
      ok: true,
      data: { listing: NONE.listing, candidate: candidate(4, { differences: [...DIFFERENT] }) },
    });
    show(report({ noMatch: [NONE] }));
    fireEvent.click(screen.getByRole("button", { name: "Find in Zoho…" }));
    fireEvent.change(screen.getByLabelText("Search Zoho records"), {
      target: { value: "Zoho title" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: /Choose Zoho title 4/ }, { timeout: 2000 }),
    );
    expect(await screen.findByRole("button", { name: "Link artwork" })).toBeInTheDocument();
    expect(preview).toHaveBeenCalledWith(idOf(4), idOf(1004));
  });
});

describe("the publish switch", () => {
  it("is turned on by an Administrator", async () => {
    setSwitch.mockResolvedValue({ ok: true, data: { blockUnlinkedPublish: true } });
    show(report({ matched: [MATCHED] }), ADMIN);
    fireEvent.click(screen.getByRole("switch", { name: "Block publishing unlinked originals" }));
    await waitFor(() => expect(setSwitch).toHaveBeenCalledWith(true));
    expect(
      await screen.findByText(/On\. An original that is not linked to Zoho/),
    ).toBeInTheDocument();
  });

  it("can be seen but not changed by anyone else", () => {
    show(report({ matched: [MATCHED] }), EDITOR);
    expect(
      screen.getByRole("switch", { name: "Block publishing unlinked originals" }),
    ).toBeDisabled();
    expect(screen.getByText(/Only an Administrator can change it/)).toBeInTheDocument();
  });
});

describe("read-only", () => {
  it("shows every group and match but no way to link", () => {
    show(report({ matched: [MATCHED], needsChoice: [CHOICE], noMatch: [NONE] }), READ_ONLY);
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Matched \(1\)/ })).toBeInTheDocument();
    expect(screen.getByText(/Differs from Zoho: title, year/)).toBeInTheDocument();
    for (const name of [/Review and link/, /Link \d+ matched/, /Choose/, /Find in Zoho/]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument();
  });
});
