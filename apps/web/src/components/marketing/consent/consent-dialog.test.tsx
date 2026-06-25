import { ConsentBar } from "@/components/marketing/consent/consent-bar";
import { ConsentPreferencesDialog } from "@/components/marketing/consent/consent-dialog";
import { CookiePreferencesLink } from "@/components/marketing/consent/cookie-preferences-link";
import { ConsentProvider } from "@/lib/analytics/consent/context";
import { type ConsentSnapshot, buildConsentSnapshot } from "@/lib/analytics/consent/cookie";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

function tree(ui: ReactNode, initialSnapshot: ConsentSnapshot | null = null) {
  return render(<ConsentProvider initialSnapshot={initialSnapshot}>{ui}</ConsentProvider>);
}

function openPreferencesFromBanner() {
  tree(
    <>
      <ConsentBar />
      <ConsentPreferencesDialog />
    </>,
  );
  fireEvent.click(screen.getByRole("button", { name: /customise/i }));
}

describe("ConsentPreferencesDialog", () => {
  beforeEach(() => {
    mockSetConsentAction.mockReset();
    mockRefresh.mockReset();
    mockSetConsentAction.mockResolvedValue({
      ok: true,
      snapshot: buildConsentSnapshot({ analytics: false, marketing: false }),
    });
  });

  it("calls setConsentAction with reject-all prefs", async () => {
    openPreferencesFromBanner();
    fireEvent.click(await screen.findByRole("button", { name: /reject all/i }));
    await waitFor(() => {
      expect(mockSetConsentAction).toHaveBeenCalledWith({ analytics: false, marketing: false });
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("calls setConsentAction with all-off prefs when saving default toggles", async () => {
    openPreferencesFromBanner();
    fireEvent.click(await screen.findByRole("button", { name: /save preferences/i }));
    await waitFor(() => {
      expect(mockSetConsentAction).toHaveBeenCalledWith({ analytics: false, marketing: false });
    });
  });

  it("calls setConsentAction with custom prefs when toggles are enabled", async () => {
    mockSetConsentAction.mockResolvedValueOnce({
      ok: true,
      snapshot: buildConsentSnapshot({ analytics: true, marketing: false }),
    });
    openPreferencesFromBanner();
    fireEvent.click(await screen.findByRole("switch", { name: /analytics/i }));
    fireEvent.click(await screen.findByRole("button", { name: /save preferences/i }));
    await waitFor(() => {
      expect(mockSetConsentAction).toHaveBeenCalledWith({ analytics: true, marketing: false });
    });
  });

  it("initialises toggles from an existing consent snapshot", async () => {
    tree(
      <>
        <CookiePreferencesLink />
        <ConsentPreferencesDialog />
      </>,
      buildConsentSnapshot({ analytics: true, marketing: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: /cookie preferences/i }));
    expect(await screen.findByRole("switch", { name: /analytics/i })).toBeChecked();
    expect(screen.getByRole("switch", { name: /marketing/i })).toBeChecked();
  });
});
