// The browser page: the slide viewer the live preview and the exported HTML file share. It runs in the browser,
// not in Obsidian, so it is plain JavaScript in a string, given the deck through window.yaasSource:
// { load(): Promise<deck>, live?(onChange), copy?: boolean }
import { fitCode } from '../render/slide';
import type { WebDeck } from '../types';

// P or the browser's Print draws every slide as its own 1920×1080 page, for Save as PDF. fitCode is bound by value,
// so its name does not matter once the plugin is minified
const VIEWER_JS = `(function () {
  const fitCode = (${fitCode.toString()});
  const $ = (s) => document.querySelector(s);
  const stage = $(".yaas-stage"), notes = $(".yaas-notes");
  let deck = null, index = Math.max(0, (parseInt(location.hash.slice(1), 10) || 1) - 1);
  function draw(stageEl, slide, position, fraction) {
    const style = slide.style;
    for (const k of ["bg", "text", "accent"]) stageEl.style.setProperty("--ks-" + k, style[k]);
    if (deck.font) stageEl.style.setProperty("--ks-font", deck.font);
    const backdrop = stageEl.querySelector(".yaas-backdrop"), dim = stageEl.querySelector(".yaas-dim");
    backdrop.style.backgroundImage = style.image ? "url(" + JSON.stringify(style.image) + ")" : "";
    backdrop.style.backgroundSize = style.fit === "contain" ? "contain" : "cover";
    dim.style.opacity = style.image ? String(style.dim || 0) : "0";
    const slideEl = stageEl.querySelector(".yaas-slide");
    slideEl.className = slide.classes;
    // The slide as Obsidian drew it from the note: the plugin's own output, not text from elsewhere
    slideEl.innerHTML = slide.html;
    fitCode(slideEl);
    const counter = stageEl.querySelector(".yaas-counter");
    counter.textContent = position;
    counter.style.display = deck.counter ? "" : "none";
    const progress = stageEl.querySelector(".yaas-progress");
    progress.style.display = deck.progress ? "" : "none";
    progress.firstChild.style.width = (fraction * 100) + "%";
  }
  function fit() { stage.style.transform = "translate(-50%, -50%) scale(" + Math.min(innerWidth / 1920, innerHeight / 1080) + ")"; }
  function show() {
    if (!deck || !deck.slides.length) { stage.querySelector(".yaas-slide").textContent = "No slides yet."; return; }
    index = Math.min(Math.max(index, 0), deck.slides.length - 1);
    const slide = deck.slides[index];
    draw(stage, slide, (index + 1) + " / " + deck.slides.length, (index + 1) / deck.slides.length);
    // Apply the colours before fades are switched on, or this very first change would fade too
    void stage.offsetWidth;
    stage.classList.add("is-animated");
    notes.replaceChildren(...((slide.notes || []).length ? slide.notes : ["No speaker notes for this slide."])
      .map((text) => Object.assign(document.createElement("p"), { textContent: text })));
    history.replaceState(null, "", "#" + (index + 1));
    if (window.yaasSource.copy) addCopyButtons(stage.querySelector(".yaas-slide"));
  }
  // Live preview only: a copy icon on every code block (its text) and diagram (its Mermaid source); a tick after
  // copying, a cross if the browser refused
  const SVG = "http://www.w3.org/2000/svg";
  const ICONS = {
    copy: [["rect", { x: 9, y: 9, width: 13, height: 13, rx: 2 }], ["path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }]],
    done: [["path", { d: "M20 6 9 17l-5-5" }]],
    failed: [["path", { d: "M18 6 6 18M6 6l12 12" }]],
  };
  function icon(name) {
    const svg = document.createElementNS(SVG, "svg");
    const attrs = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" };
    for (const key in attrs) svg.setAttribute(key, attrs[key]);
    for (const [tag, shape] of ICONS[name]) {
      const el = document.createElementNS(SVG, tag);
      for (const key in shape) el.setAttribute(key, shape[key]);
      svg.append(el);
    }
    return svg;
  }
  function addCopyButtons(slideEl) {
    const targets = [];
    slideEl.querySelectorAll("pre").forEach((pre) => targets.push([pre, () => (pre.querySelector("code") || pre).textContent]));
    slideEl.querySelectorAll(".mermaid[data-source]").forEach((diagram) => targets.push([diagram, () => diagram.dataset.source]));
    targets.forEach(([box, text]) => {
      const button = document.createElement("button");
      button.className = "yaas-copy";
      button.type = "button";
      button.title = "Copy";
      button.setAttribute("aria-label", "Copy");
      button.replaceChildren(icon("copy"));
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        let done = true;
        try { await navigator.clipboard.writeText(text()); } catch (error) { done = false; }
        button.replaceChildren(icon(done ? "done" : "failed"));
        button.title = done ? "Copied" : "Could not copy";
        button.classList.toggle("is-done", done);
        setTimeout(() => {
          button.replaceChildren(icon("copy"));
          button.title = "Copy";
          button.classList.remove("is-done");
        }, 1500);
      });
      box.append(button);
      if (box.classList.contains("mermaid")) besideDrawing(box, button);
    });
  }
  // A diagram is drawn centred in all the room it has: the icon goes just right of the drawing's top corner, or
  // inside that corner when there is no room beside it
  function besideDrawing(diagram, button) {
    const svg = diagram.querySelector("svg");
    const box = svg && svg.viewBox && svg.viewBox.baseVal;
    if (!box || !box.width || !box.height) return;
    const scale = Math.min(diagram.clientWidth / box.width, diagram.clientHeight / box.height);
    const side = (diagram.clientWidth - box.width * scale) / 2;
    const top = (diagram.clientHeight - box.height * scale) / 2;
    const size = button.offsetWidth;
    button.style.top = top + "px";
    button.style.right = (side >= size + 24 ? side - size - 24 : side) + "px";
  }
  async function load() {
    try { deck = await window.yaasSource.load(); } catch (error) { stage.querySelector(".yaas-slide").textContent = error.message; return; }
    document.title = deck.title;
    show();
  }
  addEventListener("beforeprint", () => {
    const sheet = document.createElement("div");
    sheet.className = "yaas-print";
    deck.slides.forEach((slide, i) => {
      const copy = stage.cloneNode(true);
      copy.removeAttribute("style");
      copy.classList.remove("is-animated");
      draw(copy, slide, (i + 1) + " / " + deck.slides.length, (i + 1) / deck.slides.length);
      sheet.append(copy);
    });
    document.body.append(sheet);
    // The print pages are hidden on screen: shown out of sight for a moment, so their code can be measured
    sheet.classList.add("is-fitting");
    sheet.querySelectorAll(".yaas-slide").forEach(fitCode);
    sheet.classList.remove("is-fitting");
  });
  addEventListener("afterprint", () => document.querySelectorAll(".yaas-print").forEach((el) => el.remove()));
  addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, " ": 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (step) { index += step; show(); e.preventDefault(); }
    else if (e.key === "Home") { index = 0; show(); }
    else if (e.key === "End") { index = 1e9; show(); }
    else if ((e.key === "n" || e.key === "N") && notes.dataset.allowed) notes.hidden = !notes.hidden;
    else if (e.key === "f" || e.key === "F") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    else if (e.key === "p" || e.key === "P") print();
  });
  $(".yaas").addEventListener("click", (e) => {
    if (e.target.closest("a, .yaas-notes, .yaas-copy")) return;
    index += e.clientX < innerWidth / 3 ? -1 : 1; show();
  });
  addEventListener("resize", fit);
  fit(); load();
  if (window.yaasSource.live) window.yaasSource.live(load);
})();`;

