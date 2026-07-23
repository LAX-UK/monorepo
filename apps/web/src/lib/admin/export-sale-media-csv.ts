import { formatCsvDocument } from "@auction/exports";
import type { SaleDayMediaRef } from "@auction/types";

type MediaExportRow = {
  key: string;
  mediaType: "image" | "video";
  caption: string;
  alt: string;
};

const COLUMNS = [
  { key: "key", header: "Storage key" },
  { key: "mediaType", header: "Type" },
  { key: "caption", header: "Caption" },
  { key: "alt", header: "Alt text" },
] as const;

function toExportRow(item: SaleDayMediaRef): MediaExportRow {
  if (item.mediaType === "video") {
    return {
      key: item.key,
      mediaType: "video",
      caption: item.caption ?? "",
      alt: "",
    };
  }
  return {
    key: item.key,
    mediaType: "image",
    caption: item.caption ?? "",
    alt: item.alt ?? "",
  };
}

export function downloadSaleMediaCsv(items: readonly SaleDayMediaRef[], saleTitle: string): void {
  const slug = saleTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `${slug || "sale"}-media.csv`;
  const csv = formatCsvDocument([...COLUMNS], items.map(toExportRow));

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
