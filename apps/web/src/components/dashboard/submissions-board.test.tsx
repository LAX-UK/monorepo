import { SubmissionsBoard } from "@/components/dashboard/submissions-board";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/dashboard/submissions",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/dashboard/submissions/submissions-list-toolbar", () => ({
  SubmissionsListToolbar: () => null,
}));

describe("SubmissionsBoard", () => {
  it("uses FilterEmptyState when status filter yields zero rows", () => {
    render(<SubmissionsBoard rows={[]} initialStatus="draft" initialQ="" fetchedCount={0} />);

    expect(screen.getByText(/No submissions match this filter/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Clear filters/i })).toHaveAttribute(
      "href",
      "/dashboard/submissions",
    );
  });

  it("uses title-specific FilterEmptyState when q filter matches nothing but rows exist server-side", () => {
    render(
      <SubmissionsBoard rows={[]} initialStatus="all" initialQ="nonexistent" fetchedCount={3} />,
    );

    expect(screen.getByText("No title matches")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Clear filters/i })).toBeInTheDocument();
  });
});
