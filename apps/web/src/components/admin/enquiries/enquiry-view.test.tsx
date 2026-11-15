import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnquiryView, type EnquiryViewProps } from "./enquiry-view";
import {
  ASSIGNEES,
  buyEnquiry,
  closedEnquiry,
  convertedEnquiry,
  sellEnquiry,
} from "./enquiry.fixture";

const refresh = vi.fn();
const update = vi.fn();
const attachmentLink = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/enquiries/E-1042",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin/admin-enquiries", () => ({
  updateEnquiryAction: (...args: unknown[]) => update(...args),
  enquiryAttachmentLinkAction: (...args: unknown[]) => attachmentLink(...args),
  saveEnquiryRoutingAction: vi.fn(),
}));
vi.mock("@/lib/actions/admin/admin-private-sales", () => ({
  convertEnquiryAction: vi.fn(),
  searchDealArtworksAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (...args: unknown[]) => notifySuccess(...args), error: vi.fn() },
}));

function renderView(props: Partial<EnquiryViewProps> = {}) {
  return render(
    <StaffTooltipProvider>
      <EnquiryView
        enquiry={sellEnquiry}
        assignees={ASSIGNEES}
        history={[]}
        viewerId="u-sofia"
        canWork
        now="2026-11-03T12:00:00.000Z"
        {...props}
      />
    </StaffTooltipProvider>,
  );
}

const saved = (patch: object = {}) => ({
  ok: true,
  data: { ...sellEnquiry, version: sellEnquiry.version + 1, ...patch },
});

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  update.mockResolvedValue(saved());
});

