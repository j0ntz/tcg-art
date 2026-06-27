import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// A section's <h2> + supporting paragraph. `align` switches between the centered
// marketing-section style and the left-aligned in-column style; `tone` switches
// between dark-on-light and light-on-dark (the brand-colored binder section).
const wrapperVariants = cva("flex flex-col", {
  variants: {
    align: {
      center: "gap-3 text-center",
      left: "gap-4",
    },
  },
  defaultVariants: { align: "center" },
});

const titleVariants = cva("text-heading font-bold tracking-tight", {
  variants: {
    tone: {
      default: "text-foreground",
      inverse: "text-foreground-inverse",
    },
  },
  defaultVariants: { tone: "default" },
});

const subtitleVariants = cva("", {
  variants: {
    align: {
      center: "mx-auto max-w-2xl",
      left: "max-w-lg",
    },
    tone: {
      default: "text-foreground-muted",
      inverse: "text-primary-foreground-muted",
    },
  },
  defaultVariants: { align: "center", tone: "default" },
});

interface SectionHeadingProps
  extends VariantProps<typeof wrapperVariants>,
    VariantProps<typeof titleVariants> {
  title: string;
  subtitle: string;
  className?: string;
}

const SectionHeading: React.FC<SectionHeadingProps> = ({
  title,
  subtitle,
  align,
  tone,
  className,
}) => (
  <div className={cn(wrapperVariants({ align }), className)}>
    <h2 className={titleVariants({ tone })}>{title}</h2>
    <p className={subtitleVariants({ align, tone })}>{subtitle}</p>
  </div>
);

export default SectionHeading;
