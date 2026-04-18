import { Button } from "@/components/ui/button";
import { DisplayHeading } from "@/components/ui/typography";
import {
  adminAttachLotToSaleAction,
  adminCancelSaleAction,
  adminDetachLotFromSaleAction,
  adminPublishSaleAction,
} from "@/lib/actions/admin-sales";
import { getAdminLotList, getAdminSaleById } from "@/lib/data/http/admin.server";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminSaleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const bundle = await getAdminSaleById(id);
  if (!bundle) notFound();
  const { sale, lots } = bundle;

  let draftOrphans = await getAdminLotList({ status: "draft", limit: 100, offset: 0 });
  draftOrphans = draftOrphans.filter((l) => l.saleId == null);

  const canEdit = sale.status === "draft";
  const canPublish = sale.status === "draft";
  const canCancel =
    sale.status === "draft" || sale.status === "scheduled" || sale.status === "active";

  return (
    <div className="max-w-4xl space-y-8">
      <Link
        href="/admin/sales"
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Sales
      </Link>
      <DisplayHeading as="h1" className="text-4xl">
        {sale.title}
      </DisplayHeading>
      <p className="font-label text-xs uppercase tracking-widest text-secondary">
        {sale.status} · {lots.length} lot{lots.length === 1 ? "" : "s"}
      </p>
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {canEdit ? (
          <Link
            href={`/admin/sales/${id}/edit`}
            className="font-label text-xs font-bold uppercase tracking-widest text-primary underline"
          >
            Edit draft
          </Link>
        ) : null}
        {canPublish ? (
          <form action={adminPublishSaleAction}>
            <input type="hidden" name="saleId" value={id} />
            <Button type="submit">Publish</Button>
          </form>
        ) : null}
        {canCancel ? (
          <form action={adminCancelSaleAction}>
            <input type="hidden" name="saleId" value={id} />
            <Button type="submit" variant="secondary">
              Cancel sale
            </Button>
          </form>
        ) : null}
        <Link
          href={`/sales/${id}`}
          className="font-label text-xs font-bold uppercase tracking-widest text-primary underline"
        >
          View on site
        </Link>
      </div>

      <div>
        <DisplayHeading as="h2" className="text-2xl">
          Catalog lots
        </DisplayHeading>
        <ul className="mt-4 divide-y divide-outline-variant/15 rounded-xl border border-outline-variant/15">
          {lots.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-headline text-base">{l.title}</p>
                <p className="text-xs text-on-surface-variant">
                  Lot #{l.lotNumber ?? "—"} · {l.status}
                </p>
              </div>
              {canEdit ? (
                <form action={adminDetachLotFromSaleAction}>
                  <input type="hidden" name="saleId" value={id} />
                  <input type="hidden" name="lotId" value={l.id} />
                  <Button type="submit" variant="secondary">
                    Detach
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {canEdit && draftOrphans.length > 0 ? (
        <div>
          <DisplayHeading as="h2" className="text-2xl">
            Attach draft lot
          </DisplayHeading>
          <p className="mt-2 text-sm text-on-surface-variant">
            Standalone draft lots only. After attach, set schedule on the lot if needed.
          </p>
          <ul className="mt-4 space-y-3">
            {draftOrphans.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/15 px-4 py-3"
              >
                <span className="font-body text-sm">{l.title}</span>
                <form action={adminAttachLotToSaleAction}>
                  <input type="hidden" name="saleId" value={id} />
                  <input type="hidden" name="lotId" value={l.id} />
                  <Button type="submit" variant="secondary">
                    Attach
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
