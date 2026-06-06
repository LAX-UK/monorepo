import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminJsonDisclosure } from "./admin-json-disclosure";

describe("AdminJsonDisclosure", () => {
  it("hides JSON until expanded", () => {
    render(<AdminJsonDisclosure label="Payload" value={{ reason: "seller_request" }} />);
    expect(screen.queryByText(/seller_request/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /show request payload/i }));
    expect(screen.getByText(/seller_request/)).toBeTruthy();
  });

  it("renders nothing for empty payload", () => {
    const { container } = render(<AdminJsonDisclosure label="Payload" value={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