const PAGE_HEAD = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>:root{--font-interface:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}html,body{margin:0;height:100%;background:#120b11}
.yaas-print{display:none}.yaas-print.is-fitting{display:block;position:absolute;left:-100000px;top:0}
@page{size:1920px 1080px;margin:0}
@media print{html,body{height:auto;background:none}.yaas{display:none}.yaas-print{display:block}
.yaas-print *{transition:none!important}.yaas-print .yaas-stage{position:relative;left:0;top:0;transform:none;break-after:page;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;

const PAGE_BODY = '<div class="yaas"><div class="yaas-stage"><div class="yaas-backdrop"></div><div class="yaas-dim"></div><div class="yaas-slide"></div><div class="yaas-counter"></div><div class="yaas-progress"><div class="yaas-progress-bar"></div></div></div><div class="yaas-notes" hidden data-allowed="1"></div></div>';

/** The live preview: data from this computer's YAAS server, redrawn whenever the note is saved. The stylesheet is
 *  in the head (the key is hex only), so the first slide is drawn with its colours, not faded in */
export function previewPage(key: string): string {
	return `<!doctype html>
<html lang="en"><head>${PAGE_HEAD}<link rel="stylesheet" href="/yaas.css?key=${key}"><title>YAAS</title></head><body>
${PAGE_BODY}
<script>
const q = new URLSearchParams(location.search), file = q.get("file"), key = q.get("key");
const api = (path) => path + "?file=" + encodeURIComponent(file) + "&key=" + encodeURIComponent(key);
window.yaasSource = {
  load: async () => {
    const response = await fetch(api("/deck.json"));
    if (!response.ok) throw new Error("Note not found, or this link has expired: open the deck again from Obsidian.");
    const deck = await response.json();
    deck.title += " · YAAS";
    return deck;
  },
  live: (onChange) => { new EventSource(api("/events")).onmessage = onChange; },
  copy: true,
};
${VIEWER_JS}
</script></body></html>`;
}

/** The file to share: one HTML page with the styles, the slides and their images inside, no speaker notes */
export function exportPage(css: string, deck: WebDeck): string {
	const data = JSON.stringify(deck).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
	const escapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
	const title = deck.title.replace(/[&<>"]/g, (c) => escapes[c] ?? c);
	return `<!doctype html>
<html lang="en"><head>${PAGE_HEAD}<title>${title}</title>
<style>${css.replace(/<\/style/gi, '<\\/style')}</style></head><body>
${PAGE_BODY.replace(' data-allowed="1"', '')}
<script>
window.yaasSource = { load: async () => (${data}) };
${VIEWER_JS}
</script></body></html>`;
}
