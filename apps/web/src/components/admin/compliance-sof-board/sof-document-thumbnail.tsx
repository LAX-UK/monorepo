"use client";

import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import { isImageFileName } from "@/lib/upload-limits";
import Image from "next/image";
import { useState } from "react";

type Props = {
  doc: AdminSourceOfFundsDetail["submittedDocuments"][number];
  downloadUrl: string | null;
};

/** Staff-side image thumbnail using a short-TTL presigned URL from case detail. */
export function SofDocumentThumbnail({ doc, downloadUrl }: Props) {
  const [failed, setFailed] = useState(false);
  const fileName = doc.fileName ?? doc.label ?? "";
  if (!downloadUrl || !isImageFileName(fileName) || failed) return null;

  return (
    <div className="relative mt-2 h-20 w-28 overflow-hidden rounded border border-border-hairline bg-surface-container-low">
      <Image
        src={downloadUrl}
        alt={fileName || doc.requestedType}
        fill
        unoptimized
        className="object-contain p-1"
        sizes="112px"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
