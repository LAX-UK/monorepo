import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Count, PlainLink as Link, SecondaryTabNav, type TabNavItem } from "./index.js";

const pages: TabNavItem[] = [
  { id: "registrations", label: "Registrations", href: "/sales/1/registrations", count: 12 },
  {
    id: "telephone-bookings",
    label: "Telephone bookings",
    href: "/sales/1/telephone-bookings",
    count: 2,
    countTone: "attention",
    countLabel: "waiting",
  },
];

describe("SecondaryTabNav", () => {
  it("renders each page as a link in a named navigation, marking only the current one", () => {
    render(
      <SecondaryTabNav items={pages} activeId="telephone-bookings" label="Bidders" Link={Link} />,
    );
    const nav = screen.getByRole("navigation", { name: "Bidders" });
    const links = Array.from(nav.querySelectorAll("a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/sales/1/registrations",
      "/sales/1/telephone-bookings",
    ]);
    expect(screen.getByRole("link", { name: /Telephone bookings/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /Registrations/ })).not.toHaveAttribute("aria-current");
  });

  it("shows each page's count, with work waiting in the attention tone and its meaning", () => {
    render(<SecondaryTabNav items={pages} activeId="registrations" label="Bidders" Link={Link} />);
    expect(screen.getByRole("link", { name: "Registrations 12" })).toBeInTheDocument();
    const waiting = screen.getByRole("link", { name: "Telephone bookings 2 waiting" });
    expect(waiting.querySelector(".bg-lax-ink")).not.toBeNull();
  });
});

describe("Count", () => {
  it("reads its meaning after the number without showing it", () => {
    render(<Count value={3} tone="attention" label="waiting" />);
    const label = screen.getByText("waiting");
    expect(label).toHaveClass("sr-only");
    expect(label.parentElement).toHaveTextContent("3 waiting");
  });
});
