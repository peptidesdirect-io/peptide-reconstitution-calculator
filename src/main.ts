import "./style.css";
import {
  concentrationMgPerMl,
  volumePerAliquotMl,
  aliquotsPerVial,
  blendAmountsPerAliquot,
  reconcileRoundedParts,
} from "./calc";
import { PEPTIDES, blendComponentsForVial, type Peptide } from "./peptides";

const SWATCHES = ["#0f766e", "#c67b12", "#3b6db3", "#8a4fbf"];

const app = document.getElementById("app");
if (!app) throw new Error("Missing #app root element");

app.innerHTML = `
<div class="wrap">
  <header class="intro">
    <h1>Peptide Reconstitution Calculator</h1>
    <p>Enter your vial size, the amount of bacteriostatic water you add and the target amount per aliquot. The calculator returns the concentration, the volume per aliquot and how many aliquots one vial yields.</p>
  </header>

  <div class="grid">
    <section class="card">
      <h2>Your values</h2>
      <div class="field">
        <label for="peptide">Peptide</label>
        <select id="peptide">
          <option value="">Choose a peptide or enter manually</option>
          <option value="__manual__">Manual entry</option>
        </select>
        <p class="preset" id="preset" hidden></p>
      </div>
      <div class="field">
        <label for="vial">Vial size (mg)</label>
        <input id="vial" type="number" inputmode="decimal" min="0" step="any" placeholder="e.g. 10" />
      </div>
      <div class="field">
        <label for="water">Bacteriostatic water (ml)</label>
        <input id="water" type="number" inputmode="decimal" min="0" step="any" placeholder="e.g. 2" value="2" />
      </div>
      <div class="field" style="margin-bottom:0">
        <label for="amount">Target amount per aliquot</label>
        <div class="amount-row">
          <input id="amount" type="number" inputmode="decimal" min="0" step="any" placeholder="e.g. 250" />
          <div class="uom-toggle" role="group" aria-label="mcg or mg">
            <button type="button" id="uom-mcg" aria-pressed="true">mcg</button>
            <button type="button" id="uom-mg" aria-pressed="false">mg</button>
          </div>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Result</h2>
      <p class="empty" id="empty">Enter a vial size, water amount and target amount greater than zero to see the result.</p>
      <dl class="readouts" id="readouts" hidden>
        <div><dt>Concentration</dt><dd id="r-conc">-</dd></div>
        <div><dt>Volume per aliquot</dt><dd class="hi" id="r-vol">-</dd></div>
        <div><dt>Aliquots per vial</dt><dd id="r-count">-</dd></div>
      </dl>

      <div class="blend" id="blend" hidden>
        <p class="cap">Per component in one aliquot</p>
        <div id="blend-rows"></div>
      </div>

      <div class="foot">
        <a class="brand" href="https://peptidesdirect.io/research/reconstitution-calculator" target="_blank" rel="noopener">Powered by <b>peptidesdirect.io</b></a>
      </div>
      <p class="disc">For laboratory and research use only, not for human or veterinary use. This tool only performs arithmetic on the values you enter. It is not dosing advice and not a protocol.</p>
    </section>
  </div>
</div>
`;

function req<T extends Element>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as unknown as T;
}

const fmt = (value: number, digits: number): string =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);

interface State {
  vial: string;
  water: string;
  amount: string;
  amountUnit: "mcg" | "mg";
  preset: Peptide | null;
}

const state: State = {
  vial: "",
  water: "2",
  amount: "",
  amountUnit: "mcg",
  preset: null,
};

const peptideSelect = req<HTMLSelectElement>("peptide");
const presetEl = req<HTMLParagraphElement>("preset");
const vialInput = req<HTMLInputElement>("vial");
const waterInput = req<HTMLInputElement>("water");
const amountInput = req<HTMLInputElement>("amount");
const mcgBtn = req<HTMLButtonElement>("uom-mcg");
const mgBtn = req<HTMLButtonElement>("uom-mg");
const emptyEl = req<HTMLParagraphElement>("empty");
const readoutsEl = req<HTMLElement>("readouts");
const rConc = req<HTMLElement>("r-conc");
const rVol = req<HTMLElement>("r-vol");
const rCount = req<HTMLElement>("r-count");
const blendEl = req<HTMLDivElement>("blend");
const blendRowsEl = req<HTMLDivElement>("blend-rows");

for (const p of PEPTIDES) {
  const option = document.createElement("option");
  option.value = p.slug;
  option.textContent = `${p.name} (vials: ${p.typicalVialMg.map((m) => `${m} mg`).join(", ")})`;
  peptideSelect.appendChild(option);
}

// One aliquot's component amounts are reconciled in whole mcg, so a part shown
// in mg (1 mg and above) never needs more than three decimals and the value on
// screen is exactly the value that was summed.
function partAmountText(mcg: number): string {
  return mcg >= 1000 ? `${fmt(mcg / 1000, 3)} mg` : `${fmt(mcg, 0)} mcg`;
}

