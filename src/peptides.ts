import data from "./peptides.json";

/** A citation for a single identity field (PubChem, DailyMed, PubMed, ...). */
export interface PeptideSource {
  field: string;
  ref: string;
}

/** One component of a multi-peptide blend (GLOW, KLOW, ...), at the recipe's
 * base vial size (typicalVialMg[0]). Scale to any other listed vial size with
 * blendComponentsForVial below. */
export interface PeptideComponent {
  name: string;
  mg: number;
  pubchemCid?: number | null;
}

export interface Peptide {
  slug: string;
  name: string;
  /** PubChem-cited molecular weight, or null for blends / peptides with no
   * single defined molecule (see `note`). */
  molecularWeightDa: number | null;
  pubchemCid: number | null;
  typicalVialMg: number[];
  diluent: string;
  reconstitutionPhClass: string;
  storage: string;
  plasmaHalfLife?: string | null;
  /** Short summary of the dose range used in published studies. Empty for
   * blends, which have no single-peptide study record. Reference only. */
  studyDose: string;
  /** One-line qualifier for studyDose, e.g. "No established human protocol". */
  studyNote: string;
  /** Short summary of what peptide forums discuss. Reference/forum-sourced
   * only, never a recommendation. Empty for blends. */
  communityDose: string;
  /** "preclinical" | "human-trial" | "human-approved" | "" (blends). */
  doseBasis: string;
  /** Present only for blends (GLOW, KLOW, ...): the recipe at typicalVialMg[0]. */
  components?: PeptideComponent[];
  sources?: PeptideSource[];
  /** Free-text identity caveat, e.g. why a compound has no PubChem CID. */
  note?: string;
}

interface PeptideDataset {
  _meta: Record<string, unknown>;
  peptides: Peptide[];
}

const dataset = data as PeptideDataset;

export const PEPTIDES: Peptide[] = dataset.peptides;

/** Scales a blend's component recipe (defined at its base typicalVialMg[0])
 * to whichever vial size is currently selected. Returns null for
 * non-blend peptides or if the base recipe has no usable total. */
export function blendComponentsForVial(
  peptide: Peptide,
  vialMg: number,
): { name: string; mg: number }[] | null {
  if (!peptide.components || peptide.components.length === 0) return null;
  const baseMg = peptide.components.reduce((sum, c) => sum + c.mg, 0);
  if (!(baseMg > 0) || !(vialMg > 0)) return null;
  const scale = vialMg / baseMg;
  return peptide.components.map((c) => ({ name: c.name, mg: c.mg * scale }));
}
