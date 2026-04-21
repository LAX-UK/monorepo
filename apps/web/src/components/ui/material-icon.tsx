import { cn } from "@auction/ui";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Bookmark,
  BookmarkPlus,
  Calendar,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Gavel,
  Home,
  LayoutDashboard,
  Maximize2,
  Menu,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Palette,
  Search,
  Shield,
  ShieldUser,
  SlidersHorizontal,
  Store,
  Sun,
  Truck,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  bar_chart: BarChart3,
  event: Calendar,
  schedule: Clock,
  assignment: ClipboardList,
  gavel: Gavel,
  account_balance_wallet: Wallet,
  group: Users,
  shield_person: ShieldUser,
  storefront: Store,
  palette: Palette,
  person: User,
  tune: SlidersHorizontal,
  notifications: Bell,
  fullscreen: Maximize2,
  close: X,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  visibility: Eye,
  bookmark: Bookmark,
  bookmark_add: BookmarkPlus,
  search: Search,
  menu: Menu,
  panel_left: PanelLeft,
  panel_left_close: PanelLeftClose,
  home: Home,
  arrow_back: ArrowLeft,
  arrow_forward: ArrowRight,
  west: ChevronLeft,
  east: ChevronRight,
  light_mode: Sun,
  dark_mode: Moon,
  expand_more: ChevronDown,
  verified: CheckCircle2,
  local_shipping: Truck,
  shield: Shield,
};

export function MaterialIcon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const Cmp = ICON_MAP[name];
  if (!Cmp) {
    return (
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center text-xs text-on-surface-variant",
          className,
        )}
        aria-hidden
      >
        ?
      </span>
    );
  }
  return <Cmp className={cn("size-[1.25em] shrink-0", className)} aria-hidden strokeWidth={1.65} />;
}