describe("EnquiryView: a new private sale enquiry", () => {
  it("shows who sent it, the work, the message and who has it", () => {
    renderView();
    expect(
      screen.getByRole("heading", { level: 1, name: "Daniel Price · Sell privately" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Iris Calder, Low tide at Maldon")).toBeInTheDocument();
    expect(screen.getByText("£45,000.00")).toBeInTheDocument();
    expect(screen.getByText("1 photo and 1 document received")).toBeInTheDocument();
    expect(screen.getByText(/bought from the artist's dealer/)).toBeInTheDocument();
    expect(screen.getByText("daniel.price@example.com")).toBeInTheDocument();
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(screen.getAllByText("Sofia Okafor").length).toBeGreaterThan(0);
  });

  it("offers the next step, Assign and Change status, and no reply or convert button", () => {
    renderView();
    expect(screen.getByRole("button", { name: "Mark in progress" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reassign" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Change status/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reply/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Convert/ })).toBeNull();
  });

  it("marks it in progress with the version it was looking at", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Mark in progress" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("E-1042", { status: "in_progress", version: 3 }),
    );
    expect(refresh).toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith("E-1042 marked in progress");
  });

  it("uses the newer version for the next change, so it is not taken for a stale edit", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Mark in progress" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole("textbox", { name: /Add a note/ }), {
      target: { value: "Called the seller." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update).toHaveBeenLastCalledWith("E-1042", { note: "Called the seller.", version: 4 });
  });
});

describe("EnquiryView: notes", () => {
  it("shows the hint and refuses an empty note without calling the API", () => {
    renderView();
    expect(screen.getByText(/Don't paste the client's personal details/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect(screen.getByText("Write the note before adding it.")).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it("offers a reload on a stale edit and keeps what was typed", async () => {
    update.mockResolvedValue({
      ok: false,
      error: "This enquiry changed while you were editing it.",
      errorCode: "stale_version",
      status: 409,
    });
    renderView();
    const box = screen.getByRole("textbox", { name: /Add a note/ });
    fireEvent.change(box, { target: { value: "Called back." } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect(await screen.findByText("This enquiry changed")).toBeInTheDocument();
    expect(box).toHaveValue("Called back.");
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("says nothing was changed when the API fails", async () => {
    update.mockResolvedValue({
      ok: false,
      error: "The Bid API didn't answer. Nothing was changed.",
      status: 503,
    });
    renderView();
    fireEvent.change(screen.getByRole("textbox", { name: /Add a note/ }), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect(await screen.findByText("The note wasn't added")).toBeInTheDocument();
    expect(screen.getByText(/Nothing was changed/)).toBeInTheDocument();
  });
});

describe("EnquiryView: closing and assigning", () => {
  async function openClose() {
    fireEvent.keyDown(screen.getByRole("button", { name: /Change status/ }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Close…" }));
    return screen.findByRole("dialog", { name: "Close E-1042" });
  }

  it("needs a reason before it closes", async () => {
    renderView();
    const dialog = await openClose();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close enquiry" }));
    expect(
      (await within(dialog).findAllByText("Choose why you're closing this enquiry.")).length,
    ).toBeGreaterThan(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("closes with the chosen reason and the optional note", async () => {
    renderView();
    const dialog = await openClose();
    fireEvent.click(within(dialog).getByRole("radio", { name: /Not proceeding/ }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Note/ }), {
      target: { value: "Decided against selling." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close enquiry" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("E-1042", {
        status: "closed",
        closeReason: "not_proceeding",
        note: "Decided against selling.",
        version: 3,
      }),
    );
    expect(notifySuccess).toHaveBeenCalledWith("E-1042 closed · Not proceeding");
  });

  it("assigns to a colleague, and the button only works once someone else is chosen", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Reassign" }));
    const dialog = await screen.findByRole("dialog", { name: "Assign E-1042" });
    expect(within(dialog).getByRole("button", { name: "Assign" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    fireEvent.click(within(dialog).getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Tom Reid" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Assign" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("E-1042", { assignedToUserId: "u-tom", version: 3 }),
    );
  });
});

describe("EnquiryView: other states", () => {
  it("shows a buyer's brief and an in progress enquiry without a next step", () => {
    renderView({ enquiry: buyEnquiry });
    expect(screen.getByText("A Modern British landscape for a hallway.")).toBeInTheDocument();
    expect(screen.getByText("£10,000 to £50,000")).toBeInTheDocument();
    expect(screen.getByText("Within 3 months")).toBeInTheDocument();
    expect(screen.getByText("LAX account")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark in progress" })).toBeNull();
  });

  it("says why a closed enquiry ended, and offers to reopen it", async () => {
    renderView({ enquiry: closedEnquiry });
    expect(screen.getAllByText("Closed: Not a fit").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("E-1020", { status: "in_progress", version: 3 }),
    );
  });

  it("leaves a converted enquiry to its deal", () => {
    renderView({ enquiry: convertedEnquiry });
    expect(screen.getAllByText("Converted to a deal").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Change status/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reassign" })).toBeNull();
  });

  it("is view only without the capability to work", () => {
    renderView({ canWork: false });
    expect(screen.queryByRole("button", { name: "Mark in progress" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Reassign|Assign/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Change status/ })).toBeNull();
    expect(screen.queryByRole("textbox", { name: /Add a note/ })).toBeNull();
    expect(screen.getByText(/View only/)).toBeInTheDocument();
    expect(screen.getByText("Daniel Price", { selector: "dd, dd *" })).toBeInTheDocument();
  });

  it("names a deleted assignee as a former colleague", () => {
    renderView({ enquiry: { ...sellEnquiry, assignedToUserId: "u-gone" } });
    expect(screen.getAllByText("Former staff member").length).toBeGreaterThan(0);
  });
});

describe("EnquiryView: turning a private sale enquiry into a deal", () => {
  it("offers Convert to deal on a started private sale enquiry to those who run deals", async () => {
    renderView({ enquiry: buyEnquiry, canConvert: true });
    fireEvent.click(screen.getByRole("button", { name: "Convert to deal" }));
    const dialog = await screen.findByRole("dialog", { name: "Convert E-1041 to a deal" });
    // A buy enquiry names the work the buyer is asking about.
    expect(within(dialog).getByRole("textbox", { name: /Work/ })).toBeInTheDocument();
  });

  it("does not ask a sell enquiry for a work, because it brings its own", async () => {
    renderView({
      enquiry: {
        ...sellEnquiry,
        status: "in_progress",
        nextStatuses: ["waiting_on_client", "closed", "converted"],
      },
      canConvert: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Convert to deal" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("textbox")).toBeNull();
  });

  it("waits until someone has started on the enquiry", () => {
    renderView({ enquiry: sellEnquiry, canConvert: true });
    expect(screen.queryByRole("button", { name: "Convert to deal" })).toBeNull();
  });

  it("is left out for people who do not run deals, and for an enquiry that is already a deal", () => {
    renderView({ enquiry: buyEnquiry, canConvert: false });
    expect(screen.queryByRole("button", { name: "Convert to deal" })).toBeNull();
    renderView({ enquiry: convertedEnquiry, canConvert: true });
    expect(screen.queryByRole("button", { name: "Convert to deal" })).toBeNull();
  });
});

describe("EnquiryView: reply by date", () => {
  const due = (replyDueAt: string) => ({ ...sellEnquiry, replyDueAt });

  it("leaves the year off in the current year and shows it in any other", () => {
    const { unmount } = renderView({
      enquiry: due("2026-12-30T09:00:00.000Z"),
      now: "2026-12-29T12:00:00.000Z",
    });
    expect(screen.getByText("Reply by Wed 30 Dec")).toBeInTheDocument();
    unmount();
    const { unmount: unmount2 } = renderView({
      enquiry: due("2027-01-02T09:00:00.000Z"),
      now: "2026-12-31T12:00:00.000Z",
    });
    expect(screen.getByText("Reply by Sat 2 Jan 2027")).toBeInTheDocument();
    unmount2();
    renderView({ enquiry: due("2027-01-02T09:00:00.000Z"), now: "2027-01-01T12:00:00.000Z" });
    expect(screen.getByText("Reply by Sat 2 Jan")).toBeInTheDocument();
  });
});

describe("EnquiryView: attachments", () => {
  it("opens a file through a link signed when it is clicked, and never shows an address", async () => {
    attachmentLink.mockResolvedValue({
      ok: true,
      data: {
        url: "https://files.example/signed?sig=abc",
        kind: "image",
        contentType: "image/jpeg",
        expiresInSec: 60,
      },
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderView();
    expect(document.body.innerHTML).not.toContain("files.example");
    fireEvent.click(screen.getByRole("button", { name: "Open Photo" }));
    await waitFor(() => expect(attachmentLink).toHaveBeenCalledWith("E-1042", "a1"));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.href).toBe("https://files.example/signed?sig=abc");
    expect(anchor.rel).toContain("noopener");
    click.mockRestore();
  });

  it("says so when the file cannot be opened", async () => {
    attachmentLink.mockResolvedValue({ ok: false, error: "This file is no longer available." });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Open Document" }));
    await waitFor(() => expect(attachmentLink).toHaveBeenCalledWith("E-1042", "a2"));
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it("has no section when nothing was attached", () => {
    renderView({ enquiry: buyEnquiry });
    expect(screen.queryByRole("heading", { name: "Attachments" })).toBeNull();
  });
});

describe("EnquiryView: history", () => {
  const history = [
    {
      id: "1",
      kind: "assigned" as const,
      at: "2026-11-02T09:30:00.000Z",
      actorUserId: "u-tom",
      toUserId: "u-sofia",
      fromUserId: null,
    },
    {
      id: "2",
      kind: "status_changed" as const,
      at: "2026-11-02T10:00:00.000Z",
      actorUserId: "u-sofia",
      from: "new",
      to: "in_progress",
      closeReason: null,
    },
    {
      id: "3",
      kind: "status_changed" as const,
      at: "2026-11-02T12:00:00.000Z",
      actorUserId: "u-sofia",
      from: "in_progress",
      to: "closed",
      closeReason: "spam",
    },
  ];

  it("lists assignments and status changes with who made them, newest first, beside the notes", () => {
    renderView({ history });
    const list = within(screen.getByRole("list", { name: "Enquiry history" }));
    const titles = list.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(titles[0]).toContain("Closed: Spam");
    expect(titles[0]).toContain("Sofia Okafor");
    expect(titles.some((t) => t.includes("Status changed to in progress"))).toBe(true);
    expect(
      titles.some((t) => t.includes("Assigned to Sofia Okafor") && t.includes("Tom Reid")),
    ).toBe(true);
    expect(titles.some((t) => t.includes("Note added"))).toBe(true);
    expect(titles.filter((t) => t.includes("Closed")).length).toBe(1);
  });

  it("says the trail could not be loaded, and still shows what the record holds", () => {
    renderView({ history: null });
    expect(
      screen.getByText("Assignments and status changes couldn't be loaded"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Received from a guest/)).toBeInTheDocument();
  });

  it("falls back to the record's own close when the trail is unavailable", () => {
    renderView({ enquiry: closedEnquiry, history: null });
    expect(screen.getAllByText("Closed: Not a fit").length).toBeGreaterThan(1);
  });
});
