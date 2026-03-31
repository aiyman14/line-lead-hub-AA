/**
 * Resolves the display label for a production stage submission
 * based on which parts (target / EOD) exist.
 *
 * @param stage  Capitalized stage name ("Sewing", "Cutting", "Finishing")
 * @param hasTarget  Whether a target submission exists
 * @param hasActual  Whether an EOD/actual submission exists
 * @returns  Merged label (e.g. "Sewing" when both exist)
 */
export function resolveStageLabel(
  stage: string,
  hasTarget: boolean,
  hasActual: boolean,
): string {
  if (hasTarget && hasActual) return stage;
  if (hasTarget) return `${stage} Target`;
  return `${stage} EOD`;
}
