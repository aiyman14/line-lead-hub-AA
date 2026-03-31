import { describe, it, expect } from "vitest";
import { resolveStageLabel } from "../resolve-stage-label";

describe("resolveStageLabel", () => {
  it("returns just the stage name when both target and actual exist", () => {
    expect(resolveStageLabel("Sewing", true, true)).toBe("Sewing");
    expect(resolveStageLabel("Cutting", true, true)).toBe("Cutting");
    expect(resolveStageLabel("Finishing", true, true)).toBe("Finishing");
  });

  it('returns "Stage Target" when only target exists', () => {
    expect(resolveStageLabel("Sewing", true, false)).toBe("Sewing Target");
    expect(resolveStageLabel("Cutting", true, false)).toBe("Cutting Target");
    expect(resolveStageLabel("Finishing", true, false)).toBe("Finishing Target");
  });

  it('returns "Stage EOD" when only actual exists', () => {
    expect(resolveStageLabel("Sewing", false, true)).toBe("Sewing EOD");
    expect(resolveStageLabel("Cutting", false, true)).toBe("Cutting EOD");
    expect(resolveStageLabel("Finishing", false, true)).toBe("Finishing EOD");
  });
});
