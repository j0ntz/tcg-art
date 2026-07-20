import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Small status / label chip. Both variants are neutral ink: badges are metadata,
// not accent placements (the ember budget lives in globals.css). `soft` is the
// quiet outline chip; `solid` is the filled counter (e.g. a deck card count).
export const badgeVariants = cva(
  "inline-flex w-fit items-center rounded-pill text-xs font-medium tnum",
  {
    variants: {
      variant: {
        soft: "gap-2 border border-border bg-surface-muted text-foreground-secondary",
        solid: "bg-surface-inverse text-foreground-on-inverse",
      },
      size: {
        sm: "px-2.5 py-0.5",
        md: "px-3 py-1",
      },
    },
    defaultVariants: {
      variant: "soft",
      size: "md",
    },
  },
);

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

const Badge: React.FC<BadgeProps> = ({ className, variant, size, ...props }) => (
  <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
);

export default Badge;
