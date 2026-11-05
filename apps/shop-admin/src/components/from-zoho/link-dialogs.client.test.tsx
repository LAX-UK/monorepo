// @vitest-environment jsdom
import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import type { AdminZohoLinkCandidate } from "@auction/shop-contracts";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DIFFERENT, SAME, candidate, idOf, row } from "./link-fixtures";

const { search, preview, link, linkMany, unlink, toastSuccess } = vi.hoisted(() => ({
  search: vi.fn(),
  preview: vi.fn(),
  link: vi.fn(),
  linkMany: vi.fn(),
  unlink: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/from-zoho",
}));
vi.mock("@/server/application/admin-zoho-link-actions.server", () => ({
  searchZohoRecords: (...args: unknown[]) => search(...args),
  getZohoLinkPreview: (...args: unknown[]) => preview(...args),
  linkToZoho: (...args: unknown[]) => link(...args),
  unlinkFromZoho: (...args: unknown[]) => unlink(...args),
  linkManyToZoho: (...args: unknown[]) => linkMany(...args),
  getZohoLinkReport: vi.fn(),
  setBlockUnlinkedPublish: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { LinkToZohoView, LinkToZohoDialog } = await import("./link-to-zoho-dialog.client");
const { BulkLinkView, BulkLinkDialog } = await import("./bulk-link-dialog.client");
const { UnlinkZohoDialog } = await import("./unlink-zoho-dialog.client");

const wrap = (node: React.ReactNode) =>
  render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={laxStaffAccess([], undefined)}>{node}</StaffAccessProvider>
    </StaffTooltipProvider>,
  );

beforeEach(() => {
  for (const mock of [search, preview, link, linkMany, unlink, toastSuccess]) mock.mockReset();
});

const SUBTITLE = "Harbour at dusk · Ben Ilsley · Live on lax.art";
const changed = candidate(1, { comparison: DIFFERENT });
const taken = candidate(2, {
  refusal: "This record is already linked to ‘Harbour, early light’.",
  record: { linkedTo: "Harbour, early light", title: "Harbour, early light" },
});

const viewProps = {
  open: true,
  onOpenChange: vi.fn(),
  subtitle: SUBTITLE,
  published: true as boolean | null,
  query: "",
  onQueryChange: vi.fn(),
  search: { phase: "idle" } as const,
  suggestions: [] as { candidate: AdminZohoLinkCandidate; rule: "stock_code" | null }[],
  selectedId: null as string | null,
  onSelect: vi.fn(),
  detail: null,
  onRetrySearch: vi.fn(),
  saving: false,
  error: null as string | null,
  onConfirm: vi.fn(),
};

describe("Link to Zoho record: choosing the record", () => {
  it("names the artwork and asks for at least two characters before it searches", () => {
    wrap(<LinkToZohoView {...viewProps} />);
    expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
    expect(screen.getByText(/at least two characters/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link to Zoho record" })).toBeDisabled();
  });

  it("lists the suggested records with what each was matched on", () => {
    wrap(
      <LinkToZohoView
        {...viewProps}
        suggestions={[{ candidate: changed, rule: "stock_code" }]}
        selectedId={changed.record.registerId}
        detail={{ phase: "ready", candidate: changed }}
      />,
    );
    const list = screen.getByRole("radiogroup", { name: "Zoho records" });
    expect(within(list).getByText("Zoho title 1")).toBeInTheDocument();
    expect(within(list).getByText("Stock code")).toBeInTheDocument();
    expect(screen.getByText("Suggested")).toBeInTheDocument();
  });

  it("shows a record linked to another listing as such, and it cannot be chosen", () => {
    wrap(
      <LinkToZohoView
        {...viewProps}
        suggestions={[
          { candidate: changed, rule: null },
          { candidate: taken, rule: null },
        ]}
      />,
    );
    expect(screen.getByText("Linked to ‘Harbour, early light’")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /LAX-ORI-AR-TM-26-0002/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /LAX-ORI-AR-TM-26-0001/ })).not.toBeDisabled();
  });

  it("shows a loading state while it searches", () => {
    wrap(<LinkToZohoView {...viewProps} query="harbour" search={{ phase: "loading" }} />);
    expect(screen.getByRole("status", { name: "Searching Zoho" })).toBeInTheDocument();
  });

  it("says plainly when nothing matches", () => {
    wrap(
      <LinkToZohoView
        {...viewProps}
        query="zzzz"
        search={{ phase: "done", result: { items: [], more: false } }}
      />,
    );
    expect(screen.getByText(/No Zoho original matches “zzzz”/)).toBeInTheDocument();
  });

  it("offers Try again when the search fails", () => {
    const onRetrySearch = vi.fn();
    wrap(
      <LinkToZohoView
        {...viewProps}
        query="harbour"
        search={{ phase: "error", message: "Could not search Zoho. Try again in a moment." }}
        onRetrySearch={onRetrySearch}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetrySearch).toHaveBeenCalled();
  });

  it("lists results, says when more match, and marks the linked ones", () => {
    wrap(
      <LinkToZohoView
        {...viewProps}
        query="harbour"
        search={{
          phase: "done",
          result: { items: [changed.record, taken.record], more: true },
        }}
      />,
    );
    expect(screen.getByText("Results")).toBeInTheDocument();
    expect(screen.getByText(/More records match/)).toBeInTheDocument();
    expect(screen.getByText("Linked to ‘Harbour, early light’")).toBeInTheDocument();
  });
});

describe("Link to Zoho record: what it will change", () => {
  const ready = (candidateToShow: AdminZohoLinkCandidate, extra = {}) => (
    <LinkToZohoView
      {...viewProps}
      suggestions={[{ candidate: candidateToShow, rule: null }]}
      selectedId={candidateToShow.record.registerId}
      detail={{ phase: "ready", candidate: candidateToShow }}
      {...extra}
    />
  );

  it("shows lax.art now beside Zoho after linking, with the changed rows highlighted", () => {
    const { container } = wrap(ready(changed));
    const table = screen.getByRole("table", { name: "What linking changes" });
    expect(within(table).getByRole("columnheader", { name: "lax.art now" })).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "From Zoho, after linking" }),
    ).toBeInTheDocument();
    expect(container.ownerDocument.querySelectorAll('tr[data-changes="true"]')).toHaveLength(2);
    expect(screen.getByRole("row", { name: /Title/ })).toHaveTextContent("was Tidal Margin 4");
  });

  it("counts the changes and says where a live artwork goes", () => {
    wrap(ready(changed));
    expect(
      screen.getByText(
        "2 fields change to Zoho's values. The web address stays the same. It becomes On lax.art in the register.",
      ),
    ).toBeInTheDocument();
  });

  it("says a draft stays a draft until it is published", () => {
    wrap(ready(changed, { published: false }));
    expect(screen.getByText(/It stays a draft/)).toBeInTheDocument();
  });

  it("says nothing changes when lax.art and Zoho already agree", () => {
    wrap(ready(candidate(1, { comparison: SAME })));
    expect(screen.getByText(/lax.art and Zoho already agree\./)).toBeInTheDocument();
  });

  it("names the stock code on the button that links", () => {
    wrap(ready(changed));
    expect(screen.getByRole("button", { name: "Link to LAX-ORI-AR-TM-26-0001" })).toBeEnabled();
  });

  it("names the reason a record cannot be used and leaves out the changes", () => {
    wrap(ready(taken));
    expect(screen.getByText("This artwork can't be linked to that record now")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "What linking changes" })).toBeNull();
    expect(screen.getByRole("button", { name: /Link to/ })).toBeDisabled();
  });

  it("shows the busy state while linking", () => {
    wrap(ready(changed, { saving: true }));
    expect(
      document.querySelector('button[aria-busy="true"], button[data-loading="true"]'),
    ).not.toBeNull();
  });

  it("shows the register's refusal and offers Try again", () => {
    wrap(ready(changed, { error: "Another lax.art artwork was linked to this record." }));
    expect(screen.getByText("Not linked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows a skeleton while the chosen record is read, and its error when it fails", () => {
    const { rerender } = wrap(
      <LinkToZohoView {...viewProps} selectedId="x" detail={{ phase: "loading" }} />,
    );
    expect(screen.getByRole("status", { name: "Checking this record" })).toBeInTheDocument();
    rerender(
      <StaffTooltipProvider>
        <StaffAccessProvider access={laxStaffAccess([], undefined)}>
          <LinkToZohoView
            {...viewProps}
            selectedId="x"
            detail={{ phase: "error", message: "Could not read that record." }}
          />
        </StaffAccessProvider>
      </StaffTooltipProvider>,
    );
    expect(screen.getByText("Could not read that record")).toBeInTheDocument();
  });
});

describe("Link to Zoho record: the dialog", () => {
  it("previews a searched record, then links it on confirm", async () => {
    search.mockResolvedValue({
      ok: true,
      data: { items: [changed.record], more: false },
    });
    preview.mockResolvedValue({ ok: true, data: { listing: row(1).listing, candidate: changed } });
    link.mockResolvedValue({ ok: true, data: { status: "linked" } });
    const onLinked = vi.fn();
    wrap(
      <LinkToZohoDialog
        open
        onOpenChange={vi.fn()}
        artworkId={idOf(1)}
        subtitle={SUBTITLE}
        published
        onLinked={onLinked}
      />,
    );
    fireEvent.change(screen.getByLabelText("Search Zoho records"), { target: { value: "zoho" } });
    fireEvent.click(await screen.findByRole("radio", { name: /LAX-ORI-AR-TM-26-0001/ }));
    expect(await screen.findByRole("table", { name: "What linking changes" })).toBeInTheDocument();
    expect(preview).toHaveBeenCalledWith(idOf(1), changed.record.registerId);
    fireEvent.click(screen.getByRole("button", { name: "Link to LAX-ORI-AR-TM-26-0001" }));
    await waitFor(() => expect(onLinked).toHaveBeenCalled());
    expect(link).toHaveBeenCalledWith({
      artworkId: idOf(1),
      registerId: changed.record.registerId,
    });
    expect(toastSuccess).toHaveBeenCalledWith("Linked to the Zoho record");
  });

  it("starts with the report's only suggestion chosen, with no extra request", () => {
    wrap(
      <LinkToZohoDialog
        open
        onOpenChange={vi.fn()}
        artworkId={idOf(1)}
        subtitle={SUBTITLE}
        suggestions={[{ candidate: changed, rule: "stock_code" }]}
        onLinked={vi.fn()}
      />,
    );
    expect(screen.getByRole("table", { name: "What linking changes" })).toBeInTheDocument();
    expect(preview).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and says why when the link is refused", async () => {
    link.mockResolvedValue({ ok: false, kind: "conflict", message: "Held in a LAX Bid sale." });
    const onLinked = vi.fn();
    wrap(
      <LinkToZohoDialog
        open
        onOpenChange={vi.fn()}
        artworkId={idOf(1)}
        subtitle={SUBTITLE}
        suggestions={[{ candidate: changed, rule: "stock_code" }]}
        onLinked={onLinked}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Link to LAX-ORI/ }));
    expect(await screen.findByText(/Held in a LAX Bid sale/)).toBeInTheDocument();
    expect(onLinked).not.toHaveBeenCalled();
  });
});

