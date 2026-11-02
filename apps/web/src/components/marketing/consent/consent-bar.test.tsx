import { ConsentBar } from "@/components/marketing/consent/consent-bar";
import { ConsentPreferencesDialog } from "@/components/marketing/consent/consent-dialog";
import {
  CookieDock,
  CookieDockProvider,
  CookieDockSlot,
} from "@/components/marketing/consent/cookie-dock";
import { ConsentProvider } from "@/lib/analytics/consent/context";
import { buildConsentSnapshot } from "@/lib/analytics/consent/cookie";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSetConsentAction = vi.fn();
const mockRefresh = vi.fn();

vi.mock("@/lib/analytics/consent/actions", () => ({
  setConsentAction: (...args: unknown[]) => mockSetConsentAction(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function tree(ui: ReactNode) {
  return render(<ConsentProvider initialSnapshot={null}>{ui}</ConsentProvider>);
}

describe("ConsentBar", () => {
  beforeEach(() => {
    mockSetConsentAction.mockReset();
    mockRefresh.mockReset();
    mockSetConsentAction.mockResolvedValue({
      ok: true,
      snapshot: buildConsentSnapshot({ analytics: true, marketing: true }),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("offers three equal choices in one row", () => {
    tree(<ConsentBar />);
    const names = ["Accept all", "Reject all", "Settings"];
    const buttons = names.map((name) => screen.getByRole("button", { name }));
    const classes = buttons.map((button) => button.className);
    expect(new Set(classes).size).toBe(1);
    expect(buttons[0]?.className).toContain("border-lax-line-strong");
    expect(buttons[0]?.className).not.toContain("bg-lax-ink");
  });

  it("is a labelled region", () => {
    tree(<ConsentBar />);
    expect(screen.getByRole("region", { name: "Cookies" })).toBeInTheDocument();
  });

  it("rejects from the first layer", async () => {
    mockSetConsentAction.mockResolvedValueOnce({
      ok: true,
      snapshot: buildConsentSnapshot({ analytics: false, marketing: false }),
    });
    tree(<ConsentBar />);
    fireEvent.click(screen.getByRole("button", { name: "Reject all" }));
    await waitFor(() => {
      expect(mockSetConsentAction).toHaveBeenCalledWith({ analytics: false, marketing: false });
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("accepts only the categories the site offers", async () => {
    tree(<ConsentBar />);
    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    await waitFor(() => {
      expect(mockSetConsentAction).toHaveBeenCalledWith({ analytics: true, marketing: false });
    });
  });

  it("also grants marketing when a marketing tag is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_MARKETING_TAGS", "true");
    tree(<ConsentBar />);
    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    await waitFor(() => {
      expect(mockSetConsentAction).toHaveBeenCalledWith({ analytics: true, marketing: true });
    });
  });

  it("opens the settings dialog", async () => {
    tree(
      <>
        <ConsentBar />
        <ConsentPreferencesDialog />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("heading", { name: "Cookie settings" })).toBeInTheDocument();
  });

  it("names no vendor in the first layer and underlines the policy link", () => {
    tree(<ConsentBar />);
    expect(screen.getByRole("region", { name: "Cookies" }).textContent).not.toMatch(/google/i);
    expect(screen.getByRole("link", { name: /cookie policy/i })).toHaveClass("underline");
  });

  it("returns focus to where the person was once a choice removes the banner", async () => {
    mockSetConsentAction.mockResolvedValueOnce({
      ok: true,
      snapshot: buildConsentSnapshot({ analytics: false, marketing: false }),
    });
    render(
      <ConsentProvider initialSnapshot={null}>
        <button type="button">Page control</button>
        <ConsentBar />
      </ConsentProvider>,
    );
    const control = screen.getByRole("button", { name: "Page control" });
    control.focus();
    const reject = screen.getByRole("button", { name: "Reject all" });
    reject.focus();
    fireEvent.focusIn(reject, { relatedTarget: control });
    fireEvent.click(reject);
    await waitFor(() => expect(control).toHaveFocus());
  });
});

describe("CookieDock", () => {
  it("renders a slot child below the banner", () => {
    render(
      <ConsentProvider initialSnapshot={null}>
        <CookieDockProvider>
          <CookieDock>
            <ConsentBar />
          </CookieDock>
          <CookieDockSlot>
            <div>Placeholder bar</div>
          </CookieDockSlot>
        </CookieDockProvider>
      </ConsentProvider>,
    );
    const banner = screen.getByRole("region", { name: "Cookies" });
    const bar = screen.getByText("Placeholder bar");
    expect(banner.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bar.closest("[data-cookie-dock]")).not.toBeNull();
  });

  it("renders nothing where there is no dock", () => {
    render(
      <CookieDockProvider>
        <CookieDockSlot>
          <div>Placeholder bar</div>
        </CookieDockSlot>
      </CookieDockProvider>,
    );
    expect(screen.queryByText("Placeholder bar")).not.toBeInTheDocument();
  });
});
