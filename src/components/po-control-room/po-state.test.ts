import { describe, it, expect } from "vitest";
import {
  computeWorkflowState,
  computeAvgPerDay,
  computeNeededPerDay,
  computeForecastFinish,
  computeCluster,
} from "./po-state";

// ── computeWorkflowState ──────────────────────────────────────────────────────

describe("computeWorkflowState", () => {
  it("returns 'completed' when remaining <= 0 regardless of other flags", () => {
    expect(computeWorkflowState({ hasAnyActual: true, hasTarget: true, hasLine: true, remaining: 0 })).toBe("completed");
    expect(computeWorkflowState({ hasAnyActual: false, hasTarget: false, hasLine: false, remaining: -5 })).toBe("completed");
  });

  it("returns 'running' when sewing actuals exist and remaining > 0", () => {
    expect(computeWorkflowState({ hasAnyActual: true, hasTarget: false, hasLine: false, remaining: 100 })).toBe("running");
    expect(computeWorkflowState({ hasAnyActual: true, hasTarget: true, hasLine: true, remaining: 1 })).toBe("running");
  });

  it("returns 'planned' when line OR target exists but no actuals", () => {
    expect(computeWorkflowState({ hasAnyActual: false, hasTarget: true, hasLine: false, remaining: 500 })).toBe("planned");
    expect(computeWorkflowState({ hasAnyActual: false, hasTarget: false, hasLine: true, remaining: 500 })).toBe("planned");
    expect(computeWorkflowState({ hasAnyActual: false, hasTarget: true, hasLine: true, remaining: 500 })).toBe("planned");
  });

  it("returns 'not_started' when no actuals, no target, no line", () => {
    expect(computeWorkflowState({ hasAnyActual: false, hasTarget: false, hasLine: false, remaining: 500 })).toBe("not_started");
  });
});

// ── computeAvgPerDay ──────────────────────────────────────────────────────────

describe("computeAvgPerDay", () => {
  const today = "2026-02-24";

  it("returns zeros for empty actuals", () => {
    const result = computeAvgPerDay([], today);
    expect(result.avg3d).toBe(0);
    expect(result.avg7d).toBe(0);
    expect(result.effective).toBe(0);
  });

  it("computes 3-day avg from actuals within last 3 days", () => {
    const actuals = [
      { good_today: 300, production_date: "2026-02-24" }, // 0 days ago
      { good_today: 300, production_date: "2026-02-23" }, // 1 day ago
      { good_today: 300, production_date: "2026-02-22" }, // 2 days ago
    ];
    const result = computeAvgPerDay(actuals, today);
    expect(result.avg3d).toBe(300);          // 900 / 3
    expect(result.effective).toBe(300);       // uses 3d since data present
  });

  it("falls back to 7-day avg when no data in last 3 days", () => {
    const actuals = [
      { good_today: 700, production_date: "2026-02-18" }, // 6 days ago
      { good_today: 700, production_date: "2026-02-17" }, // 7 days ago — outside window
    ];
    const result = computeAvgPerDay(actuals, today);
    expect(result.avg3d).toBe(0);
    expect(result.avg7d).toBeCloseTo(100);   // 700 / 7
    expect(result.effective).toBe(result.avg7d);
  });

  it("ignores actuals older than 7 days", () => {
    const actuals = [
      { good_today: 1000, production_date: "2026-02-01" }, // 23 days ago
    ];
    const result = computeAvgPerDay(actuals, today);
    expect(result.avg7d).toBe(0);
    expect(result.effective).toBe(0);
  });

  it("avg3d divides by 3 (window), not just the count of days with data", () => {
    // Only 1 day of data in last 3 days → avg3d = output / 3
    const actuals = [{ good_today: 900, production_date: "2026-02-24" }];
    const result = computeAvgPerDay(actuals, today);
    expect(result.avg3d).toBe(300); // 900 / 3, not 900 / 1
  });
});

// ── computeNeededPerDay ───────────────────────────────────────────────────────

