import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const approve = vi.fn();
const decline = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin", () => ({
  adminApproveWithdrawalRequestResultAction: (...args: unknown[]) => approve(...args),
  adminDeclineWithdrawalRequestResultAction: (...args: unknown[]) => decline(...args),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/admin/typed-confirmation-dialog", () => ({
  TypedConfirmationDialog: () => null,
}));
vi.mock("@auction/staff-ui", () => ({
  StaffButton: ({
    children,
    loading: _loading,
    variant: _variant,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: string }) => (
    <button type="button" {...rest}>
      {children}
    </button>
  ),
  StaffDialog: ({
    open,
    title,
    children,
    footer,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
    footer: React.ReactNode;
  }) =>
    open ? (
      <section aria-label={title}>
        {children}
        {footer}
      </section>
    ) : null,
  Field: ({
    label,
    error,
    children,
  }: { label: string; error?: string | null; children: React.ReactNode }) => (
    <div>
      <span>{label}</span>
      {children}
      {error ? <span role="alert">{error}</span> : null}
    </div>
  ),
  TextArea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

import { WithdrawalDecisionActions } from "./withdrawal-decision-actions";

describe("WithdrawalDecisionActions", () => {
  beforeEach(() => {
    approve.mockReset();
    decline.mockReset();
    refresh.mockReset();
    decline.mockResolvedValue({ ok: true });
  });

  it("offers no decision to staff who cannot decide", () => {
    render(<WithdrawalDecisionActions lotId="lot-1" canDecide={false} />);
    expect(screen.queryByRole("button", { name: /approve withdrawal/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /decline withdrawal/i })).toBeNull();
    expect(screen.getByText(/only auction managers/i)).toBeTruthy();
  });

  it("offers approve and decline to auction managers", () => {
    render(<WithdrawalDecisionActions lotId="lot-1" canDecide />);
    expect(screen.getByRole("button", { name: /approve withdrawal/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /decline withdrawal/i })).toBeTruthy();
  });

  it("will not decline without a reason for the seller", () => {
    render(<WithdrawalDecisionActions lotId="lot-1" canDecide />);
    fireEvent.click(screen.getByRole("button", { name: /decline withdrawal/i }));
    fireEvent.click(screen.getByRole("button", { name: /decline and notify seller/i }));
    expect(screen.getByRole("alert").textContent).toMatch(/tell the seller why/i);
    expect(decline).not.toHaveBeenCalled();
  });

  it("sends the trimmed reason and refreshes", async () => {
    render(<WithdrawalDecisionActions lotId="lot-1" canDecide />);
    fireEvent.click(screen.getByRole("button", { name: /decline withdrawal/i }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Already catalogued  " } });
    fireEvent.click(screen.getByRole("button", { name: /decline and notify seller/i }));
    await waitFor(() => expect(decline).toHaveBeenCalledWith("lot-1", "Already catalogued"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
