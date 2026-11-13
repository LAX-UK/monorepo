import type { PayoutDetailVm, PayoutLineVm } from "@/lib/seller/payout-detail.vm";
import type { SellerChargeVm } from "@/lib/seller/seller-commission.vm";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { StatusBadge } from "@auction/ui/lax/status-badge";
import { pageTitleClass } from "@auction/ui/lax/styles";
import { Download } from "lucide-react";

const CELL = "px-4 py-3 text-lax-14 md:px-5";
const FIGURE = `${CELL} text-right tabular-nums text-lax-fg`;

/** A charge and, under it, its rate ("15%"), or "No VAT" when none was charged. */
function Charge({ charge, noVat = false }: { charge: SellerChargeVm | null; noVat?: boolean }) {
  if (!charge) return <span className="text-lax-muted">—</span>;
  const under = charge.rate ?? (noVat ? "No VAT" : null);
  return (
    <>
      <Amount>{charge.amount}</Amount>
      {under ? <span className="block text-lax-13 text-lax-muted">{under}</span> : null}
    </>
  );
}

/** An amount kept whole on its line: a minus sign never ends one line and its figure the next. */
function Amount({ children }: { children: string }) {
  return <span className="whitespace-nowrap">{children}</span>;
}

/** Facts with "·" between them, each a label and an amount kept whole. */
type Fact = readonly [label: string, amount: string] | string;

function Facts({ items }: { items: readonly (Fact | null)[] }) {
  const shown = items.filter((item): item is Fact => item !== null && item !== "");
  return (
    <>
      {shown.map((item, index) => (
        <span key={typeof item === "string" ? item : item[0]}>
          {index > 0 ? " · " : null}
          {typeof item === "string" ? (
            item
          ) : (
            <>
              {item[0]} <Amount>{item[1]}</Amount>
            </>
          )}
        </span>
      ))}
    </>
  );
}

/** A sale on a phone: its split as one line of facts, each charge with its rate. */
function PhoneFacts({ line }: { line: PayoutLineVm }) {
  const sale = line.sale;
  if (!sale) return <>{line.lot ?? ""}</>;
  const rated = (label: string, charge: SellerChargeVm) =>
    [`${label}${charge.rate ? ` ${charge.rate}` : ""}`, charge.amount] as const;
  return (
    <Facts
      items={[
        line.lot,
        ["hammer", sale.hammer],
        rated("commission", sale.commission),
        sale.vat ? (sale.noVat ? "no VAT" : rated("VAT", sale.vat)) : null,
      ]}
    />
  );
}

/**
 * One payout: what was paid and where it is, then each lot with its hammer, the commission and
 * the VAT on it at their rates, and what the seller receives; the totals are the sums of the
 * lines. On a phone each lot is a short block instead of a table row.
 */
