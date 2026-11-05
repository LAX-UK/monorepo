import { CookieDock } from "@/components/marketing/consent/cookie-dock";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

describe("CookieDock", () => {
  it("sits above the docked tab bar, on the shared bottom space", () => {
    const { container } = render(<CookieDock />);
    const dock = container.querySelector("[data-cookie-dock]");
    expect(dock?.className).toContain("bottom-[var(--lax-bottom-bar-space,0px)]");
    expect(dock?.className).not.toContain("bottom-0");
  });
});
