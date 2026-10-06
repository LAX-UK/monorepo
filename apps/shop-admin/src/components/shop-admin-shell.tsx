import Link from "next/link";
import type { ReactNode } from "react";

export type AdminNavItem = {
  href: string;
  label: string;
  enabled?: boolean;
};

export function ShopAdminShell({
  nav,
  children,
}: {
  nav: AdminNavItem[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-surface text-on-surface">
      <aside className="w-64 shrink-0 border-r border-outline-variant bg-surface-container-low p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          LAX Shop Admin
        </p>
        <nav className="flex flex-col gap-1 text-sm">
          {nav
            .filter((item) => item.enabled !== false)
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 hover:bg-surface-container"
              >
                {item.label}
              </Link>
            ))}
        </nav>
        <form action="/api/auth/logout" method="post" className="mt-8">
          <button type="submit" className="text-sm text-on-surface-variant underline">
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

export function AdminTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: string[][];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-on-surface-variant">No rows yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-outline-variant">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-surface-container-low">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("|")} className="border-t border-outline-variant">
              {row.map((cell) => (
                <td key={`${row.join("|")}-${cell}`} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
