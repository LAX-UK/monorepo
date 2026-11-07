import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/account-switcher/account-switcher-sheet", () => ({
  AccountSwitcherSheet: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Switch account" /> : null,
}));

const { PhoneAccountButton } = await import("./phone-account-button");

const personal = {
  id: "me",
  kind: "personal",
  name: "Personal",
  detail: "Victoria Harrington",
  initials: "VH",
  current: true,
  underReview: false,
} as const;
const northbank = {
  id: "org-1",
  kind: "organisation",
  name: "Northbank Gallery",
  detail: "Owner",
  initials: "NG",
  current: false,
  underReview: false,
} as const;

const switcher: NonNullable<AccountChrome["switcher"]> = {
  options: [personal, northbank],
  pendingInvitations: 0,
  invitationsHref: "/organisations/invitations",
  accountsHref: "/organisations",
  registerHref: "/onboarding/organisation?fresh=1",
};

const user = { name: "Victoria Harrington", email: "v@example.com", image: null };

describe("PhoneAccountButton", () => {
  it("shows the personal account as the person's avatar and the word Personal", () => {
    render(<PhoneAccountButton user={user} current={personal} switcher={switcher} />);
    const trigger = screen.getByRole("button", {
      name: "Your accounts, Victoria Harrington, Personal",
    });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveTextContent("VH");
    expect(trigger).toHaveTextContent("Personal");
  });

  it("shows an organisation as its tile with the person's initials as a badge", () => {
    render(
      <PhoneAccountButton
        user={user}
        current={{ ...northbank, current: true }}
        switcher={switcher}
      />,
    );
    const trigger = screen.getByRole("button", {
      name: "Your accounts, acting as Northbank Gallery",
    });
    expect(trigger).toHaveTextContent("NG");
    expect(trigger).toHaveTextContent("VH");
    expect(trigger).not.toHaveTextContent("Personal");
  });

  it("opens the account sheet", () => {
    render(<PhoneAccountButton user={user} current={personal} switcher={switcher} />);
    const trigger = screen.getByRole("button", { name: /^Your accounts/ });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Switch account" })).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
