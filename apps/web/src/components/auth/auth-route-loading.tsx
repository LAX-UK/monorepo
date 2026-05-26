/** Route-level loading skeleton for auth pages under the `(task)` shell. */
export function AuthRouteLoading() {
  return (
    <main
      id="main-content"
      className="min-h-[calc(100vh-3.5rem)] bg-page-bg pb-16 pt-8 dark:bg-background sm:pt-12"
    >
      <div className="mx-auto flex w-full max-w-[var(--auth-column,528px)] flex-col items-center gap-8 px-6">
        <div
          data-testid="auth-logo-skeleton"
          className="h-[72px] w-[min(100%,320px)] animate-pulse rounded bg-surface-container-high sm:h-[98px] sm:w-[min(100%,512px)]"
          aria-hidden
        />
        <div className="flex w-full flex-col gap-3">
          <div
            className="mx-auto h-8 w-48 animate-pulse rounded bg-surface-container-high"
            aria-hidden
          />
          <div
            className="mx-auto h-4 w-64 animate-pulse rounded bg-surface-container-high"
            aria-hidden
          />
        </div>
        <div
          className="h-64 w-full animate-pulse rounded-md border border-border-hairline bg-surface-container-high"
          aria-hidden
        />
      </div>
    </main>
  );
}
