// @vitest-environment jsdom
import { act, createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { registerArtHero, useArtHeroPresent } from "./art-hero-presence.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  return createElement("span", null, String(useArtHeroPresent()));
}

describe("art hero presence", () => {
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
  });

  function mountProbe(): HTMLElement {
    const container = document.createElement("div");
    root = createRoot(container);
    act(() => root?.render(createElement(Probe)));
    return container;
  }

  it("assumes a hero on the server, where mounted heroes are invisible", () => {
    expect(renderToString(createElement(Probe))).toContain("true");
  });

  it("follows heroes as they mount and unmount", () => {
    const container = mountProbe();
    expect(container.textContent).toBe("false");

    let unregister = () => {};
    act(() => {
      unregister = registerArtHero();
    });
    expect(container.textContent).toBe("true");

    act(() => unregister());
    expect(container.textContent).toBe("false");
  });

  it("stays present until every hero has unmounted", () => {
    const container = mountProbe();

    let unregisterFirst = () => {};
    let unregisterSecond = () => {};
    act(() => {
      unregisterFirst = registerArtHero();
      unregisterSecond = registerArtHero();
    });
    act(() => unregisterFirst());
    expect(container.textContent).toBe("true");
    act(() => unregisterSecond());
    expect(container.textContent).toBe("false");
  });
});
