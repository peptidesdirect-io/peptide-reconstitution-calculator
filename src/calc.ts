/**
 * Pure aliquot arithmetic for the peptide reconstitution calculator.
 * Dependency-free and DOM-free, so it is trivially testable in isolation and
 * the readouts all derive from the exact same formulas.
 *
 * Three formulas, nothing else:
 *   concentration (mg/ml)   = vial mg / water ml
 *   volume per aliquot (ml) = target amount mg / concentration
 *   aliquots per vial       = floor(vial mg / target amount mg)
 *
 * Every helper returns 0 or null rather than a non-finite number, so nothing
 * downstream can ever render "Infinity" or "NaN": extreme but valid inputs
 * (a huge vial size over a tiny water volume, for instance) overflow silently
 * here and the caller falls back to its empty state.
 */

/** mg/ml, or 0 if there is no vial content, no water, or the division does not
 * yield a finite number. */
export function concentrationMgPerMl(vialMg: number, waterMl: number): number {
  if (!Number.isFinite(vialMg) || !Number.isFinite(waterMl)) return 0;
  if (!(vialMg > 0) || !(waterMl > 0)) return 0;
  const value = vialMg / waterMl;
  return Number.isFinite(value) ? value : 0;
}

/** Volume in ml that contains the target amount, or null if there is no
 * concentration, no target amount to work from, or the division does not yield
 * a finite number. */
export function volumePerAliquotMl(
  amountMg: number,
  concentrationMgPerMlValue: number,
): number | null {
  if (!Number.isFinite(amountMg) || !Number.isFinite(concentrationMgPerMlValue)) return null;
  if (!(concentrationMgPerMlValue > 0) || !(amountMg > 0)) return null;
  const value = amountMg / concentrationMgPerMlValue;
  return Number.isFinite(value) ? value : null;
}

/** How many whole aliquots of amountMg the vial yields, or null if either
 * value is missing or the result is not finite. */
export function aliquotsPerVial(vialMg: number, amountMg: number): number | null {
  if (!Number.isFinite(vialMg) || !Number.isFinite(amountMg)) return null;
  if (!(amountMg > 0) || !(vialMg > 0)) return null;
  const value = Math.floor(vialMg / amountMg);
  return Number.isFinite(value) ? value : null;
}

export interface BlendComponentAmount {
  name: string;
  mg: number;
  mcg: number;
  /** Share of the vial's total mg this component represents, for a bar width (0-1). */
  fraction: number;
}

/** Splits one aliquot across a blend's components. Each component has its own
 * concentration (its share of the vial mg / the water ml); the amount it
 * contributes to a given volume follows the same arithmetic as the total, so
 * the sum of the parts always equals the aliquot amount. Returns an empty list
 * if any input or any resulting amount is not finite. */
export function blendAmountsPerAliquot(
  parts: { name: string; mg: number }[],
  volumeMl: number,
  waterMl: number,
  vialMg: number,
): BlendComponentAmount[] {
  if (!Number.isFinite(volumeMl) || !Number.isFinite(waterMl) || !Number.isFinite(vialMg)) {
    return [];
  }
  const amounts = parts.map((p) => {
    const partConcentration = waterMl > 0 && Number.isFinite(p.mg) ? p.mg / waterMl : 0;
    const mg = volumeMl * partConcentration;
    return {
      name: p.name,
      mg,
      mcg: mg * 1000,
      fraction: vialMg > 0 && Number.isFinite(p.mg) ? p.mg / vialMg : 0,
    };
  });
  return amounts.every((a) => Number.isFinite(a.mcg) && Number.isFinite(a.fraction)) ? amounts : [];
}

/** Rounds every part to a whole number and makes the rounded parts add up to the
 * rounded total, by giving the whole rounding residual to the largest part.
 * Rounding each part on its own does not add up: a 70 mg GLOW vial at 250 mcg
 * per aliquot splits into 178.57 + 35.71 + 35.71, which displays as
 * 179 + 36 + 36 = 251 mcg. Callers pass the values in whichever scale they show,
 * so the numbers on screen are the numbers that sum. Returns null if any value
 * or the total is not finite. */
export function reconcileRoundedParts(values: number[], total: number): number[] | null {
  if (!Number.isFinite(total) || !values.every((v) => Number.isFinite(v))) return null;
  if (values.length === 0) return [];

  const rounded = values.map((v) => Math.round(v));
  const residual = Math.round(total) - rounded.reduce((sum, v) => sum + v, 0);
  if (residual === 0) return rounded;

  let largest = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > values[largest]) largest = i;
  }
  rounded[largest] += residual;
  return rounded;
}
