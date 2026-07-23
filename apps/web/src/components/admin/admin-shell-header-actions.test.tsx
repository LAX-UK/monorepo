import { AdminShellHeaderActions } from "@/components/admin/admin-shell-header-actions";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("AdminShellHeaderActions", () => {
  it("does not render Create or Submissions shortcuts", () => {
    render(<AdminShellHeaderActions items={[]} />);

    expect(screen.queryByRole("button", { name: /quick create/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /submissions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /submissions/i })).not.toBeInTheDocument();
  });

  it("renders the attention bell with provided items", () => {
    render(
      <AdminShellHeaderActions
        items={[
          {
            id: "nav-manual-review",
            href: "/admin/payments?manualReview=1",
            label: "Payments — manual review",
            count: 3,
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: /staff attention/i })).toBeInTheDocument();
    expect(screen.queryByText(/pending submissions/i)).not.toBeInTheDocument();
  });
});
