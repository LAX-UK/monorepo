import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccessDeniedState, accessDeniedLine, accessDeniedTitle } from "./access-denied-state.js";

describe("AccessDeniedState", () => {
  it("names the page and who can open it", () => {
    render(<AccessDeniedState page="Payouts" openedBy="Owners, admins and finance" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "You don't have access to Payouts" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Owners, admins and finance can open it. Ask one of them if you need something here.",
      ),
    ).toBeVisible();
  });

  it("says plainly that there is no access when the page has no name", () => {
    render(<AccessDeniedState />);
    expect(screen.getByRole("heading", { name: "You don't have access" })).toBeVisible();
  });

  it("puts a reason that is not about a role in place of the roles line", () => {
    render(
      <AccessDeniedState
        page="this consignment"
        openedBy="Owners and admins"
        reason="It belongs to an account you aren't using."
      />,
    );
    expect(screen.getByText("It belongs to an account you aren't using.")).toBeVisible();
    expect(screen.queryByText(/can open it/)).toBeNull();
  });

  it("offers the way on it is given", () => {
    render(
      <AccessDeniedState page="Payouts" actions={<a href="/home">Back to Home</a>} size="panel" />,
    );
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/home");
    // Inside a page, under its own title, it is a section heading.
    expect(screen.getByRole("heading", { level: 2 })).toBeVisible();
  });

  it("names whom to ask in a quiet line under the actions", () => {
    render(
      <AccessDeniedState
        page="Sold & payouts"
        actions={<a href="/home">Back to Home</a>}
        footnote="Need access? Ask an owner: Maya Okafor"
      />,
    );
    expect(screen.getByText("Need access? Ask an owner: Maya Okafor")).toBeVisible();
  });

  it("builds its words for pages that compose their own", () => {
    expect(accessDeniedTitle("Members")).toBe("You don't have access to Members");
    expect(accessDeniedTitle(null)).toBe("You don't have access");
    expect(accessDeniedLine("Owners and admins")).toBe(
      "Owners and admins can open it. Ask one of them if you need something here.",
    );
  });
});
