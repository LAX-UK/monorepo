import { SellCtaLink } from "@/components/marketing/sell-cta-link";
import { FOCUS_RING, MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { sellDepartmentIcon } from "@/lib/marketing/sell-department-icons";
import {
  SELL_DEPARTMENT_GROUPS,
  type SellDepartment,
  departmentIntakeHref,
} from "@/lib/marketing/sell-departments";
import { SELL_PAGE_ACCEPTANCE } from "@/lib/marketing/sell-flow-copy";
import { sellContactHref } from "@/lib/marketing/sell-intake";
import { cn } from "@auction/ui";

const DEPT_CARD_CLASS =
  "group relative block rounded-lg border border-border-hairline bg-surface-container-lowest p-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none motion-safe:hover:-translate-y-px motion-safe:hover:ring-1 motion-safe:hover:ring-primary/20";

function departmentAffordance(dept: SellDepartment): string {
  if (dept.intake === "contact") return "Speak to a specialist →";
  if (dept.intake === "landing") return "Learn more →";
  return "Submit →";
}

function DepartmentCard({ dept }: { dept: SellDepartment }) {
  const Icon = sellDepartmentIcon(dept.id);
  const href = departmentIntakeHref(dept);
  const examples = dept.examples?.join(" · ");

  return (
    <li>
      <SellCtaLink
        href={href}
        source={`sell_dept_${dept.id}`}
        data-testid={`sell-department-${dept.id}`}
        aria-label={`${dept.label}: ${departmentAffordance(dept).replace(" →", "")}`}
        className={cn(DEPT_CARD_CLASS, FOCUS_RING)}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-container-low text-primary"
            aria-hidden
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-headline text-sm text-on-surface">{dept.label}</p>
            {examples ? (
              <p className="font-body text-xs text-on-surface-variant">{examples}</p>
            ) : null}
            {dept.note ? (
              <p className="font-body text-xs text-on-surface-variant">{dept.note}</p>
            ) : null}
          </div>
        </div>
        <p className="mt-3 font-label text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
          {departmentAffordance(dept)}
        </p>
      </SellCtaLink>
    </li>
  );
}

/** Department grid body — heading lives on parent `LegalH2`. */
export function SellDepartmentsSection() {
  return (
    <div className="space-y-6">
      <p>{SELL_PAGE_ACCEPTANCE}</p>
      <p>
        Browse by department below — we also review watches, motor cars, design, books, coins, and
        more. Every submission is assessed for suitability; acceptance is not guaranteed.
      </p>

      {SELL_DEPARTMENT_GROUPS.map((group) => (
        <div key={group.id} className="space-y-3">
          <h3 className="font-label text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
            {group.label}
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {group.departments.map((dept) => (
              <DepartmentCard key={dept.id} dept={dept} />
            ))}
          </ul>
        </div>
      ))}

      <p>
        Jewellery and handbags are reviewed by specialist enquiry. For estates or corporate
        collections,{" "}
        <SellCtaLink
          href={sellContactHref("estate")}
          source="sell_dept_estate_footer"
          className={MARKETING_PROSE_LINK}
        >
          contact our team
        </SellCtaLink>
        .
      </p>
    </div>
  );
}
