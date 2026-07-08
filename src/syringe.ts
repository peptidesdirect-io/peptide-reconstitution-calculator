/**
 * Interactive draggable U-100 syringe SVG. Ported from the vanilla-JS
 * version's inline <svg id="syr"> (drag/keyboard/step, target marker, liquid
 * fill), split out into its own typed module. Geometry and behaviour are
 * unchanged from the original: viewBox 0 0 900 210, barrel from x=102 to
 * x=802, 100 tick marks, plunger drag via pointer events, arrow-key stepping
 * (Shift = 5 units), target marker for the current dose.
 */
import { clampUnits } from "./calc";

export interface SyringeOptions {
  /** Current max draw (barrel top, in units) for clamping drag/keyboard input. */
  getMaxUnits: () => number;
  /** Fired whenever the user drags, arrow-keys, or steps the plunger. */
  onUnitsChange: (units: number) => void;
}

export interface SyringeInstance {
  svg: SVGSVGElement;
  /** Repaints the plunger/liquid/target marker for the given state. */
  render(units: number, maxUnits: number, targetUnits: number | null): void;
  /** Moves keyboard focus to the plunger (e.g. after a peptide selection). */
  focus(): void;
  /** Nudges the current units by delta (used by the +/- step buttons). */
  stepBy(delta: number): void;
}

const NS = "http://www.w3.org/2000/svg";

// Geometry (viewBox 0 0 900 210), unchanged from the original.
const X0 = 104;
const XMAX = 792;
const SPAN = XMAX - X0;
const ROD_LEN = 690;
const STOPPER_W = 15;
const BARREL_Y = 72;
const BARREL_H = 60;

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node as SVGElementTagNameMap[K];
}

