import { differenceInDays, isSameMonth } from "date-fns";
import type { POControlRoomData } from "./types";

// ── Filter state ──────────────────────────────────────────────────────────────

export interface POFilters {
  buyers: string[];
  poNumbers: string[];
  styles: string[];
  lines: string[];
  units: string[];
  floors: string[];
  health: string[];
  exFactory: string | null; // "overdue" | "next7" | "next14" | "this_month" | "no_deadline"
  updated: string | null;   // "today" | "no_today"
}

export const EMPTY_FILTERS: POFilters = {
  buyers: [],
  poNumbers: [],
  styles: [],
  lines: [],
  units: [],
  floors: [],
  health: [],
  exFactory: null,
  updated: null,
};

// ── Count active filters ──────────────────────────────────────────────────────

export function countActiveFilters(filters: POFilters): number {
  return (
    filters.buyers.length +
    filters.poNumbers.length +
    filters.styles.length +
    filters.lines.length +
    filters.units.length +
    filters.floors.length +
    filters.health.length +
    (filters.exFactory ? 1 : 0) +
    (filters.updated ? 1 : 0)
  );
}

// ── Derive available options from dataset ─────────────────────────────────────

export interface POFilterOptions {
  buyers: string[];
  poNumbers: string[];
  styles: string[];
  lines: string[];
  units: string[];
  floors: string[];
  health: string[];
}

export function deriveFilterOptions(orders: POControlRoomData[]): POFilterOptions {
  const buyers = new Set<string>();
  const poNumbers = new Set<string>();
  const styles = new Set<string>();
  const lines = new Set<string>();
  const units = new Set<string>();
  const floors = new Set<string>();
  const health = new Set<string>();

  for (const po of orders) {
    if (po.buyer) buyers.add(po.buyer);
    if (po.po_number) poNumbers.add(po.po_number);
    if (po.style) styles.add(po.style);
    for (const l of po.line_names) lines.add(l);
    for (const u of po.unit_names ?? []) units.add(u);
    for (const f of po.floor_names ?? []) floors.add(f);
    if (po.health?.status) health.add(po.health.status);
  }

  return {
    buyers: [...buyers].sort(),
    poNumbers: [...poNumbers].sort(),
    styles: [...styles].sort(),
    lines: [...lines].sort(),
    units: [...units].sort(),
    floors: [...floors].sort(),
    health: [...health].sort(),
  };
}

// ── Apply filters ─────────────────────────────────────────────────────────────
// Across categories: AND
// Within a category: OR

export function applyFilters(
  orders: POControlRoomData[],
  filters: POFilters,
  today: string
): POControlRoomData[] {
  const hasFilters =
    filters.buyers.length > 0 ||
    filters.poNumbers.length > 0 ||
    filters.styles.length > 0 ||
    filters.lines.length > 0 ||
    filters.units.length > 0 ||
    filters.floors.length > 0 ||
    filters.health.length > 0 ||
    filters.exFactory !== null ||
    filters.updated !== null;

  if (!hasFilters) return orders;

  return orders.filter((po) => {
    // Buyer: OR within selected buyers
    if (filters.buyers.length > 0 && !filters.buyers.includes(po.buyer)) {
      return false;
    }

    // PO number: OR within selected PO numbers
    if (filters.poNumbers.length > 0 && !filters.poNumbers.includes(po.po_number)) {
      return false;
    }

    // Style: OR within selected styles
    if (filters.styles.length > 0 && !filters.styles.includes(po.style ?? "")) {
      return false;
    }

    // Line: OR — PO matches if any of its lines is in the selected set
    if (filters.lines.length > 0) {
      const hasMatchingLine = po.line_names.some((l) => filters.lines.includes(l));
      if (!hasMatchingLine) return false;
    }

    // Unit: OR — PO matches if any of its lines' units is in the selected set
    if (filters.units.length > 0) {
      const hasMatchingUnit = (po.unit_names ?? []).some((u) => filters.units.includes(u));
      if (!hasMatchingUnit) return false;
    }

    // Floor: OR — PO matches if any of its lines' floors is in the selected set
    if (filters.floors.length > 0) {
      const hasMatchingFloor = (po.floor_names ?? []).some((f) => filters.floors.includes(f));
      if (!hasMatchingFloor) return false;
    }

    // Health: OR within selected health statuses
    if (
      filters.health.length > 0 &&
      !filters.health.includes(po.health?.status ?? "")
    ) {
      return false;
    }

    // Ex-factory date range (single-select)
    if (filters.exFactory !== null) {
      if (!matchExFactory(po.planned_ex_factory, filters.exFactory, today)) {
        return false;
      }
    }

    // Updated (single-select)
    if (filters.updated !== null) {
      if (!matchUpdated(po.hasEodToday, filters.updated)) {
        return false;
      }
    }

    return true;
  });
}

function matchExFactory(
  exFactory: string | null,
  range: string,
  today: string
): boolean {
  if (range === "no_deadline") return exFactory === null;
  if (!exFactory) return false;

  const daysToEx = differenceInDays(new Date(exFactory), new Date(today));

  switch (range) {
    case "overdue":
      return daysToEx < 0;
    case "next7":
      return daysToEx >= 0 && daysToEx <= 7;
    case "next14":
      return daysToEx >= 0 && daysToEx <= 14;
    case "this_month":
      return isSameMonth(new Date(exFactory), new Date(today));
    default:
      return true;
  }
}

function matchUpdated(hasEodToday: boolean, updated: string): boolean {
  switch (updated) {
    case "today":
      return hasEodToday;
    case "no_today":
      return !hasEodToday;
    default:
      return true;
  }
}

// ── URL param serialization ───────────────────────────────────────────────────

export function filtersToParams(filters: POFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.buyers.length) params.buyer = filters.buyers.join(",");
  if (filters.poNumbers.length) params.po = filters.poNumbers.join(",");
  if (filters.styles.length) params.style = filters.styles.join(",");
  if (filters.lines.length) params.line = filters.lines.join(",");
  if (filters.units.length) params.unit = filters.units.join(",");
  if (filters.floors.length) params.floor = filters.floors.join(",");
  if (filters.health.length) params.health = filters.health.join(",");
  if (filters.exFactory) params.ex = filters.exFactory;
  if (filters.updated) params.updated = filters.updated;
  return params;
}

export function filtersFromParams(params: URLSearchParams): POFilters {
  const split = (key: string): string[] =>
    params
      .get(key)
      ?.split(",")
      .filter(Boolean) ?? [];

  return {
    buyers: split("buyer"),
    poNumbers: split("po"),
    styles: split("style"),
    lines: split("line"),
    units: split("unit"),
    floors: split("floor"),
    health: split("health"),
    exFactory: params.get("ex"),
    updated: params.get("updated"),
  };
}

// ── Label helpers (used in chips + drawer) ────────────────────────────────────

export const HEALTH_LABELS: Record<string, string> = {
  healthy: "Healthy",
  watch: "Watch",
  at_risk: "At Risk",
  no_deadline: "No date",
  deadline_passed: "Overdue",
  completed: "Complete",
};

export const EX_FACTORY_OPTIONS: { value: string; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "next7", label: "Next 7 days" },
  { value: "next14", label: "Next 14 days" },
  { value: "this_month", label: "This month" },
  { value: "no_deadline", label: "No deadline" },
];

export const UPDATED_OPTIONS: { value: string; label: string }[] = [
  { value: "today", label: "Updated today" },
  { value: "no_today", label: "No updates today" },
];

// ── Toggle helpers ────────────────────────────────────────────────────────────

export function toggleArrayItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}
