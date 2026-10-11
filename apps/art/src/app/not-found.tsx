import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";

export default function ArtNotFound() {
  return (
    <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
      <ArtStatusState
        variant="empty"
        icon="search"
        layout="page"
        titleAs="h1"
        title="Page not found"
        description="This page may have moved, or the work is no longer listed."
        actions={
          <>
            <ArtStatusStateLink href="/artworks" priority="primary">
              Browse artworks
            </ArtStatusStateLink>
            <ArtStatusStateLink href="/search">Search</ArtStatusStateLink>
          </>
        }
      />
    </div>
  );
}
