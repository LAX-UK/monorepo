import { emailJobDetail } from "@/lib/admin/failed-jobs/failed-job.fixture";
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

function renderJob(job: FailedJobDetail = emailJobDetail, canAct = true) {
  return render(
    <StaffTooltipProvider>
      <FailedJobView job={job} canAct={canAct} />
    </StaffTooltipProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  restore.mockResolvedValue({ ok: true, data: { succeeded: 1, failures: [] } });
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
