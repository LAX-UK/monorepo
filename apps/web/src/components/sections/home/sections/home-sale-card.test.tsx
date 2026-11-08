import type { HomeComingUpRow } from "@/lib/home-sections/types";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./home-sale-remind", () => ({
  HomeSaleRemind: ({ signedIn }: { signedIn: boolean }) => (
    <button type="button">{signedIn ? "Remind me (signed in)" : "Remind me"}</button>
  ),
}));

import { HomeSaleCard } from "./home-sale-card";

afterEach(cleanup);

const row: HomeComingUpRow = {
  id: "s1",
  href: "/sales/winter",
  dateMain: "10 Nov",
  dateSub: "Tue · 18:00 GMT",
  title: "Winter Evening Sale",
  meta: "Online · 6 lots",
  typeLabel: "Online",
  lotsLabel: "6 lots",
  image: { src: "/c.jpg", alt: "", focal: { x: 0.25, y: 0.75 } },
  time: { text: "Opens Tue 10 Nov, 18:00 GMT · in 4 days" },
  action: { href: "/sales/winter", label: "Preview" },
};

describe("HomeSaleCard", () => {
  it("shows the cover cropped at the staff focal point, with Preview and Remind me", () => {
    const { container } = render(<HomeSaleCard row={row} variant="feature" signedIn={false} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("style")).toContain("object-position: 25% 75%");
    expect(screen.getByRole("link", { name: /Preview/ }).getAttribute("href")).toBe(
      "/sales/winter",
    );
    expect(screen.getByRole("button", { name: "Remind me" })).toBeTruthy();
    expect(screen.getByText(/in 4 days/)).toBeTruthy();
  });

  it("names resized files for the cover, sized to the card, instead of the uploaded original", () => {
    const remote = {
      ...row,
      image: { ...row.image, src: "https://cdn.example/cover-2400.jpg" },
    } as HomeComingUpRow;
    const feature = render(<HomeSaleCard row={remote} variant="feature" signedIn={false} />);
    const img = feature.container.querySelector("img");
    expect(img?.getAttribute("srcset")).toContain(
      "/_next/image?url=https%3A%2F%2Fcdn.example%2Fcover-2400.jpg&w=640",
    );
    expect(img?.getAttribute("sizes")).toBe("(min-width: 768px) 46vw, 100vw");
    feature.unmount();
    const card = render(<HomeSaleCard row={remote} variant="row" signedIn={false} />);
    expect(card.container.querySelector("img")?.getAttribute("sizes")).toContain("33vw");
  });

  it("has no picture and stays compact when the sale has no cover", () => {
    const { container } = render(
      <HomeSaleCard row={{ ...row, image: null }} variant="feature" signedIn />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("article")?.className).toContain("md:max-w-[44rem]");
    expect(screen.getByRole("button", { name: "Remind me (signed in)" })).toBeTruthy();
  });
});
