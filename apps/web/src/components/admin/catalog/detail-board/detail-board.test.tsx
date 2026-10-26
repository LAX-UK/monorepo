import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DetailAttentionTable } from "./detail-attention-table";
import { DetailBoardShell } from "./detail-board-shell";
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
