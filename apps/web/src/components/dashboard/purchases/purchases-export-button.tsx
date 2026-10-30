"use client";

import type { PurchaseTab } from "@/lib/purchases/purchase-progress";
import { purchasesExportHref } from "@/lib/purchases/purchases-csv";
import { parsePurchasesListQuery, purchasesInView } from "@/lib/purchases/purchases-list";
import type { PurchasesVm } from "@/lib/purchases/purchases.vm";
import { Button, ExportSheet } from "@auction/ui/lax";
import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

/** Export on Purchases: the shared sheet, following the view and filters on screen. */
export function PurchasesExportButton({
  vm,
  fallbackView,
}: {
  vm: PurchasesVm;
  fallbackView: PurchaseTab;
}) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const query = parsePurchasesListQuery(Object.fromEntries(params.entries()), fallbackView);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <Button
        icon={<Download aria-hidden />}
        onClick={() => setOpen(true)}
        className="max-md:hidden"
      >
        Export
      </Button>
      <ExportSheet<"csv">
        open={open}
        onOpenChange={setOpen}
        subject="purchases"
        viewCount={purchasesInView(vm.cardsByTab[query.view], query).length}
        defaultFormat="csv"
        period={{ from: `${today.slice(0, 4)}-01-01`, to: today }}
        formats={[
          {
            value: "csv",
            label: "Spreadsheet (CSV)",
            description: "Opens in Excel and Numbers, with who won each lot and when it is due.",
          },
        ]}
        onExport={(request) => {
          window.location.assign(purchasesExportHref(query, request));
        }}
      />
    </>
  );
}
