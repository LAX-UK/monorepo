import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CoverAlertField } from "./cover-alert.js";

afterEach(cleanup);

const alert = { action: "/api/alerts/notify", fieldLabel: "Your email address" };

describe("CoverAlertField", () => {
  it("shows one message under the field, with no summary, and focuses the field", () => {
    render(<CoverAlertField alert={alert} submitLabel="Get alerts" tone={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Get alerts" }));
    const input = screen.getByLabelText("Your email address");
    expect(screen.queryByText("There is a problem")).toBeNull();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const message = screen.getByText("Enter your email address");
    expect(input.getAttribute("aria-describedby")).toBe(message.id);
    expect(document.activeElement).toBe(input);
  });

  it("is announced once: by the field's description when focus moves to it", () => {
    render(<CoverAlertField alert={alert} submitLabel="Get alerts" tone={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Get alerts" }));
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("is announced once: by a live region when the field already had focus", () => {
    render(<CoverAlertField alert={alert} submitLabel="Get alerts" tone={null} />);
    screen.getByLabelText("Your email address").focus();
    fireEvent.submit(screen.getByRole("button", { name: "Get alerts" }).closest("form") as Element);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("explains a malformed address and clears once it is edited", () => {
    render(<CoverAlertField alert={alert} submitLabel="Get alerts" tone={null} />);
    fireEvent.change(screen.getByLabelText("Your email address"), { target: { value: "nope@" } });
    fireEvent.click(screen.getByRole("button", { name: "Get alerts" }));
    expect(screen.getByText(/like name@example.com/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Your email address"), {
      target: { value: "grace@example.com" },
    });
    expect(screen.queryByText(/like name@example.com/)).toBeNull();
  });
});
