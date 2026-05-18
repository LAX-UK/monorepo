import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

type SettingsWelcomeProps = {
  displayName: string;
  email: string;
};

export function SettingsWelcome({ displayName, email }: SettingsWelcomeProps) {
  return (
    <Surface variant="section" padding="md" className="space-y-4">
      <div>
        <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
          Settings
        </p>
        <h1 className="font-headline text-2xl font-semibold tracking-tight text-on-surface">
          Hello, {displayName}
        </h1>
        <p className="mt-1 font-body text-sm text-on-surface-variant">{email}</p>
      </div>
      <p className="font-body text-sm text-on-surface-variant">
        Use the navigation to update your profile, security, and bidding preferences. On mobile,
        open the menu above to jump between sections.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/settings/profile">Edit profile</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/settings/security">Security</Link>
        </Button>
      </div>
    </Surface>
  );
}
