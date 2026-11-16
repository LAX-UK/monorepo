import {
  createStaffPageError,
  retryStaffPage,
} from "@/components/admin/staff/create-staff-page-error";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/observability/use-report-route-error", () => ({ useReportRouteError: () => {} }));

const ClerkConsoleError = createStaffPageError({
  title: "Clerk console",
  backHref: "/admin/saleroom",
  backLabel: "Back to the saleroom",
});

function staleActionError(): Error {
  const error = new Error('Server Action "7f3a" was not found on the server.');
  error.name = "UnrecognizedActionError";
  return error;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("retryStaffPage", () => {
  it("refetches the page and resets the boundary in one transition", () => {
    const order: string[] = [];
    const startTransition = vi.fn((run: () => void) => {
      order.push("transition:start");
      run();
      order.push("transition:end");
    });

    retryStaffPage({
      error: new Error("boom"),
      reset: () => order.push("reset"),
      refresh: () => order.push("refresh"),
      reload: () => order.push("reload"),
      startTransition,
    });

    // Refresh first: reset alone re-renders the console from the props it was first given.
    expect(order).toEqual(["transition:start", "refresh", "reset", "transition:end"]);
  });

  it("reloads onto the current build when the page's server action is gone after a deploy", () => {
    const reset = vi.fn();
    const refresh = vi.fn();
    const reload = vi.fn();

    retryStaffPage({
      error: staleActionError(),
      reset,
      refresh,
      reload,
      startTransition: (run) => run(),
    });

    expect(reload).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("createStaffPageError", () => {
  it("Try again fetches live state before showing the page again", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();

    render(<ClerkConsoleError error={new Error("boom")} reset={reset} />);
    expect(screen.getByText("Clerk console did not load")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(refresh.mock.invocationCallOrder[0]).toBeLessThan(
      reset.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("Try again after a deploy reloads the page instead of resetting onto the old build", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    const reset = vi.fn();

    render(<ClerkConsoleError error={staleActionError()} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reload).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
