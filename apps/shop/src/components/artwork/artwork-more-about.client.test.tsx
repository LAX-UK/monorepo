/** @vitest-environment jsdom */
import { ArtworkMoreAbout } from "@/components/artwork/artwork-more-about.client";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

function mockWidth(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe("ArtworkMoreAbout", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("starts closed on a phone and keeps the summary", () => {
    mockWidth(false);
    const { container } = render(<ArtworkMoreAbout>Body</ArtworkMoreAbout>);
    expect(screen.getByText("More about this edition")).toBeTruthy();
    expect(container.querySelector("details")?.open).toBe(false);
  });

  it("is open from tablet width", () => {
    mockWidth(true);
    const { container } = render(<ArtworkMoreAbout>Body</ArtworkMoreAbout>);
    expect(container.querySelector("details")?.open).toBe(true);
  });

  const STATEMENT =
    "A limited edition is a fixed number of prints from one image. No more will be made in this size and form.";

  it("holds the limited-edition statement inside the disclosure, before the work", () => {
    mockWidth(true);
    const { container } = render(
      <ArtworkMoreAbout statement={STATEMENT}>
        <section>
          <h2>About the work and the print</h2>
        </section>
      </ArtworkMoreAbout>,
    );
    const details = container.querySelector("details");
    if (!details) throw new Error("expected a details element");
    const summary = within(details).getByText("More about this edition");
    expect(summary.closest("summary")).toBeTruthy();
    const section = within(details).getByRole("region", { name: "About limited editions" });
    expect(within(section).getByText(STATEMENT)).toBeTruthy();
    const headings = within(details)
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["About limited editions", "About the work and the print"]);
  });

  it("renders with only the statement and no work description", () => {
    mockWidth(false);
    const { container } = render(<ArtworkMoreAbout statement={STATEMENT} />);
    const details = container.querySelector("details");
    expect(details?.querySelector("summary")?.textContent).toBe("More about this edition");
    expect(details?.textContent).toContain(STATEMENT);
  });

  it("shows no limited-editions part without a statement", () => {
    mockWidth(true);
    render(<ArtworkMoreAbout>Body</ArtworkMoreAbout>);
    expect(screen.queryByText("About limited editions")).toBeNull();
  });
});
