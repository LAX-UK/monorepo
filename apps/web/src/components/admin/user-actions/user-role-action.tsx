"use client";

import { adminSetUserRoleResultAction } from "@/lib/actions/admin";
import { Can } from "@/lib/auth/capabilities";
import { notify } from "@/lib/ui/notify";
import { type UserRole, userRoles } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const roleOptions: UserRole[] = [...userRoles];

type RoleLayout = "row" | "block";

export type UserRoleActionProps = {
  userId: string;
  defaultRole: UserRole;
  layout?: RoleLayout;
};

export function UserRoleAction({ userId, defaultRole, layout = "row" }: UserRoleActionProps) {
  const [role, setRole] = useState<UserRole>(defaultRole);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const runSave = () => {
    startTransition(() => {
      void (async () => {
        const r = await adminSetUserRoleResultAction(userId, { role });
        if (r.ok) {
          notify.success("Role updated");
          router.refresh();
          return;
        }
        notify.error(r.error);
      })();
    });
  };

  const form =
    layout === "block" ? (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select value={role} onValueChange={(v) => setRole(v as UserRole)} disabled={pending}>
          <SelectTrigger
            className="min-h-11 w-full font-body text-sm sm:flex-1"
            aria-label="User role"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleOptions.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          disabled={pending}
          className="min-h-11 w-full sm:w-auto"
          onClick={runSave}
        >
          Save role
        </Button>
      </div>
    ) : (
      <div className="flex flex-wrap items-center gap-2">
        <Select value={role} onValueChange={(v) => setRole(v as UserRole)} disabled={pending}>
          <SelectTrigger
            className="h-auto min-h-11 w-[min(100%,11rem)] px-2 py-1 font-body text-xs"
            aria-label="User role"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleOptions.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="link"
          disabled={pending}
          className="h-auto min-h-11 px-0 py-0 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary underline-offset-2 hover:underline disabled:opacity-50"
          onClick={runSave}
        >
          Save
        </Button>
      </div>
    );

  return <Can requirement="platform.admin.full">{form}</Can>;
}
