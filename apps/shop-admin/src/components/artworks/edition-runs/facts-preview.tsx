import type { FactsPreview as FactsPreviewModel } from "@/lib/edition-facts-form";
import { KeyValueList } from "@auction/staff-ui";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-staff-xs font-medium text-staff-muted">{title}</h4>
      {children}
    </div>
  );
}

/**
 * "Shoppers will see": the edition page's facts, the card line and an order line, in the exact
 * words the storefront will use. Until every fact is chosen and consistent it shows the edition
 * row and says what is missing.
 */
export function FactsPreview({ preview }: { preview: FactsPreviewModel }) {
  return (
    <aside
      aria-label="Shoppers will see"
      className="flex flex-col gap-4 rounded-staff-lg border border-staff-line bg-staff-sunken p-4"
    >
      <h3 className="font-staff text-staff-md font-semibold text-staff-fg">Shoppers will see</h3>
      {preview.state === "partial" ? (
        <>
          <KeyValueList items={[{ label: "Edition", value: preview.edition }]} />
          <p className="text-staff-sm text-staff-muted">{preview.message}</p>
        </>
      ) : (
        <>
          <Block title="Edition page">
            <KeyValueList
              items={[
                { label: "Edition", value: preview.description.rows.edition },
                { label: "Signature", value: preview.description.rows.signature },
                { label: "Number", value: preview.description.rows.number },
                { label: "Certificate", value: preview.description.rows.certificate },
                ...(preview.description.rows.proofs
                  ? [{ label: "Proofs", value: preview.description.rows.proofs }]
                  : []),
              ]}
            />
          </Block>
          <Block title="Card">
            <p className="text-staff-sm text-staff-fg">{preview.description.cardLine}</p>
          </Block>
          <Block title="Order line, once paid">
            <p className="text-staff-sm text-staff-fg">{preview.orderLine}</p>
          </Block>
        </>
      )}
    </aside>
  );
}
