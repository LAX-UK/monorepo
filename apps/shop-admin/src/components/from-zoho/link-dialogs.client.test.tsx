// @vitest-environment jsdom
import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DIFFERENT, candidate, idOf, row } from "./link-fixtures";

const { search, preview, link, unlink, toastSuccess } = vi.hoisted(() => ({
  search: vi.fn(),
  preview: vi.fn(),
  link: vi.fn(),
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
  linkManyToZoho: vi.fn(),
  getZohoLinkReport: vi.fn(),
  setBlockUnlinkedPublish: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { RecordSearchView, LinkToZohoDialog } = await import("./link-to-zoho-dialog.client");
const { LinkConfirmView } = await import("./link-confirm-dialog.client");
const { UnlinkZohoDialog } = await import("./unlink-zoho-dialog.client");
const { LinkDifferences } = await import("./link-differences");

const wrap = (node: React.ReactNode) =>
  render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={laxStaffAccess([], undefined)}>{node}</StaffAccessProvider>
    </StaffTooltipProvider>,
  );

beforeEach(() => {
  for (const mock of [search, preview, link, unlink, toastSuccess]) mock.mockReset();
});

const viewProps = {
  open: true,
  onOpenChange: vi.fn(),
  artworkTitle: "Harbour at Dusk",
  query: "",
  onQueryChange: vi.fn(),
  choosing: null,
  chooseError: null,
  onChoose: vi.fn(),
  onRetry: vi.fn(),
};

describe("searching the register for one artwork's record", () => {
  it("asks for at least two characters before it searches", () => {
    wrap(<RecordSearchView {...viewProps} search={{ phase: "idle" }} />);
    expect(screen.getByText(/Type at least two characters/)).toBeInTheDocument();
  });

  it("shows a loading state while it searches", () => {
    wrap(<RecordSearchView {...viewProps} query="tidal" search={{ phase: "loading" }} />);
    expect(screen.getByRole("status", { name: "Searching Zoho" })).toBeInTheDocument();
  });

  it("says plainly when nothing matches", () => {
    wrap(
      <RecordSearchView
        {...viewProps}
        query="zzz"
        search={{ phase: "done", result: { items: [], more: false } }}
      />,
    );
    expect(screen.getByText(/No unlinked original in Zoho matches “zzz”/)).toBeInTheDocument();
  });

  it("offers Try again when the search fails", () => {
    const onRetry = vi.fn();
    wrap(
      <RecordSearchView
        {...viewProps}
        onRetry={onRetry}
        query="tidal"
        search={{ phase: "error", message: "Could not search Zoho." }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("lists records with enough to be sure, and says when more match", () => {
    const onChoose = vi.fn();
    wrap(
      <RecordSearchView
        {...viewProps}
        onChoose={onChoose}
        query="zoho"
        search={{
          phase: "done",
          result: { items: [candidate(1).record, candidate(2).record], more: true },
        }}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(/LAX-ORI-AR-TM-26-0001/)).toBeInTheDocument();
    expect(screen.getByText(/More records match/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Choose Zoho title 2/ }));
    expect(onChoose).toHaveBeenCalledWith(candidate(2).record);
  });

  it("says a record could not be read when the preview fails, and keeps the search", async () => {
    search.mockResolvedValue({ ok: true, data: { items: [candidate(1).record], more: false } });
    preview.mockResolvedValue({
      ok: false,
      kind: "failed",
      message: "Could not read this record.",
    });
    wrap(
      <LinkToZohoDialog
        open
        onOpenChange={vi.fn()}
        artworkId={idOf(1)}
        artworkTitle="Harbour at Dusk"
        onLinked={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Search Zoho records"), { target: { value: "zoho" } });
    fireEvent.click(
      await screen.findByRole("button", { name: /Choose Zoho title 1/ }, { timeout: 2000 }),
    );
    expect(await screen.findByText("Could not read this record.")).toBeInTheDocument();
    expect(screen.getByLabelText("Search Zoho records")).toBeInTheDocument();
  });
});

describe("the link confirmation", () => {
  const listing = row(1).listing;
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    listing,
    saving: false,
    error: null,
    onConfirm: vi.fn(),
  };

  it("says where a live artwork will go", () => {
    wrap(<LinkConfirmView {...props} candidate={candidate(1)} />);
    expect(screen.getByText(/the register will show it as On lax.art/)).toBeInTheDocument();
  });

  it("says a draft stays where it is until published", () => {
    wrap(
      <LinkConfirmView
        {...props}
        listing={{ ...listing, published: false }}
        candidate={candidate(1)}
      />,
    );
    expect(screen.getByText(/when it is published/)).toBeInTheDocument();
  });

  it("names the place that holds the record and offers no way to link", () => {
    wrap(
      <LinkConfirmView
        {...props}
        candidate={candidate(1, {
          refusal: "This artwork is in a LAX Bid sale. Withdraw the lot there first.",
        })}
      />,
    );
    expect(screen.getByText(/in a LAX Bid sale\. Withdraw the lot/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Link artwork" })).toBeNull();
  });

  it("shows the busy state while linking", () => {
    wrap(<LinkConfirmView {...props} saving candidate={candidate(1)} />);
    expect(screen.getByRole("button", { name: /Link artwork/ })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});

describe("what differs", () => {
  it("highlights each differing row and strikes through lax.art's old value", () => {
    const { container } = wrap(<LinkDifferences differences={[...DIFFERENT]} />);
    expect(container.querySelectorAll("[data-difference]")).toHaveLength(2);
    expect(screen.getByText("Tidal Margin 4").closest(".line-through")).not.toBeNull();
    expect(screen.getByText("Tidal margin IV").closest(".line-through")).toBeNull();
  });

  it("says an empty value is empty", () => {
    wrap(
      <LinkDifferences
        differences={[{ field: "size", label: "Size", zohoValue: null, laxArtValue: "80 x 100" }]}
      />,
    );
    expect(screen.getByText("Empty")).toBeInTheDocument();
  });

  it("says nothing differs when it does not", () => {
    wrap(<LinkDifferences differences={[]} />);
    expect(screen.getByText(/already agree/)).toBeInTheDocument();
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
