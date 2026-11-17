import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusDetailsButton } from "./status-details.js";

const STATUS = { label: "Mirrored to Zoho", tone: "success", shape: "check" } as const;
const NAME = "Zoho: Mirrored to Zoho, details";

/** `matchMedia` answering the `md` query: true from 768px up (a desk), false below (a phone). */
function atWidth(desk: boolean) {
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) =>
      ({
        matches: desk,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

type Holds = "text" | "a button" | "a link";

/** Details holding only a sentence, a sentence and a button, or a sentence and a link. */
function renderButton(holds: Holds = "text") {
  return render(
    <StatusDetailsButton status={STATUS} name={NAME} data-zoho-mirror="mirrored">
      <p>Last sent 14 Nov 2026, 16:02.</p>
      {holds === "a button" ? <button type="button">Copy Zoho record ID</button> : null}
      {holds === "a link" ? <a href="https://bid.example.test/admin/failed-jobs">Open</a> : null}
    </StatusDetailsButton>,
  );
}

afterEach(() => {
  atWidth(false);
});

describe("StatusDetailsButton", () => {
  it("is a button whose name includes the state, drawing the badge's label and cue", () => {
    atWidth(true);
    renderButton();
    const button = screen.getByRole("button", { name: NAME });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-zoho-mirror", "mirrored");
    expect(button).toHaveTextContent("Mirrored to Zoho");
    expect(button.querySelector("[data-tone='success'] [data-shape='check']")).not.toBeNull();
    // Nothing on hover alone: the details are not in the page until the badge is pressed.
    fireEvent.pointerEnter(button);
    fireEvent.mouseEnter(button);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the details as a dialog on a desk, with focus moved in and Esc back to the badge", async () => {
    atWidth(true);
    renderButton();
    const button = screen.getByRole("button", { name: NAME });
    await act(async () => {
      button.focus();
      fireEvent.click(button);
    });
    const dialog = await screen.findByRole("dialog", { name: "Mirrored to Zoho" });
    expect(dialog).toHaveAccessibleDescription("Last sent 14 Nov 2026, 16:02.");
    expect(within(dialog).getByRole("heading", { name: "Mirrored to Zoho" })).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(dialog));
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document.activeElement ?? dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(button);
  });

  it("opens the details as a bottom sheet on a phone, with a 44px close back to the badge", async () => {
    atWidth(false);
    renderButton();
    const button = screen.getByRole("button", { name: NAME });
    await act(async () => {
      button.focus();
      fireEvent.click(button);
    });
    const sheet = await screen.findByRole("dialog", { name: "Mirrored to Zoho" });
    expect(sheet).toHaveAttribute("data-side", "bottom");
    expect(sheet).toHaveAccessibleDescription("Last sent 14 Nov 2026, 16:02.");
    await waitFor(() => expect(document.activeElement).toBe(sheet));
    const close = within(sheet).getByRole("button", { name: "Close" });
    expect(close.className).toContain("size-11");

    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(button);
  });

  // Whatever the details hold, focus lands in the same place: the dialog itself.
  it.each([
    ["a desk", "text"],
    ["a desk", "a button"],
    ["a desk", "a link"],
    ["a phone", "text"],
    ["a phone", "a button"],
    ["a phone", "a link"],
  ] as const)("on %s, focus moves to the dialog itself when it holds %s", async (where, holds) => {
    atWidth(where === "a desk");
    renderButton(holds);
    const button = screen.getByRole("button", { name: NAME });
    await act(async () => {
      button.focus();
      fireEvent.click(button);
    });
    const dialog = await screen.findByRole("dialog", { name: "Mirrored to Zoho" });
    await waitFor(() => expect(document.activeElement).toBe(dialog));
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(button);
  });
});
