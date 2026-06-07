import { SubmissionsListToolbar } from "@/components/dashboard/submissions/submissions-list-toolbar";
import { parseSubmissionsParams } from "@/lib/dashboard/filters/submissions/submissions-filters";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/dashboard/submissions",
  useSearchParams: () => new URLSearchParams(),
}));

describe("SubmissionsListToolbar", () => {
  it("shows filter badge when a non-default status is selected", () => {
    render(
      <SubmissionsListToolbar
        filters={parseSubmissionsParams({ status: "draft" })}
        initialStatus="draft"
        statusCounts={{
          all: 3,
          draft: 1,
          submitted: 1,
          under_review: 0,
          approved: 0,
          rejected: 0,
          withdrawn: 0,
          converted: 1,
        }}
      />,
    );

    expect(
      screen.getAllByRole("button", { name: /Filters, 1 applied/i }).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Status: Draft")).toBeInTheDocument();
  });
});
