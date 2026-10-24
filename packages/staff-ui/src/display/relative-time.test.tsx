import { render, screen } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelativeTime } from "./relative-time.js";

// Positioning the tooltip is not under test.
vi.mock("@auction/ui/components/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div role="tooltip">{children}</div>
  ),
}));

afterEach(() => {
  vi.useRealTimers();
});

describe("RelativeTime", () => {
  it("says how long ago, and keeps the exact London time for readers and machines", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T13:08:00.000Z"));
    render(<RelativeTime value="2026-10-24T13:05:00.000Z" zoneLabel />);
    const time = screen.getByText("3 minutes ago").closest("time");
    expect(time).toHaveAttribute("dateTime", "2026-10-24T13:05:00.000Z");
    expect(time).toHaveTextContent("3 minutes ago, 24 Oct 2026, 14:05 BST");
    expect(screen.getByRole("tooltip")).toHaveTextContent("24 Oct 2026, 14:05 BST");
  });
});
