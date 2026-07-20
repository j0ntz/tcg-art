import { cn } from "@/lib/utils";

// Energy-type chip: the ONLY place the functional type ramps (globals.css) may
// be consumed. Type colors are data ink in the game's native language: a chip
// naming an energy type wears that type's color; nothing else ever does.
// Unknown type strings fall back to the neutral Colorless treatment so a new
// API value can never render an unstyled chip.

const TYPE_CLASSES: Record<string, string> = {
  Grass: "border-type-grass-border bg-type-grass-subtle text-type-grass-strong",
  Fire: "border-type-fire-border bg-type-fire-subtle text-type-fire-strong",
  Water: "border-type-water-border bg-type-water-subtle text-type-water-strong",
  Lightning: "border-type-lightning-border bg-type-lightning-subtle text-type-lightning-strong",
  Psychic: "border-type-psychic-border bg-type-psychic-subtle text-type-psychic-strong",
  Fighting: "border-type-fighting-border bg-type-fighting-subtle text-type-fighting-strong",
  Darkness: "border-type-darkness-border bg-type-darkness-subtle text-type-darkness-strong",
  Metal: "border-type-metal-border bg-type-metal-subtle text-type-metal-strong",
  Fairy: "border-type-fairy-border bg-type-fairy-subtle text-type-fairy-strong",
  Dragon: "border-type-dragon-border bg-type-dragon-subtle text-type-dragon-strong",
  Colorless: "border-type-colorless-border bg-type-colorless-subtle text-type-colorless-strong",
};

interface TypeBadgeProps {
  type: string;
  className?: string;
}

const TypeBadge: React.FC<TypeBadgeProps> = ({ type, className }) => (
  <span
    className={cn(
      "inline-flex w-fit items-center rounded-pill border px-2.5 py-0.5 text-xs font-semibold",
      TYPE_CLASSES[type] ?? TYPE_CLASSES.Colorless,
      className,
    )}
  >
    {type}
  </span>
);

export default TypeBadge;
