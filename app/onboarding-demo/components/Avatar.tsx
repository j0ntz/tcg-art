import { cn } from "@/lib/utils";
import { initials } from "../format";

// Initials avatar. No photos are fetched (the demo claims no live Workday
// connection and ships no personal images); initials on neutral ink chrome are
// the placeholder, consistent with the account page's avatar fallback.
interface AvatarProps {
  name: string;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ name, className }) => (
  <span
    aria-hidden
    className={cn(
      "flex shrink-0 items-center justify-center rounded-pill bg-surface-inverse font-display font-semibold text-foreground-on-inverse",
      className,
    )}
  >
    {initials(name)}
  </span>
);

export default Avatar;
