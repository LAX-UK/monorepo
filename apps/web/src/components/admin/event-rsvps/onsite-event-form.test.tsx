import { OnsiteEventForm } from "@/components/admin/event-rsvps/onsite-event-form";
import {
  adminCreateOnsiteEventAction,
  adminUpdateOnsiteEventAction,
} from "@/lib/actions/admin/admin-onsite-event";
import type { OnsiteEventAdminDetail } from "@auction/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), back: vi.fn() }));

vi.mock("@/lib/actions/admin/admin-onsite-event", () => ({
  adminCreateOnsiteEventAction: vi.fn(),
  adminUpdateOnsiteEventAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const editInitial: OnsiteEventAdminDetail = {
  slug: "lax001",
  title: "Opening evening",
  status: "published",
  startsAt: "2026-06-18T18:00:00.000Z",
  rsvpCloseAt: "2026-06-10T18:00:00.000Z",
  segmentOptions: [
    { value: "full_evening", label: "Full evening" },
    { value: "auction_only", label: "Auction only", helper: "From 7pm" },
  ],
  micrositeUrl: "https://event.lax.bid/lax001",
  venue: "Brunswick Art Gallery",
  dressCode: "Smart formal",
  arrivalNote: "Doors 6:00 PM",
  opsEmail: "events@lax.bid",
  checkInDryRun: false,
  rsvpCount: 12,
  checkedInCount: 4,
  saleId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OnsiteEventForm", () => {
  it("shows the saved details and attendance options in edit mode", () => {
    render(<OnsiteEventForm mode="edit" initial={editInitial} />);

    expect(screen.getByLabelText("Title")).toHaveValue("Opening evening");
    expect(screen.getByLabelText(/^Ops email/)).toHaveValue("events@lax.bid");
    expect(screen.getByLabelText(/^Dress code/)).toHaveValue("Smart formal");
    expect(screen.getByLabelText(/^Arrival note/)).toHaveValue("Doors 6:00 PM");
    expect(screen.getByLabelText("Name of option 1")).toHaveValue("Full evening");
    expect(screen.getByLabelText("Name of option 2")).toHaveValue("Auction only");
    expect(screen.getByLabelText(/^Note for option 2/)).toHaveValue("From 7pm");
    expect(screen.queryByLabelText("Slug")).not.toBeInTheDocument();
  });

  it("shows London times with their zone", () => {
    render(<OnsiteEventForm mode="edit" initial={editInitial} />);
    expect(screen.getAllByText("Europe/London (BST)").length).toBeGreaterThan(0);
  });

  it("adds and removes attendance options", () => {
    render(<OnsiteEventForm mode="edit" initial={editInitial} />);
    expect(screen.getAllByLabelText(/^Name of option/)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Add an option" }));
    expect(screen.getAllByLabelText(/^Name of option/)).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Remove option 1" }));
    expect(screen.getAllByLabelText(/^Name of option/)).toHaveLength(2);
    expect(screen.queryByDisplayValue("Full evening")).not.toBeInTheDocument();
  });

  it("lists what to fix on submit, links each to its field and does not save", async () => {
    render(<OnsiteEventForm mode="create" />);
    const submit = screen.getByRole("button", { name: "Create event" });
    expect(submit).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Name of option 1"), { target: { value: "" } });
    fireEvent.click(submit);

    const summary = await screen.findByRole("alert");
    expect(summary).toHaveTextContent("There is a problem");
    expect(summary).toHaveTextContent("Enter a slug, for example lax002");
    expect(summary).toHaveTextContent("Enter the event title");
    expect(summary).toHaveTextContent("Add at least one way to attend");
    await waitFor(() => expect(summary).toHaveFocus());
    expect(screen.getByLabelText("Slug")).toHaveAttribute("aria-invalid", "true");
    expect(adminCreateOnsiteEventAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("link", { name: "Enter the event title" }));
    expect(screen.getByLabelText("Title")).toHaveFocus();
  });

  it("re-checks a field as it changes and keeps focus where the person is typing", async () => {
    render(<OnsiteEventForm mode="create" />);
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));
    await screen.findByText("Enter the event title", { selector: "a" });

    const title = screen.getByLabelText("Title");
    title.focus();
    fireEvent.change(title, { target: { value: "Opening evening" } });

    await waitFor(() =>
      expect(
        screen.queryByText("Enter the event title", { selector: "a" }),
      ).not.toBeInTheDocument(),
    );
    expect(title).toHaveFocus();
  });

  it("creates the event with a stored key for each new option, then opens it", async () => {
    vi.mocked(adminCreateOnsiteEventAction).mockResolvedValue({
      ok: true,
      data: { slug: "lax002" },
    });
    render(<OnsiteEventForm mode="create" />);

    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "lax002" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Summer party" } });
    fireEvent.click(screen.getByRole("button", { name: "Add an option" }));
    fireEvent.change(screen.getByLabelText("Name of option 2"), {
      target: { value: "Auction only" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/event-rsvps/lax002"));
    expect(adminCreateOnsiteEventAction).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "lax002",
        title: "Summer party",
        status: "draft",
        segmentOptions: [
          { value: "full_evening", label: "Full evening" },
          { value: "auction_only", label: "Auction only" },
        ],
      }),
    );
  });

  it("keeps a failed save on the form with the reason and the typed values", async () => {
    vi.mocked(adminUpdateOnsiteEventAction).mockResolvedValue({
      ok: false,
      error: "The event could not be saved",
    });
    render(<OnsiteEventForm mode="edit" initial={editInitial} />);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Opening night" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("The event could not be saved")).toBeInTheDocument();
    expect(screen.getByText("That did not go through")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Opening night");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("asks before leaving a new event with changes, and lets the person keep editing", async () => {
    render(<OnsiteEventForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Summer party" } });

    fireEvent.click(screen.getByRole("link", { name: "Cancel" }));

    expect(await screen.findByText("Discard changes to the new event?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await waitFor(() =>
      expect(screen.queryByText("Discard changes to the new event?")).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Summer party");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("goes where the person was headed once they discard", async () => {
    render(<OnsiteEventForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Summer party" } });

    fireEvent.click(screen.getByRole("link", { name: "Cancel" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/event-rsvps"));
  });
});
