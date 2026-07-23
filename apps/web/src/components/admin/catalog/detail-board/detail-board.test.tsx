import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DetailAttentionTable } from "./detail-attention-table";
import { DetailBoardShell } from "./detail-board-shell";
import { DetailCardGrid } from "./detail-card-grid";
import { DetailQualityGapCard } from "./detail-quality-gap-card";
import { DetailStatValue } from "./detail-stat-value";

describe("DetailBoardShell", () => {
  it("renders title and count badge", () => {
    render(
      <DetailBoardShell title="Lots" count={4}>
        <p>Body</p>
      </DetailBoardShell>,
    );
    expect(screen.getByRole("heading", { name: "Lots" })).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });
});

describe("DetailAttentionTable", () => {
  it("renders attention rows with severity", () => {
    render(
      <DetailAttentionTable
        rows={[
          {
            id: "1",
            title: "Missing reserve",
            count: 3,
            category: "Lots",
            severity: "critical",
            actionLabel: "Review lots",
            href: "/admin/sales/x/lots",
          },
        ]}
      />,
    );
    expect(screen.getByText("Missing reserve")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review lots" })).toHaveAttribute(
      "href",
      "/admin/sales/x/lots",
    );
  });
});

describe("DetailCardGrid", () => {
  it("renders media-style cards with badge and meta", () => {
    render(
      <DetailCardGrid
        items={[
          {
            id: "1",
            title: "Saleroom photo",
            subtitle: "Image",
            badge: { label: "Published", tone: "live" },
            meta: "JPEG",
          },
        ]}
      />,
    );
    expect(screen.getByText("Saleroom photo")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("JPEG")).toBeInTheDocument();
  });

  it("applies aspect-video wrapper when imageAspect is video", () => {
    const { container } = render(
      <DetailCardGrid
        items={[
          {
            id: "1",
            imageAspect: "video",
            image: <span data-testid="press-media">Media</span>,
            title: "Press story",
          },
        ]}
      />,
    );

    const mediaSlot = container.querySelector(".aspect-video");
    expect(mediaSlot).toBeTruthy();
    expect(screen.getByTestId("press-media")).toBeInTheDocument();
  });
});

describe("DetailQualityGapCard", () => {
  it("renders quality gap rows with severity badges", () => {
    render(
      <DetailQualityGapCard
        rows={[
          {
            id: "signature",
            field: "Signature",
            message: "Signature not clearly visible in any provided image.",
            severity: "warning",
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Quality gap" })).toBeInTheDocument();
    expect(screen.getByText("Signature")).toBeInTheDocument();
    expect(
      screen.getByText("Signature not clearly visible in any provided image."),
    ).toBeInTheDocument();
    expect(screen.getByText("Advisory")).toBeInTheDocument();
  });
});

describe("DetailStatValue verified", () => {
  it("renders verified checkmark when showVerified is true", () => {
    render(
      <DetailStatValue
        row={{ id: "title", label: "Title", value: "Sunset", verified: true }}
        showVerified
      />,
    );
    expect(screen.getByText("Sunset")).toBeInTheDocument();
  });
});
