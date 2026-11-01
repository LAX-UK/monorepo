import { MarketingUnderlineTabs } from "@/components/marketing/marketing-underline-tabs";
import { type ResultsView, resultsHref } from "@/lib/marketing/results-page-params";

const TABS: readonly { id: ResultsView; label: string }[] = [
  { id: "sales", label: "Sales" },
  { id: "lots", label: "Lots" },
];

/** The two ways into the results: by sale, or by sold work. */
export function ResultsViewTabs({
  active,
  className,
}: {
  active: ResultsView;
  className?: string;
}) {
  return (
    <MarketingUnderlineTabs
      variant="route"
      {...(className ? { className } : {})}
      ariaLabel="Results views"
      tabs={TABS.map((tab) => ({
        id: tab.id,
        label: tab.label,
        href: resultsHref(tab.id),
        active: tab.id === active,
        scroll: false,
      }))}
    />
  );
}
