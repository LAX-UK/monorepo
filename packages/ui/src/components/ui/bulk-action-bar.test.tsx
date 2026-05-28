import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BulkActionBar } from "./bulk-action-bar.js";

describe("BulkActionBar", () => {
  it("offsets the mobile bar above bottom chrome when enabled", () => {
    render(
      <BulkActionBar count={2} offsetBottomChrome>
        <button type="button">Remove</button>
      </BulkActionBar>,
    );

    const mobileBar = screen
      .getAllByLabelText("2 selected")
      .find((el) => el.className.includes("md:hidden"));
    expect(mobileBar?.className).toMatch(
      /bottom-\[calc\(var\(--bottom-nav-height,64px\)\+var\(--bottom-tab-bar-bottom,0px\)\)\]/,
    );
  });
});
