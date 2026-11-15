import { emailJobDetail, xeroDeliveryDetail } from "@/lib/admin/failed-jobs/failed-job.fixture";
import { StaffTooltipProvider } from "@auction/staff-ui";
import type { FailedJobDetail } from "@auction/types";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FailedJobView } from "./failed-job-view";

const refresh = vi.fn();
const restore = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/failed-jobs/dlq%3Aemail%3A55120",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin/admin-failed-jobs", () => ({
  retryFailedJobsAction: vi.fn(),
  discardFailedJobsAction: vi.fn(),
  restoreFailedJobsAction: (input: unknown) => restore(input),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

function renderJob(
  job: FailedJobDetail = emailJobDetail,
  canAct = true,
  recordHrefs: (string | null)[] = [],
) {
  return render(
    <StaffTooltipProvider>
      <FailedJobView job={job} canAct={canAct} recordHrefs={recordHrefs} />
    </StaffTooltipProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  restore.mockResolvedValue({ ok: true, data: { succeeded: 1, failures: [] } });
});

describe("FailedJobView: an integration delivery", () => {
  it("words the page for a delivery and says what a retry does", () => {
    renderJob(xeroDeliveryDetail);
    expect(screen.getByRole("heading", { level: 1, name: "Payment to Xero" })).toBeInTheDocument();
    expect(screen.getByText("Integrations · Xero")).toBeInTheDocument();
    expect(screen.getByText(/can't create a second invoice or payment/)).toBeInTheDocument();
    expect(screen.queryByText("May repeat an action")).not.toBeInTheDocument();
    expect(screen.getByText("Delivery ID")).toBeInTheDocument();
    expect(screen.getByText("Event")).toBeInTheDocument();
    const payload = screen.getByRole("region", { name: "Payload" });
    expect(within(payload).getByText("£9,000.00")).toBeInTheDocument();
    expect(within(payload).getByText(/3 fields are left out/)).toBeInTheDocument();
  });

  it("is view only without Retry or Discard for read-only staff", () => {
    renderJob(xeroDeliveryDetail, false);
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("says a discarded delivery is a delivery", () => {
    renderJob({
      ...xeroDeliveryDetail,
      state: "discarded",
      retry: { allowed: false, reason: "This was discarded. Restore it to retry it." },
      discard: {
        reasonLabel: "Duplicate",
        note: null,
        at: "2026-11-01T09:00:00.000Z",
        byName: null,
        restorableUntil: "2027-01-30T09:00:00.000Z",
      },
    });
    expect(screen.getByText("This delivery was discarded")).toBeInTheDocument();
  });
});

describe("FailedJobView", () => {
  it("shows what happened, what a retry does, the error and the masked payload", () => {
    renderJob();
    expect(screen.getByRole("heading", { level: 1, name: "Email" })).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("May repeat an action")).toBeInTheDocument();
    expect(screen.getByText(/Sends this email again from the start/)).toBeInTheDocument();
    expect(screen.getByLabelText("Error message")).toHaveTextContent("PostmarkError 422");

    const payload = screen.getByRole("region", { name: "Payload" });
    expect(within(payload).getByText("Masked")).toBeInTheDocument();
    expect(within(payload).getByText("l•••••@n•••••.com")).toBeInTheDocument();
    expect(within(payload).getByText("L. F•••")).toBeInTheDocument();
    expect(within(payload).getByText("lot-14")).toBeInTheDocument();
    expect(within(payload).getByText(/2 fields are left out/)).toBeInTheDocument();
  });

  it("offers Retry and Discard to people who may act", () => {
    renderJob();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Discard…" })).toBeInTheDocument();
    expect(screen.queryByText("View only")).not.toBeInTheDocument();
  });

  it("is view only for everyone else, with the same facts and no actions", () => {
    renderJob(emailJobDetail, false);
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard…" })).not.toBeInTheDocument();
    expect(screen.getByText(/Sends this email again from the start/)).toBeInTheDocument();
  });

  it("explains why a retry is not available instead of only disabling it", () => {
    renderJob({
      ...emailJobDetail,
      queue: "lot-lifecycle",
      typeLabel: "Lot schedule",
      retry: { allowed: false, reason: "Lot start and end jobs aren't retried from here." },
    });
    expect(screen.getByText("Retry isn't available")).toBeInTheDocument();
    expect(
      screen.getByText("Lot start and end jobs aren't retried from here."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toHaveAttribute("aria-disabled", "true");
  });

  it("shows a discard with its reason and lets the person restore it", () => {
    renderJob({
      ...emailJobDetail,
      state: "discarded",
      retry: { allowed: false, reason: "This job was discarded. Restore it to retry it." },
      discard: {
        reasonLabel: "Can't succeed",
        note: "Address bounced.",
        at: "2026-11-01T09:00:00.000Z",
        byName: "Sam Okoye",
        restorableUntil: "2027-01-30T09:00:00.000Z",
      },
      history: [
        {
          id: "1",
          kind: "discarded",
          at: "2026-11-01T09:00:00.000Z",
          actorName: "Sam Okoye",
          detail: "Can't succeed: Address bounced.",
        },
      ],
    });
    expect(screen.getByText("This job was discarded")).toBeInTheDocument();
    expect(
      screen.getByText(/Can't succeed: Address bounced\. Discarded by Sam Okoye\./),
    ).toBeInTheDocument();
    const history = screen.getByRole("list", { name: "Job history" });
    expect(within(history).getByText("Discarded")).toBeInTheDocument();
    expect(within(history).getByText(/Sam Okoye/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(restore).toHaveBeenCalledWith({ ids: [emailJobDetail.id] });
  });

  it("links a payload record to its admin page where there is one", () => {
    const lot = emailJobDetail.payload.findIndex((entry) => entry.label === "Lot ID");
    const hrefs = emailJobDetail.payload.map((_, index) =>
      index === lot ? "/admin/lots/lot-14" : null,
    );
    renderJob(emailJobDetail, true, hrefs);
    expect(screen.getByRole("link", { name: "lot-14" })).toHaveAttribute(
      "href",
      "/admin/lots/lot-14",
    );
    expect(screen.getAllByRole("link", { name: /lot-14/ })).toHaveLength(1);
  });

  it("says until when a discard can be restored, then closes the window", () => {
    const discarded = {
      ...emailJobDetail,
      state: "discarded" as const,
      retry: { allowed: false as const, reason: "Restore it to retry it." },
      discard: {
        reasonLabel: "Duplicate",
        note: null,
        at: "2026-11-01T09:00:00.000Z",
        byName: null,
        restorableUntil: "2099-01-30T09:00:00.000Z",
      },
    };
    const { unmount } = renderJob(discarded);
    expect(screen.getByText(/can be restored until/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeEnabled();
    unmount();
    renderJob({
      ...discarded,
      discard: { ...discarded.discard, restorableUntil: "2026-01-30T09:00:00.000Z" },
    });
    expect(screen.getByText(/90-day window to restore it has passed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(restore).not.toHaveBeenCalled();
  });

  it("gives a discarded delivery no restore window or purge copy, even when long ago", () => {
    renderJob({
      ...xeroDeliveryDetail,
      state: "discarded",
      retry: { allowed: false, reason: "This job was discarded. Restore it to retry it." },
      discard: {
        reasonLabel: "Duplicate",
        note: null,
        at: "2025-01-01T09:00:00.000Z",
        byName: null,
        restorableUntil: null,
      },
    });
    expect(screen.queryByText(/can be restored until/)).not.toBeInTheDocument();
    expect(screen.queryByText(/has been cleared|is cleared/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(restore).toHaveBeenCalled();
  });

  it("says so when the payload was not kept", () => {
    renderJob({ ...emailJobDetail, payload: [], omittedPayloadFields: 0 });
    expect(screen.getByText(/The job's data can't be shown here/)).toBeInTheDocument();
  });

  it("folds a long error behind Show full error", () => {
    renderJob({ ...emailJobDetail, errorMessage: `${"A very long error line. ".repeat(40)}` });
    const toggle = screen.getByRole("button", { name: "Show full error" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("opens the Retry dialog naming what will run", () => {
    renderJob();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    const dialog = screen.getByRole("dialog", { name: "Retry 1 job?" });
    expect(within(dialog).getByText("1 × Email")).toBeInTheDocument();
  });
});
