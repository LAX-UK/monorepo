import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@auction/ui/components/tooltip", () =>
  import("../test/radix-stubs.js").then((m) => m.tooltip),
);

const { COPY_CONFIRMATION_MS, CopyButton, CopyableId } = await import("./copy-button.js");

function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

/** Lets the live region's next-frame update run. */
const nextFrame = () => act(() => vi.advanceTimersByTime(20));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  stubClipboard(undefined);
});

describe("CopyButton", () => {
  it("is a named button with an empty live region at rest", () => {
    render(<CopyButton value="ord_123" label="Order ID" />);
    expect(screen.getByRole("button", { name: "Copy order ID" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("copies the exact value, shows a tick and announces it, then returns to rest after 1.5s", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<CopyButton value="ord_123" label="Order ID" />);
    const button = screen.getByRole("button", { name: "Copy order ID" });
    expect(button.querySelector(".lucide-copy")).not.toBeNull();

    await act(async () => {
      fireEvent.click(button);
    });
    await nextFrame();
    expect(writeText).toHaveBeenCalledWith("ord_123");
    expect(screen.getByRole("status")).toHaveTextContent("Order ID copied");
    expect(button.querySelector(".lucide-check")).not.toBeNull();
    // The name does not change, so the announcement is not read twice.
    expect(button).toHaveAccessibleName("Copy order ID");

    act(() => {
      vi.advanceTimersByTime(COPY_CONFIRMATION_MS - 21);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Order ID copied");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(button.querySelector(".lucide-copy")).not.toBeNull();
  });

  it("says so, and shows no tick, when the browser refuses", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    render(<CopyButton value="ord_123" label="Order ID" />);
    const button = screen.getByRole("button", { name: "Copy order ID" });
    await act(async () => {
      fireEvent.click(button);
    });
    await nextFrame();
    expect(screen.getByRole("status")).toHaveTextContent("Could not copy order ID");
    expect(button.querySelector(".lucide-check")).toBeNull();
    // The failure is visible, not only announced: an alert icon in the danger colour.
    expect(button.querySelector(".lucide-circle-alert")).not.toBeNull();
    expect(button.querySelector(".lucide-copy")).toBeNull();
    expect(button).toHaveAttribute("data-copy-status", "failed");
    expect(button.className).toContain("text-staff-danger");

    act(() => {
      vi.advanceTimersByTime(COPY_CONFIRMATION_MS);
    });
    expect(button.querySelector(".lucide-copy")).not.toBeNull();
    expect(button.className).not.toContain("text-staff-danger");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("says so when there is no clipboard", async () => {
    stubClipboard(undefined);
    render(<CopyButton value="ord_123" label="Order ID" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy order ID" }));
    await nextFrame();
    expect(screen.getByRole("status")).toHaveTextContent("Could not copy order ID");
  });

  it("is reachable and operable from the keyboard: Tab, Enter and Space", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // user-event waits on real timers between keystrokes.
    vi.useRealTimers();
    const user = userEvent.setup();
    // setup() installs its own clipboard; put the spy back.
    stubClipboard(writeText);
    render(<CopyButton value="ord_123" label="Order ID" />);
    const button = screen.getByRole("button", { name: "Copy order ID" });
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(writeText).toHaveBeenCalledTimes(1);
    await user.keyboard(" ");
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it("announces a repeat press inside the window: the same live region changes twice", async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyButton value="ord_123" label="Order ID" />);
    const region = screen.getByRole("status");
    const button = screen.getByRole("button", { name: "Copy order ID" });
    const texts: string[] = [];
    const observer = new MutationObserver(() => texts.push(region.textContent ?? ""));
    observer.observe(region, { childList: true, characterData: true, subtree: true });
    const press = async () => {
      await act(async () => {
        fireEvent.click(button);
      });
      await nextFrame();
      await Promise.resolve();
    };
    await press();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    await press();
    observer.disconnect();
    // The region is the same element throughout, and its text went set, cleared, set again.
    expect(screen.getByRole("status")).toBe(region);
    expect(texts.filter((text) => text === "Order ID copied")).toHaveLength(2);
    expect(texts).toContain("");
  });

  it("keeps a proper noun cased in the name and the failure message", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    render(<CopyButton value="acct_1" label="Stripe Connect account ID" />);
    const button = screen.getByRole("button", { name: "Copy Stripe Connect account ID" });
    await act(async () => {
      fireEvent.click(button);
    });
    await nextFrame();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Could not copy Stripe Connect account ID",
    );
  });

  it.each([
    ["ATG auction ID", "Copy ATG auction ID"],
    ["SHA-256", "Copy SHA-256"],
    ["Stripe transfer", "Copy Stripe transfer"],
    ["Stripe requirement key", "Copy Stripe requirement key"],
    ["Xero invoice", "Copy Xero invoice"],
    ["Veriff session", "Copy Veriff session"],
    ["Zoho record ID", "Copy Zoho record ID"],
    ["Order ID", "Copy order ID"],
  ])("names %s as %s", (label, name) => {
    render(<CopyButton value="v" label={label} />);
    expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("clears its timer on unmount", async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const { unmount } = render(<CopyButton value="ord_123" label="Order ID" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy order ID" }));
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("CopyableId", () => {
  it("shows the reference on one line with its copy button", () => {
    render(<CopyableId value="pi_3QxAbCdEfGhIjKlM" label="Payment intent ID" />);
    expect(screen.getByText(/pi_3Qx/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy payment intent ID" })).toBeInTheDocument();
  });
});
