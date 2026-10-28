import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccessDeniedState, NotFoundState } from "./states.js";

describe("AccessDeniedState", () => {
  it("names the resource and the one role that can open it", () => {
    render(<AccessDeniedState resource="Payments" requiredRole="Finance" />);
    expect(
      screen.getByRole("heading", { name: "You don’t have access to Payments" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Payments is open to the Finance role. Ask an admin on your team if you need it.",
      ),
    ).toBeInTheDocument();
  });

  it("lists several roles in plain English", () => {
    render(
      <AccessDeniedState
        resource="Lots"
        requiredRoles={["Cataloguer", "Sales manager", "Operations"]}
      />,
    );
    expect(
      screen.getByText(
        "Lots is open to the Cataloguer, Sales manager and Operations roles. Ask an admin on your team if you need it.",
      ),
    ).toBeInTheDocument();
  });

  it("can be the page heading and offer a way on", () => {
    render(
      <AccessDeniedState
        resource="Staff"
        headingLevel="h1"
        action={<a href="/admin/finance">Back to your overview</a>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Staff");
    expect(screen.getByRole("link", { name: "Back to your overview" })).toBeInTheDocument();
    expect(screen.getByText("Ask an admin on your team if you need it.")).toBeInTheDocument();
  });
});

describe("NotFoundState", () => {
  it("can be the page heading", () => {
    render(<NotFoundState headingLevel="h1" title="This page doesn’t exist" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This page doesn’t exist");
  });
});
