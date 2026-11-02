import {
  adEventJob,
  emailJob,
  failedJobList,
  lotScheduleJob,
} from "@/lib/admin/failed-jobs/failed-job.fixture";
import { parseFailedJobsSearch } from "@/lib/admin/failed-jobs/failed-jobs-search";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FailedJobsList, type FailedJobsListProps } from "./failed-jobs-list";

const push = vi.fn();
const refresh = vi.fn();
const retry = vi.fn();
const discard = vi.fn();
const restore = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push, replace: vi.fn() }),
  usePathname: () => "/admin/failed-jobs",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin/admin-failed-jobs", () => ({
  retryFailedJobsAction: (input: unknown) => retry(input),
  discardFailedJobsAction: (input: unknown) => discard(input),
  restoreFailedJobsAction: (input: unknown) => restore(input),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

function renderList(patch: Partial<FailedJobsListProps> = {}) {
  const props: FailedJobsListProps = {
    list: failedJobList,
    search: {},
    filters: parseFailedJobsSearch({}),
    chips: [],
    pagination: { summary: "4 jobs", prevHref: null, nextHref: null },
    loadError: null,
    filtered: false,
    canAct: true,
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <FailedJobsList {...props} />
    </StaffTooltipProvider>,
  );
}

/** Opens a row's `…` menu from the keyboard and returns its items. */
function openRowMenu(job: string) {
  const trigger = screen.getAllByRole("button", { name: new RegExp(`^Actions for ${job}`) })[0];
  fireEvent.keyDown(trigger as HTMLElement, { key: "Enter" });
  return within(screen.getByRole("menu"));
}

beforeEach(() => {
  vi.clearAllMocks();
  retry.mockResolvedValue({ ok: true, data: { succeeded: 1, failures: [] } });
  discard.mockResolvedValue({ ok: true, data: { succeeded: 1, failures: [] } });
  restore.mockResolvedValue({ ok: true, data: { succeeded: 1, failures: [] } });
});

describe("FailedJobsList: rows", () => {
  it("shows the job, its error and when it failed", () => {
    renderList();
    expect(screen.getByRole("heading", { level: 1, name: "Failed jobs" })).toBeInTheDocument();
    expect(screen.getAllByText("Email").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Background job · Email · Outbid notice").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Mail provider rejected the message/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Email" })[0]).toHaveAttribute(
      "href",
      "/admin/failed-jobs/dlq%3Aemail%3A55120",
    );
  });

  it("has a tab for each stage with its count", () => {
    renderList();
    const tabs = screen.getByRole("navigation", { name: /views/i });
    expect(within(tabs).getByText("Needs review")).toBeInTheDocument();
    expect(within(tabs).getByText("Retried")).toBeInTheDocument();
    expect(within(tabs).getByText("Discarded")).toBeInTheDocument();
    expect(within(tabs).getByText("4")).toBeInTheDocument();
  });
});

describe("FailedJobsList: states", () => {
  it("says nothing needs review when the first tab is empty", () => {
    renderList({
      list: {
        ...failedJobList,
        rows: [],
        total: 0,
        counts: { needs_review: 0, retried: 2, discarded: 1 },
      },
      pagination: null,
    });
    expect(screen.getByText("No failed jobs need review")).toBeInTheDocument();
  });

  it("has its own empty message for each tab", () => {
    renderList({
      list: { ...failedJobList, rows: [], total: 0 },
      filters: parseFailedJobsSearch({ view: "discarded" }),
      pagination: null,
    });
    expect(screen.getByText("No discarded jobs")).toBeInTheDocument();
  });

  it("says nothing matches when a filter finds no rows, with a way out", () => {
    renderList({
      list: { ...failedJobList, rows: [], total: 0 },
      filters: parseFailedJobsSearch({ q: "invoice 0418" }),
      filtered: true,
      pagination: null,
    });
    expect(screen.getByText("No failed jobs match")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(push).toHaveBeenCalledWith("/admin/failed-jobs", { scroll: false });
  });

  it("keeps the frame and offers another try when the list cannot load", () => {
    renderList({ list: null, loadError: "Failed jobs could not be loaded.", pagination: null });
    expect(screen.getByText("Failed jobs couldn't be loaded")).toBeInTheDocument();
    expect(screen.getByText("Failed jobs could not be loaded.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(push).toHaveBeenCalled();
  });

  it("explains a switch that turned retries off", () => {
    renderList({ list: { ...failedJobList, actionsEnabled: false } });
    expect(screen.getByText("Retries and discards are switched off")).toBeInTheDocument();
  });
});

describe("FailedJobsList: view only", () => {
  it("has no checkboxes and no way to act, and says so", () => {
    renderList({ canAct: false });
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    const menu = openRowMenu("Email");
    expect(menu.getByRole("menuitem", { name: "Open job" })).toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: "Copy job ID" })).toBeInTheDocument();
    expect(menu.queryByRole("menuitem", { name: "Retry" })).not.toBeInTheDocument();
    expect(menu.queryByRole("menuitem", { name: "Discard…" })).not.toBeInTheDocument();
  });
});

