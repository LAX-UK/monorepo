import type { AccountMenuContext } from "@/lib/navigation/account-menu-context";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  user: null as null | { id: string; name: string; email: string; image: null; role: string },
}));
const menuContext = vi.hoisted(() => ({ value: null as AccountMenuContext | null }));

vi.mock("@/lib/auth/use-app-session", () => ({
  useAppSession: () => ({ user: session.user, pending: false }),
}));
vi.mock("@/lib/auth/client-audience", () => ({ usesBidAsClient: () => true }));
vi.mock("@/lib/navigation/use-account-menu-context.client", () => ({
  useAccountMenuContext: () => menuContext.value,
}));
vi.mock("@/components/workspace/phone-account-button", () => ({
  PhoneAccountButton: ({ current }: { current: { name: string } }) => (
    <button type="button">{current.name}</button>
  ),
}));

import { BidPhoneAccountButton } from "./bid-phone-account-button";

const personal = {
  id: "me",
  kind: "personal",
  name: "Personal",
  detail: "Oliver Grant",
  initials: "OG",
  current: true,
  underReview: false,
} as const;

beforeEach(() => {
  session.user = {
    id: "u1",
    name: "Oliver Grant",
    email: "o@example.com",
    image: null,
    role: "client",
  };
});

function context(accounts: AccountMenuContext["accounts"]): AccountMenuContext {
  return { accounts, pendingInvitations: 0 } as AccountMenuContext;
}

describe("BidPhoneAccountButton", () => {
  it("shows the account in use in Personal for someone with an organisation", () => {
    menuContext.value = context([
      personal,
      { ...personal, id: "org-1", kind: "organisation", name: "Northbank Gallery", current: false },
    ]);
    render(<BidPhoneAccountButton />);
    expect(screen.getByRole("button", { name: "Personal" })).toBeInTheDocument();
  });

  it("renders nothing for someone with only their own account", () => {
    menuContext.value = context(null);
    const { container } = render(<BidPhoneAccountButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when signed out", () => {
    session.user = null;
    menuContext.value = null;
    const { container } = render(<BidPhoneAccountButton />);
    expect(container).toBeEmptyDOMElement();
  });
});
