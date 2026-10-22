import { cn } from "@auction/ui";
import {
  Award,
  Bell,
  BellRing,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Ellipsis,
  Heart,
  House,
  ImageIcon,
  Info,
  LayoutGrid,
  type LucideProps,
  Menu,
  Moon,
  Phone,
  Play,
  Search,
  SearchX,
  Share2,
  ShoppingBag,
  Sun,
  User,
  X,
} from "lucide-react";

type MarketingIconProps = Omit<LucideProps, "aria-hidden">;

/** Chevron for section “View all” actions — matches Bid marketing rails. */
export function MarketingViewAllChevron({ className, ...props }: MarketingIconProps) {
  return <ChevronRight className={cn("size-5 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingCarouselPreviousIcon({ className, ...props }: MarketingIconProps) {
  return <ChevronLeft className={cn("size-6 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingCarouselNextIcon({ className, ...props }: MarketingIconProps) {
  return <ChevronRight className={cn("size-6 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingSearchIcon({ className, ...props }: MarketingIconProps) {
  return <Search className={cn("size-5 shrink-0", className)} aria-hidden {...props} />;
}

/** Search with a cross: a search that found nothing. */
export function MarketingSearchRemoveIcon({ className, ...props }: MarketingIconProps) {
  return <SearchX className={cn("size-5 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingHomeIcon({ className, ...props }: MarketingIconProps) {
  return <House className={cn("size-5 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingGridIcon({ className, ...props }: MarketingIconProps) {
  return <LayoutGrid className={cn("size-5 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingHeartIcon({ className, ...props }: MarketingIconProps) {
  return <Heart className={cn("size-6 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingBagIcon({ className, ...props }: MarketingIconProps) {
  return <ShoppingBag className={cn("size-8 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingCircleAlertIcon({ className, ...props }: MarketingIconProps) {
  return <CircleAlert className={cn("size-4 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingInfoIcon({ className, ...props }: MarketingIconProps) {
  return <Info className={cn("size-4 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingBellIcon({ className, ...props }: MarketingIconProps) {
  return <Bell className={cn("size-4 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingBellRingIcon({ className, ...props }: MarketingIconProps) {
  return <BellRing className={cn("size-4 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingMenuIcon({ className, ...props }: MarketingIconProps) {
  return <Menu className={cn("size-6 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingCloseIcon({ className, ...props }: MarketingIconProps) {
  return <X className={cn("size-6 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingChevronDownIcon({ className, ...props }: MarketingIconProps) {
  return <ChevronDown className={cn("size-4 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingSunIcon({ className, ...props }: MarketingIconProps) {
  return <Sun className={cn("size-5 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingMoonIcon({ className, ...props }: MarketingIconProps) {
  return <Moon className={cn("size-5 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingUserIcon({ className, ...props }: MarketingIconProps) {
  return <User className={cn("size-5 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingShareIcon({ className, ...props }: MarketingIconProps) {
  return <Share2 className={cn("size-5 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingPlayIcon({ className, ...props }: MarketingIconProps) {
  return <Play className={cn("size-6", className)} aria-hidden {...props} />;
}

export function MarketingMoreIcon({ className, ...props }: MarketingIconProps) {
  return <Ellipsis className={cn("size-5 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingCertificateIcon({ className, ...props }: MarketingIconProps) {
  return <Award className={cn("size-5 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingImageIcon({ className, ...props }: MarketingIconProps) {
  return <ImageIcon className={cn("size-5 shrink-0", className)} aria-hidden {...props} />;
}

export function MarketingPhoneIcon({ className, ...props }: MarketingIconProps) {
  return <Phone className={cn("size-5 shrink-0", className)} aria-hidden {...props} />;
}
