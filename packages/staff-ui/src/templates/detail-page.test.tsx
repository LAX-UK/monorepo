import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DetailColumns, DetailPage } from "./detail-page.js";

describe("DetailPage heading", () => {
  it("wraps a plain title in the page's one h1", () => {
    render(<DetailPage title="Autumn sale">Body</DetailPage>);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Autumn sale" })).toBeInTheDocument();
  });

  it("lets a title that renders its own h1 stay the only one", () => {
    render(
      <DetailPage
        renderHeading
        title={
          <span>
            <h1>Ada Lovelace</h1>
            <button type="button">Rename client</button>
          </span>
        }
      >
        Body
      </DetailPage>,
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Rename client" })).toBeInTheDocument();
  });
});

describe("DetailColumns rail placement", () => {
  it("keeps the rail after the main column by default", () => {
    render(<DetailColumns rail={<p>Facts</p>}>Thread</DetailColumns>);
    expect(screen.getByRole("complementary", { name: "Activity" }).className).not.toContain(
      "order-first",
    );
  });

  it("puts the rail first on narrow screens when asked, named for what it holds", () => {
    render(
      <DetailColumns rail={<p>Facts</p>} railLabel="Consignment facts" railPlacement="before">
        Thread
      </DetailColumns>,
    );
    const rail = screen.getByRole("complementary", { name: "Consignment facts" });
    expect(rail.className).toContain("order-first");
    expect(rail.className).toContain("xl:order-none");
  });
});
