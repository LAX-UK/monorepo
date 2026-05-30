import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";

type Props = {
  current: string;
};

/** Breadcrumb for catalogue-adjacent ops queues (fulfilment, condition reports). */
export function CatalogOpsBreadcrumb({ current }: Props) {
  return (
    <CatalogBreadcrumbs
      segments={[{ label: "Catalog", href: "/admin/lots" }, { label: current }]}
    />
  );
}
