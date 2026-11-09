// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/production",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/server/application/admin-operations-actions.server", () => ({
  updateFramingTask: vi.fn(),
}));

const { FramingDueList } = await import("./framing-due-list.client");

const item = (over: Record<string, unknown> = {}) => ({
  taskId: "00000000-0000-4000-8000-000000000401",
  status: "queued" as const,
  dueAt: "2026-11-24T00:00:00.000Z",
  version: 1,
  orderId: "00000000-0000-4000-8000-0000000000b1",
  orderReference: "LAX-S-10482",
  printTitle: "Tide line",
  editionNumber: 2,
  printStarted: true,
  name: "Natural oak frame",
  spec: "Natural oak, 20 mm",
  ...over,
});

describe("FramingDueList", () => {
  afterEach(cleanup);

  it("says so when the frames due could not be loaded, rather than showing nothing", () => {
    render(<FramingDueList items={[]} failed />);
    expect(screen.getByText("Frames due could not be loaded")).toBeInTheDocument();
  });

  it("shows nothing when no frame is due", () => {
    const { container } = render(<FramingDueList items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers the next step once the print is in production, and a hint before", () => {
    render(<FramingDueList items={[item()]} />);
    expect(screen.getByRole("button", { name: "Start framing" })).toBeInTheDocument();
    cleanup();
    render(<FramingDueList items={[item({ printStarted: false })]} />);
    expect(screen.queryByRole("button", { name: "Start framing" })).toBeNull();
    expect(screen.getByText("Start the print first")).toBeInTheDocument();
  });
});
