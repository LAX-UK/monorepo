import { SIGNED_OUT_SALE_VIEWER } from "@/lib/marketing/sale-viewer";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SaleViewerProvider, useSaleViewer, useSaleViewerLoaded } from "./sale-viewer-provider";

function Probe() {
  const viewer = useSaleViewer();
  const loaded = useSaleViewerLoaded();
  return (
    <>
      <p data-testid="probe">
        {viewer.isAuthenticated ? "signed-in" : "signed-out"}:
        {viewer.isFollowing ? "following" : "-"}
      </p>
      <p data-testid="loaded">{loaded ? "loaded" : "guess"}</p>
    </>
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("SaleViewerProvider", () => {
  it("draws the signed-out page first, then the caller's part from /me", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: { isAuthenticated: true, isFollowing: true } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SaleViewerProvider saleId="sale-1" signedOut={SIGNED_OUT_SALE_VIEWER}>
        <Probe />
      </SaleViewerProvider>,
    );
    expect(screen.getByTestId("probe").textContent).toBe("signed-out:-");
    expect(screen.getByTestId("loaded").textContent).toBe("guess");
    await waitFor(() =>
      expect(screen.getByTestId("probe").textContent).toBe("signed-in:following"),
    );
    expect(screen.getByTestId("loaded").textContent).toBe("loaded");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/sales/sale-1/me");
    expect(init.cache).toBe("no-store");
    expect(init.credentials).toBe("same-origin");
  });

  it("stays signed out when /me cannot be read", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <SaleViewerProvider saleId="hidden" signedOut={SIGNED_OUT_SALE_VIEWER}>
        <Probe />
      </SaleViewerProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loaded").textContent).toBe("loaded"));
    expect(fetchMock).toHaveBeenCalled();
    expect(screen.getByTestId("probe").textContent).toBe("signed-out:-");
  });
});
