/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShopOrderInvoiceCard } from "./shop-order-invoice-card";

afterEach(cleanup);

describe("ShopOrderInvoiceCard", () => {
  it("draws nothing while it is LAX's own invoice", () => {
    const { container } = render(<ShopOrderInvoiceCard card={{ kind: "lax" }} />);
    expect(container.innerHTML).toBe("");
  });

  it("announces a late invoice, and offers no download before it is issued", () => {
    render(
      <ShopOrderInvoiceCard
        card={{
          kind: "delayed",
          title: "Invoice being prepared",
          detail:
            "This is taking longer than usual. Our team has been told. Your payment is not affected.",
          note: "PDF available once issued",
        }}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("taking longer than usual");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("PDF available once issued")).toBeTruthy();
  });

  it("links the issued invoice to LAX's stored copy", () => {
    render(
      <ShopOrderInvoiceCard
        card={{
          kind: "issued",
          title: "Invoice LAX-INV-000124",
          meta: "Issued Thu 12 Nov, 14:05 GMT",
          download: { label: "Download invoice (PDF)", href: "/account/orders/o/documents/d" },
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Invoice" })).toBeTruthy();
    const link = screen.getByRole("link", { name: "Download invoice (PDF)" });
    expect(link.getAttribute("href")).toBe("/account/orders/o/documents/d");
    expect(screen.getByText("Invoice LAX-INV-000124")).toBeTruthy();
  });

  it("says when it was cancelled, with no link", () => {
    render(
      <ShopOrderInvoiceCard
        card={{
          kind: "cancelled",
          title: "Invoice cancelled",
          detail: "This invoice was cancelled on Mon 16 Nov. You owe nothing on it.",
        }}
      />,
    );
    expect(screen.getByText("Invoice cancelled")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
