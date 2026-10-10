import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TwoFactorStatusCard } from "./two-factor-status-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/auth/two-factor-disable-dialog", () => ({
  TwoFactorDisableDialog: () => null,
}));
vi.mock("@/components/auth/two-factor-regenerate-codes-dialog", () => ({
  TwoFactorRegenerateCodesDialog: () => null,
}));

describe("TwoFactorStatusCard", () => {
  it("lets the user turn 2FA off when no policy requires it", () => {
    render(<TwoFactorStatusCard twoFactorEnabled />);
    expect(screen.getByRole("button", { name: "Turn off 2FA" })).toBeInTheDocument();
    expect(screen.queryByText(/Required by/)).not.toBeInTheDocument();
  });

  it("explains the requirement and hides turn off while a policy applies", () => {
    render(<TwoFactorStatusCard twoFactorEnabled requiredBy={["org", "staff"]} />);
    expect(
      screen.getByText(/Required by LAX staff policy and your organisation\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn off 2FA" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate backup codes" })).toBeInTheDocument();
  });

  it("tells a not-yet-enrolled user they will be asked at next sign-in", () => {
    render(<TwoFactorStatusCard twoFactorEnabled={false} requiredBy={["org"]} />);
    expect(screen.getByText(/Required by your organisation\./)).toBeInTheDocument();
    expect(screen.getByText(/asked to set it up the next time you sign in/)).toBeInTheDocument();
  });
});
