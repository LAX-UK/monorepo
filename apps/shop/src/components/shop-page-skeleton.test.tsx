/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShopPageSkeleton } from "./shop-page-skeleton";

afterEach(cleanup);

describe("ShopPageSkeleton", () => {
  it.each(["catalogue", "detail", "commerce"] as const)(
    "marks the %s skeleton as busy for assistive tech",
    (variant) => {
      const { container } = render(<ShopPageSkeleton variant={variant} />);
      const skeleton = container.querySelector(`.shop-skeleton--${variant}`);
      expect(skeleton?.getAttribute("aria-busy")).toBe("true");
    },
  );
});
