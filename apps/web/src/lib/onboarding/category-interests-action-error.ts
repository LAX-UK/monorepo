import { DashboardFetchError } from "@/lib/dashboard/dashboard-fetch-errors";
import { categoryInterestsPutSchema } from "@auction/validators";

export function parseCategoryInterestIds(formData: FormData): string[] | { error: string } {
  const parsed = categoryInterestsPutSchema.safeParse({
    categoryIds: formData
      .getAll("categoryId")
      .map(String)
      .filter((id) => id.length > 0),
  });
  if (!parsed.success) {
    return { error: "Choose valid categories and try again." };
  }
  return parsed.data.categoryIds;
}

export function describeCategoryInterestsSaveError(error: unknown, fallback: string): string {
  if (error instanceof DashboardFetchError) {
    if (error.detail.status === 403) {
      return "Auction interests are only available for individual buyer accounts.";
    }
    if (error.detail.status === 422) {
      return "Some of those categories are no longer available. Refresh and try again.";
    }
    if (error.detail.status === 401) {
      return "Your session expired. Sign in again and retry.";
    }
  }
  return fallback;
}
