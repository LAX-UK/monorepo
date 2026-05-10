import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

type Props = { searchParams: Promise<{ lots?: string }> };

export default async function MultiLotCheckoutPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = (sp.lots ?? "").trim();
  const ids = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="Multi-lot checkout"
        description="Combine hammer settlements when finance enables basket invoicing."
        className="border-0 pb-0"
      />
      {ids.length === 0 ? (
        <Alert>
          <AlertTitle>Add lots via query string</AlertTitle>
          <AlertDescription className="font-body text-sm">
            Example:{" "}
            <code className="rounded bg-surface-container-high px-1 py-0.5 font-mono text-xs">
              /dashboard/checkout?lots=&lt;uuid&gt;,&lt;uuid&gt;
            </code>
            . Single-lot checkout continues to use{" "}
            <Link href="/dashboard/portfolio" className="text-primary underline">
              collection
            </Link>{" "}
            links.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertTitle>{ids.length} lot(s) queued</AlertTitle>
          <AlertDescription className="font-body text-sm">
            Multi-lot basket invoicing is not enabled yet. Complete each lot from its individual
            checkout route (via your collection).
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
