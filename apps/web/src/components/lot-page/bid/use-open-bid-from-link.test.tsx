import { useOpenBidFromLink } from "@/components/lot-page/bid/use-open-bid-from-link";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type Primary = Parameters<typeof useOpenBidFromLink>[0];
const openButton: Primary = {
  control: { kind: "open_dialog", start: "next", label: "Bid £10" },
  disabledReason: null,
};

function visit(search: string) {
  window.history.replaceState(null, "", `/lot/a/b${search}`);
}

describe("useOpenBidFromLink", () => {
  afterEach(() => visit(""));

  it("opens the dialog once on the next bid and drops the request from the address", () => {
    visit("?bid=open&sale=s1");
    const onOpen = vi.fn();
    const { rerender } = renderHook(() => useOpenBidFromLink(openButton, onOpen));
    rerender();
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith("next");
    expect(window.location.search).toBe("?sale=s1");
  });

  it("does nothing without the request", () => {
    visit("");
    const onOpen = vi.fn();
    renderHook(() => useOpenBidFromLink(openButton, onOpen));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a sign-in link",
      { control: { kind: "go", to: "sign_in", label: "Sign in" }, disabledReason: null },
    ],
    ["a disabled button", { ...openButton, disabledReason: "Bidding has closed" }],
    ["no button", null],
  ] as [string, Primary][])("does not open for %s, and still drops the request", (_, primary) => {
    visit("?bid=open");
    const onOpen = vi.fn();
    renderHook(() => useOpenBidFromLink(primary, onOpen));
    expect(onOpen).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });
});
