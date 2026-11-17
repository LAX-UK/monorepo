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

function renderButton() {
  return render(
    <StatusDetailsButton status={STATUS} name={NAME} data-zoho-mirror="mirrored">
      <p>Last sent Sat 14 Nov, 16:02 GMT.</p>
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
    expect(dialog).toHaveAccessibleDescription("Last sent Sat 14 Nov, 16:02 GMT.");
    expect(within(dialog).getByRole("heading", { name: "Mirrored to Zoho" })).toBeInTheDocument();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
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
    expect(sheet).toHaveAccessibleDescription("Last sent Sat 14 Nov, 16:02 GMT.");
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true));
    const close = within(sheet).getByRole("button", { name: "Close" });
    expect(close.className).toContain("size-11");

    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(button);
  });
});
