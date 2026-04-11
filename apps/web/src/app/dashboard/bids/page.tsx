export default function DashboardBidsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 font-headline text-4xl tracking-tight">Active bids</h1>
      <p className="mb-10 font-body text-on-surface-variant">
        Track live positions once bid history endpoints are available. For now, browse{" "}
        <a className="text-primary underline" href="/">
          live lots
        </a>{" "}
        and place bids on artwork pages.
      </p>
      <div className="border border-outline-variant/15 bg-surface-container-lowest p-8">
        <p className="font-label text-[10px] uppercase tracking-widest text-secondary">
          Coming soon
        </p>
        <p className="mt-2 font-headline text-xl">Bid ledger</p>
      </div>
    </div>
  );
}
