import type { AccountRowVm } from "@/lib/organisations/organisation-accounts.vm";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountList } from "./account-list";

const approved: AccountRowVm = {
  id: "nb",
  kind: "organisation",
  title: "Northbank Gallery",
  tileName: "Northbank Gallery",
  meta: ["Gallery", "Owner"],
  href: "/home?account=nb",
  current: false,
  attention: null,
  step: null,
};

describe("AccountList", () => {
  it("opens an account with one Open action and no badge", () => {
    render(<AccountList rows={[approved]} />);
    expect(screen.getByRole("link", { name: "Open, Northbank Gallery" })).toHaveAttribute(
      "href",
      "/home?account=nb",
    );
    expect(screen.queryByText("Approved")).not.toBeInTheDocument();
  });

  it("offers the setup step instead of Open, with the one badge", () => {
    render(
      <AccountList
        rows={[
          {
            ...approved,
            attention: { label: "Payouts not set up", tone: "warning", shape: "alert" },
            step: { label: "Finish payout setup", href: "/onboarding/organisation/step/connect" },
          },
        ]}
      />,
    );
    expect(screen.getByText("Payouts not set up")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Finish payout setup, Northbank Gallery" }),
    ).toHaveAttribute("href", "/onboarding/organisation/step/connect");
  });
});
