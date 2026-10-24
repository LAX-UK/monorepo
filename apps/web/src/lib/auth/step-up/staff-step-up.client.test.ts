import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const notifyInfo = vi.fn();
const notifyError = vi.fn();
vi.mock("@/lib/ui/notify", () => ({
  notify: {
    info: (title: string, opts: unknown) => notifyInfo(title, opts),
    error: (title: string, opts: unknown) => notifyError(title, opts),
  },
}));

const { STAFF_STEP_UP_REDIRECT_DELAY_MS, handleStaffStepUp, isStaffStepUpRequired } = await import(
  "./staff-step-up.client"
);

const GUARD_KEY = "lax:hosted-reauth-attempted-at";

describe("isStaffStepUpRequired", () => {
  it("recognises the code on an action result, an error field or a bare string", () => {
    expect(isStaffStepUpRequired({ errorCode: "step_up_required" })).toBe(true);
    expect(isStaffStepUpRequired({ error: "step_up_required" })).toBe(true);
    expect(isStaffStepUpRequired("step_up_required")).toBe(true);
  });

  it("ignores other failures", () => {
    expect(isStaffStepUpRequired({ errorCode: "forbidden" })).toBe(false);
    expect(isStaffStepUpRequired({ error: "Not found" })).toBe(false);
    expect(isStaffStepUpRequired(undefined)).toBe(false);
  });
});

describe("handleStaffStepUp", () => {
  const assign = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    vi.stubGlobal("location", {
      ...window.location,
      pathname: "/admin/clients/user-one",
      search: "?tab=security",
      assign,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    assign.mockReset();
    notifyInfo.mockReset();
    notifyError.mockReset();
  });

  it("does nothing for an unrelated failure", () => {
    expect(handleStaffStepUp({ errorCode: "forbidden" })).toBe(false);
    expect(notifyInfo).not.toHaveBeenCalled();
    vi.advanceTimersByTime(STAFF_STEP_UP_REDIRECT_DELAY_MS);
    expect(assign).not.toHaveBeenCalled();
  });

  it("tells the person, then sends them to hosted re-authentication and back to this page", () => {
    expect(handleStaffStepUp({ errorCode: "step_up_required" })).toBe(true);
    expect(notifyInfo).toHaveBeenCalledWith(
      "Confirm it is you to continue",
      expect.objectContaining({ id: "staff-step-up" }),
    );
    expect(assign).not.toHaveBeenCalled();

    vi.advanceTimersByTime(STAFF_STEP_UP_REDIRECT_DELAY_MS);

    expect(assign).toHaveBeenCalledWith(
      "/api/auth/login?intent=reauth&next=%2Fadmin%2Fclients%2Fuser-one%3Ftab%3Dsecurity",
    );
    expect(sessionStorage.getItem(GUARD_KEY)).not.toBeNull();
  });

  it("stops with an error instead of looping when a re-authentication just ran", () => {
    sessionStorage.setItem(GUARD_KEY, String(Date.now() - 30_000));

    expect(handleStaffStepUp({ errorCode: "step_up_required" })).toBe(true);
    vi.advanceTimersByTime(STAFF_STEP_UP_REDIRECT_DELAY_MS);

    expect(notifyError).toHaveBeenCalledWith(
      "We could not confirm your sign-in",
      expect.anything(),
    );
    expect(notifyInfo).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("tries again once the guard window has passed", () => {
    sessionStorage.setItem(GUARD_KEY, String(Date.now() - 3 * 60 * 1000));

    handleStaffStepUp({ errorCode: "step_up_required" });
    vi.advanceTimersByTime(STAFF_STEP_UP_REDIRECT_DELAY_MS);

    expect(assign).toHaveBeenCalledTimes(1);
  });
});