describe("Link several listings", () => {
  const rows = [
    row(1, { candidates: [changed] }, { title: "Harbour at dusk" }),
    row(2, { candidates: [candidate(2)] }, { title: "Sun disc", published: false }),
    row(3, { candidates: [candidate(3, { comparison: DIFFERENT })] }, { title: "Blue weave" }),
  ];
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    matched: rows,
    saving: false,
    error: null,
    outcomes: null,
    onConfirm: vi.fn(),
  };

  it("says in three lines what will happen", () => {
    wrap(<BulkLinkView {...props} />);
    expect(screen.getByText("Link 3 lax.art listings to Zoho?")).toBeInTheDocument();
    expect(screen.getByText("3 listings linked")).toBeInTheDocument();
    expect(screen.getByText("Zoho's details replace lax.art's on 2 listings")).toBeInTheDocument();
    expect(screen.getByText(/Harbour at dusk: title and year\./)).toBeInTheDocument();
    expect(
      screen.getByText("2 live listings become On lax.art in the register"),
    ).toBeInTheDocument();
    expect(screen.getByText("The draft stays a draft.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link 3 listings" })).toBeInTheDocument();
  });

  it("offers the before and after of each listing that changes", () => {
    wrap(<BulkLinkView {...props} />);
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "See what changes on each listing" }));
    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(2);
    expect(
      screen.getByRole("table", { name: "What linking changes on Blue weave" }),
    ).toBeInTheDocument();
  });

  it("says when nothing changes except the link", () => {
    wrap(<BulkLinkView {...props} matched={[rows[1] as (typeof rows)[number]]} />);
    expect(screen.getByText("lax.art and Zoho already agree")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows the error and offers Try again", () => {
    wrap(<BulkLinkView {...props} error="Could not link the artworks." />);
    expect(screen.getByText("Could not link the artworks.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("reports what happened to each listing", () => {
    wrap(
      <BulkLinkView
        {...props}
        outcomes={[
          {
            artworkId: idOf(1),
            registerId: idOf(1001),
            status: "linked",
            message: null,
            nowOnLaxArt: true,
            replaced: [],
          },
          {
            artworkId: idOf(2),
            registerId: idOf(1002),
            status: "refused",
            message: "In a Bid sale.",
            nowOnLaxArt: false,
            replaced: [],
          },
        ]}
      />,
    );
    expect(screen.getByText("Linking finished")).toBeInTheDocument();
    expect(screen.getByText(/Sun disc: In a Bid sale\./)).toBeInTheDocument();
  });

  it("links on confirm and reads the report again when it closes", async () => {
    linkMany.mockResolvedValue({
      ok: true,
      data: {
        outcomes: rows.map((r) => ({
          artworkId: r.listing.artworkId,
          registerId: r.candidates[0]?.record.registerId,
          status: "linked",
          message: null,
          nowOnLaxArt: true,
          replaced: [],
        })),
      },
    });
    const onDone = vi.fn();
    wrap(<BulkLinkDialog open onOpenChange={vi.fn()} matched={rows} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Link 3 listings" }));
    expect(await screen.findByText("Linking finished")).toBeInTheDocument();
    expect(linkMany).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalled();
  });

  it("sends a long list in parts of 200", async () => {
    const many = Array.from({ length: 205 }, (_, i) => row(100 + i));
    linkMany.mockResolvedValue({ ok: true, data: { outcomes: [] } });
    wrap(<BulkLinkDialog open onOpenChange={vi.fn()} matched={many} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Link 205 listings" }));
    await waitFor(() => expect(linkMany).toHaveBeenCalledTimes(2));
    expect(linkMany.mock.calls[0]?.[0]).toHaveLength(200);
    expect(linkMany.mock.calls[1]?.[0]).toHaveLength(5);
  });
});

describe("removing a link", () => {
  function open(onUnlinked = vi.fn()) {
    wrap(
      <UnlinkZohoDialog
        open
        onOpenChange={vi.fn()}
        artworkId={idOf(1)}
        artworkTitle="Harbour at Dusk"
        onUnlinked={onUnlinked}
      />,
    );
    return onUnlinked;
  }

  it("needs a reason", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Remove link" }));
    expect(screen.getByText("Say why the link is being removed.")).toBeInTheDocument();
    expect(unlink).not.toHaveBeenCalled();
  });

  it("removes the link with the reason", async () => {
    unlink.mockResolvedValue({ ok: true, data: { artworkId: idOf(1), unlinked: true } });
    const onUnlinked = open();
    fireEvent.change(screen.getByLabelText(/Why is the link being removed/), {
      target: { value: "  Linked to the wrong record  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove link" }));
    await waitFor(() =>
      expect(unlink).toHaveBeenCalledWith({
        artworkId: idOf(1),
        reason: "Linked to the wrong record",
      }),
    );
    await waitFor(() => expect(onUnlinked).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith("Link removed");
  });

  it("shows the refusal in the register's words while the artwork is in a Bid sale", async () => {
    unlink.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message:
        "This artwork is in a LAX Bid sale. Withdraw the lot there before removing the link.",
    });
    const onUnlinked = open();
    fireEvent.change(screen.getByLabelText(/Why is the link being removed/), {
      target: { value: "Mistake" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove link" }));
    expect(await screen.findByText(/in a LAX Bid sale/)).toBeInTheDocument();
    expect(onUnlinked).not.toHaveBeenCalled();
  });
});
