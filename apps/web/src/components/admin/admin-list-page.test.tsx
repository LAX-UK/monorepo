import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminListPage } from "./admin-list-page";

describe("AdminListPage", () => {
  it("renders title and view slot", () => {
    render(<AdminListPage title="Sales" description="Manage sales" view={<p>Table content</p>} />);
    expect(screen.getByRole("heading", { name: "Sales" })).toBeTruthy();
    expect(screen.getByText("Table content")).toBeTruthy();
  });

  it("renders mobile cards in separate slot", () => {
    render(
      <AdminListPage
        title="Clients"
        view={<p>Desktop table</p>}
        mobileCards={<p>Mobile cards</p>}
      />,
    );
    expect(screen.getByText("Desktop table")).toBeTruthy();
    expect(screen.getByText("Mobile cards")).toBeTruthy();
  });
});
