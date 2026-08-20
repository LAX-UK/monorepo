import type { ExportClientsFilters } from "@auction/validators";
import { requirePlatformAdminAccess } from "./auth.js";
import { summarizeFilters } from "./export-shared.js";
import { mapExportClientsFilters } from "./map-export-clients-filters.js";
import type { IAdminUserReader } from "./ports/admin-user.js";
import type { ExportProvider } from "./types.js";
import { batchedRows } from "./types.js";

export function createClientsProvider(
  adminUserReader: Pick<IAdminUserReader, "list">,
): ExportProvider<ExportClientsFilters> {
  return {
    entityType: "clients",
    authorize(ctx) {
      requirePlatformAdminAccess(ctx);
    },
    columns: () => [
      { key: "id", header: "id" },
      { key: "email", header: "email" },
      { key: "name", header: "name" },
      { key: "role", header: "role" },
      { key: "staffRole", header: "staff_role" },
      { key: "mobile", header: "mobile" },
      { key: "mobileCountry", header: "mobile_country" },
      { key: "emailVerified", header: "email_verified" },
      { key: "emailStatus", header: "email_status" },
      { key: "kycStatus", header: "kyc_status" },
      { key: "kycVerifiedAt", header: "kyc_verified_at" },
      { key: "signupPersona", header: "signup_persona" },
      { key: "suspendedAt", header: "suspended_at" },
      { key: "createdAt", header: "created_at" },
      { key: "updatedAt", header: "updated_at" },
    ],
    async estimateCount(_ctx, filters) {
      const result = await adminUserReader.list(
        mapExportClientsFilters(filters, { limit: 1, offset: 0 }),
      );
      return result.total;
    },
    streamRows(_ctx, filters) {
      return batchedRows(
        async (offset, limit) => {
          const result = await adminUserReader.list(
            mapExportClientsFilters(filters, { offset, limit }),
          );
          return result.rows;
        },
        (u) => ({
          id: u.id,
          email: u.email,
          name: u.name ?? "",
          role: u.role,
          staffRole: u.staffRole ?? "",
          mobile: u.mobile ?? "",
          mobileCountry: u.mobileCountry ?? "",
          emailVerified: u.emailVerified ? "true" : "false",
          emailStatus: u.emailStatus,
          kycStatus: u.kycStatus,
          kycVerifiedAt: u.kycVerifiedAt?.toISOString() ?? "",
          signupPersona: u.signupPersona ?? "",
          suspendedAt: u.suspendedAt?.toISOString() ?? "",
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
        }),
      );
    },
    filterSummary: (_ctx, filters) => summarizeFilters(filters as Record<string, unknown>),
  };
}
