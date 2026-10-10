import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HostedLoginErrorPanel } from "./hosted-login-error-panel";

describe("HostedLoginErrorPanel", () => {
  it("shows restored copy when session was preserved", () => {
    render(
      <HostedLoginErrorPanel
        errorCode="oidc_exchange"
        next="/dashboard/settings"
        restored
        retryIntent="reauth"
      />,
    );
    expect(screen.getByRole("heading", { name: /you are still signed in/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /continue/i })).toHaveAttribute(
      "href",
      "/dashboard/settings",
    );
    expect(screen.getByRole("link", { name: /try step-up again/i })).toHaveAttribute(
      "href",
      "/api/auth/login?next=%2Fdashboard%2Fsettings&intent=reauth",
    );
  });

  it.each(["//evil.example", "/\\evil.example", "https://evil.example"])(
    "drops unsafe next %s from every link",
    (next) => {
      render(<HostedLoginErrorPanel errorCode="reauth_subject_mismatch" next={next} />);
      expect(screen.getByRole("link", { name: /continue/i })).toHaveAttribute("href", "/dashboard");
      expect(screen.getByRole("link", { name: /try step-up again/i })).toHaveAttribute(
        "href",
        "/api/auth/login?intent=reauth",
      );
      expect(screen.getByRole("link", { name: /back to sign-in/i })).toHaveAttribute(
        "href",
        "/login",
      );
    },
  );
});
