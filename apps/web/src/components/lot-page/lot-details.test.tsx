import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LotDetails } from "./lot-details";

const DETAILS = { about: ["A coastal study."], facts: [] };
const TERMS =
  "Storage is free for 14 days after your payment clears. After that it is £3 a day for each work, or £6 for works over 150 cm on any side, plus VAT where it applies.";

describe("LotDetails: Collection and storage", () => {
  it("shows the terms in the place's own words, with the storage policy link", () => {
    render(<LotDetails details={DETAILS} premiumTerms="25%" storageTerms={TERMS} />);
    const section = screen.getByRole("complementary", { name: "Collection and storage" });
    expect(section).toHaveTextContent(TERMS);
    expect(screen.getByRole("link", { name: "Storage policy" })).toHaveAttribute(
      "href",
      "/shipping#storage",
    );
  });

  it("sits beside the buying note, not instead of it", () => {
    render(<LotDetails details={DETAILS} premiumTerms="25%" storageTerms={TERMS} />);
    expect(screen.getByRole("heading", { name: "Buying this work" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Collection and storage" })).toBeInTheDocument();
  });

  it("is left out when the place has set no terms", () => {
    render(<LotDetails details={DETAILS} premiumTerms="25%" storageTerms={null} />);
    expect(screen.queryByText("Collection and storage")).toBeNull();
  });

  it("shows the section alone for a lot with no premium note", () => {
    render(
      <LotDetails details={{ about: [], facts: [] }} premiumTerms={null} storageTerms={TERMS} />,
    );
    expect(screen.getByText(TERMS)).toBeInTheDocument();
    expect(screen.queryByText("Buying this work")).toBeNull();
  });
});
