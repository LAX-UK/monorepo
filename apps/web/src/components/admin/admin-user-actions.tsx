"use client";

import {
  adminSetUserRoleResultAction,
  adminSuspendUserResultAction,
  adminUnsuspendUserResultAction,
} from "@/lib/actions/admin";
import { userRoles, type UserRole } from "@auction/types";
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
import { toast } from "sonner";

const roleOptions: UserRole[] = [...userRoles];

type RoleLayout = "row" | "block";

type UserRoleActionProps = {
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
          toast.success("Role updated");
          router.refresh();
          return;
        }
        toast.error(r.error);
      })();
    });
  };

  if (layout === "block") {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select
          value={role}
          onValueChange={(v) => setRole(v as UserRole)}
          disabled={pending}
        >
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
    );
  }

  return (
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
        className="h-auto min-h-11 px-0 py-0 font-label text-[10px] uppercase tracking-widest text-primary underline-offset-2 hover:underline disabled:opacity-50"
        onClick={runSave}
      >
        Save
      </Button>
    </div>
  );
}

type UserSuspendActionProps = {
  userId: string;
  suspendedAt: string | null;
  fullWidthButton?: boolean;
};

export function UserSuspendAction({
  userId,
  suspendedAt,
  fullWidthButton,
}: UserSuspendActionProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (suspendedAt) {
    return (
      <Button
        type="button"
        variant="secondary"
        className={fullWidthButton ? "min-h-11 w-full" : "min-h-11"}
        disabled={pending}
        onClick={() => {
          startTransition(() => {
            void (async () => {
              const r = await adminUnsuspendUserResultAction(userId);
              if (r.ok) {
                toast.success("Unsuspended");
                router.refresh();
                return;
              }
              toast.error(r.error);
            })();
          });
        }}
      >
        {fullWidthButton ? "Unsuspend account" : "Unsuspend"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      className={fullWidthButton ? "min-h-11 w-full text-error" : "min-h-11 text-error"}
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          void (async () => {
            const r = await adminSuspendUserResultAction(userId, { reason: "Admin action" });
            if (r.ok) {
              toast.success("Suspended");
              router.refresh();
              return;
            }
            toast.error(r.error);
          })();
        });
      }}
    >
      {fullWidthButton ? "Suspend account" : "Suspend"}
    </Button>
  );
}
