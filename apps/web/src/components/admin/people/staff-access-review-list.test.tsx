import { BidStaffAccessProvider } from "@/components/admin/access/bid-staff-access-provider";
import type { StaffAccessReviewPageModel } from "@/lib/admin/people/load-staff-access-review-page";
import { StaffTooltipProvider } from "@auction/staff-ui";
import type { StaffRoles } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StaffAccessReviewList } from "./staff-access-review-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/staff/access",
  useSearchParams: () => new URLSearchParams(),
}));

function model(href: string | null): StaffAccessReviewPageModel {
  return {
    filters: { view: "all", role: null, q: "" },
    counts: { all: 1, ending: 1 },
    total: 1,
    loadError: null,
    csv: { shown: [], all: [] },
    rows: [
      {
        id: "ada",
        name: "Ada Lovelace",
        email: "ada@lax.test",
        suspended: false,
        lastSignInAt: "2026-10-27T08:00:00.000Z",
        nextEnd: "2026-11-15T00:00:00.000Z",
        href,
        roles: [
          {
            id: "asg-1",
            role: "fulfilment",
            label: "Fulfilment",
            meta: "Since 5 Jan 2026 · Until 14 Nov 2026 · 18 days left",
            endingSoon: true,
          },
        ],
      },
    ],
  };
}

function renderAs(staffRoles: StaffRoles, href: string | null) {
  return render(
    <StaffTooltipProvider>
      <BidStaffAccessProvider platformRole="staff" staffRoles={staffRoles}>
        <StaffAccessReviewList model={model(href)} search={{}} />
      </BidStaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

describe("StaffAccessReviewList", () => {
  it("lists each person's roles with since when and until when", () => {
    renderAs(["administrator"], "/admin/staff/ada");
    expect(screen.getAllByText("Fulfilment").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Since 5 Jan 2026 · Until 14 Nov 2026 · 18 days left").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Ending within 30 days/ })).toBeInTheDocument();
  });

  it("offers the export and record links to role managers", () => {
    renderAs(["administrator"], "/admin/staff/ada");
    expect(screen.queryByText(/View only/)).toBeNull();
    expect(screen.getByRole("button", { name: /Export/ })).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Actions for Ada Lovelace" }).length,
    ).toBeGreaterThan(0);
  });

  it("shows read-only staff the review only", () => {
    renderAs(["read_only"], null);
    expect(screen.getByText("View only · Read-only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Export/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Actions for Ada Lovelace" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Ada Lovelace" })).toBeNull();
  });
});
