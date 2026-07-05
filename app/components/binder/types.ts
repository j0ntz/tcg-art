import type { Card } from "@/lib/pokemon";

export type DisplayMode = "binder" | "carousel" | "gallery";

export const DISPLAY_MODES: DisplayMode[] = ["binder", "carousel", "gallery"];

export const isDisplayMode = (value: string | undefined): value is DisplayMode =>
  value === "binder" || value === "carousel" || value === "gallery";

// One card in the user's collection, resolved for display: the API card plus
// the collection row's quantity and a pre-formatted acquisition date (formatted
// server-side with a fixed locale so client hydration matches).
export interface BinderEntry {
  card: Card;
  quantity: number;
  acquiredLabel: string;
}
