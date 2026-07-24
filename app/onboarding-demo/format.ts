// Small display helpers for the onboarding demo. Dates render in a fixed,
// locale-stable format so server and client markup always match (a locale-
// dependent format would risk a hydration mismatch).

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

// "2026-08-03" -> "3 Aug 2026". Parsed as UTC to avoid a timezone off-by-one.
export const formatDate = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

// Initials from a preferred name, for the avatar placeholder.
export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
