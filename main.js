/* YAAS (Yet Another Advanced Slides): presents a note as full-screen slides, with a settings panel and a
   live preview in the browser at localhost. Plain CommonJS, no build step. How to use it: README.md beside this file. */
const {
  Plugin, PluginSettingTab, Setting, MarkdownRenderer, Component, MarkdownView, Notice, ItemView, Platform,
  FuzzySuggestModal, TFile, setIcon,
} = require("obsidian");

const STAGE_W = 1920;
const STAGE_H = 1080;
const THUMB_W = 256;
const VIEW_TYPE = "yaas-panel";

const DEFAULTS = {
  bg: "#FFF3E2",
  text: "#241722",
  accent: "#D01C7F",
  font: "",
  counter: true,
  progress: true,
  port: 3939,
};

const IMAGE_TYPES = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  svg: "image/svg+xml", avif: "image/avif", bmp: "image/bmp",
};

// Ready-made colours for the panel. Every theme keeps its text at 4.5:1 or more against its background and its
// accent at 3:1 or more, which slide text (28 px and up) needs; the test checks it
const THEMES = [
  { name: "Paper", bg: "#FFF3E2", text: "#241722", accent: "#D01C7F" },
  { name: "Bubblegum", bg: "#FFC8E3", text: "#4A0E33", accent: "#C4006A" },
  { name: "Lemonade", bg: "#FFF06B", text: "#2B2300", accent: "#C23A00" },
  { name: "Lime", bg: "#C9FF4D", text: "#162300", accent: "#6B00C2" },
  { name: "Mint pop", bg: "#9DF5D0", text: "#073B2A", accent: "#006E52" },
  { name: "Sky candy", bg: "#A9DCFF", text: "#0A2A55", accent: "#0049B8" },
  { name: "Peach fizz", bg: "#FFB38A", text: "#3A1100", accent: "#8E0057" },
  { name: "Tangerine", bg: "#FF7A1A", text: "#1F0A00", accent: "#5C00A3" },
  { name: "Watermelon", bg: "#CC0F47", text: "#FFF4F7", accent: "#FFE45C" },
  { name: "Grape soda", bg: "#6B2BD9", text: "#FFF7E8", accent: "#FFE45C" },
  { name: "Ocean", bg: "#0057C2", text: "#F2F8FF", accent: "#FFD84D" },
  { name: "Neon night", bg: "#15102E", text: "#F5F3FF", accent: "#3DFFC6" },
];

// What clicking a colour offers, by the job that colour does. Every "On candy" text and accent reads on every candy
// background, every "On bold" one on every bold background; the test checks it
const SWATCHES = {
  bg: [
    ["Candy", [["Paper", "#FFF3E2"], ["Bubblegum", "#FFC8E3"], ["Cotton candy", "#FFE3F1"], ["Lemonade", "#FFF06B"], ["Lime", "#C9FF4D"],
      ["Pistachio", "#E2F7B5"], ["Mint", "#9DF5D0"], ["Sky", "#A9DCFF"], ["Peach", "#FFB38A"], ["Lilac", "#D9C2FF"]]],
    ["Bold", [["Watermelon", "#CC0F47"], ["Magenta", "#D01C7F"], ["Grape", "#6B2BD9"], ["Ocean", "#0057C2"], ["Jungle", "#0B6B47"], ["Neon night", "#15102E"]]],
  ],
  text: [
    ["On candy", [["Ink", "#241722"], ["Plum", "#4A0E33"], ["Navy", "#0A2A55"], ["Forest", "#073B2A"], ["Grape", "#250A4F"], ["Cocoa", "#3A1100"]]],
    ["On bold", [["Cream", "#FFF3E2"], ["Snow", "#FFFBF4"], ["Ice", "#F2F8FF"], ["Lavender", "#F5F3FF"]]],
  ],
  accent: [
    ["On candy", [["Hot pink", "#C4006A"], ["Red", "#C2002F"], ["Orange", "#C23A00"], ["Berry", "#8E0057"],
      ["Purple", "#6B00C2"], ["Blue", "#0049B8"], ["Teal", "#006E52"]]],
    ["On bold", [["Sunshine", "#FFE45C"], ["Neon mint", "#3DFFC6"], ["Bubblegum", "#FFB3DA"], ["Sky", "#9FD8FF"], ["Lime", "#C9FF4D"]]],
  ],
};

// The three colours of a slide, as the panel and the settings name and explain them. "Highlight" is the `accent` key
// in notes, which also accept `highlight`
const COLOR_JOBS = [
  ["bg", "Background", "The whole slide, under the soft gradient"],
  ["text", "Text", "Headings, body text, tables, and the text and lines of diagrams"],
  ["accent", "Highlight", "What should stand out: bold text, bullets and numbers, links, the slide number, the progress line and diagram boxes"],
];

// ---------------------------------------------------------------------------------------------------------------
// The deck format: slides split on ---, %% comments are speaker notes, one starting with "slide" styles its slide

const STYLE_KEYS = {
  bg: "bg", background: "bg", text: "text", color: "text", accent: "accent", highlight: "accent", align: "align",
  image: "image", "bg-image": "image", fit: "fit", dim: "dim", layout: "layout",
};
// The order a slide's comment is written back in by the panel
const STYLE_ORDER = ["bg", "text", "accent", "align", "image", "dim", "fit", "layout"];

// Each key takes only the values it understands; anything else is ignored, never passed to CSS
const STYLE_VALUES = {
  bg: isColor, text: isColor, accent: isColor,
  align: (value) => value === "left" || value === "center",
  fit: (value) => value === "cover" || value === "contain",
  layout: (value) => value === "image-left" || value === "image-right",
  dim: (value) => /^(0(\.\d+)?|1(\.0+)?)$/.test(String(value)),
  image: (value) => value.length > 0 && value.length <= 500,
};

function isColor(value) {
  return /^#[0-9a-f]{3,8}$/i.test(value) || /^(rgb|hsl)a?\([\d\s.,%/]+\)$/i.test(value) || /^[a-z]{3,20}$/i.test(value);
}

