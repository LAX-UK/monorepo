import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InvitationList } from "./invitation-list";

describe("InvitationList", () => {
  it("shows who invited, the role and the expiry, with Review", () => {
    render(
      <InvitationList
        rows={[
          {
            id: "inv-1",
            title: "Gallery Co",
            meta: ["From Pat", "Admin", "Expires 31 Dec 2026"],
            reviewHref: "/organisations/invitations/review/inv-1",
          },
        ]}
      />,
    );
    expect(screen.getByText("Gallery Co")).toBeInTheDocument();
    expect(screen.getByText("From Pat")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review invitation to Gallery Co" })).toHaveAttribute(
      "href",
      "/organisations/invitations/review/inv-1",
    );
  });
});
