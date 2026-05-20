"use client";

import { adminSetUserStaffRoleResultAction } from "@/lib/actions/admin";
import { Can } from "@/lib/auth/capabilities";
import { notify } from "@/lib/ui/notify";
import { type UserStaffRole, userStaffRoles } from "@auction/types";
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

const staffSelectValues = ["__none__", ...userStaffRoles] as const;
type StaffSelectValue = (typeof staffSelectValues)[number];

export type UserStaffRoleActionProps = {
  userId: string;
  defaultStaffRole: string | null;
};

/** LAX internal role when the user's top-level role is administrator or accountant. */
export function UserStaffRoleAction({ userId, defaultStaffRole }: UserStaffRoleActionProps) {
  const initial: StaffSelectValue =
    defaultStaffRole && userStaffRoles.includes(defaultStaffRole as UserStaffRole)
      ? (defaultStaffRole as UserStaffRole)
      : "__none__";
  const [staff, setStaff] = useState<StaffSelectValue>(initial);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const runSave = () => {
    startTransition(() => {
      void (async () => {
        const staffRole = staff === "__none__" ? null : (staff as UserStaffRole);
        const r = await adminSetUserStaffRoleResultAction(userId, { staffRole });
        if (r.ok) {
          notify.success("Staff role updated");
          router.refresh();
          return;
        }
        notify.error(r.error);
      })();
    });
  };

  return (
    <Can requirement="platform.admin.full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select
          value={staff}
          onValueChange={(v) => setStaff(v as StaffSelectValue)}
          disabled={pending}
        >
          <SelectTrigger
            className="min-h-11 w-full font-body text-sm sm:flex-1"
            aria-label="Internal staff role"
          >
            <SelectValue placeholder="Staff role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Default (legacy full)</SelectItem>
            {userStaffRoles.map((r) => (
              <SelectItem key={r} value={r}>
                {r.replace(/_/g, " ")}
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
          Save staff role
        </Button>
      </div>
    </Can>
  );
}
