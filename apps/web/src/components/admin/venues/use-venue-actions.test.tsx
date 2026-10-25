import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type VenueActionTarget, useVenueActions } from "./use-venue-actions";

const refresh = vi.fn();
const archiveAction = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin-venues", () => ({
  adminArchiveVenueResultAction: (...args: unknown[]) => archiveAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const venue: VenueActionTarget = { id: "v1", name: "Barnes Gallery", archived: false };

function Harness({ target }: { target: VenueActionTarget }) {
  const actions = useVenueActions();
  return (
    <>
      {actions.actionsFor(target).map((action) => (
        <button key={action.id} type="button" onClick={() => action.onSelect?.()}>
          {action.label}
        </button>
      ))}
      {actions.dialogs}
    </>
  );
}

describe("useVenueActions", () => {
  beforeEach(() => {
    for (const fn of [refresh, archiveAction, notifySuccess]) fn.mockReset();
  });

  it("archives only after confirming, then refreshes the list", async () => {
    archiveAction.mockResolvedValue({ ok: true });
    render(<Harness target={venue} />);
    fireEvent.click(screen.getByRole("button", { name: "Archive venue…" }));
    expect(archiveAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Archive venue" }));
    await waitFor(() => expect(archiveAction).toHaveBeenCalledWith("v1"));
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Barnes Gallery archived"));
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps a failure in the dialog so it can be read", async () => {
    archiveAction.mockResolvedValue({ ok: false, error: "Venue is in use" });
    render(<Harness target={venue} />);
    fireEvent.click(screen.getByRole("button", { name: "Archive venue…" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive venue" }));
    expect(await screen.findByText("Venue is in use")).toBeInTheDocument();
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it("offers nothing for an archived venue", () => {
    render(<Harness target={{ ...venue, archived: true }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
