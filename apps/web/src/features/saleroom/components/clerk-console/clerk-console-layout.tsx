import type {
  ClerkConsoleSlots,
  ClerkPhaseLayoutConfig,
} from "@/features/saleroom/types/clerk-console.types";
import { cn } from "@auction/ui/lib/utils";

type Props = {
  slots: ClerkConsoleSlots;
  phaseLayout: ClerkPhaseLayoutConfig;
  showActionBar: boolean;
};

export function ClerkConsoleLayout({ slots, phaseLayout, showActionBar }: Props) {
  const reserveBottom = showActionBar || phaseLayout.reserveDockSpace;

  return (
    <div className={cn("space-y-6", reserveBottom && "pb-24")}>
      {slots.alerts}
      {slots.sessionBar}
      {slots.sessionToolbar}

      <div className="grid gap-6 lg:grid-cols-2">
        {slots.runway}
        {slots.onBlock}
      </div>

      {slots.tools}

      {slots.liveDock}
    </div>
  );
}
