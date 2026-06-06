import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminTechnicalIdDisclosure } from "./admin-technical-id-disclosure";

vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn() },
}));

describe("AdminTechnicalIdDisclosure", () => {
  it("hides IDs until expanded", () => {
    render(<AdminTechnicalIdDisclosure items={[{ label: "Payment ID", value: "pay_123" }]} />);
    expect(screen.queryByText("pay_123")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /show reference ids/i }));
    expect(screen.getByText("pay_123")).toBeTruthy();
  });

  it("renders nothing when all values are empty", () => {
    const { container } = render(
      <AdminTechnicalIdDisclosure items={[{ label: "ID", value: "" }]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
