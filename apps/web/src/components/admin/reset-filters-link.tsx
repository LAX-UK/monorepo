import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  active: boolean;
  href: string;
};

export function ResetFiltersLink({ active, href }: Props) {
  if (!active) return null;
  return (
    <Button
      variant="ghost"
      asChild
      className="min-h-11 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary"
    >
      <Link href={href}>Reset filters</Link>
    </Button>
  );
}
