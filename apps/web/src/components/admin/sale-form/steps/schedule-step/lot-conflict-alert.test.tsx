import type { LotWindowConflict, SaleWindow } from "@/lib/admin/sale-lot-window-sync";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LotConflictAlert } from "./lot-conflict-alert";

const pendingWindow: SaleWindow = {
  deliveryMode: "onsite",
  startTime: new Date("2030-06-01T21:00:00Z"),
  endTime: new Date("2030-06-07T18:00:00Z"),
};

const onlineWindow: SaleWindow = {
  deliveryMode: "online",
  startTime: new Date("2030-06-01T21:00:00Z"),
  endTime: new Date("2030-06-07T18:00:00Z"),
};

const conflicts: LotWindowConflict[] = [
  {
    lot: {
      id: "lot-1",
      title: "Blue vase",
      startTime: new Date("2020-01-01T00:00:00Z"),
      endTime: new Date("2020-01-02T00:00:00Z"),
    },
    violation: "Onsite lots must use the sale's start and end times",
  },
];

describe("LotConflictAlert", () => {
  it("shows inherited-timing guidance without adjust-lot action for onsite sales", () => {
    render(
      <LotConflictAlert
        lotConflicts={conflicts}
        pendingWindow={pendingWindow}
        lotsSetupHref="/admin/sales/s1/setup?step=lots"
      />,
    );

    expect(screen.getByText(/Saving this schedule will update all draft lots/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Adjust lot schedules" })).not.toBeInTheDocument();
  });

  it("shows blocking guidance and adjust-lot action for online sales", () => {
    render(
      <LotConflictAlert
        lotConflicts={conflicts}
        pendingWindow={onlineWindow}
        lotsSetupHref="/admin/sales/s1/setup?step=lots"
      />,
    );

    expect(screen.getByText(/Save will fail until you update them/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Adjust lot schedules" })).toBeInTheDocument();
  });
});
