import type { LotDetailContext } from "@/lib/admin/lot-detail-context";
import { Badge } from "@auction/ui";
import Link from "next/link";

type Props = {
  context: LotDetailContext;
};

export function LotDetailAsideLinks({ context }: Props) {
  return (
    <>
      {context.sale ? (
        <div>
          <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Sale
          </p>
          <Link
            href={`/admin/sales/${context.sale.id}`}
            className="mt-1 inline-block text-primary underline-offset-4 hover:underline"
          >
            {context.sale.title}
          </Link>
        </div>
      ) : null}
      {context.artist ? (
        <div>
          <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Artist
          </p>
          <Link
            href={`/admin/artists/${context.artist.id}`}
            className="mt-1 inline-block text-primary underline-offset-4 hover:underline"
          >
            {context.artist.displayName}
          </Link>
        </div>
      ) : null}
      {context.seller ? (
        <div>
          <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Seller
          </p>
          <Link
            href={`/admin/legal-entities/${context.seller.id}`}
            className="mt-1 inline-block text-primary underline-offset-4 hover:underline"
          >
            {context.seller.displayName}
          </Link>
        </div>
      ) : null}
      {context.categories.length > 0 ? (
        <div>
          <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Categories
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {context.categories.map((cat) => (
              <Link key={cat.id} href={`/admin/categories/${cat.id}`}>
                <Badge variant="secondary">{cat.name}</Badge>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
