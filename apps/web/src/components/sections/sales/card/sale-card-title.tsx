import type { SaleCardTitleProps } from "@/components/sections/sales/card/types";
import { cn } from "@auction/ui";
import Link from "next/link";

export function SaleCardTitle(props: SaleCardTitleProps) {
  const { title, className } = props;

  const titleClass = cn(
    "min-w-0 max-w-full break-words font-body text-base font-semibold leading-snug text-on-surface underline-offset-2 transition-colors sm:text-lg sm:leading-6",
    "href" in props && "hover:underline",
    className,
  );

  if (!("href" in props)) {
    return <span className={titleClass}>{title}</span>;
  }

  return (
    <Link href={props.href} className={titleClass}>
      {title}
    </Link>
  );
}
