import { ArtEditorialHeader } from "@/components/editorial/art-editorial-header";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { EditorialBlockRenderer } from "@/components/editorial/editorial-block-renderer";
import { artServices } from "@/lib/art-services.server";
import { composePreviewPage } from "@/lib/editorial/editorial-pages.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Draft preview | lax.art",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

type PreviewPageProps = {
  params: Promise<{ token: string }>;
};

export default async function EditorialPreviewPage({ params }: PreviewPageProps) {
  const { token } = await params;
  const result = await composePreviewPage(artServices, token);

  // A wrong or expired link is a 404, shown by this segment's not-found page.
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return (
      <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
        <ArtEditorialStatus
          result={result}
          disabledTitle="Preview unavailable"
          disabledDescription="Editorial preview is not enabled in this environment yet."
          emptyTitle="Preview unavailable"
          emptyDescription="This preview has no content to show."
        />
      </div>
    );
  }

  const { preview, body } = result.data;
  return (
    <article className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-8 py-10")}>
      <Alert variant="warning">
        <AlertDescription>
          Draft preview — this content is not published. The link expires 15 minutes after it was
          issued.
        </AlertDescription>
      </Alert>
      <ArtEditorialHeader
        title={preview.title}
        standfirst={preview.summary}
        coverUrl={preview.coverUrl}
      />
      <EditorialBlockRenderer body={body} className="max-w-3xl" />
    </article>
  );
}
