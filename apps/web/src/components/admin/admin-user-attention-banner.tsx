import type { UserAttentionItem } from "@/lib/admin/admin-user-readiness.vm";
import { cn } from "@auction/ui";
import { AlertTriangle, Info } from "lucide-react";
import Link from "next/link";

export type { UserAttentionItem };

function severityIcon(severity: UserAttentionItem["severity"]) {
  if (severity === "critical" || severity === "warning") {
    return <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />;
  }
  return <Info className="size-4 shrink-0 text-primary" aria-hidden />;
}

function severityBorder(severity: UserAttentionItem["severity"]): string {
  if (severity === "critical") return "border-live-red/40 bg-live-red/5";
  if (severity === "warning") return "border-warning/40 bg-warning-container/20";
  return "border-primary/25 bg-primary-container/15";
}

export function AdminUserAttentionBanner({
  items,
  className,
}: {
  items: readonly UserAttentionItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <aside
      className={cn(
        "mb-6 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3",
        className,
      )}
      aria-label="Client needs attention"
    >
      <p className="mb-2 font-label text-xs font-semibold uppercase tracking-widest text-secondary">
        Needs attention
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
              severityBorder(item.severity),
            )}
          >
            {severityIcon(item.severity)}
            <Link
              href={item.href}
              className="font-body text-on-surface underline-offset-2 hover:underline"
            >
              {item.message}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
