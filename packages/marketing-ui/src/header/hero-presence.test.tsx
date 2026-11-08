import { act, render, renderHook } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createHeroPresence } from "./hero-presence.js";

describe("createHeroPresence", () => {
  it("is absent until a hero registers, and follows it as it comes and goes", () => {
    const presence = createHeroPresence({ assumedOnServer: false });
    const { result } = renderHook(() => presence.useHeroPresent());
    expect(result.current).toBe(false);

    let release = () => {};
    act(() => {
      release = presence.register();
    });
    expect(result.current).toBe(true);

    act(() => release());
    expect(result.current).toBe(false);
  });

  it("stays present while any one of several heroes is mounted", () => {
    const presence = createHeroPresence({ assumedOnServer: false });
    const { result } = renderHook(() => presence.useHeroPresent());
    let first = () => {};
    let second = () => {};
    act(() => {
      first = presence.register();
      second = presence.register();
    });
    act(() => first());
    expect(result.current).toBe(true);
    act(() => second());
    expect(result.current).toBe(false);
  });

  it("registers from a mounted hero and releases on unmount", () => {
    const presence = createHeroPresence({ assumedOnServer: false });
    function Hero() {
      useLayoutEffect(() => presence.register(), []);
      return null;
    }
    const { result } = renderHook(() => presence.useHeroPresent());
    const view = render(<Hero />);
    expect(result.current).toBe(true);
    view.unmount();
    expect(result.current).toBe(false);
  });

  it("renders on the server with the assumption it was given", () => {
    function Probe({ presence }: { presence: ReturnType<typeof createHeroPresence> }) {
      return <>{presence.useHeroPresent() ? "hero" : "none"}</>;
    }
    expect(
      renderToString(<Probe presence={createHeroPresence({ assumedOnServer: false })} />),
    ).toBe("none");
    expect(renderToString(<Probe presence={createHeroPresence({ assumedOnServer: true })} />)).toBe(
      "hero",
    );
  });
});
