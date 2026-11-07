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
  accountsHref: "/organisations",
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

  it("offers pending invitations with their count and all accounts, but not registering, in the popover", () => {
    renderList();
    expect(screen.getByRole("link", { name: "Pending invitations (2)" })).toHaveAttribute(
      "href",
      "/organisations/invitations",
    );
    expect(screen.getByRole("link", { name: "All accounts" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Register an organisation" })).toBeNull();
  });

  it("offers registering an organisation in the sheet", () => {
    renderList({ density: "sheet" });
    expect(screen.getByRole("link", { name: "Register an organisation" })).toHaveAttribute(
      "href",
      "/onboarding/organisation?fresh=1",
    );
  });

  it("leaves out the invitations row when there are none", () => {
    renderList({ switcher: { ...switcher, pendingInvitations: 0 } });
    expect(screen.queryByRole("link", { name: /Pending invitations/ })).toBeNull();
  });

  it("locks the list while a switch is in flight, and says Switching… on the chosen row", () => {
    const { onChoose } = renderList({ pendingId: "me" });
    expect(screen.getByRole("button", { name: /Northbank Gallery/ })).toBeDisabled();
    const chosen = screen.getByRole("button", { name: /Jane Smith/ });
    // The chosen row stays focusable, so focus is not dropped mid-switch, but does nothing.
    expect(chosen).not.toBeDisabled();
    expect(chosen).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(chosen);
    expect(onChoose).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Switching to Personal…");
    expect(chosen).toHaveAttribute("aria-busy", "true");
    expect(chosen).toHaveTextContent("Switching…");
    expect(screen.getByRole("button", { name: /Northbank Gallery/ })).not.toHaveTextContent(
      "Switching…",
    );
  });

  it("tints the account in use on every density", () => {
    renderList();
    expect(screen.getByRole("button", { name: /Northbank Gallery/ })).toHaveClass(
      "bg-lax-selected",
    );
  });

  it("gives Try again a 44px target in the sheet", () => {
    renderList({
      density: "sheet",
      failure: { title: "Could not switch", description: "Try later." },
      onRetry: vi.fn(),
    });
    expect(screen.getByRole("button", { name: "Try again" })).toHaveClass("min-h-11");
  });

  it("marks the account in use with the word Current", () => {
    renderList();
    expect(screen.getByRole("button", { name: /Northbank Gallery/ })).toHaveTextContent("Current");
    expect(screen.getByRole("button", { name: /Jane Smith/ })).not.toHaveTextContent("Current");
    expect(screen.getByText("Switch account")).toBeInTheDocument();
  });

  it("says why a switch failed and offers to try again", () => {
    const onRetry = vi.fn();
    renderList({
      failure: { title: "Could not switch", description: "Please try again." },
      onRetry,
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Could not switch. Please try again.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("leaves the links to a menu that has its own", () => {
    renderList({ withLinks: false });
    expect(screen.queryByRole("link", { name: "All accounts" })).toBeNull();
  });

  it("shows a number where something needs the person, read when the list opens", async () => {
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
    expect(document.querySelector("[data-needs-you]")).toHaveTextContent("2");
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
    expect(screen.getByText("No accounts match “zzz”.")).toBeVisible();
  });

  it("has no field with fewer than six accounts", () => {
    renderList();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});
