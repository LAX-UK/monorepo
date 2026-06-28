import { ShareActions } from "@/components/ui/share-actions";
import { TooltipProvider } from "@auction/ui/components/tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

function renderShareActions(props: ComponentProps<typeof ShareActions>) {
  return render(
    <TooltipProvider>
      <ShareActions {...props} />
    </TooltipProvider>,
  );
}

describe("ShareActions", () => {
  it("copies the article URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderShareActions({ url: "https://example.com/article", title: "Headline" });
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith("https://example.com/article");
    expect(await screen.findByText("Link copied")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link copied" })).toBeInTheDocument();
  });

  it("announces clipboard failures", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.assign(navigator, { clipboard: { writeText } });

    renderShareActions({ url: "https://example.com/article", title: "Headline" });
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(await screen.findByText("Couldn't copy link")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Couldn't copy link" })).toBeInTheDocument();
  });

  it("opens X share intent in a new window", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    renderShareActions({ url: "https://example.com/article", title: "Headline" });
    fireEvent.click(screen.getByRole("button", { name: "Share on X" }));

    expect(open).toHaveBeenCalledWith(
      "https://twitter.com/intent/tweet?url=https%3A%2F%2Fexample.com%2Farticle&text=Headline",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("opens LinkedIn share in a new window", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    renderShareActions({ url: "https://example.com/article", title: "Headline" });
    fireEvent.click(screen.getByRole("button", { name: "Share on LinkedIn" }));

    expect(open).toHaveBeenCalledWith(
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fexample.com%2Farticle",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("uses minimum touch targets for icon buttons", () => {
    renderShareActions({ url: "https://example.com/article", title: "Headline" });

    for (const name of ["Copy link", "Share on X", "Share on LinkedIn"]) {
      expect(screen.getByRole("button", { name }).className).toContain("min-h-11");
    }
  });
});
