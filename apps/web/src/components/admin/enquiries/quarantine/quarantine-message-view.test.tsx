import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuarantineMessageView, type QuarantineMessageViewProps } from "./quarantine-message-view";
import { heldMessage } from "./quarantine.fixture";

const refresh = vi.fn();
const push = vi.fn();
const notifySuccess = vi.fn();
const attach = vi.fn();
const discard = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push, replace: vi.fn() }),
  usePathname: () => "/admin/enquiries/quarantine/x",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin/admin-enquiry-quarantine", () => ({
  attachQuarantinedEmailAction: vi.fn(),
  discardQuarantinedEmailAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (...args: unknown[]) => notifySuccess(...args), error: vi.fn() },
}));

function renderView(props: Partial<QuarantineMessageViewProps> = {}) {
  return render(
    <StaffTooltipProvider>
      <QuarantineMessageView
        message={heldMessage()}
        canWork
        now="2026-11-03T12:00:00.000Z"
        actions={{ attach, discard }}
        {...props}
      />
    </StaffTooltipProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  attach.mockResolvedValue({ ok: true, data: { enquiryReference: "E-1042", messageId: "m-1" } });
  discard.mockResolvedValue({ ok: true });
});

describe("QuarantineMessageView: reading", () => {
  it("shows the sender, why it was held, the plain text, the sender checks and the file names", () => {
    renderView();
    expect(
      screen.getByRole("heading", { level: 1, name: "Re: Your enquiry E-1042" }),
    ).toBeInTheDocument();
    expect(screen.getByText("assistant@northbank-gallery.example")).toBeInTheDocument();
    expect(screen.getAllByText("Different sender").length).toBeGreaterThan(0);
    expect(screen.getByText(/Forwarding on behalf of Daniel/)).toBeInTheDocument();
    expect(screen.getByText("Passed for another domain")).toBeInTheDocument();
    const files = screen.getByRole("list", { name: "Files named in this email" });
    expect(within(files).getByText("corner-detail.jpg")).toBeInTheDocument();
    expect(within(files).queryByRole("link")).toBeNull();
    expect(screen.getByRole("link", { name: "E-1042" })).toHaveAttribute(
      "href",
      "/admin/enquiries/E-1042",
    );
  });

  it("says when the sender checks were not recorded and no enquiry was named", () => {
    renderView({
      message: heldMessage({ spfResult: null, dkimResult: null, suspectedEnquiry: null }),
    });
    expect(screen.getAllByText("Not recorded")).toHaveLength(2);
    expect(
      screen.getByText("Its reply address named no enquiry we could find."),
    ).toBeInTheDocument();
  });
});

describe("QuarantineMessageView: attach", () => {
  it("confirms, attaches to the suspected enquiry and opens it", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Attach to enquiry" }));
    const dialog = await screen.findByRole("dialog", { name: "Attach this email to an enquiry?" });
    expect(within(dialog).getByText(/This can't be undone/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Attach to E-1042" }));
    await waitFor(() =>
      expect(attach).toHaveBeenCalledWith(heldMessage().id, {
        enquiryReference: "E-1042",
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/enquiries/E-1042"));
    expect(notifySuccess).toHaveBeenCalledWith("Email attached to E-1042");
  });

  it("attaches to another enquiry a person names, only once the reference is valid", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Attach to enquiry" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText("Another enquiry"));
    const confirm = within(dialog).getByRole("button", { name: "Attach" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Enquiry reference/), {
      target: { value: " e-2001 " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Attach to E-2001" }));
    await waitFor(() =>
      expect(attach).toHaveBeenCalledWith(heldMessage().id, { enquiryReference: "E-2001" }),
    );
  });

  it("keeps the dialog open with the reason when it is refused", async () => {
    attach.mockResolvedValueOnce({
      ok: false,
      error: "Someone has already attached or discarded this email.",
    });
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Attach to enquiry" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Attach to E-1042" }));
    expect(
      await within(dialog).findByText("Someone has already attached or discarded this email."),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("QuarantineMessageView: discard", () => {
  it("confirms with a danger button and discards", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("dialog", { name: "Discard this email?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Discard email" }));
    await waitFor(() => expect(discard).toHaveBeenCalledWith(heldMessage().id));
    expect(notifySuccess).toHaveBeenCalledWith("Email discarded");
    expect(refresh).toHaveBeenCalled();
  });
});

describe("QuarantineMessageView: states", () => {
  it("is view only without the right to work enquiries", () => {
    renderView({ canWork: false });
    expect(screen.queryByRole("button", { name: "Attach to enquiry" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
    expect(
      screen.getByText("You can read held email but not attach or discard it."),
    ).toBeInTheDocument();
  });

  it("says when it was already attached, and offers no review", () => {
    renderView({
      message: heldMessage({ status: "linked", reviewedAt: "2026-11-03T10:00:00.000Z" }),
    });
    expect(screen.getByText("Attached to an enquiry")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Attach to enquiry" })).toBeNull();
  });

  it("says when it was discarded", () => {
    renderView({
      message: heldMessage({ status: "dismissed", reviewedAt: "2026-11-03T10:00:00.000Z" }),
    });
    expect(screen.getByText("Discarded")).toBeInTheDocument();
  });
});
