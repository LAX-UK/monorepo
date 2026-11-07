import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { Skeleton, pageTitleClass } from "@auction/ui/lax";

/** The Pay page while its plan is read: the title at once, then the lots and the payment. */
export default function PayLoading() {
  return (
    <DashboardPage>
      <output aria-label="Working out your payment" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className={pageTitleClass}>Pay</h1>
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="h-56 rounded-lax-card" />
          <Skeleton className="h-72 rounded-lax-card" />
        </div>
      </output>
    </DashboardPage>
  );
}
