"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { FacetGroupKey, FacetGroupView, SortKey } from "@/lib/facets";
import { cn } from "@/lib/utils";

// Faceted filter + sort controls, following the established conventions:
// desktop gets a left facet rail, mobile gets a bottom-sheet panel, applied
// filters render as removable chips, one sort dropdown, and all state lives
// in the URL (shareable, back-button-safe). Checkbox toggles apply instantly
// against local state and commit to the URL debounced.

const APPLY_DEBOUNCE_MS = 250;
const OPTIONS_SHOWN_COLLAPSED = 8;

export interface SortOption {
  key: SortKey;
  label: string;
}

interface FacetControlsProps {
  groups: FacetGroupView[];
  sortOptions: SortOption[];
  appliedSort: SortKey | null;
  defaultSort: SortKey;
  resultCount: number;
  // False when counts cannot be computed locally (name-mode search filters
  // API-side); options then render without numbers.
  showCounts: boolean;
  children: React.ReactNode;
}

type LocalFilters = Partial<Record<FacetGroupKey, string[]>>;

const selectionsOf = (groups: FacetGroupView[]): LocalFilters => {
  const filters: LocalFilters = {};
  for (const group of groups) {
    const selected = group.options.filter(option => option.selected).map(option => option.value);
    if (selected.length > 0) filters[group.key] = selected;
  }
  return filters;
};

