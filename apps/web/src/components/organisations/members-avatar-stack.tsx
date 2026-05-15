import { cn } from "@auction/ui";

export type MemberAvatar = {
  name: string;
  image: string | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1];
  if (!last?.[0] || !first[0]) return first.slice(0, 2).toUpperCase();
  return `${first[0]}${last[0]}`.toUpperCase();
}

type Props = {
  members: MemberAvatar[];
  /** Max avatars before +N overflow. */
  max?: number;
  className?: string;
};

export function MembersAvatarStack({ members, max = 5, className }: Props) {
  const slice = members.slice(0, max);
  const overflow = members.length - slice.length;

  if (slice.length === 0) return null;

  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex -space-x-2">
        {slice.map((m, i) => (
          <div
            key={`${m.name}-${i}`}
            className="relative inline-flex size-9 items-center justify-center rounded-full border-2 border-surface bg-primary-container text-[10px] font-bold text-on-primary-container"
            title={m.name}
          >
            {m.image ? (
              <img src={m.image} alt={m.name} className="size-full rounded-full object-cover" />
            ) : (
              <span aria-hidden>{initials(m.name)}</span>
            )}
          </div>
        ))}
      </div>
      {overflow > 0 ? (
        <span className="ml-2 text-xs font-medium text-on-surface-variant">+{overflow}</span>
      ) : null}
    </div>
  );
}
