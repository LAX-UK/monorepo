import { AdminInviteForm } from "@/components/admin/admin-invite-form";
import { Surface } from "@auction/ui/components/surface";

export function AdminInviteCard() {
  return (
    <Surface variant="card" padding="lg" className="border-border-hairline">
      <header className="space-y-1.5">
        <h2 className="font-headline text-lg text-on-surface">Send invite</h2>
        <p className="max-w-prose text-sm text-on-surface-variant">
          Recipients get a secure signup link by email. Invitations expire after 7 days.
        </p>
      </header>
      <div className="mt-4 border-t border-border-hairline pt-5">
        <AdminInviteForm />
      </div>
    </Surface>
  );
}
