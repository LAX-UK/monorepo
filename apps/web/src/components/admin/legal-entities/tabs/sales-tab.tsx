import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import Link from "next/link";

type Props = {
  entityId: string;
  displayName: string;
};

export function LegalEntitySalesTab({ entityId, displayName }: Props) {
  return (
    <CatalogDetailTabPanel
      title="Sales"
      description={`Consignment and catalogue sales linked to ${displayName}.`}
    >
      <p className="font-body text-sm text-on-surface-variant">
        No sales are linked to this entity in the current seed data. When sales are associated with
        this legal entity, they will appear here.
      </p>
      <Link
        href="/admin/sales"
        className="inline-flex font-body text-sm text-link underline-offset-2 hover:underline"
      >
        Browse all sales
      </Link>
      <p className="sr-only">Entity id {entityId}</p>
    </CatalogDetailTabPanel>
  );
}
