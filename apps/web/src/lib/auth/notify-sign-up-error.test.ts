import { notifySignUpRegistrationError } from "@/lib/auth/notify-sign-up-error";
import { notify } from "@/lib/ui/notify";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ui/notify", () => ({
  notify: {
    error: vi.fn(),
  },
}));

describe("notifySignUpRegistrationError", () => {
  it("shows toast with sign-in and reset actions for email_already_registered", () => {
    const onNavigate = vi.fn();
    notifySignUpRegistrationError("email_already_registered", "This email is already registered.", {
      loginHref: "/login",
      forgotPasswordHref: "/forgot-password",
      onNavigate,
    });

    expect(notify.error).toHaveBeenCalledWith("This email is already registered.", {
      id: "signup-email-already-registered",
      action: expect.objectContaining({ label: "Sign in" }),
      cancel: expect.objectContaining({ label: "Reset password" }),
    });

    const opts = vi.mocked(notify.error).mock.calls[0]?.[1];
    opts?.action?.onClick();
    expect(onNavigate).toHaveBeenCalledWith("/login");
    opts?.cancel?.onClick();
    expect(onNavigate).toHaveBeenCalledWith("/forgot-password");
  });

  it("shows a plain error toast for other registration failures", () => {
    notifySignUpRegistrationError("registration_failed", "We could not complete registration.");

    expect(notify.error).toHaveBeenCalledWith("We could not complete registration.", {
      id: "signup-registration-failed",
    });
  });
});
