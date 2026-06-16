import { SaleroomCheckInPanel } from "@/components/admin/saleroom-check-in-panel";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/admin", () => ({
  adminSaleroomCheckInCandidatesResultAction: vi.fn(),
  adminSaleroomCheckInResultAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("SaleroomCheckInPanel", () => {
  it("shows search guidance and title", () => {
    render(<SaleroomCheckInPanel saleId="00000000-0000-4000-8000-000000000002" />);
    expect(screen.getByText("In-room check-in")).toBeInTheDocument();
    expect(screen.getByText(/Type email or name/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Search client")).toBeInTheDocument();
  });
});
