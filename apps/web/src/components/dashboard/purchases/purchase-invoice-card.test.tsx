import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PurchaseInvoiceCard } from "./purchase-invoice-card";

describe("PurchaseInvoiceCard", () => {
  it("offers no download while the invoice is being prepared", () => {
    render(
      <PurchaseInvoiceCard
        card={{
          kind: "preparing",
          title: "Invoice being prepared",
          detail: "You can pay now. We'll email your invoice as soon as it's ready.",
          note: "PDF available once issued",
          tone: "neutral",
        }}
      />,
    );
    expect(screen.getByText("Invoice being prepared")).toBeInTheDocument();
    expect(screen.getByText("PDF available once issued")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("tells the buyer, as a status, that a late invoice is known about", () => {
    render(
      <PurchaseInvoiceCard
        card={{
          kind: "delayed",
          title: "Invoice being prepared",
          detail:
            "This is taking longer than usual. Our team has been told. Your payment is not affected.",
          note: "PDF available once issued",
          tone: "warning",
        }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Our team has been told.");
  });

  it("links the stored invoice, and nothing else", () => {
    render(
      <PurchaseInvoiceCard
        card={{
          kind: "issued",
          title: "Invoice INV-000123",
          meta: "Issued Thu 12 Nov, 14:05 GMT",
          download: { label: "Download invoice (PDF)", href: "/purchases/l/documents/d" },
          credits: [],
        }}
      />,
    );
    expect(screen.getByText("Issued Thu 12 Nov, 14:05 GMT")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Download invoice \(PDF\)/ })).toHaveAttribute(
      "href",
      "/purchases/l/documents/d",
    );
  });

  it("keeps LAX's own invoice link as it was", () => {
    render(
      <PurchaseInvoiceCard
        card={{
          kind: "lax",
          download: { label: "Invoice", href: "/purchases/l/invoice" },
          empty: "The invoice appears here once it is raised.",
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /Download the invoice/ })).toHaveAttribute(
      "href",
      "/purchases/l/invoice",
    );
  });

  it("lists each refund's credit note under the invoice, each its own download", () => {
    render(
      <PurchaseInvoiceCard
        card={{
          kind: "issued",
          title: "Invoice INV-000123",
          meta: "Issued Thu 12 Nov, 14:05 GMT",
          download: { label: "Download invoice (PDF)", href: "/purchases/l/documents/d" },
          credits: [
            {
              text: "Refunded \u2212£123.45",
              download: {
                label: "Download credit note CN-00001 (PDF)",
                href: "/purchases/l/documents/c1",
              },
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("Refunded \u2212£123.45")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: /Download credit note CN-00001 \(PDF\)/ }),
    ).toHaveAttribute("href", "/purchases/l/documents/c1");
  });
});
