<p align="center">
  <img src="logo.png" alt="Peptide Reconstitution Calculator" width="112" />
</p>

<h1 align="center">Peptide Reconstitution Calculator</h1>

<p align="center">
  A TypeScript + Vite calculator that converts vial mg, diluent volume and target dose into syringe units, injection volume, concentration and doses per vial. Builds to one self-contained, dependency-free static HTML file.
</p>

<p align="center">
  <a href="https://calc.peptidesdirect.io"><img src="https://img.shields.io/badge/live_demo-calc.peptidesdirect.io-0f766e" alt="Live demo" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT" />
  <img src="https://img.shields.io/badge/runtime_dependencies-0-brightgreen" alt="Zero runtime dependencies" />
</p>

## What it is

An interactive U-100 syringe: drag the plunger or use arrow keys to set a dose, and the tool works out units, injection volume, concentration and doses per vial from three inputs (vial content in mg, diluent volume in ml, target dose). It ships with a bundled reference dataset (`src/peptides.json`) of common research peptides: identity (PubChem-cited molecular weight), handling (diluent, pH class, storage) and dose references (see below).

Source code is TypeScript, built with Vite. There are no runtime dependencies: the production build is a single `dist/index.html` file with all JS and CSS inlined, so it can be self-hosted, embedded, or dropped onto any static host with zero configuration.

## Live demo

[calc.peptidesdirect.io](https://calc.peptidesdirect.io)

## Embed

Drop this snippet into any page. It loads the single built file, no other scripts or stylesheets required.

```html
<iframe src="https://calc.peptidesdirect.io" width="100%" height="720" style="border:0;max-width:920px" title="Peptide Reconstitution Calculator" loading="lazy"></iframe>
```

You can also preselect a peptide via `?peptide=<slug>`, e.g. `https://calc.peptidesdirect.io/?peptide=bpc-157` (see `src/peptides.json` for the full list of slugs).

## Fork and make it your own

1. Fork this repository.
2. `npm install`
3. Edit `src/peptides.json`: change which peptides are listed, their vial sizes, diluent, pH class, storage notes, or dose references. The shape of each entry is documented in `src/peptides.ts` (the `Peptide` interface) and in [CONTRIBUTING.md](CONTRIBUTING.md).
4. `npm run build`
5. Deploy the contents of `dist/` (it is a single self-contained `index.html`) to your own domain.

Nothing else needs to change: the branding, colours, and copy live in `src/style.css` and `src/main.ts` if you want to customize further.

## Develop

```bash
npm install
npm run dev
```

Opens a local dev server with hot reload. `npm run typecheck` runs `tsc --noEmit` in strict mode.

## Deploy

This repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds and deploys `dist/` to GitHub Pages on every push to `main`. Enable Pages (Settings -> Pages -> Source: GitHub Actions) and it will publish automatically.

You can equally deploy `dist/` to Netlify, Vercel, Cloudflare Pages, or any static host: run `npm run build` and upload the single `dist/index.html`.

## How the math works

The calculator assumes a standard U-100 insulin syringe, where 100 units equal 1 ml (1 unit = 0.01 ml). All figures come from three inputs: vial content in mg, diluent (water) volume in ml, and the desired dose.

- Concentration (mg/ml) = vial mg / water ml
- Units for a dose = (dose / concentration) x 100
- Doses per vial = vial mg / dose

No other assumptions or corrections are applied. The tool does the arithmetic; it does not evaluate whether a given dose is appropriate. The pure math lives in `src/calc.ts`, independent of the DOM, so it is easy to audit or reuse.

## Data and disclaimer

`src/peptides.json` is a bundled, editable dataset of reference values for a set of common research peptides:

- **Identity and handling**: molecular weight (cited to PubChem where a single defined molecule exists), typical vial size, diluent type, reconstitution pH class, and storage handling. Contains no purity, potency, or quality claims.
- **studyDose / studyNote**: a short summary of the dose range used in published studies for that peptide, with a one-line qualifier (e.g. whether an established human protocol exists).
- **communityDose**: what peptide research forums discuss as commonly used amounts. This is forum-sourced, not from a study, and is never presented as a recommendation.

None of this is medical advice or a dosing recommendation. Most of the compounds listed have no established human protocol; where doses are shown, they describe what was used in a specific cited study or what a community discusses, not what anyone should use. The dataset is licensed separately under CC BY 4.0 (see License below) and can be freely edited when you fork this project.

## License

- Code (`src/`, `vite.config.ts`, this repository's tooling and documentation): [MIT](LICENSE)
- Data (`src/peptides.json`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## Attribution

Powered by [peptidesdirect.io](https://peptidesdirect.io). The widget carries a small "Powered by" link back to the project; please keep it intact when embedding.
