/**
 * Pure math for the interactive syringe reconstitution calculator. Ported
 * verbatim (same formulas, same behaviour) from peptidesdirect.io's
 * apps/web/src/lib/syringe-math.ts, kept dependency-free so it is trivially
 * unit-testable and so the drag/keyboard handlers, the tick renderer and the
 * readouts all derive from the exact same formulas (no drift between visuals
 * and numbers).
 *
 * Model: a U-100 insulin syringe, 100 graduations = 1 ml, 1 unit = 0.01 ml.
 * The plunger position is always a whole unit (0-100), snapped.
 */

/** Clamp a units value to [0, maxUnits] and snap it to the nearest whole unit. */
export function clampUnits(units: number, maxUnits: number): number {
  if (Number.isNaN(units)) return 0;
  return Math.max(0, Math.min(maxUnits, Math.round(units)));
}

/** mg/ml, or 0 if there is no water (avoids Infinity/NaN downstream). */
export function concentrationMgPerMl(vialMg: number, waterMl: number): number {
  if (!(vialMg > 0) || !(waterMl > 0)) return 0;
  return vialMg / waterMl;
}

/** A U-100 syringe barrel always tops out at 100 U (1 ml); if the vial holds
 * less than 1 ml of solvent, the usable draw is capped by what's actually in
 * the vial. */
export function maxUnitsForWater(waterMl: number): number {
  const w = waterMl > 0 ? waterMl : 1;
  return Math.max(1, Math.min(100, Math.round(w * 100)));
}

export function unitsToMl(units: number): number {
  return units / 100;
}

/** Amount of substance drawn at a given plunger position, in mg and mcg. */
export function amountAtUnits(
  units: number,
  concentrationMgPerMlValue: number,
): { mg: number; mcg: number } {
  const mg = unitsToMl(units) * concentrationMgPerMlValue;
  return { mg, mcg: mg * 1000 };
}

/** Where the plunger needs to sit to draw the target dose, in fractional
 * units (may exceed 100 if the dose needs more than 1 ml). Null if there is
 * no concentration or no dose to aim for. */
export function targetUnits(doseMg: number, concentrationMgPerMlValue: number): number | null {
  if (!(concentrationMgPerMlValue > 0) || !(doseMg > 0)) return null;
  return (doseMg / concentrationMgPerMlValue) * 100;
}

/** How many full doses the vial yields. Null if there's no dose to divide by. */
export function dosesPerVial(vialMg: number, doseMg: number): number | null {
  if (!(doseMg > 0) || !(vialMg > 0)) return null;
  return Math.floor(vialMg / doseMg);
}

export interface BlendDrawAmount {
  name: string;
  mg: number;
  mcg: number;
  /** Share of the vial's total mg this component represents, for a bar width (0-1). */
  fraction: number;
}

/** Splits the current draw across a blend's components. Each component has
 * its own concentration (its share of the vial mg / the water ml); amount at
 * the current draw volume follows the same units-to-ml conversion as the
 * total. The sum of parts always equals the total. */
export function blendAmountsAtUnits(
  parts: { name: string; mg: number }[],
  units: number,
  waterMl: number,
  vialMg: number,
): BlendDrawAmount[] {
  const ml = unitsToMl(units);
  return parts.map((p) => {
    const partConcentration = waterMl > 0 ? p.mg / waterMl : 0;
    const mg = ml * partConcentration;
    return {
      name: p.name,
      mg,
      mcg: mg * 1000,
      fraction: vialMg > 0 ? p.mg / vialMg : 0,
    };
  });
}
