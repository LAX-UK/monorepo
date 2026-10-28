import type { ChecklistRollupRowView } from "./consignment-checklist-rollup-view";
import type { SellerAttentionItem } from "./seller-attention";

/** What a task is about; the list shows a matching icon. */
export type NeedsYouKind =
  | "agreement"
  | "identity"
  | "payouts"
  | "changes"
  | "draft"
  | "rejected"
  | "unsold";

export type NeedsYouItem = {
  id: string;
  kind: NeedsYouKind;
  title: string;
  detail: string;
  /** The step to take now; `null` while someone else has to act. */
  action: { label: string; href: string; emphasis: "primary" | "secondary" } | null;
};

export type NeedsYouVm = {
  /** "Two things to do before your works can go to sale." */
  summary: string;
  items: NeedsYouItem[];
};

/** Each attention task's kind and button, keyed by its id's first part. */
const ATTENTION_TASKS: Record<string, { kind: NeedsYouKind; action: string }> = {
  changes: { kind: "changes", action: "Edit submission" },
  draft: { kind: "draft", action: "Finish draft" },
  drafts: { kind: "draft", action: "See drafts" },
  identity: { kind: "identity", action: "Verify identity" },
  "payout-setup": { kind: "payouts", action: "Set up payouts" },
  rejected: { kind: "rejected", action: "Submit again" },
  unsold: { kind: "unsold", action: "Choose next step" },
};

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

function summaryFor(items: readonly NeedsYouItem[]): string {
  const count = NUMBER_WORDS[items.length] ?? String(items.length);
  const things = items.length === 1 ? "thing" : "things";
  const beforeSale = items.every((item) => item.kind !== "unsold" && item.kind !== "rejected");
  return beforeSale
    ? `${count} ${things} to do before your works can go to sale.`
    : `${count} ${things} to do.`;
}

function fromChecklist(row: ChecklistRollupRowView): Omit<NeedsYouItem, "action"> & {
  action: { label: string; href: string } | null;
} {
  return {
    id: `checklist:${row.id}`,
    kind: row.id,
    title: row.title,
    detail: `${row.concerns} · ${(row.waiting ?? row.due).replace(/^./, (c) => c.toLowerCase())}`,
    action: row.action,
  };
}

function fromAttention(item: SellerAttentionItem) {
  const task = ATTENTION_TASKS[item.id.split(":")[0] ?? ""] ?? {
    kind: "draft" as const,
    action: "Open",
  };
  return {
    id: `attention:${item.id}`,
    kind: task.kind,
    title: item.title,
    detail: item.detail,
    action: { label: task.action, href: item.href },
  };
}

/**
 * "Needs you" on Selling: the checklist items still open across consignments, then the other
 * tasks (changes asked for, drafts, unsold lots). The first step the person can take is the
 * primary button; the rest are quieter.
 */
export function buildSellingNeedsYou(input: {
  checklist: readonly ChecklistRollupRowView[];
  attention: readonly SellerAttentionItem[];
}): NeedsYouVm | null {
  const merged = [...input.checklist.map(fromChecklist), ...input.attention.map(fromAttention)];
  if (merged.length === 0) return null;
  const firstAction = merged.findIndex((item) => item.action);
  const items: NeedsYouItem[] = merged.map((item, index) => ({
    ...item,
    action: item.action
      ? { ...item.action, emphasis: index === firstAction ? "primary" : "secondary" }
      : null,
  }));
  return { summary: summaryFor(items), items };
}
