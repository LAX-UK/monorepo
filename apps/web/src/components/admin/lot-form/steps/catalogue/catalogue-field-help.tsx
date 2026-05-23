"use client";

type Props = {
  text?: string | undefined;
};

export function CatalogueFieldHelp({ text }: Props) {
  if (!text) return null;
  return <p className="mt-2 font-body text-xs text-on-surface-variant">{text}</p>;
}
