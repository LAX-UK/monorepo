/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShopAccountLinkButton, ShopAccountShell } from "./shop-account-shell";

describe("ShopAccountShell", () => {
  it("renders title, notice, and main landmark", () => {
    render(
      <ShopAccountShell
        title="Session expired"
        notice={{
          variant: "warning",
          title: "Sign in again",
          description: "Your session timed out.",
        }}
      >
        <p>Body copy</p>
      </ShopAccountShell>,
    );

    expect(document.getElementById("main-content")?.tagName).toBe("MAIN");
    expect(screen.getByRole("heading", { level: 1, name: "Session expired" })).toBeTruthy();
    expect(screen.getByText("Sign in again")).toBeTruthy();
    expect(screen.getByText("Your session timed out.")).toBeTruthy();
    expect(screen.getByText("Body copy")).toBeTruthy();
  });

  it("renders link button with accessible name", () => {
    render(<ShopAccountLinkButton href="/login" label="Sign in" />);
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link.attributes.getNamedItem("href")?.value).toBe("/login");
  });
});
