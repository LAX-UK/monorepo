import type {
  ClerkConsoleSlots,
  ClerkPhaseLayoutConfig,
} from "@/features/saleroom/types/clerk-console.types";
import { Notice } from "@auction/staff-ui";

type Props = {
  slots: ClerkConsoleSlots;
  phaseLayout: ClerkPhaseLayoutConfig;
  showActionBar: boolean;
};

/**
 * The console in one column: alerts, the session bar, then the controls. The controls need a
 * screen of at least 1024px; below that the console says so and shows the room read-only, so a
 * phone can follow a sale but never half-runs one.
 */
export function ClerkConsoleLayout({ slots }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {slots.alerts}
      {slots.sessionBar}

      <div className="flex flex-col gap-6 lg:hidden">
        <Notice tone="info" title="Live clerking needs a screen at least 1024px wide.">
          Open this sale on a larger screen to run the floor. You can still follow it here.
        </Notice>
        {slots.phoneView}
      </div>

      <div className="hidden flex-col gap-6 lg:flex">
        {slots.sessionToolbar}

        <div className="grid grid-cols-2 items-start gap-6">
          {slots.onBlock}
          {slots.runway}
        </div>

        {slots.tools}

        {slots.liveDock}
      </div>
    </div>
  );
}