function render(): void {
  const vial = parseFloat(state.vial) || 0;
  const water = parseFloat(state.water) || 0;
  const amountRaw = parseFloat(state.amount) || 0;
  const amountMg = state.amountUnit === "mcg" ? amountRaw / 1000 : amountRaw;

  const conc = concentrationMgPerMl(vial, water);
  const volume = volumePerAliquotMl(amountMg, conc);
  const count = aliquotsPerVial(vial, amountMg);

  // Every number that reaches the DOM has to be finite. Inputs can be valid on
  // their own and still overflow together (vial 1e308 over water 1e-308), and
  // the empty state is the honest answer there, not "Infinity" in a readout or
  // a blend row. The volume and count null checks are what the calc helpers
  // return in that case; they are repeated below so the compiler narrows them.
  const complete =
    Number.isFinite(vial) &&
    vial > 0 &&
    Number.isFinite(water) &&
    water > 0 &&
    Number.isFinite(amountMg) &&
    amountMg > 0 &&
    Number.isFinite(conc) &&
    conc > 0 &&
    volume !== null &&
    count !== null;

  emptyEl.hidden = complete;
  readoutsEl.hidden = !complete;

  if (!complete || volume === null || count === null) {
    blendRowsEl.innerHTML = "";
    blendEl.hidden = true;
    return;
  }

  rConc.textContent = `${fmt(conc, conc < 10 ? 2 : 1)} mg/ml`;
  rVol.textContent = `${fmt(volume, volume < 0.01 ? 4 : 3)} ml`;
  rCount.textContent = fmt(count, 0);

  const parts = state.preset ? blendComponentsForVial(state.preset, vial) : null;
  const amounts = parts ? blendAmountsPerAliquot(parts, volume, water, vial) : [];
  // Round the parts against the target amount, so what the rows show adds up to
  // the aliquot the readouts are about instead of one mcg more or less.
  const partsMcg =
    amounts.length > 0
      ? reconcileRoundedParts(
          amounts.map((a) => a.mcg),
          amountMg * 1000,
        )
      : null;

  if (partsMcg && partsMcg.length === amounts.length) {
    blendRowsEl.innerHTML = amounts
      .map((p, i) => {
        const color = SWATCHES[i % SWATCHES.length];
        const amountText = partAmountText(partsMcg[i]);
        return `<div class="row"><span class="sw" style="background:${color}"></span><span class="nm">${p.name}</span><span class="bar"><span style="width:${Math.min(100, p.fraction * 100)}%;background:${color}"></span></span><span class="amt">${amountText}</span></div>`;
      })
      .join("");
    blendEl.hidden = false;
  } else {
    blendRowsEl.innerHTML = "";
    blendEl.hidden = true;
  }
}

peptideSelect.addEventListener("change", (e) => {
  const slug = (e.target as HTMLSelectElement).value;
  state.preset = PEPTIDES.find((p) => p.slug === slug) ?? null;

  if (state.preset) {
    state.vial = String(state.preset.typicalVialMg[0]);
    vialInput.value = state.vial;
    const sizes = state.preset.typicalVialMg.map((m) => `${m} mg`).join(", ");
    presetEl.innerHTML = `<b>${state.preset.name}</b><br />Vial sizes in the catalogue: ${sizes}`;
    presetEl.hidden = false;
  } else {
    presetEl.hidden = true;
    presetEl.innerHTML = "";
  }

  render();
});

vialInput.addEventListener("input", (e) => {
  state.vial = (e.target as HTMLInputElement).value;
  render();
});
waterInput.addEventListener("input", (e) => {
  state.water = (e.target as HTMLInputElement).value;
  render();
});
amountInput.addEventListener("input", (e) => {
  state.amount = (e.target as HTMLInputElement).value;
  render();
});

function setAmountUnit(uom: "mcg" | "mg"): void {
  state.amountUnit = uom;
  mcgBtn.setAttribute("aria-pressed", String(uom === "mcg"));
  mgBtn.setAttribute("aria-pressed", String(uom === "mg"));
  render();
}
mcgBtn.addEventListener("click", () => setAmountUnit("mcg"));
mgBtn.addEventListener("click", () => setAmountUnit("mg"));

// Pre-select the peptide from a ?peptide=<slug> query param (e.g. an
// embedding page linking in with a peptide already chosen), then fire the
// same change handler as a manual selection, which fills the vial size.
// Water stays at its own default (2 ml); the target amount is never touched.
// No-op if the param is missing or unknown.
(function preselectFromQuery(): void {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("peptide");
  if (!slug) return;
  const match = PEPTIDES.find((p) => p.slug === slug);
  if (!match) return;
  peptideSelect.value = slug;
  peptideSelect.dispatchEvent(new Event("change"));
})();

render();
