import { PageSkeleton } from "@auction/ui/components/page-skeleton";

export default function CheckoutLoading() {
  return (
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] px-4 py-10">
      <PageSkeleton variant="grid" />
    </div>
  );
}
