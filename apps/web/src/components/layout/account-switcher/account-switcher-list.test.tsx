import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountNeedsYouProvider } from "./account-needs-you";
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
    const own = screen.getByRole("button", { name: /Jane Smith/ });
    expect(own).not.toHaveAttribute("aria-current");
    // The person's own account leads with their name and says Personal under it.
    expect(own).toHaveTextContent("Jane SmithPersonal");
  });

  it("switches when another account is chosen", () => {
    const { onChoose } = renderList();
    fireEvent.click(screen.getByRole("button", { name: /Jane Smith/ }));
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

  it("shows a dot with its count where something needs the person, read when the list opens", async () => {
    const read = vi.fn(async () => ({ northbank: 2, me: 0 }));
    render(
      <AccountNeedsYouProvider enabled read={read}>
        <AccountSwitcherList
          switcher={switcher}
          pendingId={null}
          onChoose={vi.fn()}
          onNavigate={vi.fn()}
        />
      </AccountNeedsYouProvider>,
    );
    expect(read).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Northbank Gallery.*2 need you/ }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /Jane Smith/ })).not.toHaveAccessibleName(/need/);
    expect(document.querySelectorAll("[data-needs-you]")).toHaveLength(1);
  });

  it("shows no dots when the counts cannot be read", async () => {
    const read = vi.fn(async () => null);
    render(
      <AccountNeedsYouProvider enabled read={read}>
        <AccountSwitcherList
          switcher={switcher}
          pendingId={null}
          onChoose={vi.fn()}
          onNavigate={vi.fn()}
        />
      </AccountNeedsYouProvider>,
    );
    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(document.querySelectorAll("[data-needs-you]")).toHaveLength(0);
  });

  it("offers a field to find an account from six accounts", () => {
    const options = [
      ...switcher.options,
      ...["Cedar & Stone", "Holloway Estate", "Marsh Fine Art", "Galerie Ève"].map(
        (name, i) => ({ ...switcher.options[1], id: `org-${i}`, name, current: false }) as never,
      ),
    ];
    renderList({ switcher: { ...switcher, options } });
    const field = screen.getByRole("searchbox", { name: "Find an account" });
    fireEvent.change(field, { target: { value: "eve" } });
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      expect.stringContaining("Galerie Ève"),
    ]);
    fireEvent.change(field, { target: { value: "zzz" } });
    expect(screen.getByRole("status")).toHaveTextContent("No accounts match “zzz”.");
  });

  it("has no field with fewer than six accounts", () => {
    renderList();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});
