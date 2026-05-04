import type { FaqGroup, FaqItem } from "@/components/marketing/faq/faq-data";
import { LegalH2 } from "@/components/marketing/legal-page";

type FaqFlatListProps = {
  items?: FaqItem[];
  groups?: FaqGroup[];
};

function FaqEntry({ item }: { item: FaqItem }) {
  return (
    <section aria-labelledby={`faq-${item.id}`}>
      <h3
        id={`faq-${item.id}`}
        className="mb-3 font-headline text-xl font-medium leading-snug tracking-tight text-on-surface"
      >
        {item.title}
      </h3>
      {item.bodyNode ? (
        <div className="font-body text-sm leading-relaxed text-on-surface-variant md:text-base">
          {item.bodyNode}
        </div>
      ) : (
        <p>{item.body}</p>
      )}
    </section>
  );
}

export function FaqFlatList({ groups, items = [] }: FaqFlatListProps) {
  if (groups) {
    return (
      <div className="space-y-12">
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`faq-group-${group.id}`} className="space-y-8">
            <LegalH2 id={`faq-group-${group.id}`} className="scroll-mt-28">
              {group.title}
            </LegalH2>
            {group.items.map((item) => (
              <FaqEntry key={item.id} item={item} />
            ))}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {items.map((item) => (
        <FaqEntry key={item.id} item={item} />
      ))}
    </div>
  );
}
