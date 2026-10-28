import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";

export default function ArtPreviewNotFound() {
  return (
    <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
      <ArtStatusState
        variant="empty"
        icon="ticket"
        layout="page"
        titleAs="h1"
        title="This preview link has expired or is wrong"
        description="Preview links last 15 minutes. Ask for a new one from LAX Admin."
        actions={<ArtStatusStateLink href="/">Go to lax.art</ArtStatusStateLink>}
      />
    </div>
  );
}
