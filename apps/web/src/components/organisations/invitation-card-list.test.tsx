import { InvitationCardList } from "@/components/organisations/invitation-card-list";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("InvitationCardList", () => {
  it("returns null when empty", () => {
    const { container } = render(<InvitationCardList invitations={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders invitation rows", () => {
    render(
      <InvitationCardList
        invitations={[
          {
            id: "inv-1",
            email: "a@b.com",
            expiresAt: "2026-12-31T00:00:00.000Z",
            legalEntityId: "le-1",
            orgDisplayName: "Gallery Co",
            orgSubkind: "gallery",
            inviterUserId: "u1",
            inviterName: "Pat",
            roleOffered: "admin",
          },
        ]}
      />,
    );
    expect(screen.getByText("Gallery Co")).toBeInTheDocument();
    expect(screen.getByText(/Pat/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review/i })).toHaveAttribute(
      "href",
      "/dashboard/invitations/review/inv-1",
    );
  });
});
