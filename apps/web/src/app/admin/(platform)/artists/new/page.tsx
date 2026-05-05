import { AdminArtistForm } from "@/components/admin/admin-artist-form";
import { getAdminUserList } from "@/lib/data/http/admin.server";
import { Card, CardContent } from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";

export default async function NewAdminArtistPage() {
  const users = await getAdminUserList({ limit: 100 });

  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="New artist"
        description="Create a canonical artist profile that can be linked to a client and assigned to lots."
      />
      <Card>
        <CardContent className="pt-6">
          <AdminArtistForm
            mode="create"
            users={users.rows}
            defaultValues={{
              displayName: "",
              slug: "",
              portraitUrl: "",
              heroImageUrl: "",
              shortBio: "",
              longBio: "",
              statement: "",
              nationality: "",
              location: "",
              birthYear: "",
              deathYear: "",
              websiteUrl: "",
              ownerUserId: null,
              featured: false,
              verified: false,
              archived: false,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
