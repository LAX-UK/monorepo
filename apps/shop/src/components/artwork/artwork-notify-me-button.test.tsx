import { registerArtworkInterest } from "@/app/actions/artwork-interest.actions";
/** @vitest-environment jsdom */
import { ArtworkNotifyMeButton } from "@/components/artwork/artwork-notify-me-button";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/artwork-interest.actions", () => ({
  registerArtworkInterest: vi.fn(),
}));

const registerMock = vi.mocked(registerArtworkInterest);

describe("ArtworkNotifyMeButton", () => {
  afterEach(() => {
    cleanup();
    registerMock.mockReset();
  });

  it("shows subscribed copy when initialSubscribed is true", () => {
    render(<ArtworkNotifyMeButton slug="reed-study" initialSubscribed />);
    expect(screen.getByText(/We will notify you when this work is available online/i)).toBeTruthy();
  });

  it("shows success state after registration", async () => {
    registerMock.mockResolvedValueOnce({ ok: true, status: "registered" });
    render(<ArtworkNotifyMeButton slug="reed-study" initialSubscribed={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Notify me" }));
    await waitFor(() => {
      expect(
        screen.getByText(/We will notify you when this work is available online/i),
      ).toBeTruthy();
    });
  });

  it("shows already subscribed message", async () => {
    registerMock.mockResolvedValueOnce({ ok: true, status: "already_subscribed" });
    render(<ArtworkNotifyMeButton slug="reed-study" initialSubscribed={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Notify me" }));
    await waitFor(() => {
      expect(screen.getByText(/already on the list/i)).toBeTruthy();
    });
  });

  it("shows failure message from server action", async () => {
    registerMock.mockResolvedValueOnce({ ok: false, message: "Could not save" });
    render(<ArtworkNotifyMeButton slug="reed-study" initialSubscribed={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Notify me" }));
    await waitFor(() => {
      expect(screen.getByText("Could not save")).toBeTruthy();
    });
  });
});
