import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CoverAlertField } from "./cover-alert.js";

afterEach(cleanup);

const alert = { action: "/api/alerts/notify", fieldLabel: "Your email address" };

describe("CoverAlertField", () => {
  it("explains a missing address, marks the field and moves focus to the summary", () => {
    render(<CoverAlertField alert={alert} submitLabel="Get alerts" tone={null} />);
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Get alerts" }));
    const summary = screen.getByRole("alert");
    expect(summary.textContent).toContain("Enter your email address");
    expect(screen.getByLabelText("Your email address").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(summary);
  });

  it("explains a malformed address and clears once it is valid", () => {
    render(<CoverAlertField alert={alert} submitLabel="Get alerts" tone={null} />);
    fireEvent.change(screen.getByLabelText("Your email address"), { target: { value: "nope@" } });
    fireEvent.click(screen.getByRole("button", { name: "Get alerts" }));
    expect(screen.getByRole("alert").textContent).toContain("like name@example.com");
    fireEvent.change(screen.getByLabelText("Your email address"), {
      target: { value: "grace@example.com" },
    });
    const form = screen.getByRole("button", { name: "Get alerts" }).closest("form");
    form?.addEventListener("submit", (event) => event.preventDefault());
    fireEvent.click(screen.getByRole("button", { name: "Get alerts" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
