import ClerkConsoleError from "@/app/admin/(platform)/saleroom/[saleId]/error";
import { createStaffPageError } from "@/components/admin/staff/create-staff-page-error";
import { createStaffTabError } from "@/components/admin/staff/create-staff-tab-error";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/observability/use-report-route-error", () => ({ useReportRouteError: () => {} }));

function staleActionError(): Error {
  const error = new Error('Server Action "7f3a" was not found on the server.');
  error.name = "UnrecognizedActionError";
  return error;
}

function stubReload() {
  const reload = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload });
  return reload;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("clerk console error boundary", () => {
  it("Try again resets the boundary; the console then refetches the page and reads the room", () => {
    const reset = vi.fn();

    render(<ClerkConsoleError error={new Error("boom")} reset={reset} />);
    expect(screen.getByText("Clerk console did not load")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe("createStaffPageError", () => {
  it("keeps the page title with what failed, Try again and a way back", () => {
    const InboxError = createStaffPageError({
      title: "Inbox",
      backHref: "/admin",
      backLabel: "Back to overview",
    });
    const reset = vi.fn();

    render(<InboxError error={new Error("boom")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("Inbox did not load")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to overview" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe("createStaffTabError", () => {
  const RegistrationsError = createStaffTabError({ title: "Registrations did not load" });

  it("Try again reloads the page, so the tab never comes back with the state it was loaded with", () => {
    const reload = stubReload();
    const reset = vi.fn();

    render(<RegistrationsError error={new Error("boom")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reload).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });

  it("Try again after a deploy reloads the tab onto the current build", () => {
    const reload = stubReload();

    render(<RegistrationsError error={staleActionError()} reset={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
