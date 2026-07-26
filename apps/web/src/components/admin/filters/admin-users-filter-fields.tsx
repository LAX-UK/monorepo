"use client";

import {
  AdminFilterDraftDateRange,
  AdminFilterDraftSelect,
  AdminFilterToggleRow,
} from "@/components/admin/filters/admin-filter-draft-fields";
import {
  AdminFilterSection,
  AdminFilterSheetFields,
} from "@/components/admin/filters/admin-filter-section";
import { useAdminFilterDraftContext } from "@/components/admin/filters/admin-filter-sheet-root";
import type { UsersFilterDraft } from "@/lib/admin/filters/users-filter-adapter";
import { signupPersonaFilterOptions } from "@/lib/admin/signup-persona-presenter";

const triStateOptions = [
  { value: "", label: "Any" },
  { value: "1", label: "Yes" },
  { value: "0", label: "No" },
];

export function AdminUsersFilterFields() {
  const { draft, patch } = useAdminFilterDraftContext<UsersFilterDraft>();

  return (
    <AdminFilterSheetFields>
      <AdminFilterDraftSelect
        id="admin-users-filter-status"
        label="Account status"
        value={draft.status}
        onChange={(status) => patch({ status })}
        options={[
          { value: "", label: "Any" },
          { value: "active", label: "Active" },
          { value: "suspended", label: "Suspended" },
        ]}
      />

      <AdminFilterDraftSelect
        id="admin-users-filter-email-verified"
        label="Email verified"
        value={draft.emailVerified}
        onChange={(emailVerified) => patch({ emailVerified })}
        options={triStateOptions}
      />

      <AdminFilterDraftSelect
        id="admin-users-filter-kyc-status"
        label="KYC status"
        value={draft.kycStatus}
        onChange={(kycStatus) => patch({ kycStatus })}
        options={[
          { value: "", label: "Any" },
          { value: "unverified", label: "Unverified" },
          { value: "pending", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
        ]}
      />

      <AdminFilterDraftSelect
        id="admin-users-filter-persona"
        label="Signup persona"
        value={draft.persona}
        onChange={(persona) => patch({ persona })}
        options={[
          { value: "", label: "Any" },
          ...signupPersonaFilterOptions.map(({ value, label }) => ({
            value,
            label,
          })),
        ]}
      />

      <AdminFilterDraftSelect
        id="admin-users-filter-two-factor"
        label="Two-factor auth"
        value={draft.twoFactor}
        onChange={(twoFactor) => patch({ twoFactor })}
        options={triStateOptions}
      />

      <AdminFilterDraftSelect
        id="admin-users-filter-has-mobile"
        label="Mobile on file"
        value={draft.hasMobile}
        onChange={(hasMobile) => patch({ hasMobile })}
        options={triStateOptions}
      />

      <AdminFilterDraftSelect
        id="admin-users-filter-sort"
        label="Sort"
        value={draft.sort}
        onChange={(sort) => patch({ sort })}
        options={[
          { value: "created_desc", label: "Newest first" },
          { value: "created_asc", label: "Oldest first" },
          { value: "name_asc", label: "Name A–Z" },
          { value: "name_desc", label: "Name Z–A" },
          { value: "last_active_desc", label: "Last active" },
          { value: "kyc_status", label: "KYC status" },
        ]}
      />

      <AdminFilterSection label="Flags">
        <AdminFilterToggleRow
          id="admin-users-filter-deletion-requested"
          label="Deletion requested"
          checked={draft.deletionRequested}
          onCheckedChange={(deletionRequested) => patch({ deletionRequested })}
        />
      </AdminFilterSection>

      <AdminFilterSection label="Date ranges">
        <AdminFilterDraftDateRange
          id="admin-users-filter-joined"
          label="Joined"
          value={{ from: draft.createdFrom, to: draft.createdTo }}
          onChange={({ from, to }) => patch({ createdFrom: from, createdTo: to })}
        />
        <AdminFilterDraftDateRange
          id="admin-users-filter-kyc-verified"
          label="KYC verified"
          value={{ from: draft.kycVerifiedFrom, to: draft.kycVerifiedTo }}
          onChange={({ from, to }) => patch({ kycVerifiedFrom: from, kycVerifiedTo: to })}
        />
        <AdminFilterDraftDateRange
          id="admin-users-filter-last-active"
          label="Last active"
          value={{ from: draft.lastActiveFrom, to: draft.lastActiveTo }}
          onChange={({ from, to }) => patch({ lastActiveFrom: from, lastActiveTo: to })}
        />
      </AdminFilterSection>
    </AdminFilterSheetFields>
  );
}
