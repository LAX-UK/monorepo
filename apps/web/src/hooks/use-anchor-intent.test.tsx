import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useAnchorIntent } from "./use-anchor-intent";

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("useAnchorIntent", () => {
  it("is false until a link to the section is pointed at, then stays true", () => {
    render(
      <>
        <a href="#telephone">Telephone bidding</a>
        <a href="#overview">Overview</a>
      </>,
    );
    const { result } = renderHook(() => useAnchorIntent("telephone"));
    expect(result.current).toBe(false);

    fireEvent.pointerOver(screen.getByRole("link", { name: "Overview" }));
    expect(result.current).toBe(false);

    fireEvent.pointerOver(screen.getByRole("link", { name: "Telephone bidding" }));
    expect(result.current).toBe(true);
    fireEvent.pointerOver(screen.getByRole("link", { name: "Overview" }));
    expect(result.current).toBe(true);
  });

  it("answers to a focused or touched link too", () => {
    render(<a href="#telephone">Telephone bidding</a>);
    const { result } = renderHook(() => useAnchorIntent("telephone"));
    act(() => {
      screen.getByRole("link").focus();
    });
    expect(result.current).toBe(true);
  });

  it("is true at once when the address already names the section", () => {
    window.history.replaceState(null, "", "/#telephone");
    const { result } = renderHook(() => useAnchorIntent("telephone"));
    expect(result.current).toBe(true);
  });
});
