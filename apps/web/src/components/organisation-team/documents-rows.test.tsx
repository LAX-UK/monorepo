import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AgreementDocuments } from "./agreement-documents";
import { StatementDocuments } from "./statement-documents";

const agreement = (pageHref: string | null) => ({
  submissionId: "s1",
  title: "Consignment agreement · Low cloud",
  detail: "Accepted",
  accepted: true,
  href: "/organisation/documents/agreements/s1",
  pageHref,
});
const statement = (pageHref: string | null) => ({
  payoutId: "p1",
  title: "Payout statement",
  period: "1 Oct 2026 → 31 Oct 2026",
  detail: "£12,860.00",
  unavailable: false,
  href: "/legal-entities/org/payouts/p1/statement",
  pageHref,
});

describe("Agreement rows", () => {
  it("open the consignment page and keep the download separate", () => {
    render(<AgreementDocuments rows={[agreement("/selling/consignments/s1")]} />);
    expect(screen.getByRole("link", { name: "Consignment agreement · Low cloud" })).toHaveAttribute(
      "href",
      "/selling/consignments/s1",
    );
    const download = screen.getByRole("link", {
      name: "Download Consignment agreement · Low cloud",
    });
    expect(download).toHaveAttribute("href", "/organisation/documents/agreements/s1");
    expect(download).toHaveAttribute("download");
  });

  it("have no row link when the member cannot open the consignment, only the download", () => {
    render(<AgreementDocuments rows={[agreement(null)]} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/organisation/documents/agreements/s1");
  });
});

describe("Statement rows", () => {
  it("open the payout page and keep the download separate", () => {
    render(<StatementDocuments rows={[statement("/selling/payouts/p1")]} />);
    expect(screen.getByRole("link", { name: "Payout statement" })).toHaveAttribute(
      "href",
      "/selling/payouts/p1",
    );
    expect(screen.getByRole("link", { name: /^Download Payout statement/ })).toHaveAttribute(
      "href",
      "/legal-entities/org/payouts/p1/statement",
    );
  });

  it("have no row link when the member cannot open the payout, only the download", () => {
    render(<StatementDocuments rows={[statement(null)]} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("download");
  });
});
