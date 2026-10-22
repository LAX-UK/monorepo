import { Button } from "@auction/ui";

export function AdminAccountMenu({ roleLabel }: { roleLabel: string }) {
  return (
    <div className="flex flex-col gap-3 px-3">
      <p className="text-sm text-on-surface-variant">
        Signed in as <span className="font-medium text-on-surface">{roleLabel}</span>
      </p>
      <form action="/api/auth/logout" method="post">
        <Button type="submit" variant="outline" size="md" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
