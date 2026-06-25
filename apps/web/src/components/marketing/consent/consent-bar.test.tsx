import { ConsentBar } from "@/components/marketing/consent/consent-bar";
import { ConsentPreferencesDialog } from "@/components/marketing/consent/consent-dialog";
import { ConsentProvider } from "@/lib/analytics/consent/context";
import { buildConsentSnapshot } from "@/lib/analytics/consent/cookie";
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

  it("calls setConsentAction with reject-all prefs from preferences dialog", async () => {
    mockSetConsentAction.mockResolvedValueOnce({
      ok: true,
      snapshot: buildConsentSnapshot({ analytics: false, marketing: false }),
    });
    tree(
      <>
        <ConsentBar />
        <ConsentPreferencesDialog />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /customise/i }));
    fireEvent.click(await screen.findByRole("button", { name: /reject all/i }));
    await waitFor(() => {
      expect(mockSetConsentAction).toHaveBeenCalledWith({ analytics: false, marketing: false });
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("does not show reject all on the first-layer banner", () => {
    tree(<ConsentBar />);
    expect(screen.queryByRole("button", { name: /reject all/i })).not.toBeInTheDocument();
  });

  it("calls setConsentAction with accept-all prefs", async () => {
    tree(
      <>
        <ConsentBar />
        <ConsentPreferencesDialog />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /accept all/i }));
    await waitFor(() => {
      expect(mockSetConsentAction).toHaveBeenCalledWith({ analytics: true, marketing: true });
    });
  });

  it("opens customise dialog", async () => {
    tree(
      <>
        <ConsentBar />
        <ConsentPreferencesDialog />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /customise/i }));
    expect(await screen.findByRole("heading", { name: /cookie preferences/i })).toBeInTheDocument();
  });
});
