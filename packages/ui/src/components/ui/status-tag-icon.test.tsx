import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusTagIcon } from "./status-tag-icon.js";

describe("StatusTagIcon", () => {
  it("uses distinct glyphs for info-family tones", () => {
    const { container: info } = render(<StatusTagIcon tone="info" />);
    const { container: pending } = render(<StatusTagIcon tone="pending" />);
    const { container: draft } = render(<StatusTagIcon tone="draft" />);
    const { container: publicTone } = render(<StatusTagIcon tone="public" />);

    expect(info.querySelector("svg.lucide-info")).not.toBeNull();
    expect(pending.querySelector("svg.lucide-clock")).not.toBeNull();
    expect(draft.querySelector("svg.lucide-file")).not.toBeNull();
    expect(publicTone.querySelector("svg.lucide-eye")).not.toBeNull();
  });
});
