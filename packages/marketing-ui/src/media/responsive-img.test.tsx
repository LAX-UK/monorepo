import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResponsiveImg } from "./responsive-img.js";

const SET = "/_next/image?url=a&w=256&q=75 256w, /_next/image?url=a&w=640&q=75 640w";

describe("ResponsiveImg", () => {
  it("names the resized files and what they mean in layout terms", () => {
    render(<ResponsiveImg src="https://cdn/a.jpg" alt="Harbour" srcSet={SET} sizes="240px" />);
    const img = screen.getByRole("img", { name: "Harbour" });
    expect(img).toHaveAttribute("srcset", SET);
    expect(img).toHaveAttribute("sizes", "240px");
    expect(img).toHaveAttribute("src", "https://cdn/a.jpg");
  });

  it("is a plain image when there is nothing to choose from", () => {
    render(<ResponsiveImg src="https://cdn/a.jpg" alt="" srcSet="" sizes="240px" />);
    const img = document.querySelector("img");
    expect(img).not.toHaveAttribute("srcset");
    expect(img).not.toHaveAttribute("sizes");
  });

  it("falls back once to the original when the resized files are refused, before reporting", () => {
    const onError = vi.fn();
    render(<ResponsiveImg src="https://cdn/a.jpg" alt="Harbour" srcSet={SET} onError={onError} />);
    const img = screen.getByRole("img", { name: "Harbour" });
    fireEvent.error(img);
    expect(onError).not.toHaveBeenCalled();
    expect(img).not.toHaveAttribute("srcset");
    expect(img).toHaveAttribute("src", "https://cdn/a.jpg");
    fireEvent.error(img);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("tells the page once, with the address, that it fell back", () => {
    const onFallback = vi.fn();
    render(
      <ResponsiveImg src="https://cdn/a.jpg" alt="Harbour" srcSet={SET} onFallback={onFallback} />,
    );
    const img = screen.getByRole("img", { name: "Harbour" });
    fireEvent.error(img);
    fireEvent.error(img);
    expect(onFallback).toHaveBeenCalledExactlyOnceWith("https://cdn/a.jpg");
  });

  it("reports an error at once when there were no resized files", () => {
    const onError = vi.fn();
    render(<ResponsiveImg src="https://cdn/a.jpg" alt="Harbour" onError={onError} />);
    fireEvent.error(screen.getByRole("img", { name: "Harbour" }));
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
