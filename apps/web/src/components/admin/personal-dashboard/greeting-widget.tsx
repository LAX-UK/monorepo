import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

type Props = {
  name: string;
};

export function GreetingWidget({ name }: Props) {
  const first = name.trim().split(/\s+/)[0] || "there";
  return (
    <Surface variant="card" padding="md" className="space-y-3">
      <h2 className="font-headline text-xl font-semibold text-on-surface">Good day, {first}</h2>
      <p className="font-body text-sm text-on-surface-variant">
        Your personal cockpit — queue, trends, and saleroom pulse in one place.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/lots/new"
          className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 py-2 font-label text-xs font-semibold text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          New lot
        </Link>
        <Link
          href="/admin/submissions"
          className="inline-flex min-h-9 items-center rounded-md border border-outline-variant px-3 py-2 font-label text-xs font-semibold text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Submissions
        </Link>
      </div>
    </Surface>
  );
}
