"use client";

import {
  revokeShopStaffAccessAction,
  setShopStaffRoleAction,
} from "@/lib/admin/people/staff-access.actions";
import { notify } from "@/lib/ui/notify";
import { laxStaffPlatform } from "@auction/types";
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

const SHOP_ROLES = laxStaffPlatform("shop").roles;

export function ShopStaffAccessControl({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: string | null;
}) {
  const [role, setRole] = useState(currentRole ?? "");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const summary = SHOP_ROLES.find((r) => r.value === role)?.summary;

  const run = (action: () => ReturnType<typeof setShopStaffRoleAction>, success: string) => {
    startTransition(() => {
      void (async () => {
        const result = await action();
        if (result.ok) {
          notify.success(success);
          router.refresh();
          return;
        }
        notify.error(result.error);
      })();
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select value={role} onValueChange={setRole} disabled={pending}>
          <SelectTrigger
            className="min-h-11 w-full font-body text-sm sm:flex-1"
            aria-label="Shop role"
          >
            <SelectValue placeholder="Choose a Shop role" />
          </SelectTrigger>
          <SelectContent>
            {SHOP_ROLES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          disabled={pending || !role || role === currentRole}
          className="min-h-11 w-full sm:w-auto"
          onClick={() =>
            run(
              () => setShopStaffRoleAction(userId, role),
              "Shop access requested. It shows here once Shop applies it.",
            )
          }
        >
          {currentRole ? "Change Shop role" : "Give Shop access"}
        </Button>
        {currentRole ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
            onClick={() =>
              run(
                () => revokeShopStaffAccessAction(userId),
                "Removal requested. It shows here once Shop applies it.",
              )
            }
          >
            Remove Shop access
          </Button>
        ) : null}
      </div>
      {summary ? <p className="text-xs text-on-surface-variant">{summary}</p> : null}
    </div>
  );
}