const FacetControls: React.FC<FacetControlsProps> = ({
  groups,
  sortOptions,
  appliedSort,
  defaultSort,
  resultCount,
  showCounts,
  children,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local selection state gives instant checkbox feedback; the URL commit is
  // debounced behind it, and fresh server props re-sync it (covers
  // back/forward navigation).
  const [filters, setFilters] = useState<LocalFilters>(() => selectionsOf(groups));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<FacetGroupKey>>(new Set());
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupsKey = useMemo(() => JSON.stringify(selectionsOf(groups)), [groups]);

  // Re-sync local selections when the server-applied state changes (the
  // "adjust state on prop change during render" pattern, not an effect).
  const [syncedKey, setSyncedKey] = useState(groupsKey);
  if (syncedKey !== groupsKey) {
    setSyncedKey(groupsKey);
    setFilters(JSON.parse(groupsKey) as LocalFilters);
  }

  useEffect(() => {
    return () => {
      if (commitTimer.current != null) clearTimeout(commitTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sheetOpen]);

  const commitToUrl = (nextFilters: LocalFilters, nextSort: SortKey | null, immediate = false): void => {
    const run = (): void => {
      const params = new URLSearchParams(searchParams.toString());
      for (const group of groups) params.delete(group.key);
      for (const group of groups) {
        for (const value of nextFilters[group.key] ?? []) params.append(group.key, value);
      }
      params.delete("sort");
      if (nextSort != null && nextSort !== defaultSort) params.set("sort", nextSort);
      // A changed filter restarts pagination/depth.
      params.delete("page");
      params.delete("n");
      const qs = params.toString();
      router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, { scroll: false });
    };
    if (commitTimer.current != null) clearTimeout(commitTimer.current);
    if (immediate) {
      run();
    } else {
      commitTimer.current = setTimeout(run, APPLY_DEBOUNCE_MS);
    }
  };

  const toggleValue = (groupKey: FacetGroupKey, value: string): void => {
    const current = filters[groupKey] ?? [];
    const next = {
      ...filters,
      [groupKey]: current.includes(value)
        ? current.filter(candidate => candidate !== value)
        : [...current, value],
    };
    setFilters(next);
    commitToUrl(next, appliedSort);
  };

  const clearAll = (): void => {
    setFilters({});
    commitToUrl({}, appliedSort, true);
  };

  const onSortChange = (value: string): void => {
    commitToUrl(filters, value as SortKey, true);
  };

  const appliedChips = groups.flatMap(group =>
    (filters[group.key] ?? []).map(value => ({ group, value })),
  );
  const activeCount = appliedChips.length;

  const groupList = (idPrefix: string): React.ReactNode => (
    <div className="flex flex-col">
      {groups.map(group => {
        const expanded = expandedGroups.has(group.key);
        const shown = expanded ? group.options : group.options.slice(0, OPTIONS_SHOWN_COLLAPSED);
        const hidden = group.options.length - shown.length;
        return (
          <fieldset key={group.key} className="border-t border-border py-4 first:border-t-0">
            <legend className="float-left mb-2 w-full font-medium text-foreground">
              {group.label}
            </legend>
            <ul className="clear-both flex flex-col gap-1.5">
              {shown.map(option => (
                <li key={option.value}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 text-sm",
                      option.count === 0 && !option.selected
                        ? "text-foreground-faint"
                        : "text-foreground-secondary hover:text-foreground",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={(filters[group.key] ?? []).includes(option.value)}
                        onChange={() => toggleValue(group.key, option.value)}
                        data-testid={`${idPrefix}facet-${group.key}-${option.value}`}
                        className="h-4 w-4 shrink-0 accent-(--color-surface-inverse)"
                      />
                      <span className="truncate">{option.value}</span>
                    </span>
                    {showCounts ? (
                      <span className="tnum shrink-0 text-xs text-foreground-subtle">
                        {option.count}
                      </span>
                    ) : null}
                  </label>
                </li>
              ))}
            </ul>
            {hidden > 0 ? (
              <button
                type="button"
                onClick={() => setExpandedGroups(previous => new Set([...previous, group.key]))}
                className="mt-2 text-sm text-foreground-subtle underline underline-offset-4 transition-colors hover:text-foreground"
              >
                Show all {group.options.length}
              </button>
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );

  const sortSelect = (idPrefix: string): React.ReactNode => (
    <label className="flex items-center gap-2 text-sm text-foreground-muted">
      Sort
      <select
        value={appliedSort ?? defaultSort}
        onChange={event => onSortChange(event.target.value)}
        data-testid={`${idPrefix}sort-select`}
        className="rounded-field border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-foreground"
      >
        {sortOptions.map(option => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
      <aside className="hidden lg:block lg:w-60 lg:shrink-0" aria-label="Filters">
        <div className="flex items-baseline justify-between pb-1">
          <h2 className="font-display text-lg font-semibold text-foreground">Filters</h2>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              data-testid="clear-all"
              className="text-sm text-foreground-subtle underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Clear all
            </button>
          ) : null}
        </div>
        {groupList("")}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="tnum text-sm text-foreground-subtle" data-testid="result-count">
            {resultCount.toLocaleString()} {resultCount === 1 ? "card" : "cards"}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              data-testid="filter-open"
              className="rounded-pill border border-border-strong px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover lg:hidden"
            >
              Filter &amp; sort{activeCount > 0 ? ` (${activeCount})` : ""}
            </button>
            <div className="hidden lg:block">{sortSelect("")}</div>
          </div>
        </div>

        {appliedChips.length > 0 ? (
          <ul className="flex flex-wrap items-center gap-2" data-testid="applied-chips">
            {appliedChips.map(({ group, value }) => (
              <li key={`${group.key}:${value}`}>
                <button
                  type="button"
                  onClick={() => toggleValue(group.key, value)}
                  data-testid={`chip-${group.key}-${value}`}
                  aria-label={`Remove filter ${group.label}: ${value}`}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-muted px-3 py-1 text-sm text-foreground-secondary transition-colors hover:border-border-strong hover:text-foreground"
                >
                  {value}
                  <span aria-hidden>×</span>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={clearAll}
                data-testid="chips-clear-all"
                className="text-sm text-foreground-subtle underline underline-offset-4 transition-colors hover:text-foreground"
              >
                Clear all
              </button>
            </li>
          </ul>
        ) : null}

        {children}
      </div>

      {sheetOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-surface-night/50"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter and sort"
            data-testid="filter-sheet"
            className="absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col rounded-t-card border-t border-border bg-surface"
          >
            <div className="flex items-center justify-between border-b border-border px-gutter py-3">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Filter &amp; sort
              </h2>
              {activeCount > 0 ? (
                <button
                  type="button"
                  onClick={clearAll}
                  data-testid="sheet-clear-all"
                  className="text-sm text-foreground-subtle underline underline-offset-4"
                >
                  Clear all
                </button>
              ) : null}
            </div>
            <div className="flex-1 overflow-y-auto px-gutter pb-4">
              <div className="border-b border-border py-4">{sortSelect("sheet-")}</div>
              {groupList("sheet-")}
            </div>
            <div className="border-t border-border px-gutter py-3">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                data-testid="filter-sheet-done"
                className="w-full rounded-pill bg-surface-inverse px-4 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-surface-inverse-hover"
              >
                Show {resultCount.toLocaleString()} {resultCount === 1 ? "card" : "cards"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default FacetControls;
