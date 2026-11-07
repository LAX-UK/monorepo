import type { OrganisationRecoveryView } from "@/lib/organisations/organisation-recovery.vm";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/account-switcher/use-account-switch", () => ({
  useAccountSwitch: () => ({ pendingId: null, choose: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/home" }));
import { OrganisationRecoveryPanel } from "./organisation-recovery-panel";
import { OrganisationStateBanner } from "./organisation-state-banner";

const restricted: OrganisationRecoveryView = {
  kind: "restricted",
  heading: "What you can do now",
  abilities: [
    {
      key: "history",
      label: "Read sales, purchases and invoices",
      open: true,
      tag: { label: "Available", tone: "success" },
    },
    {
      key: "pay",
      label: "Pay invoices already issued",
      open: true,
      tag: { label: "Available", tone: "success" },
    },
    {
      key: "trade",
      label: "Bid, register and send works",
      open: false,
      tag: { label: "Paused", tone: "warning" },
    },
  ],
  documents: null,
  progress: null,
  personal: { label: "Keep bidding as yourself", href: { hop: "/bids?account=person-1" } },
};

describe("OrganisationRecoveryPanel", () => {
  it("lists what is open and what is paused, each with a word", () => {
    render(<OrganisationRecoveryPanel view={restricted} />);
    expect(screen.getByRole("heading", { name: "What you can do now" })).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Read sales, purchases and invoicesAvailable",
      "Pay invoices already issuedAvailable",
      "Bid, register and send worksPaused",
    ]);
    expect(screen.queryByText("Documents we asked for")).not.toBeInTheDocument();
  });

  it("shows each document with its state and a 44px-tall link to send it", () => {
    render(
      <OrganisationRecoveryPanel
        view={{
          ...restricted,
          kind: "documents_requested",
          documents: {
            heading: "Documents we asked for",
            rows: [
              {
                key: "a",
                title: "Proof of address",
                badge: { label: "Needs replacing", tone: "danger" },
                hint: "We couldn't accept this copy. Send a clear, current one.",
                link: { label: "Replace", href: "/organisation/documents" },
              },
              {
                key: "b",
                title: "ID of a director",
                badge: { label: "Accepted", tone: "success" },
                hint: null,
                link: null,
              },
            ],
          },
        }}
      />,
    );
    const group = screen.getByRole("region", { name: "Documents we asked for" });
    const link = within(group).getByRole("link", { name: "Replace, Proof of address" });
    expect(link).toHaveAttribute("href", "/organisation/documents");
    expect(link.className).toContain("h-11");
    expect(within(group).getAllByRole("link")).toHaveLength(1);
    expect(within(group).getByText("Accepted")).toBeInTheDocument();
  });

  it("says how far the check has got and offers Contact us", () => {
    render(
      <OrganisationRecoveryPanel
        view={{
          ...restricted,
          progress: {
            line: "Review started on 5 November 2026. Waiting longer than 3 working days?",
            contact: { label: "Contact us", href: "mailto:help@example.com" },
          },
        }}
      />,
    );
    expect(screen.getByText(/Review started on 5 November 2026/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact us" })).toHaveAttribute(
      "href",
      "mailto:help@example.com",
    );
  });
});

describe("OrganisationStateBanner with recovery", () => {
  const banner = {
    kind: "blocked" as const,
    title: "Bidding and selling paused.",
    line: "Harrington Advisors can still see its history and pay its invoices.",
    message: "We need an updated proof of address.",
    action: { label: "Contact us", href: "mailto:help@example.com", kind: "contact" as const },
  };

  it("shows LAX's message under the line, labelled", () => {
    render(<OrganisationStateBanner banner={banner} />);
    expect(screen.getByTestId("organisation-state-message")).toHaveTextContent(
      "Message from LAX: We need an updated proof of address.",
    );
  });

  it("leaves the message out when LAX wrote none", () => {
    render(<OrganisationStateBanner banner={{ ...banner, message: null }} />);
    expect(screen.queryByTestId("organisation-state-message")).not.toBeInTheDocument();
  });

  it("offers Contact us and Keep bidding as yourself as secondary buttons", () => {
    render(<OrganisationStateBanner banner={banner} personal={restricted.personal} />);
    const contact = screen.getByRole("link", { name: "Contact us" });
    const keep = screen.getByRole("link", { name: "Keep bidding as yourself" });
    expect(contact).toHaveAttribute("href", "mailto:help@example.com");
    // A full page load through the switch hop, never a client navigation.
    expect(keep).toHaveAttribute("href", "/bids?account=person-1");
    expect(keep.className).toContain("h-11");
  });

  it("offers only the personal button when there is no action", () => {
    render(
      <OrganisationStateBanner
        banner={{ ...banner, action: null }}
        personal={restricted.personal}
      />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("offers no personal button without a personal account", () => {
    render(<OrganisationStateBanner banner={banner} personal={null} />);
    expect(
      screen.queryByRole("link", { name: "Keep bidding as yourself" }),
    ).not.toBeInTheDocument();
  });
});
