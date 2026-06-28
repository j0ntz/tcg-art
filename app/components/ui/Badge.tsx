import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Small status / label pill. `soft` is the brand-tinted outline chip; `solid` is
// the filled emphasis badge (e.g. "Most popular").
export const badgeVariants = cva(
  "inline-flex w-fit items-center rounded-pill text-xs font-medium",
  {
    variants: {
      variant: {
        soft: "gap-2 border border-primary-border bg-primary-subtle text-primary-subtle-foreground",
        solid: "bg-primary text-primary-foreground",
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
