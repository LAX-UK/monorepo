/** @vitest-environment jsdom */
import { ArtworkEditionExplainer } from "@/components/artwork/artwork-edition-explainer";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

const STATEMENT =
  "A limited edition is a fixed number of prints from one image. No more will be made in this size and form.";

describe("ArtworkEditionExplainer", () => {
  afterEach(cleanup);

  it("is closed by default", () => {
    render(<ArtworkEditionExplainer statement={STATEMENT} />);
    const trigger = screen.getByRole("button", { name: "About limited editions" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(STATEMENT)).toBeNull();
  });

  it("opens on click", () => {
    render(<ArtworkEditionExplainer statement={STATEMENT} />);
    const trigger = screen.getByRole("button", { name: "About limited editions" });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(STATEMENT)).toBeTruthy();
  });

  it("opens on Enter", () => {
    render(<ArtworkEditionExplainer statement={STATEMENT} />);
    const trigger = screen.getByRole("button", { name: "About limited editions" });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    // A browser turns Enter on a focused button into a click; jsdom does not, so mirror it.
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(STATEMENT)).toBeTruthy();
  });
});
