import { LaxComponentSheet } from "@/components/admin/kit/lax-component-sheet";
import { isClientKitReviewAvailable } from "@/lib/kit/client-kit-review";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { TooltipProvider } from "@auction/ui/lax";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "LAX system components",
  "The client workspace's elements in every state.",
);

/**
 * The component sheet at the client density, for review without staff access. Development and
 * test runs only: a production build answers 404, and the staff sheet is at /admin/kit.
 */
export default function ClientKitReviewPage() {
  if (!isClientKitReviewAvailable(process.env.NODE_ENV)) notFound();
  return (
    <TooltipProvider>
      <main data-lax-ui="" className="min-h-dvh bg-lax-page px-4 py-8 text-lax-fg md:px-8">
        <div className="mx-auto max-w-[1120px]">
          <LaxComponentSheet densities={["client"]} />
        </div>
      </main>
    </TooltipProvider>
  );
}
