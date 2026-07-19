import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Bordered surface panel. `cardVariants` is exported so non-<div> elements
// (a pricing <li>, the signup <form>) can wear the styling; Card is the <div>
// convenience. Padding and inner layout (flex, gap) are the caller's via
// className, since those vary per use while the surface treatment does not.
// `highlight` is a neutral emphasis (stronger border + lift), never a colored
// edge or tinted fill.
export const cardVariants = cva("rounded-panel border", {
  variants: {
    variant: {
      default: "border-border bg-surface shadow-card",
      highlight: "border-border-strong bg-surface shadow-card-lifted",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type CardProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof cardVariants>;

const Card: React.FC<CardProps> = ({ className, variant, ...props }) => (
  <div className={cn(cardVariants({ variant }), className)} {...props} />
);

export default Card;
