import { describe, it, expect } from "vitest";
import {
  applyFilters,
  countActiveFilters,
  deriveFilterOptions,
  filtersFromParams,
  filtersToParams,
  EMPTY_FILTERS,
  toggleArrayItem,
} from "./po-filters";
import type { POControlRoomData } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePO(overrides: Partial<POControlRoomData>): POControlRoomData {
  return {
    id: "wo-1",
    po_number: "PO-001",
    buyer: "ROSS",
    style: "ST-100",
    item: null,
    color: null,
    order_qty: 1000,
    status: "in_progress",
    planned_ex_factory: null,
    line_id: null,
    line_names: [],
    sewingOutput: 0,
    finishedOutput: 0,
    extrasConsumed: 0,
    totalRejects: 0,
    totalRework: 0,
    health: { status: "healthy", reasons: [] },
    hasEodToday: false,
    progressPct: 0,
    workflowState: "running",
    cluster: "on_track",
    started: false,
    remaining: 1000,
    avgPerDay: 0,
    neededPerDay: 0,
    forecastFinishDate: null,
    ...overrides,
  } as POControlRoomData;
}

const TODAY = "2026-02-25";

// ── countActiveFilters ────────────────────────────────────────────────────────

describe("countActiveFilters", () => {
  it("returns 0 for empty filters", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it("counts array entries individually", () => {
    expect(
      countActiveFilters({ ...EMPTY_FILTERS, buyers: ["ROSS", "NIKE"], lines: ["L1"] })
    ).toBe(3);
  });

  it("counts single-value filters as 1 each", () => {
    expect(
      countActiveFilters({ ...EMPTY_FILTERS, exFactory: "next7", updated: "today" })
    ).toBe(2);
  });
});

// ── applyFilters — within category OR ────────────────────────────────────────

describe("applyFilters — within category OR", () => {
  const po1 = makePO({ buyer: "ROSS", line_names: ["L1", "L2"] });
  const po2 = makePO({ id: "wo-2", po_number: "PO-002", buyer: "NIKE", line_names: ["L3"] });

  it("returns all when no filters active", () => {
    const result = applyFilters([po1, po2], EMPTY_FILTERS, TODAY);
    expect(result).toHaveLength(2);
  });

  it("filters by single buyer", () => {
    const result = applyFilters([po1, po2], { ...EMPTY_FILTERS, buyers: ["ROSS"] }, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].buyer).toBe("ROSS");
  });

  it("keeps both when both buyers selected (OR)", () => {
    const result = applyFilters(
      [po1, po2],
      { ...EMPTY_FILTERS, buyers: ["ROSS", "NIKE"] },
      TODAY
    );
    expect(result).toHaveLength(2);
  });

  it("matches PO if ANY of its lines are selected", () => {
    // po1 has L1 and L2; selecting L2 should match po1
    const result = applyFilters([po1, po2], { ...EMPTY_FILTERS, lines: ["L2"] }, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("wo-1");
  });

  it("returns empty when no POs match selected line", () => {
    const result = applyFilters([po1, po2], { ...EMPTY_FILTERS, lines: ["L99"] }, TODAY);
    expect(result).toHaveLength(0);
  });
});

// ── applyFilters — across categories AND ─────────────────────────────────────

describe("applyFilters — across categories AND", () => {
  const po1 = makePO({ buyer: "ROSS", line_names: ["L1"], style: "ST-100" });
  const po2 = makePO({
    id: "wo-2",
    po_number: "PO-002",
    buyer: "ROSS",
    line_names: ["L2"],
    style: "ST-200",
  });

  it("ANDs buyer and line: only POs matching both pass", () => {
    const result = applyFilters(
      [po1, po2],
      { ...EMPTY_FILTERS, buyers: ["ROSS"], lines: ["L1"] },
      TODAY
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("wo-1");
  });

  it("ANDs buyer and style", () => {
    const result = applyFilters(
      [po1, po2],
      { ...EMPTY_FILTERS, buyers: ["ROSS"], styles: ["ST-200"] },
      TODAY
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("wo-2");
  });
});

// ── applyFilters — health filter ──────────────────────────────────────────────

describe("applyFilters — health filter", () => {
  const poHealthy = makePO({ health: { status: "healthy", reasons: [] } });
  const poAtRisk = makePO({
    id: "wo-2",
    po_number: "PO-002",
    health: { status: "at_risk", reasons: [] },
  });

  it("filters to at_risk only", () => {
    const result = applyFilters(
      [poHealthy, poAtRisk],
      { ...EMPTY_FILTERS, health: ["at_risk"] },
      TODAY
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("wo-2");
  });

  it("OR within health: healthy OR at_risk", () => {
    const result = applyFilters(
      [poHealthy, poAtRisk],
      { ...EMPTY_FILTERS, health: ["healthy", "at_risk"] },
      TODAY
    );
    expect(result).toHaveLength(2);
  });
});

// ── applyFilters — ex-factory ranges ─────────────────────────────────────────

describe("applyFilters — ex-factory ranges", () => {
  const overdue = makePO({ planned_ex_factory: "2026-02-10" }); // 15 days ago
  const next3 = makePO({ id: "wo-2", po_number: "PO-002", planned_ex_factory: "2026-02-28" }); // 3 days away
  const next10 = makePO({ id: "wo-3", po_number: "PO-003", planned_ex_factory: "2026-03-07" }); // 10 days away
  const noDeadline = makePO({ id: "wo-4", po_number: "PO-004", planned_ex_factory: null });

  it("overdue: ex-factory before today", () => {
    const result = applyFilters(
      [overdue, next3, next10, noDeadline],
      { ...EMPTY_FILTERS, exFactory: "overdue" },
      TODAY
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("wo-1");
  });

  it("next7: ex-factory 0-7 days away", () => {
    const result = applyFilters(
      [overdue, next3, next10, noDeadline],
      { ...EMPTY_FILTERS, exFactory: "next7" },
      TODAY
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("wo-2");
  });

  it("next14: includes both next3 and next10", () => {
    const result = applyFilters(
      [overdue, next3, next10, noDeadline],
      { ...EMPTY_FILTERS, exFactory: "next14" },
      TODAY
    );
    expect(result).toHaveLength(2);
  });

  it("no_deadline: only POs without ex-factory", () => {
    const result = applyFilters(
      [overdue, next3, next10, noDeadline],
      { ...EMPTY_FILTERS, exFactory: "no_deadline" },
      TODAY
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("wo-4");
  });
});

// ── applyFilters — updated filter ─────────────────────────────────────────────

describe("applyFilters — updated filter", () => {
  const updated = makePO({ hasEodToday: true });
  const notUpdated = makePO({ id: "wo-2", po_number: "PO-002", hasEodToday: false });

  it("today: only POs with EOD today", () => {
    const result = applyFilters(
      [updated, notUpdated],
      { ...EMPTY_FILTERS, updated: "today" },
      TODAY
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("wo-1");
  });

  it("no_today: only POs without EOD today", () => {
    const result = applyFilters(
      [updated, notUpdated],
      { ...EMPTY_FILTERS, updated: "no_today" },
      TODAY
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("wo-2");
  });
});

// ── deriveFilterOptions ───────────────────────────────────────────────────────

describe("deriveFilterOptions", () => {
  const orders = [
    makePO({ buyer: "ROSS", style: "ST-A", line_names: ["L1", "L2"] }),
    makePO({
      id: "wo-2",
      po_number: "PO-002",
      buyer: "NIKE",
      style: "ST-A",
      line_names: ["L2", "L3"],
      health: { status: "at_risk", reasons: [] },
    }),
  ];

  it("deduplicates buyers", () => {
    const opts = deriveFilterOptions(orders);
    expect(opts.buyers).toEqual(["NIKE", "ROSS"]);
  });

  it("deduplicates styles", () => {
    const opts = deriveFilterOptions(orders);
    expect(opts.styles).toEqual(["ST-A"]);
  });

  it("deduplicates and merges line names", () => {
    const opts = deriveFilterOptions(orders);
    expect(opts.lines).toEqual(["L1", "L2", "L3"]);
  });
});

// ── URL param serialization ───────────────────────────────────────────────────

describe("filtersToParams / filtersFromParams round-trip", () => {
  const filters = {
    buyers: ["ROSS", "NIKE"],
    poNumbers: ["PO-001"],
    styles: [],
    lines: ["L1", "L2"],
    units: ["Unit A"],
    floors: ["Floor 1"],
    health: ["at_risk"],
    exFactory: "next7",
    updated: "today",
  };

  it("serializes non-empty fields to params", () => {
    const params = filtersToParams(filters);
    expect(params.buyer).toBe("ROSS,NIKE");
    expect(params.line).toBe("L1,L2");
    expect(params.unit).toBe("Unit A");
    expect(params.floor).toBe("Floor 1");
    expect(params.ex).toBe("next7");
    expect(params.updated).toBe("today");
    expect(params.style).toBeUndefined(); // empty arrays omitted
  });

  it("round-trips through URLSearchParams", () => {
    const raw = filtersToParams(filters);
    const sp = new URLSearchParams(raw);
    const restored = filtersFromParams(sp);

    expect(restored.buyers).toEqual(["ROSS", "NIKE"]);
    expect(restored.poNumbers).toEqual(["PO-001"]);
    expect(restored.styles).toEqual([]);
    expect(restored.lines).toEqual(["L1", "L2"]);
    expect(restored.units).toEqual(["Unit A"]);
    expect(restored.floors).toEqual(["Floor 1"]);
    expect(restored.health).toEqual(["at_risk"]);
    expect(restored.exFactory).toBe("next7");
    expect(restored.updated).toBe("today");
  });

  it("returns EMPTY_FILTERS shape for empty params", () => {
    const restored = filtersFromParams(new URLSearchParams());
    expect(restored).toEqual(EMPTY_FILTERS);
  });
});

// ── toggleArrayItem ───────────────────────────────────────────────────────────

describe("toggleArrayItem", () => {
  it("adds item when not present", () => {
    expect(toggleArrayItem(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });

  it("removes item when already present", () => {
    expect(toggleArrayItem(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });
});
