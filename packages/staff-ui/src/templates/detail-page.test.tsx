import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DetailPage } from "./detail-page.js";

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
