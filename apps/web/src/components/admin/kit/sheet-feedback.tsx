"use client";

import { Button, MetricCell, MetricCellSkeleton, Notice, PlainLink } from "@auction/ui/lax";
import { Gavel, Wallet } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { SheetSection } from "./sheet-frame";

export function SheetNotices() {
  return (
    <SheetSection
      id="notices"
      title="Notices"
      description="One notice per concern, placed where it blocks. Staff notices are tinted; for clients information stays calm on the surface with a blue icon, while a warning or a block keeps its tint. At most one action, on the right."
    >
      {() => (
        <div className="flex flex-col gap-3">
          <Notice title="Bidding opens on 12 Nov." actions={<Button size="sm">Register</Button>}>
            Register now so you're ready when the sale opens.
          </Notice>
          <Notice tone="success" title="Payout sent">
            £1,140.00 to the account ending 4821.
          </Notice>
          <Notice tone="warning" title="We're checking Cedar & Stone Fine Art's documents.">
            This usually takes 2–3 working days.
          </Notice>
          <Notice
            tone="danger"
            alert
            title="Bidding and selling are paused for Harrington Advisors."
            actions={<Button size="sm">Contact us</Button>}
          >
            You can still view your history and pay invoices.
          </Notice>
        </div>
      )}
    </SheetSection>
  );
}

export function SheetFigures() {
  return (
    <SheetSection
      id="figures"
      title="Figure cells"
      description="Staff read a compact metric strip; clients see 28/36 figures on Home's At a glance. With no data the cell says so in words, never £0.00, and a cell with a link opens the list behind the number."
    >
      {() => (
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lax-card border border-lax-line bg-lax-line-subtle sm:grid-cols-2 [&>*]:bg-lax-surface">
          <MetricCell
            Link={PlainLink}
            item={{
              id: "hammer",
              label: "In upcoming sales",
              icon: <Gavel aria-hidden />,
              value: "£184,300",
              hint: "23 works, hammer price",
              href: "#upcoming",
            }}
          />
          <MetricCell
            item={{
              id: "payouts",
              label: "Payouts due",
              icon: <Wallet aria-hidden />,
              tone: "attention",
              value: "£12,860",
              comparison: {
                text: "12%",
                direction: "up",
                tone: "positive",
                basis: "vs last month",
              },
              trend: [3, 5, 4, 6, 8, 7, 9],
            }}
          />
          <MetricCell
            item={{
              id: "sold",
              label: "Sold this year",
              value: null,
              emptyText: "Nothing sold yet this year",
            }}
          />
          <MetricCellSkeleton trend={false} />
        </div>
      )}
    </SheetSection>
  );
}

/**
 * Toasts are fleeting, so the sheet raises one on arrival and keeps it until dismissed; the button
 * raises another. The toaster is the staff shell's, at the staff density.
 */
export function SheetToasts() {
  useEffect(() => {
    toast.success("Lena Fischer is now a buyer agent", {
      description: "Northbank Gallery",
      duration: Number.POSITIVE_INFINITY,
      action: { label: "Undo", onClick: () => undefined },
    });
  }, []);
  return (
    <SheetSection
      id="toasts"
      title="Toasts"
      description="Raised, hairline, 8px radius and shadow md, bottom right, with at most one ink action. A toast confirms; it is never used for an error that needs action."
    >
      {() => (
        <Button onClick={() => toast("Settings saved")} size="sm">
          Show a toast
        </Button>
      )}
    </SheetSection>
  );
}
