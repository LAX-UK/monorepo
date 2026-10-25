/** @vitest-environment jsdom */
import {
  registerEditionAlert,
  stopEditionAlertForArtwork,
} from "@/app/actions/artwork-interest.actions";
import { ArtworkEditionAlert } from "@/components/artwork/artwork-edition-alert";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/artwork-interest.actions", () => ({
  registerEditionAlert: vi.fn(),
  stopEditionAlertForArtwork: vi.fn(),
}));

const registerMock = vi.mocked(registerEditionAlert);
const stopMock = vi.mocked(stopEditionAlertForArtwork);

describe("ArtworkEditionAlert", () => {
  afterEach(() => {
    cleanup();
    registerMock.mockReset();
    stopMock.mockReset();
  });

  it("does not move focus when the page loads", () => {
    render(<ArtworkEditionAlert slug="reed-study" viewer={{ kind: "guest" }} />);
    expect(document.activeElement).toBe(document.body);
  });

  it("checks the address before sending and focuses the field to correct it", async () => {
    render(<ArtworkEditionAlert slug="reed-study" viewer={{ kind: "guest" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Email me" }));
    const input = screen.getByLabelText("Email address");
    expect(screen.getByText("Enter your email address")).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me" }));
    expect(screen.getByText(/correct format/)).toBeTruthy();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("registers a guest address and announces the result politely", async () => {
    registerMock.mockResolvedValueOnce({ ok: true, status: "registered" });
    render(<ArtworkEditionAlert slug="reed-study" viewer={{ kind: "guest" }} />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: " grace@example.com " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Email me" }));
    await waitFor(() => expect(screen.getByText("You are on the list")).toBeTruthy());
    expect(registerMock).toHaveBeenCalledWith("reed-study", { email: "grace@example.com" });
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("grace@example.com");
  });

  it("shows a server error and keeps the form", async () => {
    registerMock.mockResolvedValueOnce({ ok: false, message: "Too many requests." });
    render(<ArtworkEditionAlert slug="reed-study" viewer={{ kind: "guest" }} />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "grace@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Email me" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Too many"));
    expect(screen.getByLabelText("Email address")).toBeTruthy();
  });

  it("uses the account address for a signed-in shopper and can stop the alert", async () => {
    registerMock.mockResolvedValueOnce({ ok: true, status: "registered" });
    stopMock.mockResolvedValueOnce({ ok: true });
    render(
      <ArtworkEditionAlert
        slug="reed-study"
        viewer={{ kind: "account", email: "robert@example.test" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Email me if it is back" }));
    await waitFor(() => expect(screen.getByText("You are on the list")).toBeTruthy());
    expect(registerMock).toHaveBeenCalledWith("reed-study", {});
    fireEvent.click(screen.getByRole("button", { name: "Stop this alert" }));
    await waitFor(() => expect(screen.getByText(/Alert stopped/)).toBeTruthy());
    expect(screen.getByRole("button", { name: "Email me if it is back" })).toBeTruthy();
  });
});
