import "./style.css";
import {
  clampUnits,
  concentrationMgPerMl,
  maxUnitsForWater,
  amountAtUnits,
  unitsToMl,
  targetUnits,
  dosesPerVial,
  blendAmountsAtUnits,
} from "./calc";
import { PEPTIDES, blendComponentsForVial, type Peptide } from "./peptides";
import { createSyringe } from "./syringe";

const SWATCHES = ["#0f766e", "#c67b12", "#3b6db3", "#8a4fbf"];

const app = document.getElementById("app");
if (!app) throw new Error("Missing #app root element");

app.innerHTML = `
<div class="wrap">
  <div class="grid">
    <section class="card">
      <h2>Inputs</h2>
      <div class="field">
        <label for="peptide">Peptide (optional)</label>
        <select id="peptide"><option value="__manual__">Manual entry</option></select>
        <p class="diluent" id="diluent" hidden></p>
        <p class="study-ref" id="studyRef" hidden></p>
        <p class="community-ref" id="communityRef" hidden></p>
      </div>
      <div class="field">
        <label for="vial">Peptide in vial (mg)</label>
        <input id="vial" type="number" inputmode="decimal" min="0" step="any" placeholder="e.g. 10" />
      </div>
      <div class="field">
        <label for="water">Bacteriostatic water added (ml)</label>
        <input id="water" type="number" inputmode="decimal" min="0" step="any" placeholder="e.g. 2" value="2" />
      </div>
      <div class="field" style="margin-bottom:0">
        <label for="dose">Target dose per draw</label>
        <div class="dose-row">
          <input id="dose" type="number" inputmode="decimal" min="0" step="any" placeholder="e.g. 250" />
          <div class="unit-toggle" role="group" aria-label="Dose unit">
            <button type="button" id="u-mcg" aria-pressed="true">mcg</button>
            <button type="button" id="u-mg" aria-pressed="false">mg</button>
          </div>
        </div>
        <p class="hint">The amber marker shows where to draw for this dose.</p>
      </div>
    </section>

    <section class="card">
      <h2 style="display:flex;justify-content:space-between;align-items:center">
        Draw on a U-100 syringe
        <span id="unit-chip" class="unit-chip">0 U</span>
      </h2>
      <div class="syr-box" id="syr-box"></div>
      <div class="adjust">
        <span class="hint">Drag the plunger, use arrow keys, or the buttons.</span>
        <div class="btns">
          <button class="stepbtn" id="minus" aria-label="minus one unit">&minus;</button>
          <span class="uval"><span id="uval">0</span> U</span>
          <button class="stepbtn" id="plus" aria-label="plus one unit">+</button>
        </div>
      </div>

      <dl class="readouts">
        <div><dt>Amount drawn</dt><dd class="hi" id="r-amount">-</dd></div>
        <div><dt>Volume</dt><dd id="r-vol">-</dd></div>
        <div><dt>Units</dt><dd id="r-units">0 U</dd></div>
        <div><dt>Concentration</dt><dd id="r-conc">-</dd></div>
      </dl>

      <div class="blend" id="blend" hidden><p class="cap">Per component in this draw</p><div id="blend-rows"></div></div>

      <div class="foot">
        <span class="cap-note"><span id="doses">-</span> full doses per vial</span>
        <a class="brand" id="brand" href="https://peptidesdirect.io/research/reconstitution-calculator" target="_blank" rel="noopener">Powered by <b>peptidesdirect.io</b></a>
      </div>
      <p class="disc">Research and education reference only. U-100 syringe math (100 units = 1 ml). Not medical advice; not a dosing recommendation for humans or animals.</p>
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
  dose: string;
  doseUnit: "mcg" | "mg";
  rawUnits: number;
  autoFollow: boolean;
  preset: Peptide | null;
}

const state: State = {
  vial: "",
  water: "2",
  dose: "",
  doseUnit: "mcg",
  rawUnits: 0,
  autoFollow: true,
  preset: null,
};

interface Derived {
  vial: number;
  water: number;
  doseMg: number;
  conc: number;
  maxU: number;
  tgt: number | null;
  units: number;
}

function derived(): Derived {
  const vial = parseFloat(state.vial) || 0;
  const water = parseFloat(state.water) || 0;
  const doseRaw = parseFloat(state.dose) || 0;
  const doseMg = state.doseUnit === "mcg" ? doseRaw / 1000 : doseRaw;
  const conc = concentrationMgPerMl(vial, water);
  const maxU = maxUnitsForWater(water);
  const tgt = targetUnits(doseMg, conc);
  const units = clampUnits(state.rawUnits, maxU);
  return { vial, water, doseMg, conc, maxU, tgt, units };
}

const peptideSelect = req<HTMLSelectElement>("peptide");
const diluentEl = req<HTMLParagraphElement>("diluent");
const studyRefEl = req<HTMLParagraphElement>("studyRef");
const communityRefEl = req<HTMLParagraphElement>("communityRef");
const vialInput = req<HTMLInputElement>("vial");
const waterInput = req<HTMLInputElement>("water");
const doseInput = req<HTMLInputElement>("dose");
const uMcgBtn = req<HTMLButtonElement>("u-mcg");
const uMgBtn = req<HTMLButtonElement>("u-mg");
const unitChip = req<HTMLSpanElement>("unit-chip");
const uvalEl = req<HTMLSpanElement>("uval");
const minusBtn = req<HTMLButtonElement>("minus");
const plusBtn = req<HTMLButtonElement>("plus");
const rAmount = req<HTMLElement>("r-amount");
const rVol = req<HTMLElement>("r-vol");
const rUnits = req<HTMLElement>("r-units");
const rConc = req<HTMLElement>("r-conc");
const dosesEl = req<HTMLElement>("doses");
const blendEl = req<HTMLDivElement>("blend");
const blendRowsEl = req<HTMLDivElement>("blend-rows");

const syringe = createSyringe(req<HTMLDivElement>("syr-box"), {
  getMaxUnits: () => derived().maxU,
  onUnitsChange: (units) => {
    state.autoFollow = false;
    state.rawUnits = units;
    render();
  },
});

for (const p of PEPTIDES) {
  const option = document.createElement("option");
  option.value = p.slug;
  option.textContent = `${p.name} (${p.typicalVialMg.map((m) => `${m} mg`).join(", ")})`;
  peptideSelect.appendChild(option);
}

function render(): void {
  const d = derived();
  if (state.autoFollow && d.tgt !== null) {
    state.rawUnits = clampUnits(d.tgt, d.maxU);
  }
  const units = clampUnits(state.rawUnits, d.maxU);
  const hasInputs = d.vial > 0 && d.water > 0;

  syringe.render(units, d.maxU, d.tgt);

  const amt = amountAtUnits(units, d.conc);
  rAmount.textContent = hasInputs ? (amt.mg >= 1 ? `${fmt(amt.mg, 2)} mg` : `${fmt(Math.round(amt.mcg), 0)} mcg`) : "-";
  rVol.textContent = hasInputs ? `${fmt(unitsToMl(units), 2)} ml` : "-";
  rUnits.textContent = `${Math.round(units)} U`;
  rConc.textContent = hasInputs ? `${fmt(d.conc, d.conc < 10 ? 2 : 1)} mg/ml` : "-";
  uvalEl.textContent = String(Math.round(units));
  unitChip.textContent = `${Math.round(units)} U`;
  const doses = dosesPerVial(d.vial, d.doseMg);
  dosesEl.textContent = doses !== null ? fmt(doses, 0) : "-";
  minusBtn.disabled = units <= 0;
  plusBtn.disabled = units >= d.maxU;

  const parts = state.preset ? blendComponentsForVial(state.preset, d.vial) : null;
  if (parts && d.water > 0) {
    const amounts = blendAmountsAtUnits(parts, units, d.water, d.vial);
    blendRowsEl.innerHTML = amounts
      .map((p, i) => {
        const color = SWATCHES[i % SWATCHES.length];
        const amountText = p.mg >= 1 ? `${fmt(p.mg, 2)} mg` : `${fmt(Math.round(p.mcg), 0)} mcg`;
        return `<div class="row"><span class="sw" style="background:${color}"></span><span class="nm">${p.name}</span><span class="bar"><span style="width:${Math.min(100, p.fraction * 100)}%;background:${color}"></span></span><span class="amt">${amountText}</span></div>`;
      })
      .join("");
    blendEl.hidden = false;
  } else {
    blendEl.hidden = true;
  }
}

peptideSelect.addEventListener("change", (e) => {
  const slug = (e.target as HTMLSelectElement).value;
  state.preset = PEPTIDES.find((p) => p.slug === slug) ?? null;

  if (state.preset) {
    state.vial = String(state.preset.typicalVialMg[0]);
    vialInput.value = state.vial;
    diluentEl.textContent = `Suggested diluent: ${state.preset.diluent}`;
    diluentEl.hidden = false;
  } else {
    diluentEl.hidden = true;
  }

  if (state.preset && state.preset.studyDose) {
    studyRefEl.innerHTML =
      `Doses used in research: ${state.preset.studyDose}. ${state.preset.studyNote}. Reference only, not a recommendation. ` +
      `<a href="https://peptidesdirect.io/research/dosing" target="_blank" rel="noopener">Full dosing reference -&gt;</a>`;
    studyRefEl.hidden = false;
  } else {
    studyRefEl.hidden = true;
    studyRefEl.innerHTML = "";
  }

  if (state.preset && state.preset.communityDose) {
    communityRefEl.innerHTML =
      `Discussed in research communities: ${state.preset.communityDose}. ` +
      `Reference from peptide forums. Not a recommendation, no study basis, no established human protocol.`;
    communityRefEl.hidden = false;
  } else {
    communityRefEl.hidden = true;
    communityRefEl.innerHTML = "";
  }

  state.autoFollow = true;
  render();
});

vialInput.addEventListener("input", (e) => {
  state.vial = (e.target as HTMLInputElement).value;
  state.autoFollow = true;
  render();
});
waterInput.addEventListener("input", (e) => {
  state.water = (e.target as HTMLInputElement).value;
  state.autoFollow = true;
  render();
});
doseInput.addEventListener("input", (e) => {
  state.dose = (e.target as HTMLInputElement).value;
  state.autoFollow = true;
  render();
});

function setDoseUnit(unit: "mcg" | "mg"): void {
  state.doseUnit = unit;
  uMcgBtn.setAttribute("aria-pressed", String(unit === "mcg"));
  uMgBtn.setAttribute("aria-pressed", String(unit === "mg"));
  state.autoFollow = true;
  render();
}
uMcgBtn.addEventListener("click", () => setDoseUnit("mcg"));
uMgBtn.addEventListener("click", () => setDoseUnit("mg"));

minusBtn.addEventListener("click", () => syringe.stepBy(-1));
plusBtn.addEventListener("click", () => syringe.stepBy(1));

// Pre-select the peptide from a ?peptide=<slug> query param (e.g. an
// embedding page linking in with a peptide already chosen), then fire the
// same change handler as a manual selection so mg/diluent/study-dose fill
// in. Water stays at its own default (2 ml); the dose input is never
// touched. No-op if the param is missing or unknown.
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
