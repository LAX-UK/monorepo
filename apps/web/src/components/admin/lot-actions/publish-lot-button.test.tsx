import { ViewerCapabilitiesProvider } from "@/lib/auth/capabilities/viewer-capabilities-context";
import { renderWithViewer } from "@/test/render-with-viewer";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublishLotButton } from "./publish-lot-button";

vi.mock("@/lib/actions/admin", () => ({
  adminPublishLotResultAction: vi.fn().mockResolvedValue({ ok: false, error: "skip" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/lots/lot-1",
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

import { useSearchParams } from "next/navigation";

describe("PublishLotButton", () => {
  it("renders publish control", () => {
    renderWithViewer(<PublishLotButton lotId="lot-1" sellerLegalEntityId={null} />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("keeps publish enabled independently of cancel flow", () => {
    renderWithViewer(<PublishLotButton lotId="lot-1" sellerLegalEntityId={null} />);
    const publish = screen.getByRole("button", { name: "Publish" });
    fireEvent.click(publish);
    expect(publish).toBeInTheDocument();
  });

  it("renders for catalogue_manager viewer without auction.manage", () => {
    render(
      <ViewerCapabilitiesProvider
        user={{ role: "staff", staffRole: "catalogue_manager", name: "Catalogue" }}
      >
        <PublishLotButton lotId="lot-1" sellerLegalEntityId="seller-1" />
      </ViewerCapabilitiesProvider>,
    );
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("disables publish when connectBlocked is true without duplicating banner", () => {
    renderWithViewer(
      <PublishLotButton lotId="lot-1" sellerLegalEntityId="seller-1" connectBlocked />,
    );
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.queryByTestId("admin-lot-connect-required-banner")).not.toBeInTheDocument();
  });

  it("disables publish when error_code=connect_required is in the URL", () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("error_code=connect_required") as ReturnType<typeof useSearchParams>,
    );
    renderWithViewer(<PublishLotButton lotId="lot-1" sellerLegalEntityId="seller-1" />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>,
    );
  });
});
