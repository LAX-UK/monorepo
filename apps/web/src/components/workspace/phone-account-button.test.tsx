import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/account-switcher/account-switcher-sheet", () => ({
  AccountSwitcherSheet: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Switch account" /> : null,
}));

const { PhoneAccountButton } = await import("./phone-account-button");

const switcher: NonNullable<AccountChrome["switcher"]> = {
  options: [],
  pendingInvitations: 0,
  invitationsHref: "/organisations/invitations",
  registerHref: "/onboarding/organisation?fresh=1",
};

describe("PhoneAccountButton", () => {
  it("shows the person's initials and opens the account sheet", () => {
    render(
      <PhoneAccountButton
        user={{ name: "Victoria Harrington", email: "v@example.com", image: null }}
        switcher={switcher}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Your accounts, Victoria Harrington" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveTextContent("VH");
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Switch account" })).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
