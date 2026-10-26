import { ClerkConsoleLayout } from "@/features/saleroom/components/clerk-console/clerk-console-layout";
import { CLERK_PHASE_LAYOUT } from "@/features/saleroom/lib/clerk-phase-layout";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const slots = {
  alerts: <div data-testid="alerts" />,
  sessionBar: <div data-testid="session-bar" />,
  sessionToolbar: <div data-testid="session-toolbar" />,
  runway: <div data-testid="runway" />,
  onBlock: <div data-testid="on-block" />,
  tools: <div data-testid="tools" />,
  phoneView: <div data-testid="phone-view" />,
};

function renderLayout() {
  return render(
    <ClerkConsoleLayout slots={slots} phaseLayout={CLERK_PHASE_LAYOUT.selling} showActionBar />,
  );
}

describe("ClerkConsoleLayout", () => {
  it("tells a narrow screen that clerking needs 1024px and shows the room read-only", () => {
    renderLayout();

    expect(screen.getByText("Live clerking needs a screen at least 1024px wide.")).toBeVisible();
    expect(screen.getByTestId("phone-view").closest(".lg\\:hidden")).not.toBeNull();
  });

  it("keeps the controls out of the narrow-screen view and the session bar in both", () => {
    renderLayout();

    for (const id of ["session-toolbar", "on-block", "runway", "tools"]) {
      expect(screen.getByTestId(id).closest(".hidden.lg\\:flex")).not.toBeNull();
    }
    expect(screen.getByTestId("session-bar").closest(".hidden")).toBeNull();
  });

  it("puts the lot on the block before the runway", () => {
    renderLayout();

    const position = screen
      .getByTestId("on-block")
      .compareDocumentPosition(screen.getByTestId("runway"));
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
