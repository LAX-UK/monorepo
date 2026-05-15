import { AdminListPage } from "@/components/admin/admin-list-page";
import { WithdrawalApproveButton } from "@/components/admin/withdrawal-approve-button";
import { getLotWithdrawalRequests } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import Link from "next/link";

export default async function AdminLotsWithdrawalsPage() {
  let tasks: Awaited<ReturnType<typeof getLotWithdrawalRequests>> = [];
  let loadError: string | null = null;

  try {
    tasks = await getLotWithdrawalRequests();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load withdrawal requests.";
  }

  return (
    <AdminListPage
      title="Withdrawal requests"
      description="Seller-initiated lot withdrawal requests awaiting staff approval."
      hasFilters={false}
      resetHref="/admin/lots/withdrawals"
      errorAlert={
        loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load requests</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null
      }
      filters={null}
      view={
        tasks.length === 0 ? null : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-outline-variant/20 bg-surface-container-low/30 p-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-label text-[10px] uppercase tracking-widest text-secondary">
                    {task.kind.replaceAll("_", " ")}
                  </p>
                  {task.targetLotId ? (
                    <Link
                      href={`/admin/lots/${task.targetLotId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      Lot {task.targetLotId.slice(0, 8)}… ↗
                    </Link>
                  ) : (
                    <span className="text-sm text-on-surface-variant">No lot ID</span>
                  )}
                  <p className="font-body text-xs text-on-surface-variant">
                    Submitted: {task.createdAt.toLocaleString()}
                  </p>
                  {Object.keys(task.payload).length > 0 ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-label text-[10px] uppercase tracking-widest text-secondary hover:text-on-surface">
                        Payload
                      </summary>
                      <pre className="mt-2 overflow-auto rounded bg-surface-container-high p-2 font-mono text-xs text-on-surface-variant">
                        {JSON.stringify(task.payload, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {task.targetLotId ? <WithdrawalApproveButton lotId={task.targetLotId} /> : null}
                </div>
              </div>
            ))}
          </div>
        )
      }
      empty={
        !loadError && tasks.length === 0 ? (
          <EmptyState
            title="No withdrawal requests"
            description="Seller-initiated withdrawal requests will appear here when submitted."
          />
        ) : null
      }
      pagination={null}
    />
  );
}
