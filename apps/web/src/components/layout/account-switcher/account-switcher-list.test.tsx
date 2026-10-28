import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountSwitcherList } from "./account-switcher-list";

const switcher: NonNullable<AccountChrome["switcher"]> = {
  options: [
    {
      id: "me",
      kind: "personal",
      name: "Personal",
      detail: "Jane Smith",
      initials: "JS",
      current: false,
      underReview: false,
    },
    {
      id: "northbank",
      kind: "organisation",
      name: "Northbank Gallery",
      detail: "Admin",
      initials: "NG",
      current: true,
      underReview: false,
    },
  ],
  pendingInvitations: 2,
  invitationsHref: "/organisations/invitations",
  registerHref: "/onboarding/organisation?fresh=1",
};

function renderList(overrides: Partial<Parameters<typeof AccountSwitcherList>[0]> = {}) {
  const onChoose = vi.fn();
  render(
    <AccountSwitcherList
      switcher={switcher}
      pendingId={null}
      onChoose={onChoose}
      onNavigate={vi.fn()}
      {...overrides}
    />,
  );
  return { onChoose };
}

describe("AccountSwitcherList", () => {
  it("names each account with the person's role and marks the current one", () => {
    renderList();
    const current = screen.getByRole("button", { name: /Northbank Gallery/ });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current).toHaveTextContent("Admin");
    expect(screen.getByRole("button", { name: /Personal/ })).not.toHaveAttribute("aria-current");
  });

  it("switches when another account is chosen", () => {
    const { onChoose } = renderList();
    fireEvent.click(screen.getByRole("button", { name: /Personal/ }));
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ id: "me" }));
  });

  it("offers pending invitations with their count, and registering an organisation", () => {
    renderList();
    expect(screen.getByRole("link", { name: "Pending invitations (2)" })).toHaveAttribute(
      "href",
      "/organisations/invitations",
    );
    expect(screen.getByRole("link", { name: "Register an organisation" })).toHaveAttribute(
      "href",
      "/onboarding/organisation?fresh=1",
    );
  });

  it("leaves out the invitations row when there are none", () => {
    renderList({ switcher: { ...switcher, pendingInvitations: 0 } });
    expect(screen.queryByRole("link", { name: /Pending invitations/ })).toBeNull();
  });

  it("locks the list while a switch is in flight", () => {
    renderList({ pendingId: "me" });
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });
});
