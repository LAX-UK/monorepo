import { STAFF_STEP_UP_REQUIRED } from "@auction/identity-contracts/staff-step-up";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepUpNotice, isStaffStepUpRequired, useStaffStepUp } from "./step-up.js";

describe("isStaffStepUpRequired", () => {
  it("recognises the shared step-up code in any of the shapes actions return", () => {
    expect(isStaffStepUpRequired(STAFF_STEP_UP_REQUIRED)).toBe(true);
    expect(isStaffStepUpRequired({ errorCode: STAFF_STEP_UP_REQUIRED })).toBe(true);
    expect(isStaffStepUpRequired({ error: STAFF_STEP_UP_REQUIRED })).toBe(true);
    expect(isStaffStepUpRequired({ code: STAFF_STEP_UP_REQUIRED })).toBe(true);
  });

  it("leaves every other failure to the caller", () => {
    expect(isStaffStepUpRequired({ error: "forbidden" })).toBe(false);
    expect(isStaffStepUpRequired(undefined)).toBe(false);
    expect(isStaffStepUpRequired(null)).toBe(false);
  });
});

describe("useStaffStepUp", () => {
  it("opens “Confirm it’s you” for a step-up failure and starts the fresh sign-in", () => {
    const onReauthenticate = vi.fn();
    const { result } = renderHook(() => useStaffStepUp({ onReauthenticate }));
    let handled = false;
    act(() => {
      handled = result.current.handle({ errorCode: STAFF_STEP_UP_REQUIRED }, "issue £4,210.00");
    });
    expect(handled).toBe(true);
    render(result.current.dialog);
    const dialog = screen.getByRole("dialog", { name: "Confirm it’s you" });
    expect(dialog).toHaveTextContent("To issue £4,210.00, sign in again.");
    expect(dialog).toHaveTextContent("sign-in from the last 15 minutes");
    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(onReauthenticate).toHaveBeenCalled();
  });

  it("does not handle other failures", () => {
    const { result } = renderHook(() => useStaffStepUp({ onReauthenticate: vi.fn() }));
    expect(result.current.handle({ error: "Amount too large" })).toBe(false);
    expect(result.current.pending).toBe(false);
  });
});

describe("StepUpNotice", () => {
  it("asks inline, with the way back in", () => {
    const onReauthenticate = vi.fn();
    render(<StepUpNotice action="change this role" onReauthenticate={onReauthenticate} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Confirm it’s you to change this role");
    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(onReauthenticate).toHaveBeenCalled();
  });
});
