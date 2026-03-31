import { X } from "lucide-react";
import type { POFilters } from "./po-filters";
import {
  HEALTH_LABELS,
  EX_FACTORY_OPTIONS,
  UPDATED_OPTIONS,
} from "./po-filters";

interface Props {
  filters: POFilters;
  onChange: (filters: POFilters) => void;
}

interface Chip {
  id: string;
  label: string;
  onRemove: () => void;
}

export function POFilterChips({ filters, onChange }: Props) {
  const chips: Chip[] = [];

  filters.buyers.forEach((v) =>
    chips.push({
      id: `buyer-${v}`,
      label: `Buyer: ${v}`,
      onRemove: () =>
        onChange({ ...filters, buyers: filters.buyers.filter((x) => x !== v) }),
    })
  );

  filters.lines.forEach((v) =>
    chips.push({
      id: `line-${v}`,
      label: `Line: ${v}`,
      onRemove: () =>
        onChange({ ...filters, lines: filters.lines.filter((x) => x !== v) }),
    })
  );

  filters.styles.forEach((v) =>
    chips.push({
      id: `style-${v}`,
      label: `Style: ${v}`,
      onRemove: () =>
        onChange({ ...filters, styles: filters.styles.filter((x) => x !== v) }),
    })
  );

  filters.units.forEach((v) =>
    chips.push({
      id: `unit-${v}`,
      label: `Unit: ${v}`,
      onRemove: () =>
        onChange({ ...filters, units: filters.units.filter((x) => x !== v) }),
    })
  );

  filters.floors.forEach((v) =>
    chips.push({
      id: `floor-${v}`,
      label: `Floor: ${v}`,
      onRemove: () =>
        onChange({ ...filters, floors: filters.floors.filter((x) => x !== v) }),
    })
  );

  filters.poNumbers.forEach((v) =>
    chips.push({
      id: `po-${v}`,
      label: `PO: ${v}`,
      onRemove: () =>
        onChange({
          ...filters,
          poNumbers: filters.poNumbers.filter((x) => x !== v),
        }),
    })
  );

  filters.health.forEach((v) =>
    chips.push({
      id: `health-${v}`,
      label: `Health: ${HEALTH_LABELS[v] ?? v}`,
      onRemove: () =>
        onChange({ ...filters, health: filters.health.filter((x) => x !== v) }),
    })
  );

  if (filters.exFactory) {
    const label =
      EX_FACTORY_OPTIONS.find((o) => o.value === filters.exFactory)?.label ??
      filters.exFactory;
    chips.push({
      id: "ex",
      label: `Ex-Factory: ${label}`,
      onRemove: () => onChange({ ...filters, exFactory: null }),
    });
  }

  if (filters.updated) {
    const label =
      UPDATED_OPTIONS.find((o) => o.value === filters.updated)?.label ??
      filters.updated;
    chips.push({
      id: "updated",
      label: label,
      onRemove: () => onChange({ ...filters, updated: null }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary border border-primary/20"
        >
          {chip.label}
          <button
            onClick={chip.onRemove}
            className="hover:text-primary/70 transition-colors ml-0.5"
            aria-label={`Remove ${chip.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
