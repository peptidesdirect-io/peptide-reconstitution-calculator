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

- `src/calc.ts` - pure syringe math (concentration, units, target dose, blend split). No DOM access, easy to unit-test.
- `src/syringe.ts` - the interactive SVG syringe (drag, keyboard, tick marks, target marker).
- `src/peptides.ts` - the `Peptide` TypeScript interface plus `PEPTIDES`, loaded from `src/peptides.json`.
- `src/peptides.json` - the editable reference dataset (see below).
- `src/main.ts` - entry point: builds the UI, wires inputs, computes derived state, renders readouts.
- `src/style.css` - all styling (light/dark, mobile-safe, no external fonts).

## Adding or editing a peptide

Edit `src/peptides.json`. Each entry keeps this field shape:

```jsonc
{
  "slug": "example-peptide",        // used in the ?peptide= query param and as the <option> value
  "name": "Example Peptide",
  "molecularWeightDa": 1234.5,      // or null if there is no single defined molecule
  "pubchemCid": 1234567,            // or null; cite the exact PubChem CID you used
  "typicalVialMg": [5, 10],         // vial sizes offered in the dropdown; [0] is the default fill
  "diluent": "Bacteriostatic water (neutral)",
  "reconstitutionPhClass": "neutral ~5.7 (bacteriostatic water)",
  "storage": "lyophilized: ... ; reconstituted: ...",
  "plasmaHalfLife": null,           // optional, cited string or null
  "studyDose": "10 pg/kg to 2 mg/kg (animal)",
  "studyNote": "No established human protocol",
  "communityDose": "250-500 mcg/day (SC)",
  "doseBasis": "preclinical",       // "preclinical" | "human-trial" | "human-approved"
  "sources": [
    { "field": "molecularWeightDa", "ref": "https://pubchem.ncbi.nlm.nih.gov/compound/1234567" }
  ]
}
```

For a multi-peptide blend (like GLOW or KLOW), add a `components` array instead of `studyDose`/`communityDose`/`doseBasis` values (leave those as empty strings: a blend has no single-peptide study record):

```jsonc
{
  "slug": "example-blend",
  "typicalVialMg": [70],
  "studyDose": "",
  "studyNote": "",
  "communityDose": "",
  "doseBasis": "",
  "components": [
    { "name": "Peptide A", "mg": 50, "pubchemCid": 1234567 },
    { "name": "Peptide B", "mg": 20, "pubchemCid": 7654321 }
  ]
}
```

`components` is defined at the recipe's base vial size, `typicalVialMg[0]`. If `typicalVialMg` lists a second, larger size, the app scales the recipe proportionally (see `blendComponentsForVial` in `src/peptides.ts`); do not add a second `components` array per vial size.

### Dose fields are reference only

`studyDose` / `studyNote` and `communityDose` are two different, clearly labelled things:

- **studyDose**: what was actually used in a published study you can cite (a real dose from a real paper). Keep it short; the fuller citation trail lives at peptidesdirect.io/research/dosing, which the app links to.
- **communityDose**: what peptide research forums discuss as commonly used amounts. This has no study basis and no named source. It is always rendered with a fixed, non-negotiable disclaimer in the UI ("Reference from peptide forums. Not a recommendation, no study basis, no established human protocol.") - do not remove or soften that disclaimer, and do not add a source or author name to a community dose.

Neither field is ever a recommendation, dosing guidance, or medical advice. Do not invent numbers: every dose you add should trace back to a real study (studyDose) or a real, generic description of forum discussion (communityDose), not a guess.

## Pull requests

Keep changes scoped: a peptide-data PR should only touch `src/peptides.json`; a UI/behaviour PR should only touch the relevant `src/*.ts` / `src/style.css` files. Run `npm run typecheck` and `npm run build` before opening a PR.