export function PayoutDetail({ vm }: { vm: PayoutDetailVm }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className={pageTitleClass} data-page-title="">
              {vm.title}
            </h1>
            <p className="mt-1 text-lax-14 text-lax-muted">{vm.subtitle}</p>
          </div>
          <ButtonLink href={vm.statementHref} icon={<Download aria-hidden />} className="w-fit">
            Download statement (PDF)
          </ButtonLink>
        </div>
      </div>

      <dl className="grid overflow-hidden rounded-lax-card border border-lax-line bg-lax-surface md:grid-cols-3">
        <div className="flex flex-col gap-1 border-b border-lax-line p-5 md:border-r md:border-b-0">
          <dt className="text-lax-13 text-lax-muted">Hammer</dt>
          <dd className="font-lax-display text-lax-24 font-semibold tabular-nums text-lax-fg">
            {vm.totals.hammer}
          </dd>
        </div>
        <div className="flex flex-col gap-1 border-b border-lax-line p-5 md:border-r md:border-b-0">
          <dt className="text-lax-13 text-lax-muted">Commission and VAT</dt>
          <dd className="font-lax-display text-lax-24 font-semibold tabular-nums text-lax-fg">
            {vm.totals.charges}
          </dd>
        </div>
        <div className="flex flex-col gap-2 p-5">
          <dt className="text-lax-13 text-lax-muted">Status</dt>
          <dd className="flex flex-col items-start gap-1">
            <StatusBadge tone={vm.status.tone} shape={vm.status.shape}>
              {vm.status.label}
            </StatusBadge>
            {vm.statusNote ? (
              <span className="text-lax-13 text-lax-muted">{vm.statusNote}</span>
            ) : null}
          </dd>
        </div>
      </dl>

      <section aria-labelledby="payout-lots" className="flex flex-col gap-3">
        <h2
          id="payout-lots"
          className="flex items-baseline gap-2 font-lax-display text-lax-18 font-semibold text-lax-fg"
        >
          In this payout
          <span className="text-lax-14 font-normal text-lax-muted">{vm.lines.length}</span>
        </h2>
        <div className="overflow-hidden rounded-lax-card border border-lax-line bg-lax-surface">
          <table className="w-full max-md:hidden">
            <thead>
              <tr className="border-b border-lax-line text-left text-lax-13 text-lax-muted">
                <th scope="col" className={`${CELL} font-normal`}>
                  Work
                </th>
                <th scope="col" className={`${CELL} font-normal`}>
                  Lot
                </th>
                <th scope="col" className={`${CELL} text-right font-normal`}>
                  Hammer
                </th>
                <th scope="col" className={`${CELL} text-right font-normal`}>
                  Commission
                </th>
                <th scope="col" className={`${CELL} text-right font-normal`}>
                  VAT on commission
                </th>
                <th scope="col" className={`${CELL} text-right font-normal`}>
                  You receive
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lax-line">
              {vm.lines.map((line) => (
                <tr key={line.id}>
                  <td className={`${CELL} text-lax-fg`}>
                    {line.work}
                    {line.note ? (
                      <span className="block text-lax-13 text-lax-muted">{line.note}</span>
                    ) : null}
                  </td>
                  <td className={`${CELL} text-lax-muted`}>{line.lot}</td>
                  <td className={FIGURE}>{line.sale?.hammer}</td>
                  <td className={FIGURE}>
                    {line.sale ? <Charge charge={line.sale.commission} /> : null}
                  </td>
                  <td className={FIGURE}>
                    {line.sale ? <Charge charge={line.sale.vat} noVat={line.sale.noVat} /> : null}
                  </td>
                  <td className={`${FIGURE} font-semibold`}>{line.receive}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-lax-line">
                <th
                  scope="row"
                  colSpan={2}
                  className={`${CELL} text-left font-semibold text-lax-fg`}
                >
                  Total
                </th>
                <td className={`${FIGURE} font-semibold`}>{vm.totals.hammer}</td>
                <td className={`${FIGURE} font-semibold`}>{vm.totals.commission}</td>
                <td className={`${FIGURE} font-semibold`}>{vm.totals.vat}</td>
                <td className={`${FIGURE} font-semibold`}>{vm.totals.receive}</td>
              </tr>
            </tfoot>
          </table>
          <ul className="divide-y divide-lax-line md:hidden">
            {vm.lines.map((line) => (
              <li key={line.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 text-lax-14 font-medium text-lax-fg">{line.work}</p>
                  <p className="shrink-0 text-lax-14 font-semibold tabular-nums text-lax-fg">
                    {line.receive}
                  </p>
                </div>
                {line.sale ? (
                  <p className="text-lax-13 text-lax-muted">
                    <PhoneFacts line={line} />
                  </p>
                ) : null}
                {line.note ? <p className="text-lax-13 text-lax-muted">{line.note}</p> : null}
              </li>
            ))}
            <li className="flex flex-col gap-1 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-lax-14 font-semibold text-lax-fg">Total</p>
                <p className="text-lax-14 font-semibold tabular-nums text-lax-fg">
                  {vm.totals.receive}
                </p>
              </div>
              <p className="text-lax-13 text-lax-muted">
                <Facts
                  items={[
                    ["hammer", vm.totals.hammer],
                    ["commission", vm.totals.commission],
                    ["VAT", vm.totals.vat],
                  ]}
                />
              </p>
            </li>
          </ul>
        </div>
        {vm.notes.map((note) => (
          <p key={note} className="text-lax-13 text-lax-muted">
            {note}
          </p>
        ))}
      </section>
    </div>
  );
}