describe("FailedJobsList: retry", () => {
  it("asks first, needs the repeat tick for an email, then retries", async () => {
    renderList();
    fireEvent.click(openRowMenu("Email").getByRole("menuitem", { name: "Retry" }));
    const dialog = screen.getByRole("dialog", { name: "Retry 1 job?" });
    expect(within(dialog).getByText("1 × Email")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Retry 1 job" }));
    expect(
      within(dialog).getByText("Tick the box to confirm before retrying."),
    ).toBeInTheDocument();
    expect(retry).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry 1 job" }));
    await waitFor(() =>
      expect(retry).toHaveBeenCalledWith({ ids: [emailJob.id], confirmRepeat: true }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("does not ask for a tick when a retry cannot repeat anything", async () => {
    renderList();
    fireEvent.click(openRowMenu("Ad platform event").getByRole("menuitem", { name: "Retry" }));
    const dialog = screen.getByRole("dialog", { name: "Retry 1 job?" });
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry 1 job" }));
    await waitFor(() =>
      expect(retry).toHaveBeenCalledWith({ ids: [adEventJob.id], confirmRepeat: false }),
    );
  });

  it("keeps a lot schedule retry disabled in the menu", () => {
    renderList();
    expect(openRowMenu("Lot schedule").getByRole("menuitem", { name: /^Retry/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(lotScheduleJob.retry.allowed === false && lotScheduleJob.retry.reason).toContain(
      "open or close a lot twice",
    );
  });

  it("keeps the dialog open and says why when the API refused the job", async () => {
    retry.mockResolvedValue({
      ok: true,
      data: {
        succeeded: 0,
        failures: [{ id: adEventJob.id, message: "This job has already been retried." }],
      },
    });
    renderList();
    fireEvent.click(openRowMenu("Ad platform event").getByRole("menuitem", { name: "Retry" }));
    const dialog = screen.getByRole("dialog", { name: "Retry 1 job?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry 1 job" }));
    expect(await within(dialog).findByText("Nothing was retried")).toBeInTheDocument();
    expect(within(dialog).getByText("This job has already been retried.")).toBeInTheDocument();
  });
});

describe("FailedJobsList: discard", () => {
  it("needs a reason, needs a note for other, then discards", async () => {
    renderList();
    fireEvent.click(openRowMenu("Email").getByRole("menuitem", { name: "Discard…" }));
    const dialog = screen.getByRole("dialog", { name: "Discard 1 job?" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Discard 1 job" }));
    expect(within(dialog).getByText("Choose a reason.")).toBeInTheDocument();
    expect(discard).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("radio", { name: /Other/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Discard 1 job" }));
    expect(within(dialog).getByText("Add a note when the reason is other.")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("radio", { name: /Can't succeed/ }));
    fireEvent.change(within(dialog).getByRole("textbox"), {
      target: { value: "Address bounced." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Discard 1 job" }));
    await waitFor(() =>
      expect(discard).toHaveBeenCalledWith({
        ids: [emailJob.id],
        reason: "cannot_succeed",
        note: "Address bounced.",
      }),
    );
  });
});

describe("FailedJobsList: selection", () => {
  it("retries a selection from the bulk bar", () => {
    renderList();
    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[1] as HTMLElement);
    fireEvent.click(boxes[3] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByRole("dialog", { name: "Retry 2 jobs?" })).toBeInTheDocument();
  });

  it("restores discarded jobs from their own tab", () => {
    renderList({
      list: {
        ...failedJobList,
        rows: [{ ...emailJob, state: "discarded", retry: { allowed: false, reason: "Discarded" } }],
      },
      filters: parseFailedJobsSearch({ view: "discarded" }),
    });
    fireEvent.click(screen.getAllByRole("checkbox")[1] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(restore).toHaveBeenCalledWith({ ids: [emailJob.id] });
  });
});
