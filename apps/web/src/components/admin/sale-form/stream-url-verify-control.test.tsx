import { StreamUrlVerifyControl } from "@/components/admin/sale-form/stream-url-verify-control";
import { verifyStreamUrlAction } from "@/lib/actions/stream-url-verify";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/stream-url-verify", () => ({
  verifyStreamUrlAction: vi.fn(),
}));

const verifyStreamUrlActionMock = vi.mocked(verifyStreamUrlAction);

describe("StreamUrlVerifyControl", () => {
  beforeEach(() => {
    verifyStreamUrlActionMock.mockReset();
  });
  it("shows verified title after successful verify", async () => {
    verifyStreamUrlActionMock.mockResolvedValue({
      ok: true,
      data: {
        status: "verified",
        provider: "vimeo",
        title: "TEST Final",
      },
    });

    render(
      <StreamUrlVerifyControl value="https://vimeo.com/event/6005027/53b2f6d9ec" initialValue="" />,
    );

    fireEvent.click(screen.getByRole("button", { name: /verify link/i }));

    await waitFor(() => {
      expect(screen.getByText(/"TEST Final"/i)).toBeInTheDocument();
    });
  });

  it("shows not found error and blocks submit via gate", async () => {
    verifyStreamUrlActionMock.mockResolvedValue({
      ok: true,
      data: { status: "not_found" },
    });

    const invalidUrl = "https://vimeo.com/event/6005027/deadbeef";
    const gateRef = createRef<{ assertCanSubmit: (url: string) => string | null }>();
    render(<StreamUrlVerifyControl value={invalidUrl} initialValue="" gateRef={gateRef} />);

    fireEvent.click(screen.getByRole("button", { name: /verify link/i }));

    await waitFor(() => {
      expect(screen.getByText(/stream not found or not embeddable/i)).toBeInTheDocument();
    });

    expect(gateRef.current?.assertCanSubmit(invalidUrl)).toMatch(/not found/i);
  });

  it("allows submit when URL unchanged from initial", () => {
    const gateRef = createRef<{ assertCanSubmit: (url: string) => string | null }>();
    render(
      <StreamUrlVerifyControl
        value="https://vimeo.com/event/6005027/embed/53b2f6d9ec"
        initialValue="https://vimeo.com/event/6005027/embed/53b2f6d9ec"
        gateRef={gateRef}
      />,
    );

    expect(
      gateRef.current?.assertCanSubmit("https://vimeo.com/event/6005027/embed/53b2f6d9ec"),
    ).toBeNull();
  });

  it("shows format error for unsupported URL without calling server action", () => {
    render(<StreamUrlVerifyControl value="https://example.com/stream" initialValue="" />);

    fireEvent.click(screen.getByRole("button", { name: /verify link/i }));

    expect(screen.getByText(/unsupported stream url/i)).toBeInTheDocument();
    expect(verifyStreamUrlActionMock).not.toHaveBeenCalled();
  });
});
