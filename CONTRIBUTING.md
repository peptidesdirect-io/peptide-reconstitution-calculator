# Contributing

## Develop

```bash
npm install
npm run dev        # local dev server with hot reload
npm run typecheck  # tsc --noEmit, strict mode
npm run build      # production build -> dist/index.html (single file)
npm run preview    # serve the production build locally
```

TypeScript strict mode is on. There are no runtime dependencies; keep it that way (`devDependencies` only: `vite`, `typescript`, `vite-plugin-singlefile`).

## Project layout

- `src/calc.ts` - the pure arithmetic (concentration, volume per aliquot, aliquots per vial, blend split). No DOM access, easy to test in isolation.
- `src/peptides.ts` - the `Peptide` TypeScript interface plus `PEPTIDES`, loaded from `src/peptides.json`.
- `src/peptides.json` - the editable reference dataset (see below).
- `src/main.ts` - entry point: builds the UI, wires the inputs, computes derived state, renders the result.
- `src/style.css` - all styling (light/dark, mobile-safe, no external fonts).

## Adding or editing a peptide

Edit `src/peptides.json`. Each entry keeps this field shape:

```jsonc
{
  "slug": "example-peptide",        // used in the ?peptide= query param and as the <option> value
  "name": "Example Peptide",
  "molecularWeightDa": 1234.5,      // or null if there is no single defined molecule
  "pubchemCid": 1234567,            // or null; cite the exact PubChem CID you used
  "typicalVialMg": [5, 10],         // catalogue vial sizes, ascending; [0] is the smallest
  "sources": [
    { "field": "molecularWeightDa", "ref": "https://pubchem.ncbi.nlm.nih.gov/compound/1234567" }
  ],
  "note": "Optional identity caveat, e.g. why a compound has no PubChem CID."
}
```

For a multi-peptide blend (like GLOW or KLOW), leave `molecularWeightDa` and `pubchemCid` as `null` and add a `components` array:

```jsonc
{
  "slug": "example-blend",
  "name": "Example Blend",
  "molecularWeightDa": null,
  "pubchemCid": null,
  "typicalVialMg": [70],
  "components": [
    { "name": "Peptide A", "mg": 50, "pubchemCid": 1234567 },
    { "name": "Peptide B", "mg": 20, "pubchemCid": 7654321 }
  ],
  "note": "Blend of two peptides; no single molecular weight."
}
```

`components` is defined at the composition's base vial size, `typicalVialMg[0]`, and the mg values must add up to it. If `typicalVialMg` lists a second, larger size, the app scales the composition proportionally (see `blendComponentsForVial` in `src/peptides.ts`); do not add a second `components` array per vial size.

### What belongs in the dataset, and what does not

The dataset answers two questions only: what is this compound, and which vial sizes exist. The identity fields are cited to the PubChem record they come from in the entry's `sources` array. If you cannot cite it, set the field to `null` and write a short `note` saying why, rather than filling in a plausible-looking number.

Anything beyond identity and vial sizes is out of scope and will not be merged: amounts to use, handling or water recommendations, purity or potency claims, health claims, or references to what anyone discusses online. The calculator is arithmetic on the values a person types in, and the dataset stays at that level.

## Pull requests

Keep changes scoped: a peptide-data PR should only touch `src/peptides.json`; a UI/behaviour PR should only touch the relevant `src/*.ts` / `src/style.css` files. Run `npm run typecheck` and `npm run build` before opening a PR.
