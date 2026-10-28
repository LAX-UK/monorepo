import type { StaffAccessDetail } from "@/lib/data/http/staff-access.server";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StaffLaxAccessPanel } from "./staff-lax-access-panel";

const detail: StaffAccessDetail = {
  subjectId: "user_1",
  platforms: [
    { product: "bid", role: "finance", updatedAt: null, pending: null },
    { product: "shop", role: "editor", updatedAt: null, pending: null },
  ],
  history: [
    {
      at: "2026-04-02T10:00:00.000Z",
      product: "shop",
      action: "revoked",
      role: "broker",
      actorSubjectId: "admin_1",
      actorName: "Sara Khan",
      viaInvitation: false,
    },
    {
      at: "2026-04-01T10:00:00.000Z",
      product: "shop",
      action: "granted",
      role: "editor",
      actorSubjectId: "admin_1",
      actorName: "Sara Khan",
      viaInvitation: true,
    },
  ],
};

const renderPanel = (value: StaffAccessDetail | null = detail) =>
  render(
    <StaffTooltipProvider>
      <StaffLaxAccessPanel detail={value} />
    </StaffTooltipProvider>,
  );

describe("StaffLaxAccessPanel", () => {
  it("lists each grant and removal on every platform, with who made it", () => {
    renderPanel();
    expect(screen.getAllByText("Given Editor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Removed Broker").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sara Khan/).length).toBeGreaterThan(0);
  });

  it("has no change controls: each admin's roles have their own section", () => {
    renderPanel();
    expect(screen.queryByRole("button", { name: /change|give|remove/i })).toBeNull();
  });

  it("says when access could not be loaded", () => {
    renderPanel(null);
    expect(screen.getByText("LAX access is unavailable")).toBeInTheDocument();
  });
});
