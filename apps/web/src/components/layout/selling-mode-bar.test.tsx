import type { LegalEntitySummary } from "@auction/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SellingModeBar } from "./selling-mode-bar";

const push = vi.fn();
const refresh = vi.fn();
const switchActingLegalEntity = vi.fn();
const notifyError = vi.fn();

// Radix's popover keeps its floating-ui positioning loop running in jsdom after the test that
// opened it ends, which slows every later test and stalls the runner. This stand-in keeps the
// same open/close contract, so the tests still exercise what the picker shows and does.
vi.mock("@auction/ui/components/popover", async () => {
  const React = await import("react");
  const PopoverContext = React.createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
    open: false,
    setOpen: () => {},
  });
  return {
    Popover: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      children: React.ReactNode;
    }) => (
      <PopoverContext.Provider value={{ open, setOpen: onOpenChange }}>
        {children}
      </PopoverContext.Provider>
    ),
    PopoverTrigger: ({ children }: { children: React.ReactElement<{ onClick?: () => void }> }) => {
      const { open, setOpen } = React.useContext(PopoverContext);
      return React.cloneElement(children, { onClick: () => setOpen(!open) });
    },
    PopoverContent: ({ children }: { children: React.ReactNode }) => {
      const { open } = React.useContext(PopoverContext);
      return open ? <div>{children}</div> : null;
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/legal-entity/acting-context.actions", () => ({
  switchActingLegalEntity: (id: string | null) => switchActingLegalEntity(id),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { error: (title: string) => notifyError(title) },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function entity(overrides: Partial<LegalEntitySummary>): LegalEntitySummary {
  return {
    id: "me",
    displayName: "Alex Morgan",
    kind: "individual",
    subkind: "private_collector",
    status: "approved",
    role: "owner",
    isPrimaryAdmin: true,
    ...overrides,
  };
}

const personal = entity({});
const gallery = entity({
  id: "org-1",
  displayName: "Northbank Gallery",
  kind: "organisation",
  subkind: "gallery",
  role: "finance",
});

describe("SellingModeBar", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    switchActingLegalEntity.mockReset();
    notifyError.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("labels the mode and offers a way back to buying", () => {
    render(<SellingModeBar acting={personal} memberships={[personal]} orgModuleEnabled />);
    expect(screen.getByTestId("selling-mode-label")).toHaveTextContent("Selling");
    expect(screen.getByTestId("back-to-buying")).toHaveAttribute("href", "/dashboard/bids");
  });

  it("shows no picker to someone with no organisation", () => {
    render(<SellingModeBar acting={personal} memberships={[personal]} orgModuleEnabled />);
    expect(screen.queryByRole("button", { name: /change who you are selling as/i })).toBeNull();
  });

  it("names the organisation being sold as", () => {
    render(<SellingModeBar acting={gallery} memberships={[personal, gallery]} orgModuleEnabled />);
    expect(screen.getByTestId("selling-mode-label")).toHaveTextContent(
      "Selling as Northbank Gallery",
    );
    expect(screen.getByTestId("back-to-buying")).toBeInTheDocument();
  });

  it("lists the personal account and each organisation with the member's role", () => {
    render(<SellingModeBar acting={personal} memberships={[personal, gallery]} orgModuleEnabled />);
    fireEvent.click(screen.getByTestId("selling-mode-label"));
    expect(screen.getByText("Sell as")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /personal/i })).toHaveAttribute(
      "aria-current",
      "true",
    );
    const org = screen.getByRole("button", { name: /northbank gallery/i });
    expect(org).toHaveTextContent("Finance");
    expect(org).not.toHaveAttribute("aria-current");
  });

  it("gives a phone a compact switcher labelled with the account, in place of the wide picker", () => {
    render(
      <SellingModeBar
        acting={{ ...gallery, displayName: "The Northbank Contemporary Gallery Ltd" }}
        memberships={[personal, gallery]}
        orgModuleEnabled
      />,
    );
    expect(screen.getByTestId("selling-mode-switcher")).toHaveAttribute(
      "aria-label",
      "Selling as The Northbank Contemporary Gallery Ltd. Change account",
    );
  });

  it("offers the compact switcher to someone with no organisation, since it also holds the way back", () => {
    render(<SellingModeBar acting={personal} memberships={[personal]} orgModuleEnabled />);
    expect(screen.getByTestId("selling-mode-switcher")).toHaveAttribute(
      "aria-label",
      "Selling. Change account",
    );
  });

  it("does nothing when the current account is chosen again", () => {
    render(<SellingModeBar acting={personal} memberships={[personal, gallery]} orgModuleEnabled />);
    fireEvent.click(screen.getByTestId("selling-mode-label"));
    fireEvent.click(screen.getByRole("button", { name: /personal/i }));
    expect(switchActingLegalEntity).not.toHaveBeenCalled();
  });

  it("links to registering an organisation and to pending invitations", () => {
    render(
      <SellingModeBar
        acting={personal}
        memberships={[personal, gallery]}
        orgModuleEnabled
        pendingInvitesCount={2}
      />,
    );
    fireEvent.click(screen.getByTestId("selling-mode-label"));
    expect(screen.getByRole("link", { name: /register an organisation/i })).toHaveAttribute(
      "href",
      "/onboarding/organisation?fresh=1",
    );
    expect(screen.getByRole("link", { name: /pending invitations \(2\)/i })).toHaveAttribute(
      "href",
      "/dashboard/invitations",
    );
  });

  it("uses none of the retired wording", () => {
    const { container } = render(
      <SellingModeBar acting={gallery} memberships={[personal, gallery]} orgModuleEnabled />,
    );
    fireEvent.click(screen.getByTestId("selling-mode-label"));
    expect(document.body.textContent ?? "").not.toMatch(/acting as|legal entity/i);
    expect(container.innerHTML).not.toMatch(/legal entity/i);
  });
});
