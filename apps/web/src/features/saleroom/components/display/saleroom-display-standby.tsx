"use client";

import { salePath } from "@/lib/seo/url";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

type Props = {
  saleId: string;
  saleTitle: string;
  coverImageUrl: string | null;
  headline: string;
  subline: string;
};

export function SaleroomDisplayStandby({
  saleId,
  saleTitle,
  coverImageUrl,
  headline,
  subline,
}: Props) {
  const [catalogUrl, setCatalogUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setCatalogUrl(`${window.location.origin}${salePath({ id: saleId, title: saleTitle })}`);
  }, [saleId, saleTitle]);

  return (
    <div className="relative flex w-full max-w-4xl flex-col items-center text-center">
      {coverImageUrl ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl opacity-30"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImageUrl}
            alt=""
            className="h-full w-full scale-110 object-cover blur-2xl"
          />
        </div>
      ) : null}

      <p className="text-5xl font-light tracking-tight text-white/85 md:text-6xl">{headline}</p>
      <p className="mt-4 max-w-xl text-xl text-white/50">{subline}</p>

      {catalogUrl ? (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-neutral-900/70 px-8 py-6">
          <p className="text-sm uppercase tracking-[0.2em] text-white/50">Bid online</p>
          <div className="rounded-xl bg-white p-3 dark:bg-white">
            <QRCodeSVG value={catalogUrl} size={160} level="M" />
          </div>
          <p className="max-w-xs text-sm text-white/40">Scan to view the catalogue and register</p>
        </div>
      ) : null}
    </div>
  );
}
