import { ResultsSaleRow } from "@/components/sections/results/results-sale-row";
import type { ResultsRowVM } from "@/lib/marketing/results-page.vm";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: ({ alt }: { alt: string }) => <span data-testid="cover">{alt}</span>,
}));

const base: ResultsRowVM = {
  id: "s1",
  href: "/sales/sale/september-modern-british-s1",
  title: "September Modern British",
  covers: [{ url: "/a.jpg", alt: "Harbour lights" }],
  endedLabel: "Ended Thu 15 Oct · online",
  figures: { state: "final", sold: "18 of 24", total: "£186,400" },
  actionLabel: "See results",
  endedAtIso: "2026-10-15T20:00:00.000Z",
};

describe("ResultsSaleRow", () => {
  it("shows the figures and links the title and the action to the sale", () => {
    render(
      <ul>
        <ResultsSaleRow row={base} />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(within(row).getByText("18 of 24")).toBeInTheDocument();
    expect(within(row).getByText("£186,400")).toBeInTheDocument();
    expect(within(row).getByText("Ended Thu 15 Oct · online")).toBeInTheDocument();
    expect(within(row).queryByText("Finalising")).toBeNull();
    for (const link of within(row).getAllByRole("link")) {
      expect(link).toHaveAttribute("href", base.href);
    }
  });

  it("marks a finalising sale and says the figures are to follow", () => {
    render(
      <ul>
        <ResultsSaleRow
          row={{ ...base, figures: { state: "finalising" }, actionLabel: "View the sale" }}
        />
      </ul>,
    );
    expect(screen.getByText("Finalising")).toBeInTheDocument();
    expect(screen.getAllByText("To follow")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /View the sale/ })).toBeInTheDocument();
  });

  it("leaves out the total when nothing sold", () => {
    render(
      <ul>
        <ResultsSaleRow
          row={{ ...base, figures: { state: "final", sold: "0 of 24", total: null } }}
        />
      </ul>,
    );
    expect(screen.getByText("0 of 24")).toBeInTheDocument();
    expect(screen.queryByText("Total with premium")).toBeNull();
  });
});
