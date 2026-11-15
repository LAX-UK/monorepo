import { SellDepartmentView } from "@/components/marketing/sell-tailored-landing-page";
import { SellLandingView } from "@/components/marketing/sell/sell-landing-view";
import type { DepartmentEvidence } from "@/lib/departments/department-evidence";
import { SELL_FAQ_ITEMS } from "@/lib/marketing/sell-faq-items";
import { SELL_FEES_POINTS } from "@/lib/marketing/sell-landing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CorporatePage from "@/app/(marketing)/sell/corporate/page";
import EstatePage from "@/app/(marketing)/sell/estate/page";
import MotorCarsPage from "@/app/(marketing)/sell/motor-cars/page";
import PrintsPage from "@/app/(marketing)/sell/prints/page";
import WatchesPage from "@/app/(marketing)/sell/watches/page";
import type { Lot } from "@auction/types";
import type { ReactElement } from "react";

function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

type DepartmentProps = Omit<Parameters<typeof SellDepartmentView>[0], "evidence">;

/** The props each real department page hands to the template, read from the page module. */
function pageProps(page: () => ReactElement): DepartmentProps {
  return (page() as ReactElement<DepartmentProps>).props;
}

const DEPARTMENTS = [
  pageProps(EstatePage),
  pageProps(CorporatePage),
  pageProps(PrintsPage),
  pageProps(WatchesPage),
  pageProps(MotorCarsPage),
];

function work(id: string, title: string): Lot {
  return {
    id,
    title,
    status: "ended",
    currentPrice: "1000.00",
    startingPrice: "500.00",
    hasWinner: true,
    winnerId: null,
    images: [],
  } as unknown as Lot;
}

function evidence(over: Partial<DepartmentEvidence> = {}): DepartmentEvidence {
  return {
    categoryId: "c1",
    soldHref: "/results",
    onSaleHref: "/auctions",
    sold: [{ lot: work("s1", "Sold work one") }],
    onSale: [work("o1", "On sale work one")],
    deadline: { date: "1 December", saleTitle: "Winter Sale" },
    ...over,
  } as unknown as DepartmentEvidence;
}

describe("department pages", () => {
  it("each real page passes its title, bullets and a way into the form", () => {
    expect(DEPARTMENTS.map((d) => d.path)).toEqual([
      "/sell/estate",
      "/sell/corporate",
      "/sell/prints",
      "/sell/watches",
      "/sell/motor-cars",
    ]);
    for (const d of DEPARTMENTS) {
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.bullets.length).toBeGreaterThan(0);
      expect(Boolean(d.categorySlug || d.contactType)).toBe(true);
    }
    for (const d of DEPARTMENTS.filter((x) => x.categorySlug)) {
      expect(d.departmentNoun, `${d.path} needs a noun for its evidence`).toBeTruthy();
    }
  });
});

describe.each(DEPARTMENTS)("SellDepartmentView $path", (department) => {
  const props = department;
  const noun = department.departmentNoun ?? "works";

  it("renders the shared selling template sections with the agreed defaults", () => {
    render(<SellDepartmentView {...props} evidence={null} />);
    expect(screen.getByRole("heading", { level: 1, name: department.title })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How it works" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Fees in plain words" })).toBeTruthy();
    expect(screen.getByText(SELL_FEES_POINTS[0])).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Questions" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "What to prepare" })).toBeTruthy();
    expect(screen.getByText(department.bullets[0] as string)).toBeTruthy();
    expect(screen.getAllByText(/usually reply within one working day/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Talk to a specialist" }).length).toBe(2);
    expect(screen.queryByRole("heading", { name: "Our specialists" })).toBeNull();
    expect(screen.queryByText(/email me a link/i)).toBeNull();
    expect(screen.queryByText(/\d+(\.\d+)?\s?%/)).toBeNull();
  });

  it("opens the form with the department chosen", () => {
    render(<SellDepartmentView {...props} evidence={null} />);
    const sell = screen.getAllByRole("link", { name: /sell a work/i });
    expect(sell.length).toBeGreaterThan(0);
    if (department.categorySlug) {
      for (const link of sell) expect(link.getAttribute("href")).toContain(department.categorySlug);
    }
  });

  const withCategory = Boolean(department.categorySlug);

  it("shows the next consignment deadline when the department has one", () => {
    render(<SellDepartmentView {...props} departmentNoun={noun} evidence={evidence()} />);
    expect(screen.getByText(`Consign ${noun} by 1 December`)).toBeTruthy();
    expect(screen.getByText(/Winter Sale is the next sale/)).toBeTruthy();
  });

  it("shows no consignment notice when there is no upcoming deadline", () => {
    render(
      <SellDepartmentView
        {...props}
        departmentNoun={noun}
        evidence={evidence({ deadline: null })}
      />,
    );
    expect(screen.queryByText(/^Consign .* by /)).toBeNull();
  });

  it.runIf(withCategory)("keeps sold and on-sale works inside the template", () => {
    render(<SellDepartmentView {...props} departmentNoun={noun} evidence={evidence()} />);
    expect(screen.getByRole("heading", { name: `Recently sold in ${noun}` })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "On sale now" })).toBeTruthy();
    expect(screen.getByText("Sold work one")).toBeTruthy();
    expect(screen.getByText("On sale work one")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How it works" })).toBeTruthy();
  });

  it.runIf(withCategory)("leaves the recently sold row out when nothing sold", () => {
    render(
      <SellDepartmentView {...props} departmentNoun={noun} evidence={evidence({ sold: [] })} />,
    );
    expect(screen.queryByRole("heading", { name: /Recently sold in/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "On sale now" })).toBeTruthy();
  });

  it.runIf(withCategory)("says nothing is on sale when only sold works exist", () => {
    render(
      <SellDepartmentView {...props} departmentNoun={noun} evidence={evidence({ onSale: [] })} />,
    );
    expect(screen.getByRole("heading", { name: `Recently sold in ${noun}` })).toBeTruthy();
    expect(screen.getByText(`Nothing is on sale in ${noun} right now`)).toBeTruthy();
  });
});

describe("the selling template", () => {
  const ORDER = ["How it works", "Fees in plain words", "Questions", "Ready to sell?"];
  function order() {
    const names = screen.getAllByRole("heading").map((h) => h.textContent ?? "");
    return ORDER.map((n) => names.indexOf(n));
  }

  it("lists steps, fees, questions and the closing call in the same order on the landing and a department page", () => {
    const [department] = DEPARTMENTS as [DepartmentProps];
    const first = render(<SellDepartmentView {...department} evidence={null} />);
    const departmentOrder = order();
    first.unmount();
    render(
      <SellLandingView
        recentlySold={[]}
        treatments={{} as never}
        specialists={[]}
        faqItems={SELL_FAQ_ITEMS}
      />,
    );
    const landingOrder = order();
    for (const o of [departmentOrder, landingOrder]) {
      expect(o.every((n) => n >= 0)).toBe(true);
      expect([...o].sort((a, b) => a - b)).toEqual(o);
    }
  });
});
