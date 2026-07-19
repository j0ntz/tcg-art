import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// A section's <h2> + supporting paragraph. Left-aligned editorial by default
// (the site's one layout voice); `tone` switches between dark-on-light and
// light-on-dark (sections on the night surface). Titles wear the display face.
const titleVariants = cva("font-display text-heading font-bold tracking-tight", {
  variants: {
    tone: {
      default: "text-foreground",
      inverse: "text-foreground-inverse",
    },
  },
  defaultVariants: { tone: "default" },
});

const subtitleVariants = cva("max-w-xl text-lead", {
  variants: {
    tone: {
      default: "text-foreground-muted",
      inverse: "text-foreground-inverse-muted",
    },
  },
  defaultVariants: { tone: "default" },
});

interface SectionHeadingProps extends VariantProps<typeof titleVariants> {
  title: string;
  subtitle: string;
  className?: string;
}

const SectionHeading: React.FC<SectionHeadingProps> = ({
  title,
  subtitle,
  tone,
  className,
}) => (
  <div className={cn("flex flex-col gap-3", className)}>
    <h2 className={titleVariants({ tone })}>{title}</h2>
    <p className={subtitleVariants({ tone })}>{subtitle}</p>
  </div>
);

export default SectionHeading;
