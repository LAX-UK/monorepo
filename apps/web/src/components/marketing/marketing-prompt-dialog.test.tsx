import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { MarketingPromptDialog } from "./marketing-prompt-dialog";

vi.mock("next/navigation", () => ({
  usePathname: () => "/search",
  useSearchParams: () => new URLSearchParams("q=modern"),
}));

vi.mock("next/image", () => ({
  default: ({
    alt: _alt,
    fill: _fill,
    sizes: _sizes,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    sizes?: string;
  }) => <img {...props} alt="Prompt artwork" />,
}));

describe("MarketingPromptDialog", () => {
  it("renders the selling variant with the authenticated intake destination", () => {
    const onCta = vi.fn();
    render(
      <MarketingPromptDialog
        open
        variant="selling"
        isAuthenticated
        onDismiss={vi.fn()}
        onCta={onCta}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Have something special to sell?" }),
    ).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: "Explore selling" });
    expect(cta).toHaveAttribute("href", "/dashboard/submissions/new");
    cta.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(cta);
    expect(onCta).toHaveBeenCalledOnce();
  });

  it("preserves selling intent for guest registration", () => {
    render(
      <MarketingPromptDialog
        open
        variant="selling"
        isAuthenticated={false}
        onDismiss={vi.fn()}
        onCta={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "Explore selling" })).toHaveAttribute(
      "href",
      "/register?next=%2Fdashboard%2Fsubmissions%2Fnew&intent=sell",
    );
  });

  it("preserves the current safe path for signup and sign-in", () => {
    render(
      <MarketingPromptDialog
        open
        variant="signup"
        isAuthenticated={false}
        onDismiss={vi.fn()}
        onCta={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Discover art worth collecting" }),
    ).toHaveAccessibleDescription(/discover exceptional art/i);
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/register?next=%2Fsearch%3Fq%3Dmodern",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsearch%3Fq%3Dmodern",
    );
  });

  it("dismisses from the close control, Escape, and backdrop", () => {
    const onDismiss = vi.fn();
    const first = render(
      <MarketingPromptDialog
        open
        variant="signup"
        isAuthenticated={false}
        onDismiss={onDismiss}
        onCta={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = render(
      <MarketingPromptDialog
        open
        variant="signup"
        isAuthenticated={false}
        onDismiss={onDismiss}
        onCta={vi.fn()}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(2);
    second.unmount();

    render(
      <MarketingPromptDialog
        open
        variant="signup"
        isAuthenticated={false}
        onDismiss={onDismiss}
        onCta={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    const overlay = [...document.querySelectorAll<HTMLElement>('[data-state="open"]')].find(
      (element) => element !== dialog,
    );
    expect(overlay).toBeDefined();
    fireEvent.click(overlay as HTMLElement);
    expect(onDismiss).toHaveBeenCalledTimes(3);
  });
});
