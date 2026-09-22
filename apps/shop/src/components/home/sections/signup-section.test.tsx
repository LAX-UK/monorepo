/** @vitest-environment jsdom */
import { SignupSection } from "@/components/home/sections/signup-section";
import { homeSignup } from "@/content/home-marketing";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

describe("SignupSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the supplied CTA link", () => {
    render(<SignupSection signup={homeSignup} cta={{ label: "My account", href: "/account" }} />);
    const link = screen.getByRole("link", { name: "My account" });
    expect(link.getAttribute("href")).toBe("/account");
  });

  it("renders copy without a button when cta is omitted", () => {
    render(<SignupSection signup={homeSignup} cta={null} />);
    expect(screen.getByRole("heading", { name: homeSignup.title })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
