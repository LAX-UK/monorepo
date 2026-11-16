import { StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuarantineList, type QuarantineListProps } from "./quarantine-list";
import { heldList } from "./quarantine.fixture";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/enquiries/quarantine",
  useSearchParams: () => new URLSearchParams(),
}));

function renderList(patch: Partial<QuarantineListProps> = {}) {
  const props: QuarantineListProps = {
    page: { items: heldList, nextCursor: null, pendingCount: 3 },
    view: "pending",
    nextHref: null,
    firstHref: null,
    loadError: null,
    now: "2026-11-03T12:00:00.000Z",
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <QuarantineList {...props} />
    </StaffTooltipProvider>,
  );
}

describe("QuarantineList", () => {
  it("lists who sent each email, why it was held and the enquiry it named", () => {
    renderList();
    expect(screen.getByRole("heading", { level: 1, name: "Held email" })).toBeInTheDocument();
    expect(screen.getAllByText("assistant@northbank-gallery.example").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Different sender").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No enquiry found").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Automatic reply").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "E-1042" })[0]).toHaveAttribute(
      "href",
      "/admin/enquiries/E-1042",
    );
    expect(
      screen.getAllByRole("link", { name: /assistant@northbank-gallery\.example/ })[0],
    ).toHaveAttribute("href", "/admin/enquiries/quarantine/0b4f8c1e-6a0a-4a53-9a2a-1c9f8f0e9a11");
  });

  it("offers the two views, counting what is left to review", () => {
    renderList();
    const nav = screen.getByRole("navigation", { name: "Views" });
    expect(within(nav).getByRole("link", { name: /To review/ })).toHaveAttribute(
      "href",
      "/admin/enquiries/quarantine",
    );
    expect(within(nav).getByRole("link", { name: /Reviewed/ })).toHaveAttribute(
      "href",
      "/admin/enquiries/quarantine?view=reviewed",
    );
  });

  it("says when there is nothing to review", () => {
    renderList({ page: { items: [], nextCursor: null, pendingCount: 0 } });
    expect(screen.getByText("No held email to review")).toBeInTheDocument();
  });

  it("says when nothing has been reviewed yet", () => {
    renderList({ view: "reviewed", page: { items: [], nextCursor: null, pendingCount: 0 } });
    expect(screen.getByText("Nothing reviewed yet")).toBeInTheDocument();
  });

  it("says when the list could not be loaded", () => {
    renderList({ page: null, loadError: "The Bid API didn't answer." });
    expect(screen.getByText("Held email couldn't be loaded")).toBeInTheDocument();
  });

  it("pages forward, and back to the first page", () => {
    renderList({
      nextHref: "/admin/enquiries/quarantine?cursor=abc",
      firstHref: "/admin/enquiries/quarantine",
    });
    expect(screen.getByRole("link", { name: /Next/ })).toHaveAttribute(
      "href",
      "/admin/enquiries/quarantine?cursor=abc",
    );
  });
});
