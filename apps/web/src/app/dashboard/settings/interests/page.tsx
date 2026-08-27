import { AuctionInterestsSettingsForm } from "@/components/dashboard/auction-interests-settings-form";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import {
  describeDashboardSliceFailure,
  describeSettingsActionError,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerCategoryInterests } from "@/lib/data/http/category-interests.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { redirect } from "next/navigation";

export default async function AuctionInterestsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const saved = sp.saved === "1";

  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings/interests",
  });
  if (user.signupPersona === "organisation") {
    redirect("/dashboard/settings/profile");
  }

  let interests = null;
  let categoryIdBySlug: Record<string, string> | null = null;
  let loadFailure = null;
  try {
    const [reader, state] = await Promise.all([
      getServerCategoryReader(),
      getServerCategoryInterests(),
    ]);
    const categories = await reader.list();
    categoryIdBySlug = Object.fromEntries(
      categories.map((category) => [category.slug, category.id]),
    );
    interests = state;
  } catch (e) {
    loadFailure = describeDashboardSliceFailure(
      e,
      "settings",
      "Could not load your auction interests.",
    );
  }

  return (
    <DashboardPage className="space-y-8">
      <SettingsFormHeader
        title="Auction interests"
        description="Personalise what you see across recommendations and discovery."
      />
      {loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}
      {!loadFailure && saved ? (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>Your auction interests were updated.</AlertDescription>
        </Alert>
      ) : null}
      {!loadFailure && error ? (
        <DashboardSliceErrorAlert failure={describeSettingsActionError(error)} />
      ) : null}
      {!loadFailure && interests && categoryIdBySlug ? (
        <AuctionInterestsSettingsForm
          categoryIdBySlug={categoryIdBySlug}
          initialCategoryIds={interests.categoryIds}
        />
      ) : null}
    </DashboardPage>
  );
}
