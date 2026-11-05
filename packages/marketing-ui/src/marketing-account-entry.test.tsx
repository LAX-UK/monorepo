import { DropdownMenuItem } from "@auction/ui/components/dropdown-menu";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cutAccountEntryName } from "./account-entry-name.js";
import { MarketingAccountEntry } from "./marketing-account-entry.js";

function open(trigger: HTMLElement) {
  fireEvent.keyDown(trigger, { key: "Enter" });
}

const SIGNED_OUT = { signInHref: "/login", createAccountHref: "/register" };

describe("cutAccountEntryName", () => {
  it("keeps short names and cuts long ones at 12 characters", () => {
    expect(cutAccountEntryName("Mahmoud")).toBe("Mahmoud");
    expect(cutAccountEntryName("123456789012")).toBe("123456789012");
    expect(cutAccountEntryName("1234567890123")).toBe("123456789012…");
  });
});

describe("MarketingAccountEntry signed out", () => {
  it("shows the person icon and the word Account", () => {
    render(<MarketingAccountEntry viewer={null} {...SIGNED_OUT} />);
    const trigger = screen.getByRole("button", { name: "Account menu" });
    expect(trigger).toHaveTextContent("Account");
    expect(trigger.querySelector("svg")).not.toBeNull();
  });

  it("opens a menu with the family line, Sign in and Create account", () => {
    render(<MarketingAccountEntry viewer={null} {...SIGNED_OUT} />);
    open(screen.getByRole("button", { name: "Account menu" }));
    expect(
      screen.getByText("One LAX Account for lax.art, LAX Shop and LAX Bid"),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("menuitem", { name: "Create account" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("makes Sign in the primary action", () => {
    render(<MarketingAccountEntry viewer={null} {...SIGNED_OUT} />);
    open(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menuitem", { name: "Sign in" }).className).toContain("bg-cta-bg");
    expect(screen.getByRole("menuitem", { name: "Create account" }).className).not.toContain(
      "bg-cta-bg",
    );
  });
});

describe("MarketingAccountEntry signed in", () => {
  const viewer = { displayName: "Bartholomew-Alexander Montgomery", email: "a@example.com" };

  it("shows the avatar initials, the first name cut at 12 characters and a chevron", () => {
    render(<MarketingAccountEntry viewer={viewer} {...SIGNED_OUT} />);
    const trigger = screen.getByRole("button", { name: /Account menu/ });
    expect(trigger).toHaveTextContent("BM");
    expect(screen.getByTestId("account-entry-name")).toHaveTextContent("Bartholomew-…");
    expect(trigger.querySelectorAll("svg")).toHaveLength(1);
  });

  it("opens the menu items the product supplied", () => {
    render(
      <MarketingAccountEntry
        viewer={viewer}
        {...SIGNED_OUT}
        menuItems={<DropdownMenuItem>My bids</DropdownMenuItem>}
      />,
    );
    open(screen.getByRole("button", { name: /Account menu/ }));
    expect(screen.getByRole("menuitem", { name: "My bids" })).toBeInTheDocument();
    expect(screen.queryByText("Sign in")).toBeNull();
  });

  it("falls back to the email name and shows the attention dot on request", () => {
    render(
      <MarketingAccountEntry
        viewer={{ displayName: "", email: "sam@example.com" }}
        {...SIGNED_OUT}
        attention
      />,
    );
    expect(screen.getByTestId("account-entry-name")).toHaveTextContent("sam");
    expect(screen.getByTestId("account-entry-attention")).toBeInTheDocument();
  });
});
