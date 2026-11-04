import { manualRecord } from "@/lib/admin/data-requests/data-request.fixture";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type LogDataRequestApi, LogDataRequestDialog } from "./log-data-request-dialog";

const push = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push, replace: vi.fn() }),
  usePathname: () => "/admin/compliance/data-requests",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin/admin-data-requests", () => ({
  logDataRequestAction: vi.fn(),
  findDataRequestAccountAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (message: string) => notifySuccess(message), error: vi.fn() },
}));

const log = vi.fn();
const findAccount = vi.fn();
const onOpenChange = vi.fn();
const api: LogDataRequestApi = { log, findAccount };

function open() {
  return render(
    <LogDataRequestDialog open onOpenChange={onOpenChange} today="2026-11-02" api={api} />,
  );
}

const dialog = () => screen.getByRole("dialog", { name: "Log a manual request" });

beforeEach(() => {
  vi.clearAllMocks();
  findAccount.mockResolvedValue({
    ok: true,
    data: { subjectId: "u1", name: "Margaret Osei", status: "active" },
  });
  log.mockResolvedValue({
    ok: true,
    data: {
      ...manualRecord,
      request: { ...manualRecord.request, reference: "DR-0017", dueOn: "2026-12-02" },
    },
  });
});

async function pickAccount() {
  fireEvent.change(within(dialog()).getByPlaceholderText("Full email address"), {
    target: { value: "margaret.osei@outlook.co.uk" },
  });
  fireEvent.click(within(dialog()).getByRole("button", { name: "Find account" }));
  await within(dialog()).findByText("Margaret Osei");
}

describe("LogDataRequestDialog", () => {
  it("previews the due date by the ICO month rule before anything is saved", () => {
    open();
    expect(within(dialog()).getByText(/2 Dec 2026/)).toBeInTheDocument();
    expect(within(dialog()).getByText(/one calendar month from 2 Nov 2026/)).toBeInTheDocument();
  });

  it("finds an account by the full email address", async () => {
    open();
    await pickAccount();
    expect(findAccount).toHaveBeenCalledWith("margaret.osei@outlook.co.uk");
    expect(within(dialog()).getByRole("button", { name: "Change person" })).toBeInTheDocument();
  });

  it("says when no account has that email address", async () => {
    findAccount.mockResolvedValue({ ok: true, data: null });
    open();
    fireEvent.change(within(dialog()).getByPlaceholderText("Full email address"), {
      target: { value: "nobody@example.com" },
    });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Find account" }));
    expect(
      await within(dialog()).findByText(/No LAX account has that email address/),
    ).toBeInTheDocument();
  });

  it("checks on submit, lists what to fix and keeps the input", async () => {
    open();
    fireEvent.click(within(dialog()).getByRole("radio", { name: /We've asked for proof/ }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Log request" }));
    expect(
      await within(dialog()).findByText("Fix 1 thing to log this request"),
    ).toBeInTheDocument();
    expect(log).not.toHaveBeenCalled();
    expect(within(dialog()).getByRole("radio", { name: /We've asked for proof/ })).toBeChecked();
  });

  it("logs the request, announces the reference and due date, and opens its record", async () => {
    open();
    await pickAccount();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Log request" }));
    await waitFor(() => expect(log).toHaveBeenCalled());
    expect(log.mock.calls[0]?.[0]).toMatchObject({
      person: { kind: "account", subjectId: "u1" },
      reason: "full_copy",
      channel: "email",
      receivedOn: "2026-11-02",
      identity: "confirmed",
      products: ["account", "bid", "shop"],
    });
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith("DR-0017 logged · due 2 Dec 2026"),
    );
    expect(push).toHaveBeenCalledWith("/admin/compliance/data-requests/DR-0017");
  });

  it("logs a person with no account by name and contact", async () => {
    open();
    fireEvent.click(within(dialog()).getByRole("radio", { name: "No account or account deleted" }));
    fireEvent.change(within(dialog()).getByLabelText(/^Name/), { target: { value: "Jo Hale" } });
    fireEvent.change(within(dialog()).getByLabelText(/Email or postal address/), {
      target: { value: "jo@hale.com" },
    });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Log request" }));
    await waitFor(() => expect(log).toHaveBeenCalled());
    expect(log.mock.calls[0]?.[0]).toMatchObject({
      person: { kind: "contact", name: "Jo Hale", detail: "jo@hale.com" },
    });
  });

  it("keeps the dialog and the input when logging fails", async () => {
    log.mockResolvedValue({
      ok: false,
      error: "Identity didn't answer. Nothing was changed. Try again in a moment.",
    });
    open();
    await pickAccount();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Log request" }));
    expect(await within(dialog()).findByText("The request wasn't logged")).toBeInTheDocument();
    expect(within(dialog()).getByText("Margaret Osei")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("asks before discarding a filled form", async () => {
    open();
    await pickAccount();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Discard this request?")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes an untouched form without asking", async () => {
    open();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
