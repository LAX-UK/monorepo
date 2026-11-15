import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/ui/lax", () => ({
  Toaster: ({
    density,
    mobileOffset,
  }: {
    density: string;
    mobileOffset?: { bottom?: string };
  }) => (
    <div data-testid="toaster" data-density={density} data-bottom={mobileOffset?.bottom ?? ""} />
  ),
}));
vi.mock("./fonts", () => ({
  montserrat: { variable: "m" },
  outfit: { variable: "o" },
}));
vi.mock("./globals.css", () => ({}));

import RootLayout from "./layout";

describe("Account root layout", () => {
  it("lifts phone toasts above the docked tab bar, the same offset Bid, Shop and art use", () => {
    const html = renderToStaticMarkup(<RootLayout>{null}</RootLayout>);
    expect(html).toContain("calc(var(--lax-bottom-bar-space, 0px) + 1rem)");
    expect(html).toContain('data-density="client"');
  });
});
