import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReadOnlyBoundary } from "./read-only-boundary";
import { READ_ONLY_REASON_ID, ViewAsClientBanner } from "./view-as-client-banner";
import { ViewAsClientMenu } from "./view-as-client-menu";

vi.mock("@/lib/legal-entity/acting-context.actions", () => ({
  endAdminImpersonationAction: vi.fn(),
}));

describe("view as client", () => {
  it("names the account, says it is read-only and offers Exit", () => {
    render(<ViewAsClientBanner accountName="Jane Smith" />);
    expect(screen.getByText("Viewing as Jane Smith")).toBeTruthy();
    expect(screen.getByText("— read-only", { exact: false })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exit" })).toBeTruthy();
  });

  it("turns every action inside the boundary off, with the reason, and leaves links and Exit", () => {
    render(
      <>
        <ViewAsClientBanner accountName="Jane Smith" />
        <ReadOnlyBoundary reasonId={READ_ONLY_REASON_ID}>
          <button type="button">Accept agreement</button>
          <input aria-label="Reserve" />
          <a href="/selling">Consignments</a>
        </ReadOnlyBoundary>
      </>,
    );
    const accept = screen.getByRole("button", { name: "Accept agreement" }) as HTMLButtonElement;
    expect(accept.matches(":disabled")).toBe(true);
    expect((screen.getByLabelText("Reserve") as HTMLInputElement).matches(":disabled")).toBe(true);
    expect(screen.getByRole("link", { name: "Consignments" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Exit" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    const group = screen.getByRole("group");
    expect(group.getAttribute("aria-describedby")).toBe(READ_ONLY_REASON_ID);
    expect(document.getElementById(READ_ONLY_REASON_ID)?.textContent).toBe(
      "Actions are turned off while you view as this client.",
    );
  });
});

describe("ViewAsClientMenu", () => {
  it("names the viewed client and offers only pages to look at and Exit", () => {
    render(<ViewAsClientMenu name="Jane Smith" />);
    fireEvent.click(screen.getByRole("button", { name: "Viewing as Jane Smith" }));
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual([
      "Home",
      "My bids",
      "Purchases",
      "Watching",
      "Consignments",
      "Exit view as client",
    ]);
    expect(screen.getByText("Read-only view")).toBeTruthy();
  });
});
