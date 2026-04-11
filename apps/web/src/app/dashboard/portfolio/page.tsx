export default function DashboardPortfolioPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="mb-4 font-headline text-4xl tracking-tight">Private collection</h1>
      <p className="mb-12 font-body text-on-surface-variant">
        Portfolio views mirror the Stitch reference; wiring to won lots and receipts will connect
        here.
      </p>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="aspect-[4/5] bg-surface-container-low" />
        <div className="aspect-[4/5] bg-surface-container-high" />
      </div>
    </div>
  );
}
