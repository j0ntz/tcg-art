import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn `cn`: clsx joins/condition-resolves class values, tailwind-merge
// then dedupes conflicting Tailwind utilities so a caller's className can always
// override a component's defaults (last write wins).
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
