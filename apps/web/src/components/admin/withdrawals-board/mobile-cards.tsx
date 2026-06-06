"use client";

import type { LotWithdrawalRequestTask } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui";

type Props = {
  tasks: LotWithdrawalRequestTask[];
  onOpen: (task: LotWithdrawalRequestTask) => void;
};

export function WithdrawalsMobileCards({ tasks, onOpen }: Props) {
  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="rounded-sm border border-border-hairline bg-surface-container-lowest/80 p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-label text-[10px] uppercase tracking-wide text-secondary">
              {task.kind.replaceAll("_", " ")}
            </p>
            <span className="text-xs text-on-surface-variant">
              {task.status.replaceAll("_", " ")}
            </span>
          </div>
          <p className="mt-2 text-sm text-on-surface-variant">
            Submitted {formatDateTime(task.createdAt)}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3 min-h-11 w-full"
            onClick={() => onOpen(task)}
          >
            Review request
          </Button>
        </li>
      ))}
    </ul>
  );
}
