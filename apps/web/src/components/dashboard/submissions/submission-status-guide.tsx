import { SELLER_SUBMISSION_STATUS_LABELS } from "@/lib/marketing/sell-flow-copy";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

const GUIDE_ITEMS = [
  {
    status: "submitted" as const,
    hint: "Our specialists will start review within 24 hours.",
  },
  {
    status: "approved" as const,
    hint: "Accepted — we are preparing your catalogue entry. Complete Connect when prompted.",
  },
  {
    status: "converted" as const,
    hint: "Draft lot created — finish checklist items in your submission detail.",
  },
] as const;

/** Compact status glossary for the submissions list. */
export function SubmissionStatusGuide() {
  return (
    <Surface variant="inset" padding="sm" className="border-border-hairline">
      <p className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
        Status guide
      </p>
      <ul className="mt-3 space-y-2">
        {GUIDE_ITEMS.map(({ status, hint }) => (
          <li key={status} className="font-body text-sm text-on-surface-variant">
            <span className="font-medium text-on-surface">
              {SELLER_SUBMISSION_STATUS_LABELS[status]}
            </span>
            {" — "}
            {hint}
          </li>
        ))}
      </ul>
      <p className="mt-3 font-body text-xs text-on-surface-variant">
        Full policy in{" "}
        <Link href="/sell" className="text-primary underline-offset-4 hover:underline">
          Selling with LAX
        </Link>
        .
      </p>
    </Surface>
  );
}
