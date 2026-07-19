import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Shared button styling, owned in-repo (shadcn copy-own style). `buttonVariants`
// is exported so links (`<Link>`/`<a>`) can wear the same styling without nesting
// a real <button>; the Button component is the plain <button> convenience.
export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-pill text-center",
  {
    variants: {
      variant: {
        // dark ink fill: the default app action (header CTA, form submits)
        primary:
          "bg-surface-inverse font-medium text-primary-foreground transition-colors hover:bg-surface-inverse-hover",
        // ember fill: THE primary CTA. Part of the accent budget (globals.css);
        // at most one per view.
        accent:
          "bg-primary font-semibold text-primary-foreground transition-colors hover:bg-primary-hover",
        // outline: secondary actions
        secondary:
          "border border-border-strong font-medium text-foreground transition-colors hover:bg-surface-hover",
        // text link styled as a pill (nav)
        ghost:
          "font-medium text-foreground-muted transition-colors hover:text-foreground",
      },
      size: {
        nav: "px-3 py-2 text-sm",
        sm: "px-4 py-2 text-sm",
        md: "px-6 py-3 text-base",
        lg: "px-7 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

const Button: React.FC<ButtonProps> = ({ className, variant, size, ...props }) => (
  <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
);

export default Button;
