import {
  type CatalogBreadcrumbSegment,
  CatalogBreadcrumbs,
  CatalogDetailShell,
} from "@/components/admin/catalog";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  title: string;
  breadcrumbs: readonly CatalogBreadcrumbSegment[];
  listHref: string;
  listLabel: string;
  message?: string;
  reset?: () => void;
};

/** Error recovery inside catalog detail geometry. */
export function CatalogDetailErrorShell({
  title,
  breadcrumbs,
  listHref,
  listLabel,
  message = "Something went wrong loading this page. Try again or return to the list.",
  reset,
}: Props) {
  return (
    <CatalogDetailShell
      breadcrumbs={<CatalogBreadcrumbs segments={[...breadcrumbs, { label: "Error" }]} />}
      title={title}
    >
      <div className="flex flex-col items-start gap-4 rounded-lg border border-border-hairline bg-surface-container-low/30 p-6">
        <h2 className="font-headline text-lg text-on-surface">
          Could not load {title.toLowerCase()}
        </h2>
        <p className="font-body text-sm text-on-surface-variant">{message}</p>
        <div className="flex flex-wrap gap-2">
          {reset ? (
            <Button
              type="button"
              variant="default"
              onClick={reset}
              className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 font-label text-xs font-bold uppercase tracking-[0.12em] text-on-primary"
            >
              Try again
            </Button>
          ) : null}
          <Button variant="secondary" asChild>
            <Link href={listHref}>Back to {listLabel.toLowerCase()}</Link>
          </Button>
        </div>
      </div>
    </CatalogDetailShell>
  );
}
