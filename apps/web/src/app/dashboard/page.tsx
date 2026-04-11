import { getServerAuctionReader } from "@/lib/data/http/auctions.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { formatMoney } from "@/lib/format-currency";

export default async function DashboardHomePage() {
  const user = await getServerSessionUser();
  const reader = await getServerAuctionReader();
  const active = await reader.list({ status: "active", limit: 6 });

  return (
    <div className="max-w-[1920px]">
      <section className="mb-16">
        <h1 className="mb-4 font-headline text-5xl tracking-tight text-on-surface md:text-6xl">
          Welcome back, curator.
        </h1>
        <p className="font-label text-sm uppercase tracking-[0.2em] text-secondary">
          Session {user?.id.slice(0, 8)}… • {active.length} live lots in view
        </p>
      </section>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="font-headline text-2xl">Live inventory</h2>
            <span className="border-b border-primary-container pb-1 font-label text-[0.6875rem] uppercase tracking-widest text-primary">
              Pulled from API
            </span>
          </div>
          <div className="space-y-12">
            {active.length === 0 ? (
              <p className="text-secondary">No active auctions right now.</p>
            ) : (
              active.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-6 border-b border-outline-variant/10 pb-12 last:border-0 md:flex-row md:items-center"
                >
                  <div className="h-32 w-full flex-shrink-0 bg-surface-container-low md:w-48" />
                  <div className="flex flex-1 flex-col justify-center space-y-2">
                    <span className="font-label text-[0.65rem] uppercase tracking-[0.4em] text-secondary">
                      Lot
                    </span>
                    <h3 className="font-headline text-3xl font-light">{a.title}</h3>
                    <p className="font-label text-[10px] uppercase tracking-widest text-primary">
                      Current {formatMoney(a.currentPrice)}
                    </p>
                  </div>
                  <div className="text-right font-headline text-2xl text-on-surface">
                    {formatMoney(a.currentPrice)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="lg:col-span-4">
          <div className="bg-surface-container-low p-8">
            <h3 className="mb-4 font-headline text-xl">Account</h3>
            <p className="font-body text-sm text-secondary">Role: {user?.role ?? "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