// image=[[photo.png]], image=photo.png or image=https://…: the link without [[ ]] or an |alias
function imageLink(value) {
  return value.replace(/^!?\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
}

function parseStyle(source) {
  const style = {};
  for (const match of source.matchAll(/([a-z-]+)\s*=\s*("[^"]*"|!?\[\[[^\]]+\]\]|\S+)/gi)) {
    const key = STYLE_KEYS[match[1].toLowerCase()];
    let value = match[2].replace(/^"|"$/g, "");
    if (key === "image") value = imageLink(value);
    if (key && STYLE_VALUES[key](value)) style[key] = key === "dim" ? Number(value) : value;
  }
  return style;
}

function parseSlide(source) {
  const style = {};
  const notes = [];
  const markdown = source.replace(/%%([\s\S]*?)%%/g, (_, inner) => {
    const directive = /^\s*slide\b([\s\S]*)$/.exec(inner);
    if (directive) Object.assign(style, parseStyle(directive[1]));
    else if (inner.trim()) notes.push(inner.trim());
    return "";
  });
  return { markdown: markdown.trim(), style, notes };
}

function frontmatterEnd(text) {
  const frontmatter = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/.exec(text);
  return frontmatter ? frontmatter[0].length : 0;
}

// Like Obsidian's own Slides: a line of only --- (outside code fences) starts a new slide; the properties block at
// the top is not a slide. Each piece keeps where it sits in the note, so the panel can write back into it
function splitSegments(text) {
  const bounds = [];
  let start = frontmatterEnd(text);
  let pos = start;
  let fence = null;
  for (;;) {
    const newline = text.indexOf("\n", pos);
    const line = text.slice(pos, newline === -1 ? text.length : newline).replace(/\r$/, "");
    const opener = /^\s*(`{3,}|~{3,})/.exec(line);
    if (opener) {
      if (!fence) fence = opener[1];
      else if (line.trim().startsWith(fence)) fence = null;
    }
    if (!fence && /^\s*---\s*$/.test(line)) {
      bounds.push({ start, end: pos });
      start = newline === -1 ? text.length : newline + 1;
    }
    if (newline === -1) break;
    pos = newline + 1;
  }
  bounds.push({ start, end: text.length });
  return bounds.map((bound) => ({ ...bound, source: text.slice(bound.start, bound.end) }));
}

// The slides worth showing: empty pieces (two --- in a row) are skipped. `segment` points back into the note
function parseDeck(text) {
  return splitSegments(text)
    .map((segment, index) => Object.assign(parseSlide(segment.source), { segment: index }))
    .filter((slide) => slide.markdown || slide.notes.length);
}

function serializeStyle(style) {
  const parts = [];
  for (const key of STYLE_ORDER) {
    const value = style[key];
    if (value === undefined || value === null || value === "") continue;
    if (key === "image") parts.push(/^https?:\/\//i.test(value) ? `image=${value}` : `image=[[${value}]]`);
    else parts.push(`${key}=${value}`);
  }
  return parts.length ? `%% slide ${parts.join(" ")} %%` : "";
}

// Replace slide number `slideIndex`'s styling comment (or add one at its top); everything else stays as written
function writeSlideStyle(text, slideIndex, style) {
  const slide = parseDeck(text)[slideIndex];
  if (!slide) return text;
  const segment = splitSegments(text)[slide.segment];
  const cleaned = segment.source.replace(/%%\s*slide\b[\s\S]*?%%[ \t]*(\r?\n)?/g, "");
  const directive = serializeStyle(style);
  const lead = /^\s*/.exec(cleaned)[0];
  const source = directive ? `${lead}${directive}\n${cleaned.slice(lead.length)}` : cleaned;
  return text.slice(0, segment.start) + source + text.slice(segment.end);
}

// Deck-wide colours from the note's properties: slide-bg, slide-text, slide-accent
function deckStyle(frontmatter) {
  const style = {};
  if (!frontmatter) return style;
  for (const key of ["bg", "text", "accent"]) {
    const value = frontmatter[`slide-${key}`] ?? (key === "accent" ? frontmatter["slide-highlight"] : undefined);
    if (typeof value === "string" && isColor(value.trim())) style[key] = value.trim();
  }
  return style;
}

function slideTitle(slide) {
  const heading = /^#{1,6}\s+(.+)$/m.exec(slide.markdown);
  const line = heading ? heading[1] : slide.markdown.split("\n").find((l) => l.trim()) || "(speaker notes only)";
  const plain = line.replace(/[*_`[\]#|]/g, "").trim();
  return plain.length > 60 ? `${plain.slice(0, 57)}…` : plain;
}

// ---------------------------------------------------------------------------------------------------------------
// Drawing a slide: the same 1920×1080 stage for presenting, the panel's previews and the browser page

async function renderMarkdown(app, markdown, el, path, component) {
  if (MarkdownRenderer.render) await MarkdownRenderer.render(app, markdown, el, path, component);
  else await MarkdownRenderer.renderMarkdown(markdown, el, path, component);
}

// The source of every ```mermaid block in a slide's markdown, in order
function mermaidSources(markdown) {
  const sources = [];
  const fence = /^ {0,3}(`{3,}|~{3,})\s*mermaid\s*\n([\s\S]*?)\n {0,3}\1[`~]*\s*$/gim;
  for (let match; (match = fence.exec(markdown));) sources.push(match[2]);
  return sources;
}

// Obsidian draws a Mermaid diagram only into an element that is on the page and shown, and after the markdown is
// rendered. So a slide is rendered in a hidden box off-screen, its diagrams awaited (3 s at most), and only then
// moved onto the stage or sent to the browser: never an empty or unrendered diagram
async function renderSlide(app, markdown, path, component) {
  const holder = document.body.createDiv({ cls: "yaas-offscreen" });
  try {
    await renderMarkdown(app, markdown, holder, path, component);
    for (let waited = 0; waited < 3000 && holder.querySelector(".mermaid:not(:has(svg)), code.language-mermaid"); waited += 50) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } finally {
    holder.detach();
  }
  return holder;
}

// Code fills the slide like a diagram: the largest font from 24 to 56 px at which every code block shows whole,
// found by halving the range. When even 24 px is too wide, a line is too long to shrink readably: long lines wrap
// instead, and the size is found again from 20 px, the smallest still readable on a projector. Code too long even at
// 20 px stays at 20 px and is cut off at the bottom, and the card says so: a fade and "↓ 14 more lines". Needs the slide laid out on the page; also sent to the browser page as
// it is, so plain ES5-ish code without template strings
function fitCode(slideEl) {
  var blocks = Array.prototype.slice.call(slideEl.querySelectorAll("pre"));
  if (!blocks.length || !slideEl.isConnected) return;
  var setSize = function (size) { blocks.forEach(function (pre) { pre.style.setProperty("--ks-code-size", size + "px"); }); };
  var fits = function (size) {
    setSize(size);
    return slideEl.scrollHeight <= slideEl.clientHeight + 1 && blocks.every(function (pre) {
      return pre.scrollWidth <= pre.clientWidth + 1 && pre.scrollHeight <= pre.clientHeight + 1;
    });
  };
  // The largest size from low to high that fits, or 0 when even low does not
  var largest = function (low, high) {
    if (!fits(low)) return 0;
    while (low < high) {
      var mid = Math.ceil((low + high) / 2);
      if (fits(mid)) low = mid; else high = mid - 1;
    }
    return low;
  };
  blocks.forEach(function (pre) {
    pre.classList.remove("is-wrapped", "is-cut");
    pre.removeAttribute("data-more");
  });
  var size = largest(24, 56);
  if (!size) {
    blocks.forEach(function (pre) { pre.classList.add("is-wrapped"); });
    size = largest(20, 56) || 20;
  }
  setSize(size);
  // Lines that do not fit: counted from how far the code runs past the bottom of its card
  blocks.forEach(function (pre) {
    var code = pre.querySelector("code") || pre;
    var style = getComputedStyle(pre);
    var shown = pre.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    var hidden = code.offsetHeight - shown;
    var line = parseFloat(getComputedStyle(code).lineHeight) || size * 1.55;
    if (hidden < line / 2) return;
    var more = Math.ceil(hidden / line);
    pre.classList.add("is-cut");
    pre.setAttribute("data-more", more === 1 ? "1 more line" : more + " more lines");
    // Where the card cuts the code off, for the fade
    code.style.setProperty("--ks-code-shown", shown + "px");
  });
}

// A slide rendered and ready to be shown: its markdown, code colours and diagrams done
async function prepareSlide(app, slide, file) {
  const component = new Component();
  component.load();
  const holder = await renderSlide(app, slide.markdown, file.path, component);
  return { holder, component };
}

// Fill a .yaas-slide from rendered markdown. layout=image-left|image-right: the first image takes one half
function arrange(slideEl, holder, style) {
  slideEl.empty();
  slideEl.className = "yaas-slide";
  if (style.align === "left") slideEl.classList.add("is-left");
  const image = style.layout && holder.querySelector(".image-embed, img");
  if (!image) {
    slideEl.append(...holder.childNodes);
    return;
  }
  slideEl.classList.add("is-split", `is-${style.layout}`);
  const media = slideEl.createDiv({ cls: "yaas-media" });
  const text = slideEl.createDiv({ cls: "yaas-text" });
  const block = image.closest(".internal-embed") ?? image;
  const parent = block.parentElement;
  media.append(block);
  if (parent && parent !== holder && !parent.textContent.trim() && !parent.querySelector("img")) parent.remove();
  if (style.fit === "contain") media.classList.add("is-contain");
  text.append(...holder.childNodes);
}

class Stage {
  constructor(plugin, parent, { counter = true, progress = false } = {}) {
    this.plugin = plugin;
    this.el = parent.createDiv({ cls: "yaas-stage" });
    // Painted first, under the text: the slide's background image and its dark layer
    this.backdrop = this.el.createDiv({ cls: "yaas-backdrop" });
    this.dimmer = this.el.createDiv({ cls: "yaas-dim" });
    this.slideEl = this.el.createDiv({ cls: "yaas-slide" });
    this.counter = this.el.createDiv({ cls: "yaas-counter" });
    if (!counter) this.counter.hide();
    // A line along the bottom edge, filled up to this slide
    this.progress = this.el.createDiv({ cls: "yaas-progress" });
    this.progressBar = this.progress.createDiv({ cls: "yaas-progress-bar" });
    if (!progress) this.progress.hide();
    if (plugin.settings.font) this.el.style.setProperty("--ks-font", plugin.settings.font);
    this.rendering = 0;
    this.component = null;
  }

  scale(factor) {
    this.el.style.transform = `translate(-50%, -50%) scale(${factor})`;
  }

  // Renders off-screen, then swaps in: a quick second call never leaves an older slide showing. `ready` is a slide
  // rendered ahead of time ({ holder, component }, or a promise of it), shown without rendering it again
  async show(file, slide, style, label, fraction = 0, ready = null) {
    const ticket = ++this.rendering;
    const prepared = ready ? await ready : await prepareSlide(this.plugin.app, slide, file);
    const { holder, component } = prepared;
    if (ticket !== this.rendering || !this.el.isConnected) {
      component.unload();
      return false;
    }
    this.component?.unload();
    this.component = component;
    for (const key of ["bg", "text", "accent"]) this.el.style.setProperty(`--ks-${key}`, style[key]);
    const url = style.image && this.plugin.imageUrl(style.image, file);
    this.backdrop.style.backgroundImage = url ? `url(${JSON.stringify(url)})` : "";
    this.backdrop.style.backgroundSize = style.fit === "contain" ? "contain" : "cover";
    this.dimmer.style.opacity = url ? String(style.dim ?? 0) : "0";
    arrange(this.slideEl, holder, style);
    fitCode(this.slideEl);
    this.counter.setText(label);
    this.progressBar.style.width = `${fraction * 100}%`;
    return true;
  }

  unload() {
    this.rendering++;
    this.component?.unload();
    this.component = null;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Presenting inside Obsidian

class Presentation {
  constructor(plugin, file, slides, baseStyle, start) {
    this.plugin = plugin;
    this.file = file;
    this.slides = slides;
    this.baseStyle = baseStyle;
    this.index = Math.min(Math.max(start, 0), slides.length - 1);
    // The slides either side of this one, rendered in the background while it is shown: index → promise of
    // { holder, component }. Moving on shows one at once, diagrams and code done
    this.ahead = new Map();
    this.onKey = this.onKey.bind(this);
    this.onResize = this.fit.bind(this);
    // Esc in full screen is taken by the browser to leave full screen: leaving it ends the presentation too
    this.onFullscreen = () => { if (this.wasFullscreen && !document.fullscreenElement) this.close(); };
  }

  open() {
    this.overlay = document.body.createDiv({ cls: "yaas" });
    this.stage = new Stage(this.plugin, this.overlay, { counter: this.plugin.settings.counter, progress: this.plugin.settings.progress });
    this.notesEl = this.overlay.createDiv({ cls: "yaas-notes" });
    this.notesEl.hide();
    this.overlay.addEventListener("click", (event) => {
      if (event.target.closest("a, .yaas-notes")) return;
      event.clientX < window.innerWidth / 3 ? this.go(this.index - 1) : this.go(this.index + 1);
    });
    document.addEventListener("keydown", this.onKey, true);
    window.addEventListener("resize", this.onResize);
    document.addEventListener("fullscreenchange", this.onFullscreen);
    this.overlay.requestFullscreen?.().then(() => { this.wasFullscreen = true; }).catch(() => {});
    this.fit();
    this.show();
  }

  close() {
    if (!this.overlay.isConnected) return;
    document.removeEventListener("keydown", this.onKey, true);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("fullscreenchange", this.onFullscreen);
    this.stage.unload();
    this.ahead.forEach((ready) => ready.then(({ component }) => component.unload()));
    this.ahead.clear();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    this.overlay.remove();
    this.plugin.presentation = null;
  }

  fit() {
    this.stage.scale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
  }

  go(index) {
    if (index < 0 || index >= this.slides.length || index === this.index) return;
    this.index = index;
    this.show();
  }

  async show() {
    const slide = this.slides[this.index];
    const style = Object.assign({}, this.baseStyle, slide.style);
    const ready = this.ahead.get(this.index) ?? null;
    this.ahead.delete(this.index);
    const shown = await this.stage.show(this.file, slide, style, `${this.index + 1} / ${this.slides.length}`, (this.index + 1) / this.slides.length, ready);
    if (!shown) return;
    this.prepareAround();
    // Apply the colours before fades are switched on, or this very first change would fade too
    void this.stage.el.offsetWidth;
    this.stage.el.addClass("is-animated");
    this.notesEl.empty();
    if (slide.notes.length) slide.notes.forEach((note) => this.notesEl.createEl("p", { text: note }));
    else this.notesEl.createEl("p", { text: "No speaker notes for this slide.", cls: "is-empty" });
  }

  // Render the next and previous slides ahead, and let go of any further away
  prepareAround() {
    if (!this.overlay.isConnected) return;
    for (const [index, ready] of this.ahead) {
      if (Math.abs(index - this.index) <= 1) continue;
      this.ahead.delete(index);
      ready.then(({ component }) => component.unload());
    }
    for (const index of [this.index + 1, this.index - 1]) {
      if (index < 0 || index >= this.slides.length || this.ahead.has(index)) continue;
      this.ahead.set(index, prepareSlide(this.plugin.app, this.slides[index], this.file));
    }
  }

  onKey(event) {
    const keys = {
      ArrowRight: () => this.go(this.index + 1), ArrowDown: () => this.go(this.index + 1),
      PageDown: () => this.go(this.index + 1), " ": () => this.go(this.index + 1),
      ArrowLeft: () => this.go(this.index - 1), ArrowUp: () => this.go(this.index - 1),
      PageUp: () => this.go(this.index - 1),
      Home: () => this.go(0), End: () => this.go(this.slides.length - 1),
      n: () => this.notesEl.toggle(!this.notesEl.isShown()),
      N: () => this.notesEl.toggle(!this.notesEl.isShown()),
      Escape: () => this.close(),
    };
    const action = keys[event.key];
    if (!action) return;
    // Keep Obsidian's own hotkeys out of the way while presenting
    event.preventDefault();
    event.stopPropagation();
    action();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The panel: the open note's slides with previews, and pickers that write the note's properties and comments

function toHex(value) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) return `#${value.slice(1).split("").map((c) => c + c).join("")}`.toLowerCase();
  const context = document.createElement("canvas").getContext("2d");
  context.fillStyle = "#000000";
  context.fillStyle = value;
  return /^#[0-9a-f]{6}$/i.test(context.fillStyle) ? context.fillStyle : "#000000";
}

class ImagePicker extends FuzzySuggestModal {
  constructor(app, onPick) {
    super(app);
    this.onPick = onPick;
    this.setPlaceholder("Choose an image from the vault");
  }

  getItems() {
    return this.app.vault.getFiles().filter((file) => IMAGE_TYPES[file.extension.toLowerCase()]);
  }

  getItemText(file) {
    return file.path;
  }

  onChooseItem(file) {
    this.onPick(file);
  }
}

class YaasView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.file = null;
    this.opened = new Set();
    this.stages = [];
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "YAAS slides"; }
  getIcon() { return "presentation"; }

  async onOpen() {
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.follow()));
    this.registerEvent(this.app.vault.on("modify", (file) => { if (file === this.file) this.schedule(); }));
    this.registerEvent(this.app.metadataCache.on("changed", (file) => { if (file === this.file) this.schedule(); }));
    this.follow();
  }

  async onClose() {
    clearTimeout(this.timer);
    this.lazy?.disconnect();
    this.sizer?.disconnect();
    this.closeSwatches();
    this.clearStages();
  }

  // The panel shows the last note opened in the editor; clicking into the panel keeps it
  follow() {
    const file = this.app.workspace.getActiveFile();
    if (file && file.extension === "md" && file !== this.file) {
      this.file = file;
      this.opened.clear();
      this.refresh();
    } else if (!this.file) {
      this.refresh();
    }
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), 300);
  }

  clearStages() {
    this.stages.forEach((stage) => stage.unload());
    this.stages = [];
  }

  async refresh() {
    const root = this.contentEl;
    const scroll = root.scrollTop;
    this.closeSwatches();
    this.clearStages();
    root.empty();
    // Previews are drawn only when they scroll near view: a long deck no longer renders every slide on each save
    this.lazy?.disconnect();
    this.lazy = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        this.lazy.unobserve(entry.target);
        entry.target.yaasDraw?.();
      }
    }, { root, rootMargin: "600px 0px" });
    // Previews fill their card at any panel width: each stage is scaled to its box whenever the panel is resized
    this.sizer?.disconnect();
    this.sizer = new ResizeObserver((entries) => {
      for (const entry of entries) entry.target.yaasScale?.(entry.contentRect.width);
    });
    root.addClass("yaas-panel");
    if (!this.file) {
      root.createEl("p", { text: "Open a note to see its slides here.", cls: "yaas-hint" });
      return;
    }
    const file = this.file;
    const slides = parseDeck(await this.app.vault.read(file));
    const base = this.plugin.baseStyle(file);
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const own = deckStyle(frontmatter);

    // One line: the note's name, then Present and, as icons, the browser and the PDF
    const head = root.createDiv({ cls: "yaas-panel-head" });
    head.createDiv({ cls: "yaas-panel-title", text: file.basename });
    const actions = head.createDiv({ cls: "yaas-panel-actions" });
    this.button(actions, "Present", "play", () => this.plugin.present(file)).addClass("mod-cta");
    if (Platform.isDesktopApp) this.button(actions, "", "globe", () => this.plugin.openInBrowser(file), "Open in the browser");
    if (Platform.isDesktopApp) this.button(actions, "", "download", () => this.plugin.exportPdf(file), "Export a PDF to share: one slide per page, no speaker notes");

    const deck = root.createDiv({ cls: "yaas-panel-section" });
    deck.createDiv({ cls: "yaas-section-title", text: "Deck colours" });
    this.colorStrip(deck, base, own, this.plugin.settings, (patch) => this.plugin.setDeckColors(file, patch),
      "Every slide that does not set its own colours");

    const list = root.createDiv({ cls: "yaas-panel-section" });
    list.createDiv({ cls: "yaas-section-title", text: `Slides · ${slides.length}` });
    if (!slides.length) list.createEl("p", { cls: "yaas-hint", text: "No slides yet: separate them with a line of ---." });
    const grid = list.createDiv({ cls: "yaas-slides" });
    slides.forEach((slide, index) => this.slideCard(grid, file, slide, index, base));
    root.scrollTop = scroll;
  }

  // One framed card per slide, read top to bottom: its number, title and cog first, then its preview, then (open)
  // its settings, so the cog plainly belongs to the preview under it. Only the settings that do something for this
  // slide are shown: image fit and darken with a background image, layout when the slide has an image in it
  slideCard(parent, file, slide, index, base) {
    const style = Object.assign({}, base, slide.style);
    const own = Object.keys(slide.style).length > 0;
    const card = parent.createDiv({ cls: "yaas-card" });
    const head = card.createEl("button", { cls: "yaas-card-head", attr: { "aria-expanded": "false", "aria-label": `Settings for slide ${index + 1}` } });
    head.createSpan({ cls: "yaas-card-number", text: String(index + 1) });
    head.createSpan({ cls: "yaas-card-title", text: slideTitle(slide) });
    if (own) head.createSpan({ cls: "yaas-card-own", attr: { title: "This slide has its own settings" } });
    setIcon(head.createSpan({ cls: "yaas-card-cog" }), "settings-2");

    const thumb = card.createDiv({ cls: "yaas-thumb", attr: { "aria-label": `Present from slide ${index + 1}` } });
    thumb.addEventListener("click", () => this.plugin.present(file, index));
    const stage = new Stage(this.plugin, thumb, { counter: false });
    stage.scale(THUMB_W / STAGE_W);
    this.stages.push(stage);
    thumb.yaasDraw = () => stage.show(file, slide, style, "");
    thumb.yaasScale = (width) => { if (width) stage.scale(width / STAGE_W); };
    this.lazy.observe(thumb);
    this.sizer.observe(thumb);

    const body = card.createDiv({ cls: "yaas-card-body" });
    const toggle = (open) => {
      card.toggleClass("is-open", open);
      head.setAttribute("aria-expanded", String(open));
      open ? this.opened.add(index) : this.opened.delete(index);
    };
    toggle(this.opened.has(index));
    head.addEventListener("click", () => toggle(!card.hasClass("is-open")));
    const set = (patch) => this.plugin.setSlideStyle(file, index, patch);

    this.colorStrip(body, style, slide.style, base, set, "This slide only");
    this.segmented(body, "Position", slide.style.align ?? "", [["", "Middle"], ["left", "Top"]], (value) => set({ align: value || null }));
    if (/!\[\[|!\[[^\]]*\]\(/.test(slide.markdown)) {
      this.segmented(body, "Layout", slide.style.layout ?? "", [["", "In text"], ["image-left", "Image left"], ["image-right", "Image right"]],
        (value) => set({ layout: value || null }));
    }

    const imageRow = this.row(body, "Backdrop");
    const input = imageRow.createEl("input", { type: "text", value: slide.style.image ?? "", attr: { placeholder: "No image" } });
    input.addEventListener("change", () => set({ image: input.value.trim() || null }));
    this.button(imageRow, "", "image", () => new ImagePicker(this.app, (picked) => set({ image: picked.path })).open(), "Choose an image from the vault");
    if (slide.style.image) this.button(imageRow, "", "x", () => set({ image: null, dim: null }), "Remove the image");
    if (slide.style.image || slide.style.layout) {
      this.segmented(body, "Image fit", slide.style.fit ?? "", [["", "Fill"], ["contain", "Whole"]], (value) => set({ fit: value || null }));
    }
    if (slide.style.image) {
      const dimRow = this.row(body, "Darken");
      const range = dimRow.createEl("input", { type: "range", attr: { min: "0", max: "0.9", step: "0.05" } });
      range.value = String(slide.style.dim ?? 0);
      const shown = dimRow.createSpan({ cls: "yaas-value", text: `${Math.round(Number(range.value) * 100)}%` });
      range.addEventListener("input", () => shown.setText(`${Math.round(Number(range.value) * 100)}%`));
      range.addEventListener("change", () => set({ dim: Number(range.value) || null }));
    }
    if (own) {
      const reset = this.button(body, "Reset this slide", "rotate-ccw", () => set(Object.fromEntries(STYLE_ORDER.map((key) => [key, null]))),
        "Back to the deck's colours, no image, middle");
      reset.addClass("yaas-reset");
    }
  }

  row(parent, label) {
    const row = parent.createDiv({ cls: "yaas-row" });
    row.createSpan({ cls: "yaas-label", text: label });
    return row;
  }

  // A row of buttons, one lit: for choices of two or three, quicker than a dropdown
  segmented(parent, label, value, options, onSet) {
    const group = this.row(parent, label).createDiv({ cls: "yaas-seg", attr: { role: "radiogroup", "aria-label": label } });
    for (const [optionValue, text] of options) {
      const option = group.createEl("button", { text, attr: { role: "radio", "aria-checked": String(optionValue === value) } });
      option.toggleClass("is-active", optionValue === value);
      option.addEventListener("click", () => { if (optionValue !== value) onSet(optionValue); });
    }
  }

  // Colours in one line: the theme, then background, text and accent as swatches, and ↺ when any are set here.
  // current: the colours in use; own: those set at this level; inherited: those from further up (faded swatches)
  colorStrip(parent, current, own, inherited, onSet, hint) {
    const row = parent.createDiv({ cls: "yaas-strip", attr: { "aria-label": hint } });
    this.themeButton(row, current, (theme) => onSet({ bg: theme.bg, text: theme.text, accent: theme.accent }));
    for (const [key, label, job] of COLOR_JOBS) {
      this.colorSwatch(row, key, label, job, own[key], inherited[key], (value) => onSet({ [key]: value }));
    }
    if (["bg", "text", "accent"].some((key) => own[key])) {
      this.button(row, "", "rotate-ccw", () => onSet({ bg: null, text: null, accent: null }), "Back to the inherited colours");
    }
  }

  // A list of the themes, each shown in its own colours: choosing one sets background, text and accent together.
  // The button shows the colours in use, named after the theme they match, or "Own colours"
  themeButton(parent, current, onPick) {
    const inUse = THEMES.find((theme) => ["bg", "text", "accent"].every((key) => toHex(current[key]) === theme[key].toLowerCase()));
    const button = parent.createEl("button", { cls: "yaas-theme-select", attr: { "aria-haspopup": "listbox", "aria-label": "Theme" } });
    this.paintTheme(button, current, inUse ? inUse.name : "Own colours");
    setIcon(button.createSpan({ cls: "yaas-theme-chevron" }), "chevron-down");
    button.addEventListener("click", () => this.popover(button, "yaas-theme-menu", (pop, close) => {
      pop.setAttribute("role", "listbox");
      for (const theme of THEMES) {
        const item = pop.createEl("button", { cls: "yaas-theme-item", attr: { role: "option", "aria-selected": String(theme === inUse) } });
        this.paintTheme(item, theme, theme.name);
        item.toggleClass("is-current", theme === inUse);
        item.addEventListener("click", () => {
          close();
          onPick(theme);
        });
      }
      return pop.querySelector(".is-current") ?? pop.querySelector(".yaas-theme-item");
    }));
  }

  // The name in the theme's text colour on its background, and a dot of its highlight
  paintTheme(el, colors, name) {
    el.style.background = colors.bg;
    el.style.color = colors.text;
    el.createSpan({ cls: "yaas-theme-name", text: name });
    el.createSpan({ cls: "yaas-theme-dot" }).style.background = colors.accent;
  }

  // The colour in use as a swatch: hovering says what it colours, a click opens the presets for this job, and
  // Custom… the full picker. Faded when it comes from further up
  colorSwatch(parent, key, label, job, own, inherited, onSet) {
    const value = toHex(own ?? inherited);
    const from = own ? "" : ", inherited";
    const swatch = parent.createEl("button", { cls: "yaas-swatch-button", attr: { "aria-label": `${label} (${value}${from}): ${job}` } });
    swatch.style.background = value;
    swatch.toggleClass("is-inherited", !own);
    const input = parent.createEl("input", { type: "color", cls: "yaas-hidden-picker" });
    input.value = value;
    input.addEventListener("change", () => onSet(input.value));
    swatch.addEventListener("click", () => this.openSwatches(swatch, SWATCHES[key], value, onSet, input, label, job));
  }

  openSwatches(anchor, groups, current, onPick, input, label, job) {
    this.popover(anchor, "yaas-swatches", (pop, close) => {
      pop.createDiv({ cls: "yaas-swatches-title", text: label });
      pop.createDiv({ cls: "yaas-swatches-job", text: job });
      for (const [group, colors] of groups) {
        pop.createDiv({ cls: "yaas-swatches-group", text: group });
        const grid = pop.createDiv({ cls: "yaas-swatches-grid" });
        for (const [name, hex] of colors) {
          const button = grid.createEl("button", { cls: "yaas-swatch", attr: { "aria-label": `${name} ${hex}` } });
          button.style.background = hex;
          button.toggleClass("is-current", hex.toLowerCase() === current);
          button.addEventListener("click", () => {
            close();
            onPick(hex);
          });
        }
      }
      const custom = pop.createEl("button", { cls: "yaas-swatches-custom", text: "Custom colour…" });
      custom.addEventListener("click", () => {
        close();
        input.click();
      });
      return pop.querySelector(".is-current") ?? pop.querySelector(".yaas-swatch");
    });
  }

  // A small menu under `anchor` (above it when there is no room), filled by build(pop, close), which returns the
  // button to focus. Closes on a click elsewhere or Escape; arrow keys move between its buttons
  popover(anchor, cls, build) {
    this.closeSwatches();
    const pop = document.body.createDiv({ cls: `yaas-popover ${cls}` });
    const close = () => {
      this.closeSwatches();
      anchor.focus();
    };
    const focus = build(pop, close);
    const box = anchor.getBoundingClientRect();
    const height = pop.offsetHeight;
    pop.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - pop.offsetWidth - 8))}px`;
    pop.style.top = `${box.bottom + 6 + height > window.innerHeight ? Math.max(8, box.top - height - 6) : box.bottom + 6}px`;
    const away = (event) => {
      if (event.type === "mousedown") {
        if (!pop.contains(event.target) && !anchor.contains(event.target)) this.closeSwatches();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
      if (!step || !pop.contains(document.activeElement)) return;
      event.preventDefault();
      const buttons = Array.from(pop.querySelectorAll("button"));
      const next = buttons[(buttons.indexOf(document.activeElement) + step + buttons.length) % buttons.length];
      next.focus();
    };
    document.addEventListener("mousedown", away, true);
    document.addEventListener("keydown", away, true);
    this.swatches = { pop, away };
    focus?.focus();
  }

  closeSwatches() {
    if (!this.swatches) return;
    document.removeEventListener("mousedown", this.swatches.away, true);
    document.removeEventListener("keydown", this.swatches.away, true);
    this.swatches.pop.remove();
    this.swatches = null;
  }

  button(parent, text, icon, onClick, tooltip) {
    const button = parent.createEl("button", { cls: text ? "yaas-button" : "yaas-button clickable-icon" });
    const iconEl = button.createSpan();
    setIcon(iconEl, icon);
    if (text) button.createSpan({ text });
    if (tooltip) button.setAttribute("aria-label", tooltip);
    button.addEventListener("click", onClick);
    return button;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The browser preview: a small web server on this computer only, http://localhost:<port>/?file=…&key=…

// The slide viewer both pages share. It asks window.yaasSource for the deck: { load(): Promise<deck>, live?(onChange) }.
// P or the browser's Print draws every slide as its own 1920×1080 page, for Save as PDF
const VIEWER_JS = `(function () {
  ${fitCode.toString()}
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
  // Browser preview only: a copy icon on every code block (its text) and diagram (its Mermaid source); a tick after
  // copying, a cross if the browser refused
  const ICONS = {
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    done: '<path d="M20 6 9 17l-5-5"/>',
    failed: '<path d="M18 6 6 18M6 6l12 12"/>',
  };
  const icon = (name) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + "</svg>";
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
      button.innerHTML = icon("copy");
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        let done = true;
        try { await navigator.clipboard.writeText(text()); } catch (error) { done = false; }
        button.innerHTML = icon(done ? "done" : "failed");
        button.title = done ? "Copied" : "Could not copy";
        button.classList.toggle("is-done", done);
        setTimeout(() => {
          button.innerHTML = icon("copy");
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

const PAGE_BODY = `<div class="yaas"><div class="yaas-stage"><div class="yaas-backdrop"></div><div class="yaas-dim"></div><div class="yaas-slide"></div><div class="yaas-counter"></div><div class="yaas-progress"><div class="yaas-progress-bar"></div></div></div><div class="yaas-notes" hidden data-allowed="1"></div></div>`;

// The browser preview: data from this computer's YAAS server, redrawn whenever the note is saved. The stylesheet is
// in the head (the key is hex only), so the first slide is drawn with its colours, not faded in
const previewPage = (key) => `<!doctype html>
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

// The file to share: one HTML file with the styles, the slides and their images inside, no speaker notes
function exportPage(css, deck) {
  const data = JSON.stringify(deck).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const title = deck.title.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return `<!doctype html>
<html lang="en"><head>${PAGE_HEAD}<title>${title}</title>
<style>${css.replace(/<\/style/gi, "<\\/style")}</style></head><body>
${PAGE_BODY.replace(' data-allowed="1"', "")}
<script>
window.yaasSource = { load: async () => (${data}) };
${VIEWER_JS}
</script></body></html>`;
}

class WebPreview {
  constructor(plugin) {
    this.plugin = plugin;
    this.server = null;
    this.clients = new Set();
    // Every link carries this key: another website open in the browser cannot guess it to read the vault
    this.token = Array.from(window.crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  get running() { return Boolean(this.server?.listening); }

  url(file) {
    return `http://localhost:${this.port}/?file=${encodeURIComponent(file.path)}&key=${this.token}`;
  }

  start() {
    const http = require("http");
    const port = this.plugin.settings.port;
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        this.handle(req, res).catch((error) => {
          console.error("YAAS web preview", error);
          if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("YAAS could not draw this deck.");
        });
      });
      server.once("error", reject);
      // 127.0.0.1 only: nothing on the network can reach it
      server.listen(port, "127.0.0.1", () => {
        this.server = server;
        this.port = port;
        resolve();
      });
    });
  }

  stop() {
    for (const res of this.clients) res.end();
    this.clients.clear();
    this.server?.close();
    this.server = null;
  }

  changed(file) {
    for (const res of this.clients) if (res.yaasFile === file.path) res.write("data: change\n\n");
  }

  note(url) {
    const file = this.plugin.app.vault.getAbstractFileByPath(url.searchParams.get("file") || "");
    return file instanceof TFile && file.extension === "md" ? file : null;
  }

  async handle(req, res) {
    const send = (status, type, body, headers = {}) => {
      res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers });
      res.end(body);
    };
    // Only this computer's own names: a page that points another domain name at 127.0.0.1 is refused
    const host = (req.headers.host || "").replace(/:\d+$/, "");
    if (host !== "localhost" && host !== "127.0.0.1") return send(403, "text/plain", "Forbidden");
    if (req.method !== "GET") return send(405, "text/plain", "Method not allowed");
    const url = new URL(req.url, "http://localhost");
    if (url.searchParams.get("key") !== this.token) return send(403, "text/plain", "This link is not valid any more: open the deck again from Obsidian.");

    if (url.pathname === "/") return send(200, "text/html; charset=utf-8", previewPage(this.token));
    if (url.pathname === "/yaas.css") return send(200, "text/css; charset=utf-8", await this.plugin.css());
    if (url.pathname === "/deck.json") {
      const file = this.note(url);
      if (!file) return send(404, "application/json", "{}");
      return send(200, "application/json; charset=utf-8", JSON.stringify(await this.plugin.deckData(file)));
    }
    if (url.pathname === "/events") {
      const file = this.note(url);
      if (!file) return send(404, "text/plain", "Not found");
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
      res.write(": yaas\n\n");
      res.yaasFile = file.path;
      this.clients.add(res);
      const beat = setInterval(() => res.write(": beat\n\n"), 25000);
      req.on("close", () => {
        clearInterval(beat);
        this.clients.delete(res);
      });
      return;
    }
    if (url.pathname.startsWith("/file/")) {
      // Images only, found by their path inside the vault
      const file = this.plugin.app.vault.getAbstractFileByPath(decodeURIComponent(url.pathname.slice(6)));
      const type = file instanceof TFile && IMAGE_TYPES[file.extension.toLowerCase()];
      if (!type) return send(404, "text/plain", "Not found");
      const { Buffer } = require("buffer");
      return send(200, type, Buffer.from(await this.plugin.app.vault.readBinary(file)), { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" });
    }
    send(404, "text/plain", "Not found");
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Settings

class YaasSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName("Default colours").setHeading()
      .setDesc("For every deck. A note's deck colours and each slide's own colours, set in the YAAS panel, come first.");
    const color = (name, key, desc) => new Setting(containerEl).setName(name).setDesc(desc).addColorPicker((picker) => picker
      .setValue(toHex(this.plugin.settings[key]))
      .onChange(async (value) => {
        this.plugin.settings[key] = value;
        await this.plugin.saveSettings();
      }));
    for (const [key, label, job] of COLOR_JOBS) color(label, key, job);
    new Setting(containerEl).setName("On every slide").setHeading();
    new Setting(containerEl).setName("Font").setDesc("A font installed on this computer, e.g. Nunito Sans. Empty: Obsidian's interface font.")
      .addText((text) => text.setValue(this.plugin.settings.font).onChange(async (value) => {
        this.plugin.settings.font = value.trim();
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl).setName("Slide number").setDesc("Show 3 / 7 in the corner.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.counter).onChange(async (value) => {
        this.plugin.settings.counter = value;
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl).setName("Progress line").setDesc("A line along the bottom of the slide, filled up to the slide you are on.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.progress).onChange(async (value) => {
        this.plugin.settings.progress = value;
        await this.plugin.saveSettings();
      }));
    if (Platform.isDesktopApp) {
      new Setting(containerEl).setName("Browser preview").setHeading();
      new Setting(containerEl).setName("Port").setDesc("http://localhost:<port>. Takes effect the next time a deck is opened in the browser.")
        .addText((text) => text.setValue(String(this.plugin.settings.port)).onChange(async (value) => {
          const port = Number(value);
          if (!Number.isInteger(port) || port < 1024 || port > 65535) return;
          this.plugin.settings.port = port;
          await this.plugin.saveSettings();
          this.plugin.web.stop();
        }));
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------

class Yaas extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.presentation = null;
    this.web = new WebPreview(this);
    this.registerView(VIEW_TYPE, (leaf) => new YaasView(leaf, this));

    const withNote = (action) => (checking) => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view?.file) return false;
      if (!checking) action(view.file);
      return true;
    };
    this.addCommand({ id: "present", name: "Present this note", checkCallback: withNote((file) => this.present(file)) });
    this.addCommand({ id: "open-panel", name: "Open the slides panel", callback: () => this.openPanel() });
    if (Platform.isDesktopApp) this.addCommand({ id: "export-pdf", name: "Export this note as a PDF", checkCallback: withNote((file) => this.exportPdf(file)) });
    this.addCommand({ id: "export", name: "Export this note as one HTML file", checkCallback: withNote((file) => this.exportHtml(file)) });
    if (Platform.isDesktopApp) {
      this.addCommand({ id: "open-browser", name: "Open this note in the browser", checkCallback: withNote((file) => this.openInBrowser(file)) });
      this.addCommand({ id: "stop-browser", name: "Stop the browser preview", callback: () => { this.web.stop(); new Notice("YAAS: browser preview stopped."); } });
    }
    // One icon: the panel, where Present, Open in browser and every slide's settings are
    this.addRibbonIcon("presentation", "YAAS: slides", () => this.openPanel());
    this.registerEvent(this.app.vault.on("modify", (file) => this.web.changed(file)));
    this.addSettingTab(new YaasSettingTab(this.app, this));
  }

  onunload() {
    this.presentation?.close();
    this.web.stop();
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  baseStyle(file) {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return Object.assign({ bg: this.settings.bg, text: this.settings.text, accent: this.settings.accent }, deckStyle(frontmatter));
  }

  async present(file, start = 0) {
    this.presentation?.close();
    const slides = parseDeck(await this.app.vault.read(file));
    if (!slides.length) return new Notice("This note has no slides.");
    this.presentation = new Presentation(this, file, slides, this.baseStyle(file), start);
    this.presentation.open();
  }

  async openPanel() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
  }

  async openInBrowser(file) {
    if (!this.web.running) {
      try {
        await this.web.start();
      } catch (error) {
        return new Notice(`YAAS: port ${this.settings.port} is in use. Choose another in Settings › YAAS.`);
      }
    }
    const url = this.web.url(file);
    // The computer's own browser, not Obsidian's web viewer: full screen, a second screen and Print work there
    const shell = (() => { try { return require("electron").shell; } catch { return null; } })();
    if (shell?.openExternal) shell.openExternal(url).catch(() => window.open(url));
    else window.open(url);
    navigator.clipboard?.writeText(url).catch(() => {});
    new Notice("YAAS: opened in your browser; the link is copied too.");
  }

  // The panel writes a slide's styling comment; null or "" removes that key
  async setSlideStyle(file, index, patch) {
    await this.app.vault.process(file, (text) => {
      const slide = parseDeck(text)[index];
      if (!slide) return text;
      const style = Object.assign({}, slide.style);
      for (let [key, value] of Object.entries(patch)) {
        if (key === "image" && typeof value === "string") value = imageLink(value);
        if (value === null || value === "") delete style[key];
        else if (STYLE_VALUES[key]?.(String(value))) style[key] = key === "dim" ? Number(value) : value;
      }
      return writeSlideStyle(text, index, style);
    });
  }

  // { bg, text, accent } into the note's properties in one write; null removes that one
  async setDeckColors(file, colors) {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      for (const key of ["bg", "text", "accent"]) {
        if (!(key in colors)) continue;
        if (colors[key] && isColor(colors[key])) frontmatter[`slide-${key}`] = colors[key];
        else delete frontmatter[`slide-${key}`];
      }
    });
  }

  // A vault image by link (resolved from the note, like ![[…]]) or an http(s) address; null when it is not there
  imageUrl(link, file) {
    if (/^https?:\/\//i.test(link)) return link;
    const target = this.app.metadataCache.getFirstLinkpathDest(link, file.path);
    if (target) return this.app.vault.getResourcePath(target);
    if (!this.missing?.has(link)) {
      (this.missing ??= new Set()).add(link);
      new Notice(`YAAS: image not found: ${link}`);
    }
    return null;
  }

  async css() {
    return this.app.vault.adapter.read(`${this.manifest.dir}/styles.css`);
  }

  // The deck for the browser page: each slide drawn by Obsidian, with vault images pointed at the preview server
  // fileUrl: how a vault image is addressed on the page (the preview server by default, or a marker export fills in)
  async deckData(file, fileUrl = (target) => `/file/${encodeURIComponent(target.path)}?key=${this.web.token}`) {
    const text = await this.app.vault.read(file);
    const base = this.baseStyle(file);
    const slides = [];
    for (const slide of parseDeck(text)) {
      const style = Object.assign({}, base, slide.style);
      const component = new Component();
      component.load();
      const holder = await renderSlide(this.app, slide.markdown, file.path, component);
      this.webImages(holder, file, fileUrl);
      // A drawn diagram no longer holds its source: keep it beside the drawing, for the browser's Copy button
      const sources = mermaidSources(slide.markdown);
      holder.querySelectorAll(".mermaid").forEach((diagram, i) => { if (sources[i] != null) diagram.dataset.source = sources[i]; });
      const el = createDiv();
      arrange(el, holder, style);
      let image = null;
      if (style.image && /^https?:\/\//i.test(style.image)) image = style.image;
      else if (style.image) {
        const target = this.app.metadataCache.getFirstLinkpathDest(style.image, file.path);
        if (target) image = fileUrl(target);
      }
      slides.push({ html: el.innerHTML, classes: el.className, style: Object.assign({}, style, { image }), notes: slide.notes });
      component.unload();
    }
    return { title: file.basename, font: this.settings.font, counter: this.settings.counter, progress: this.settings.progress, slides };
  }

  // Export: the deck as one HTML file next to the note, images inside it and speaker notes left out
  // The page to share: one HTML file with the slides and their images inside, speaker notes left out
  async sharePage(file) {
    const marker = "yaas-embed:";
    const deck = await this.deckData(file, (target) => marker + encodeURIComponent(target.path));
    deck.slides.forEach((slide) => { slide.notes = []; });
    let json = JSON.stringify(deck);
    const paths = new Set(Array.from(json.matchAll(/yaas-embed:([^"'\\)\s]+)/g), (match) => decodeURIComponent(match[1])));
    const { Buffer } = require("buffer");
    for (const path of paths) {
      const target = this.app.vault.getAbstractFileByPath(path);
      const type = target instanceof TFile && IMAGE_TYPES[target.extension.toLowerCase()];
      const uri = type ? `data:${type};base64,${Buffer.from(await this.app.vault.readBinary(target)).toString("base64")}` : "";
      json = json.split(marker + encodeURIComponent(path)).join(uri);
    }
    return exportPage(await this.css(), JSON.parse(json));
  }

  exportPath(file, extension) {
    const folder = file.parent && file.parent.path !== "/" ? `${file.parent.path}/` : "";
    return `${folder}${file.basename}.${extension}`;
  }

  exported(path, message) {
    const notice = new Notice(`YAAS: ${message} ${path}. Click to show it.`, 8000);
    if (this.app.showInFolder) notice.noticeEl.addEventListener("click", () => this.app.showInFolder(path));
  }

  async exportHtml(file) {
    const path = this.exportPath(file, "html");
    await this.app.vault.adapter.write(path, await this.sharePage(file));
    this.exported(path, "exported to");
    return path;
  }

  // The same page, printed to PDF by Obsidian's own browser engine in a hidden window: every page 1920×1080,
  // landscape, whatever the computer's print settings say. Desktop only
  async exportPdf(file) {
    const electron = require("electron");
    const remote = electron.remote ?? (() => { try { return require("@electron/remote"); } catch { return null; } })();
    if (!remote?.BrowserWindow) {
      new Notice("YAAS: this Obsidian cannot make PDFs itself. Exported the HTML file instead: open it in Chrome and press P.", 10000);
      return this.exportHtml(file);
    }
    const notice = new Notice("YAAS: making the PDF…", 0);
    const fs = require("fs");
    const os = require("os");
    const nodePath = require("path");
    const page = nodePath.join(os.tmpdir(), `yaas-${Date.now()}.html`);
    const win = new remote.BrowserWindow({
      show: false, width: STAGE_W, height: STAGE_H,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    try {
      fs.writeFileSync(page, await this.sharePage(file));
      await win.loadFile(page);
      // Let images decode before printing
      await new Promise((resolve) => setTimeout(resolve, 600));
      const pdf = await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        pageSize: { width: STAGE_W / 96, height: STAGE_H / 96 },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      const path = this.exportPath(file, "pdf");
      await this.app.vault.adapter.writeBinary(path, pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength));
      notice.hide();
      this.exported(path, "PDF saved to");
      return path;
    } catch (error) {
      console.error("YAAS PDF export", error);
      notice.hide();
      new Notice(`YAAS: the PDF could not be made (${error.message}).`, 10000);
      return null;
    } finally {
      win.destroy();
      fs.unlink(page, () => {});
    }
  }

  webImages(holder, file, fileUrl) {
    holder.querySelectorAll(".internal-embed[src]").forEach((embed) => {
      const link = embed.getAttribute("src").split("#")[0].split("|")[0];
      const target = this.app.metadataCache.getFirstLinkpathDest(link, file.path);
      if (!target || !IMAGE_TYPES[target.extension.toLowerCase()]) return;
      const img = embed.querySelector("img") ?? embed.createEl("img");
      img.setAttribute("src", fileUrl(target));
    });
    // Images Obsidian already pointed at its own app:// address
    const prefix = this.app.vault.adapter.getResourcePath?.("").split("?")[0];
    holder.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      if (!prefix || !src.startsWith(prefix)) return;
      const target = this.app.vault.getAbstractFileByPath(decodeURIComponent(src.slice(prefix.length).split("?")[0]));
      if (target instanceof TFile) img.setAttribute("src", fileUrl(target));
    });
  }
}

module.exports = Yaas;
module.exports.parseDeck = parseDeck;
module.exports.deckStyle = deckStyle;
module.exports.writeSlideStyle = writeSlideStyle;
module.exports.serializeStyle = serializeStyle;
module.exports.THEMES = THEMES;
module.exports.SWATCHES = SWATCHES;
module.exports.exportPage = exportPage;
module.exports.WebPreview = WebPreview;