export function createSyringe(container: HTMLElement, options: SyringeOptions): SyringeInstance {
  const svg = svgEl("svg", {
    viewBox: "0 0 900 210",
    role: "group",
    "aria-label": "Interactive syringe",
  });
  svg.style.display = "block";
  svg.style.width = "100%";
  svg.style.touchAction = "none";
  svg.style.userSelect = "none";
  svg.style.cursor = "pointer";

  const defs = svgEl("defs");
  const liqGrad = svgEl("linearGradient", { id: "liq", x1: "0", y1: "0", x2: "0", y2: "1" });
  liqGrad.appendChild(svgEl("stop", { offset: "0", "stop-color": "#2bb3a6" }));
  liqGrad.appendChild(svgEl("stop", { offset: "1", "stop-color": "#0f766e" }));
  const glassGrad = svgEl("linearGradient", { id: "glass", x1: "0", y1: "0", x2: "0", y2: "1" });
  glassGrad.appendChild(svgEl("stop", { offset: "0", "stop-color": "#000", "stop-opacity": ".05" }));
  glassGrad.appendChild(svgEl("stop", { offset: ".5", "stop-color": "#fff", "stop-opacity": ".55" }));
  glassGrad.appendChild(svgEl("stop", { offset: "1", "stop-color": "#000", "stop-opacity": ".08" }));
  defs.appendChild(liqGrad);
  defs.appendChild(glassGrad);
  svg.appendChild(defs);

  // Needle
  svg.appendChild(svgEl("rect", { x: 18, y: 98, width: 72, height: 4, rx: 2, fill: "#aeb4c0" }));
  svg.appendChild(svgEl("rect", { x: 86, y: 92, width: 16, height: 16, rx: 3, fill: "#c4c8d0" }));

  // Barrel + liquid + glass overlay
  svg.appendChild(
    svgEl("rect", {
      x: 102,
      y: BARREL_Y,
      width: 700,
      height: BARREL_H,
      rx: 12,
      fill: "#fdfdfc",
      stroke: "#c9cdd6",
      "stroke-width": 1.5,
    }),
  );
  const liquid = svgEl("rect", { id: "liquid", x: 104, y: 74, width: 0, height: 56, rx: 10, fill: "url(#liq)" });
  svg.appendChild(liquid);
  svg.appendChild(
    svgEl("rect", {
      x: 102,
      y: BARREL_Y,
      width: 700,
      height: BARREL_H,
      rx: 12,
      fill: "url(#glass)",
      "pointer-events": "none",
    }),
  );

  const ticks = svgEl("g", { id: "ticks", "pointer-events": "none" });
  svg.appendChild(ticks);
  const target = svgEl("g", { id: "target", "pointer-events": "none" });
  svg.appendChild(target);

  // Plunger (stopper + rod + thumb)
  const plunger = svgEl("g", {
    id: "plunger",
    tabindex: 0,
    role: "slider",
    "aria-label": "Plunger position (units)",
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": 0,
  });
  plunger.style.cursor = "grab";
  const rod = svgEl("rect", { id: "rod", x: 104, y: 95, width: 0, height: 14, fill: "#cfd3da" });
  const stopper = svgEl("rect", {
    id: "stopper",
    x: 104,
    y: 70,
    width: 15,
    height: 64,
    rx: 4,
    fill: "#3aa79b",
    stroke: "#0f766e",
  });
  const thumb = svgEl("rect", { id: "thumb", x: 794, y: 62, width: 14, height: 80, rx: 5, fill: "#3aa79b" });
  plunger.appendChild(rod);
  plunger.appendChild(stopper);
  plunger.appendChild(thumb);
  svg.appendChild(plunger);

  container.appendChild(svg);

  // Build the 0-100 tick marks once.
  for (let u = 0; u <= 100; u++) {
    const x = X0 + SPAN * (u / 100);
    const major = u % 10 === 0;
    const mid = u % 5 === 0;
    const len = major ? 18 : mid ? 12 : 7;
    ticks.appendChild(
      svgEl("line", {
        x1: x,
        x2: x,
        y1: BARREL_Y + 2,
        y2: BARREL_Y + 2 + len,
        stroke: major ? "#6b7280" : "#aab0ba",
        "stroke-width": major ? 1.4 : 1,
      }),
    );
    if (major && u > 0) {
      const text = svgEl("text", {
        x,
        y: BARREL_Y + BARREL_H - 8,
        "text-anchor": "middle",
        "font-family": "monospace",
        "font-size": 10,
        fill: "#6b7280",
      });
      text.textContent = String(u);
      ticks.appendChild(text);
    }
  }

  let currentUnits = 0;
  let dragging = false;

  function updateFromClientX(clientX: number): void {
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const scale = 900 / rect.width;
    const u = ((clientX - rect.left) * scale - X0) / SPAN * 100;
    options.onUnitsChange(clampUnits(u, options.getMaxUnits()));
  }

  svg.addEventListener("pointerdown", (e) => {
    dragging = true;
    svg.style.cursor = "grabbing";
    updateFromClientX(e.clientX);
    e.preventDefault();
    plunger.focus();
  });
  window.addEventListener("pointermove", (e) => {
    if (dragging) updateFromClientX(e.clientX);
  });
  window.addEventListener("pointerup", () => {
    dragging = false;
    svg.style.cursor = "pointer";
  });

  plunger.addEventListener("keydown", (e) => {
    let dd = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") dd = 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") dd = -1;
    else return;
    if (e.shiftKey) dd *= 5;
    e.preventDefault();
    options.onUnitsChange(clampUnits(currentUnits + dd, options.getMaxUnits()));
  });

  function render(units: number, maxUnits: number, targetUnitsValue: number | null): void {
    currentUnits = units;
    const px = X0 + SPAN * (units / 100);
    liquid.setAttribute("width", String(Math.max(0, px - X0)));
    stopper.setAttribute("x", String(px));
    rod.setAttribute("x", String(px + STOPPER_W));
    rod.setAttribute("width", String(Math.max(0, px + ROD_LEN - (px + STOPPER_W))));
    thumb.setAttribute("x", String(px + ROD_LEN));
    plunger.setAttribute("aria-valuenow", String(Math.round(units)));
    plunger.setAttribute("aria-valuemax", String(maxUnits));

    target.innerHTML = "";
    if (targetUnitsValue !== null) {
      const over = targetUnitsValue > 100;
      const tx = X0 + SPAN * (Math.min(targetUnitsValue, 100) / 100);
      target.appendChild(
        svgEl("line", {
          x1: tx,
          x2: tx,
          y1: BARREL_Y - 10,
          y2: BARREL_Y + BARREL_H + 10,
          stroke: "#c67b12",
          "stroke-width": 2,
          "stroke-dasharray": "4 4",
        }),
      );
      target.appendChild(
        svgEl("rect", { x: tx - 30, y: BARREL_Y - 28, width: 60, height: 18, rx: 4, fill: "#c67b12" }),
      );
      const label = svgEl("text", {
        x: tx,
        y: BARREL_Y - 15,
        "text-anchor": "middle",
        "font-family": "monospace",
        "font-size": 11,
        "font-weight": 700,
        fill: "#fff",
      });
      label.textContent = over ? ">100U" : `${Math.round(Math.min(targetUnitsValue, 100))}U`;
      target.appendChild(label);
    }
  }

  function focus(): void {
    plunger.focus();
  }

  function stepBy(delta: number): void {
    options.onUnitsChange(clampUnits(currentUnits + delta, options.getMaxUnits()));
  }

  return { svg, render, focus, stepBy };
}
