import type { FaqItem } from "@/components/marketing/faq/faq-data";
import { LegalH2 } from "@/components/marketing/legal-page";

type FaqFlatListProps = {
  items: FaqItem[];
};

export function FaqFlatList({ items }: FaqFlatListProps) {
  return (
    <div className="space-y-8">
      {items.map((item) => (
        <section key={item.id} aria-labelledby={`faq-${item.id}`}>
          <LegalH2 id={`faq-${item.id}`} className="scroll-mt-28">
            {item.title}
          </LegalH2>
          {item.bodyNode ? (
            <div className="font-body text-sm leading-relaxed text-on-surface-variant md:text-base">
              {item.bodyNode}
            </div>
          ) : (
            <p>{item.body}</p>
          )}
        </section>
      ))}
    </div>
  );
}
