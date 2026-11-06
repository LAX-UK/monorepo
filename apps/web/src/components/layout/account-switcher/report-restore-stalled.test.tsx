import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const report = vi.hoisted(() => vi.fn());
vi.mock("@/lib/observability/report-restore-stalled", () => ({ reportRestoreStalled: report }));

import { ReportRestoreStalled } from "./report-restore-stalled";

describe("ReportRestoreStalled", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the retry state and reports once when it appears", () => {
    const { rerender } = render(
      <ReportRestoreStalled returnTo="/team?tab=roles">
        <p>Try again</p>
      </ReportRestoreStalled>,
    );
    expect(screen.getByText("Try again")).toBeInTheDocument();
    rerender(
      <ReportRestoreStalled returnTo="/team?tab=roles">
        <p>Try again</p>
      </ReportRestoreStalled>,
    );
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith("/team?tab=roles");
  });
});