describe("computeNeededPerDay", () => {
  const today = "2026-02-24";

  it("returns remaining / 7 when no ex-factory date", () => {
    expect(computeNeededPerDay(700, null, today)).toBe(100);
    expect(computeNeededPerDay(0, null, today)).toBe(0);
  });

  it("returns 0 when remaining is 0", () => {
    expect(computeNeededPerDay(0, "2026-03-10", today)).toBe(0);
  });

  it("divides remaining by days remaining to ex-factory", () => {
    // 14 days away
    expect(computeNeededPerDay(700, "2026-03-10", today)).toBeCloseTo(700 / 14);
  });

  it("clamps to minimum 1 day to avoid division by zero (ex-factory today or past)", () => {
    const result = computeNeededPerDay(500, today, today); // 0 days → clamp to 1
    expect(result).toBe(500);
    const pastResult = computeNeededPerDay(500, "2026-02-20", today); // past → clamp to 1
    expect(pastResult).toBe(500);
  });
});

// ── computeForecastFinish ─────────────────────────────────────────────────────

describe("computeForecastFinish", () => {
  const today = "2026-02-24";

  it("returns null when avgPerDay is 0", () => {
    expect(computeForecastFinish(500, 0, today)).toBeNull();
  });

  it("returns null when remaining is 0", () => {
    expect(computeForecastFinish(0, 300, today)).toBeNull();
  });

  it("computes forecast finish date correctly", () => {
    // 300 remaining / 100/day = 3 days from today
    expect(computeForecastFinish(300, 100, today)).toBe("2026-02-27");
  });

  it("ceils fractional days", () => {
    // 301 / 100 = 3.01 → ceil = 4 days
    expect(computeForecastFinish(301, 100, today)).toBe("2026-02-28");
  });
});

// ── computeCluster ────────────────────────────────────────────────────────────

describe("computeCluster", () => {
  const today = "2026-02-24";

  const base = {
    remaining: 500,
    neededPerDay: 50,
    avgPerDay: 200,
    forecastFinish: "2026-02-28",
    hasEodToday: true,
    today,
  };

  it("returns 'no_deadline' when exFactory is null — regardless of other params", () => {
    expect(computeCluster({ ...base, exFactory: null })).toBe("no_deadline");
    expect(computeCluster({ ...base, exFactory: null, hasEodToday: false })).toBe("no_deadline");
  });

  it("returns 'due_soon' when ex-factory within 7 days and remaining > 0", () => {
    expect(computeCluster({ ...base, exFactory: "2026-02-28", remaining: 100 })).toBe("due_soon"); // 4 days
    expect(computeCluster({ ...base, exFactory: today, remaining: 100 })).toBe("due_soon");        // 0 days
  });

  it("'due_soon' takes priority over 'behind_plan'", () => {
    // Even if forecast is behind, due_soon wins when within 7 days
    expect(computeCluster({
      ...base,
      exFactory: "2026-02-26",   // 2 days
      remaining: 500,
      forecastFinish: "2026-04-01", // clearly behind
    })).toBe("due_soon");
  });

  it("returns 'behind_plan' when forecast > ex-factory", () => {
    expect(computeCluster({
      ...base,
      exFactory: "2026-03-10",    // 14 days — not due_soon
      forecastFinish: "2026-03-20", // forecast after ex-factory
    })).toBe("behind_plan");
  });

  it("returns 'behind_plan' when neededPerDay > avgPerDay and avgPerDay > 0", () => {
    expect(computeCluster({
      ...base,
      exFactory: "2026-03-10",
      neededPerDay: 300,           // need 300/day
      avgPerDay: 100,              // only doing 100/day
      forecastFinish: null,        // no forecast
    })).toBe("behind_plan");
  });

  it("returns 'missing_updates' when no EOD today and not behind", () => {
    expect(computeCluster({
      ...base,
      exFactory: "2026-03-10",
      hasEodToday: false,
      forecastFinish: "2026-03-05", // on time
    })).toBe("missing_updates");
  });

  it("returns 'on_track' when deadline set, pace good, and EOD submitted today", () => {
    expect(computeCluster({
      ...base,
      exFactory: "2026-03-10",
      forecastFinish: "2026-03-05", // before ex-factory
      neededPerDay: 50,
      avgPerDay: 200,               // pace well ahead
      hasEodToday: true,
    })).toBe("on_track");
  });
});
