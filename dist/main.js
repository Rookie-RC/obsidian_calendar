"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => CalendarPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/ical.ts
var DATE_ONLY = /^\d{8}$/;
var DATE_TIME = /^\d{8}T\d{6}Z?$/;
var addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
var parseDateValue = (raw) => {
  if (DATE_ONLY.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6)) - 1;
    const day = Number(raw.slice(6, 8));
    return { date: new Date(year, month, day), allDay: true };
  }
  if (DATE_TIME.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6)) - 1;
    const day = Number(raw.slice(6, 8));
    const hour = Number(raw.slice(9, 11));
    const minute = Number(raw.slice(11, 13));
    const second = Number(raw.slice(13, 15));
    if (raw.endsWith("Z")) {
      return { date: new Date(Date.UTC(year, month, day, hour, minute, second)), allDay: false };
    }
    return { date: new Date(year, month, day, hour, minute, second), allDay: false };
  }
  return { date: new Date(raw), allDay: false };
};
var unfoldLines = (text) => {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const unfolded = [];
  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("	")) {
      const lastIndex = unfolded.length - 1;
      if (lastIndex >= 0) {
        unfolded[lastIndex] += line.slice(1);
      }
    } else if (line.trim().length) {
      unfolded.push(line.trim());
    }
  }
  return unfolded;
};
var parseIcal = (text) => {
  const events = [];
  const lines = unfoldLines(text);
  let current = {};
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current.start) {
        if (!current.end) {
          current.end = current.start;
        }
        if (current.allDay && current.end.getTime() > current.start.getTime()) {
          current.end = addDays(current.end, -1);
        }
        events.push({
          id: current.id ?? crypto.randomUUID(),
          summary: current.summary ?? "Untitled",
          start: current.start,
          end: current.end,
          allDay: current.allDay ?? false
        });
      }
      current = {};
      continue;
    }
    const [rawKey, rawValue] = line.split(":", 2);
    if (!rawKey || rawValue === void 0) {
      continue;
    }
    const key = rawKey.split(";")[0];
    if (key === "UID") {
      current.id = rawValue.trim();
    }
    if (key === "SUMMARY") {
      current.summary = rawValue.trim();
    }
    if (key === "DTSTART") {
      const { date, allDay } = parseDateValue(rawValue.trim());
      current.start = date;
      current.allDay = allDay;
    }
    if (key === "DTEND") {
      const { date, allDay } = parseDateValue(rawValue.trim());
      current.end = date;
      current.allDay = current.allDay ?? allDay;
    }
  }
  return events;
};

// src/services/icalService.ts
var import_obsidian = require("obsidian");
var IcalService = class {
  constructor(parser) {
    this.cache = /* @__PURE__ */ new Map();
    this.parser = parser;
  }
  async getEvents(sources, refreshIntervalMinutes, forceRefresh = false) {
    const enabledSources = sources.filter((source) => source.enabled && source.url.trim().length > 0);
    if (enabledSources.length === 0) {
      return [];
    }
    const now = Date.now();
    const refreshMs = Math.max(refreshIntervalMinutes, 1) * 60 * 1e3;
    const results = await Promise.all(
      enabledSources.map((source) => this.getSourceEvents(source, now, refreshMs, forceRefresh))
    );
    return results.flat().sort((a, b) => a.start.getTime() - b.start.getTime());
  }
  async getSourceEvents(source, now, refreshMs, forceRefresh) {
    const cached = this.cache.get(source.id);
    if (!forceRefresh && cached && cached.url === source.url && now - cached.fetchedAt < refreshMs) {
      return cached.events;
    }
    try {
      const response = await (0, import_obsidian.requestUrl)({ url: source.url });
      const parsed = this.parser(response.text);
      const events = parsed.map((event) => ({
        ...event,
        sourceId: source.id,
        sourceName: source.name || "Calendar"
      }));
      this.cache.set(source.id, { fetchedAt: now, events, url: source.url });
      return events;
    } catch (error) {
      console.error("Failed to fetch iCal source", source.name, error);
      return cached ? cached.events : [];
    }
  }
};

// src/main.ts
var VIEW_TYPE_CALENDAR = "obsidian-calendar-view";
var DEFAULT_SETTINGS = {
  sources: [],
  weekStart: "sunday",
  timeFormat: "24h",
  language: "en",
  refreshIntervalMinutes: 30,
  todayHighlight: "#29a5c7",
  selectedHighlight: "#54df26",
  noteDateFields: ["date"],
  allowCreateNote: true,
  noteTemplatePath: "",
  noteBarColor: "#ea640b"
};
var TRANSLATIONS = {
  en: {
    today: "Today",
    refresh: "Refresh",
    createNote: "Create note",
    events: "Events",
    notes: "Notes",
    allDay: "All day",
    noNotesOrEvents: "No notes or events",
    sun: "Sun",
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat"
  },
  zh: {
    today: "\u4ECA\u5929",
    refresh: "\u5237\u65B0",
    createNote: "\u65B0\u5EFA\u7B14\u8BB0",
    events: "\u65E5\u7A0B",
    notes: "\u7B14\u8BB0",
    allDay: "\u5168\u5929",
    noNotesOrEvents: "\u6682\u65E0\u7B14\u8BB0\u6216\u65E5\u7A0B",
    sun: "\u5468\u65E5",
    mon: "\u5468\u4E00",
    tue: "\u5468\u4E8C",
    wed: "\u5468\u4E09",
    thu: "\u5468\u56DB",
    fri: "\u5468\u4E94",
    sat: "\u5468\u516D"
  }
};
function translate(key, lang) {
  return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
}
function resolveHighlightValue(value, fallbackVar) {
  const trimmed = value.trim();
  if (!trimmed) {
    return getComputedStyle(document.body).getPropertyValue(fallbackVar).trim();
  }
  if (trimmed.startsWith("--")) {
    const resolved = getComputedStyle(document.body).getPropertyValue(trimmed).trim();
    return resolved || trimmed;
  }
  return trimmed;
}
function normalizePathSlashes(value) {
  return value.replace(/\\/g, "/");
}
var DEFAULT_SOURCE_COLORS = [
  "#e74c3c",
  // red
  "#3498db",
  // blue
  "#2ecc71",
  // green
  "#f39c12",
  // orange
  "#9b59b6",
  // purple
  "#1abc9c",
  // turquoise
  "#e67e22",
  // carrot
  "#34495e"
  // dark gray
];
function getDefaultSourceColor(index) {
  return DEFAULT_SOURCE_COLORS[index % DEFAULT_SOURCE_COLORS.length];
}
function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function parseFrontmatterDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}
function extractFrontmatterDates(value) {
  if (Array.isArray(value)) {
    return value.map((item) => parseFrontmatterDate(item)).filter((item) => item !== null);
  }
  const single = parseFrontmatterDate(value);
  return single ? [single] : [];
}
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
function addDays2(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function formatTime(date, format) {
  if (format === "24h") {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}
function clampToDayStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function clampToDayEnd(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}
function createSourceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `src-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
var CalendarView = class extends import_obsidian2.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.selectedDate = /* @__PURE__ */ new Date();
    this.visibleMonth = /* @__PURE__ */ new Date();
    this.events = [];
    this.notesByDate = /* @__PURE__ */ new Map();
    this.noteExcerptCache = /* @__PURE__ */ new Map();
    this.maxNotesForGrid = 1;
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_CALENDAR;
  }
  getDisplayText() {
    return "Calendar";
  }
  getIcon() {
    return "calendar";
  }
  async onOpen() {
    this.containerEl.empty();
    this.containerEl.addClass("obsidian-calendar");
    this.buildLayout();
    this.ensureHoverPreview();
    this.render();
  }
  async onClose() {
    this.hoverPreviewEl?.remove();
    this.hoverPreviewEl = void 0;
    return;
  }
  setEvents(events) {
    this.events = events;
    this.render();
  }
  jumpToToday() {
    const today = /* @__PURE__ */ new Date();
    this.selectedDate = today;
    this.visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    this.render();
  }
  buildLayout() {
    const header = this.containerEl.createDiv({ cls: "obsidian-calendar__header" });
    this.headerTitle = header.createDiv({ cls: "obsidian-calendar__title" });
    this.legendEl = header.createDiv({ cls: "obsidian-calendar__legend" });
    const body = this.containerEl.createDiv({ cls: "obsidian-calendar__body" });
    this.gridEl = body.createDiv({ cls: "obsidian-calendar__grid" });
    this.navEl = body.createDiv({ cls: "obsidian-calendar__nav" });
    this.detailsEl = body.createDiv({ cls: "obsidian-calendar__details" });
  }
  renderNav() {
    if (!this.navEl) return;
    this.navEl.empty();
    const lang = this.plugin.settings.language;
    const leftGroup = this.navEl.createDiv({ cls: "obsidian-calendar__nav-left" });
    const prevBtn = leftGroup.createEl("button", { text: "\u2190" });
    const centerGroup = this.navEl.createDiv({ cls: "obsidian-calendar__nav-center" });
    const todayBtn = centerGroup.createEl("button", { text: translate("today", lang) });
    const refreshBtn = centerGroup.createEl("button", { text: translate("refresh", lang) });
    const rightGroup = this.navEl.createDiv({ cls: "obsidian-calendar__nav-right" });
    const nextBtn = rightGroup.createEl("button", { text: "\u2192" });
    prevBtn.addEventListener("click", () => {
      this.visibleMonth = new Date(this.visibleMonth.getFullYear(), this.visibleMonth.getMonth() - 1, 1);
      this.render();
    });
    nextBtn.addEventListener("click", () => {
      this.visibleMonth = new Date(this.visibleMonth.getFullYear(), this.visibleMonth.getMonth() + 1, 1);
      this.render();
    });
    todayBtn.addEventListener("click", () => {
      this.jumpToToday();
    });
    refreshBtn.addEventListener("click", () => {
      this.plugin.refreshEvents(true);
    });
  }
  render() {
    if (!this.gridEl || !this.detailsEl || !this.headerTitle) {
      return;
    }
    this.gridEl.empty();
    this.detailsEl.empty();
    this.updateLegend();
    this.renderNav();
    const lang = this.plugin.settings.language;
    const monthStart = startOfMonth(this.visibleMonth);
    const monthEnd = endOfMonth(this.visibleMonth);
    const startWeekday = this.plugin.settings.weekStart === "monday" ? 1 : 0;
    const offset = (monthStart.getDay() - startWeekday + 7) % 7;
    const gridStart = addDays2(monthStart, -offset);
    const gridEnd = addDays2(gridStart, 41);
    this.notesByDate = this.buildNotesIndex(gridStart, gridEnd);
    this.maxNotesForGrid = this.getMaxNotesCount();
    this.headerTitle.setText(
      monthStart.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long" })
    );
    const weekdayRow = this.gridEl.createDiv({ cls: "obsidian-calendar__weekdays" });
    const weekdayKeys = this.plugin.settings.weekStart === "monday" ? ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] : ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    for (const key of weekdayKeys) {
      weekdayRow.createDiv({ cls: "obsidian-calendar__weekday", text: translate(key, lang) });
    }
    const daysGrid = this.gridEl.createDiv({ cls: "obsidian-calendar__days" });
    let cursor = new Date(gridStart);
    const today = /* @__PURE__ */ new Date();
    while (cursor <= gridEnd) {
      const cellDate = new Date(cursor);
      const cell = daysGrid.createEl("button", { cls: "obsidian-calendar__day" });
      cell.setAttr("type", "button");
      if (cellDate.getMonth() !== this.visibleMonth.getMonth()) {
        cell.addClass("is-outside");
      }
      if (isSameDay(cellDate, today)) {
        cell.addClass("is-today");
      }
      if (isSameDay(cellDate, this.selectedDate)) {
        cell.addClass("is-selected");
      }
      const numberEl = cell.createDiv({ cls: "obsidian-calendar__day-number" });
      numberEl.setText(String(cellDate.getDate()));
      const subtitleContainer = cell.createDiv({ cls: "obsidian-calendar__day-subtitles" });
      const notesForDay = this.getNotesForDay(cellDate);
      const dayEvents = this.getEventsForDay(cellDate);
      if (dayEvents.length > 0) {
        const source = this.plugin.settings.sources.find((s) => s.id === dayEvents[0].sourceId);
        const color = source?.color || getDefaultSourceColor(0);
        numberEl.style.color = color;
        const eventLine = subtitleContainer.createDiv({ cls: "obsidian-calendar__day-subtitle obsidian-calendar__day-event" });
        eventLine.style.color = color;
        eventLine.setText(dayEvents[0].summary);
      }
      if (notesForDay.length > 0) {
        const noteLine = subtitleContainer.createDiv({ cls: "obsidian-calendar__day-subtitle obsidian-calendar__day-note" });
        noteLine.setText(notesForDay[0].title);
      }
      const indicator = cell.createDiv({ cls: "obsidian-calendar__day-indicator" });
      if (notesForDay.length > 0) {
        const ratio = Math.min(notesForDay.length / this.maxNotesForGrid, 1);
        const width = Math.max(0.25, ratio) * 100;
        const bar = indicator.createDiv({ cls: "obsidian-calendar__day-bar" });
        bar.style.width = `${width}%`;
      }
      cell.addEventListener("mouseenter", () => {
        this.showHoverPreview(cell, notesForDay);
      });
      cell.addEventListener("mouseleave", () => {
        this.hideHoverPreview();
      });
      cell.addEventListener("click", () => {
        this.selectedDate = cellDate;
        if (cellDate.getMonth() !== this.visibleMonth.getMonth()) {
          this.visibleMonth = new Date(cellDate.getFullYear(), cellDate.getMonth(), 1);
        }
        this.render();
      });
      cursor = addDays2(cursor, 1);
    }
    this.renderDetails();
  }
  updateLegend() {
    if (!this.legendEl) {
      return;
    }
    this.legendEl.empty();
    const enabledSources = this.plugin.settings.sources.filter((s) => s.enabled && s.name);
    if (enabledSources.length === 0) {
      return;
    }
    for (const source of enabledSources) {
      const item = this.legendEl.createDiv({ cls: "obsidian-calendar__legend-item" });
      const dot = item.createDiv({ cls: "obsidian-calendar__legend-dot" });
      dot.style.backgroundColor = source.color;
      item.createDiv({ cls: "obsidian-calendar__legend-label", text: source.name });
    }
  }
  renderDetails() {
    if (!this.detailsEl) {
      return;
    }
    this.detailsEl.empty();
    const lang = this.plugin.settings.language;
    const title = this.detailsEl.createDiv({ cls: "obsidian-calendar__details-title" });
    title.setText(
      this.selectedDate.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { month: "long", day: "numeric", year: "numeric" })
    );
    const notes = this.getNotesForDay(this.selectedDate);
    const events = this.getEventsForDay(this.selectedDate);
    if (events.length > 0) {
      const eventsSection = this.detailsEl.createDiv({ cls: "obsidian-calendar__section" });
      eventsSection.createDiv({ cls: "obsidian-calendar__section-title", text: translate("events", lang) });
      const eventsList = eventsSection.createDiv({ cls: "obsidian-calendar__event-list" });
      for (const event of events) {
        const row = eventsList.createDiv({ cls: "obsidian-calendar__event-row" });
        const source = this.plugin.settings.sources.find((s) => s.id === event.sourceId);
        const color = source?.color || getDefaultSourceColor(0);
        row.style.borderLeft = `3px solid ${color}`;
        row.createDiv({
          cls: "obsidian-calendar__event-time",
          text: event.allDay ? translate("allDay", lang) : formatTime(event.start, this.plugin.settings.timeFormat)
        });
        row.createDiv({ cls: "obsidian-calendar__event-summary", text: event.summary });
      }
    }
    if (notes.length > 0) {
      const notesSection = this.detailsEl.createDiv({ cls: "obsidian-calendar__section" });
      notesSection.createDiv({ cls: "obsidian-calendar__section-title", text: translate("notes", lang) });
      const notesList = notesSection.createDiv({ cls: "obsidian-calendar__notes-list" });
      for (const note of notes) {
        const row = notesList.createEl("button", { cls: "obsidian-calendar__note-row" });
        row.setAttr("type", "button");
        row.createDiv({ cls: "obsidian-calendar__note-title", text: note.title });
        const excerptEl = row.createDiv({ cls: "obsidian-calendar__note-excerpt", text: note.excerpt });
        this.ensureExcerpt(note.file, excerptEl);
        row.addEventListener("click", () => this.openNote(note.file));
      }
    }
    if (notes.length === 0 && events.length === 0) {
      this.detailsEl.createDiv({ cls: "obsidian-calendar__details-empty", text: translate("noNotesOrEvents", lang) });
    }
    if (this.plugin.settings.allowCreateNote) {
      const action = this.detailsEl.createDiv({ cls: "obsidian-calendar__details-action" });
      const button = action.createEl("button", { text: translate("createNote", lang) });
      button.addEventListener("click", async () => {
        const file = await this.plugin.createNoteForDate(this.selectedDate);
        if (file) {
          this.openNote(file);
        }
      });
    }
  }
  getEventsForDay(day) {
    const start = clampToDayStart(day);
    const end = clampToDayEnd(day);
    return this.events.filter((event) => event.start <= end && event.end >= start).sort((a, b) => a.start.getTime() - b.start.getTime());
  }
  buildNotesIndex(start, end) {
    const index = /* @__PURE__ */ new Map();
    const startDay = clampToDayStart(start);
    const endDay = clampToDayEnd(end);
    const fields = this.plugin.settings.noteDateFields.map((field) => field.trim()).filter((field) => field.length > 0);
    if (fields.length === 0) {
      return index;
    }
    const files = this.plugin.app.vault.getMarkdownFiles();
    for (const file of files) {
      const cache = this.plugin.app.metadataCache.getFileCache(file);
      if (!cache?.frontmatter) {
        continue;
      }
      for (const field of fields) {
        const rawValue = cache.frontmatter[field];
        if (!rawValue) {
          continue;
        }
        const dates = extractFrontmatterDates(rawValue);
        for (const date of dates) {
          if (date < startDay || date > endDay) {
            continue;
          }
          const key = formatDateKey(date);
          const list = index.get(key) ?? [];
          if (!list.some((note) => note.file.path === file.path)) {
            const title = file.basename;
            list.push({
              file,
              title,
              excerpt: this.noteExcerptCache.get(file.path) ?? ""
            });
            index.set(key, list);
          }
        }
      }
    }
    for (const [key, list] of index.entries()) {
      list.sort((a, b) => a.title.localeCompare(b.title));
      index.set(key, list);
    }
    return index;
  }
  getNotesForDay(day) {
    return this.notesByDate.get(formatDateKey(day)) ?? [];
  }
  getMaxNotesCount() {
    let maxCount = 1;
    for (const list of this.notesByDate.values()) {
      if (list.length > maxCount) {
        maxCount = list.length;
      }
    }
    return maxCount;
  }
  ensureHoverPreview() {
    if (this.hoverPreviewEl) {
      return;
    }
    this.hoverPreviewEl = document.body.createDiv({ cls: "obsidian-calendar__note-preview" });
  }
  showHoverPreview(anchor, notes) {
    if (!this.hoverPreviewEl || notes.length === 0) {
      return;
    }
    this.hoverPreviewEl.empty();
    for (const note of notes.slice(0, 3)) {
      const row = this.hoverPreviewEl.createDiv({ cls: "obsidian-calendar__note-preview-row" });
      row.createDiv({ cls: "obsidian-calendar__note-preview-title", text: note.title });
      const excerptEl = row.createDiv({
        cls: "obsidian-calendar__note-preview-excerpt",
        text: note.excerpt
      });
      this.ensureExcerpt(note.file, excerptEl);
    }
    this.hoverPreviewEl.style.display = "block";
    const rect = anchor.getBoundingClientRect();
    const previewWidth = 220;
    const previewHeight = this.hoverPreviewEl.offsetHeight || 80;
    const padding = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let left = rect.left + rect.width / 2 - previewWidth / 2;
    left = Math.max(padding, Math.min(left, viewportWidth - previewWidth - padding));
    let top = rect.bottom + 6;
    if (top + previewHeight > viewportHeight - padding) {
      top = rect.top - previewHeight - 6;
    }
    this.hoverPreviewEl.style.width = `${previewWidth}px`;
    this.hoverPreviewEl.style.left = `${left}px`;
    this.hoverPreviewEl.style.top = `${Math.max(padding, top)}px`;
  }
  hideHoverPreview() {
    if (this.hoverPreviewEl) {
      this.hoverPreviewEl.style.display = "none";
    }
  }
  ensureExcerpt(file, targetEl) {
    if (this.noteExcerptCache.has(file.path)) {
      targetEl.setText(this.noteExcerptCache.get(file.path) ?? "");
      return;
    }
    this.plugin.app.vault.cachedRead(file).then((content) => {
      const lines = content.split("\n");
      let startIndex = 0;
      if (lines[0]?.trim() === "---") {
        const endIndex = lines.slice(1).findIndex((line) => line.trim() === "---");
        if (endIndex >= 0) {
          startIndex = endIndex + 2;
        }
      }
      const firstLine = lines.slice(startIndex).find((line) => line.trim().length > 0) ?? "";
      const excerpt = firstLine.replace(/^#\s+/, "").trim();
      this.noteExcerptCache.set(file.path, excerpt);
      targetEl.setText(excerpt);
    });
  }
  async openNote(file) {
    const leaf = this.plugin.app.workspace.getLeaf(false);
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    const line = cache?.frontmatterPosition?.end?.line ?? 0;
    await leaf.openFile(file, { state: { line }, active: true });
  }
};
var CalendarSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.selectedTemplateFolder = "";
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Calendar" });
    new import_obsidian2.Setting(containerEl).setName("Refresh interval (minutes)").setDesc("How often calendar sources are refreshed.").addText(
      (text) => text.setPlaceholder("30").setValue(String(this.plugin.settings.refreshIntervalMinutes)).onChange(async (value) => {
        const parsed = Number(value);
        this.plugin.settings.refreshIntervalMinutes = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SETTINGS.refreshIntervalMinutes;
        await this.plugin.saveSettings();
        this.plugin.refreshEvents(true);
        this.plugin.restartAutoRefresh();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Language").setDesc("Display language for the calendar interface.").addDropdown(
      (dropdown) => dropdown.addOption("en", "English").addOption("zh", "\u4E2D\u6587").setValue(this.plugin.settings.language).onChange(async (value) => {
        this.plugin.settings.language = value;
        await this.plugin.saveSettings();
        this.plugin.renderViews();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Week starts on").addDropdown(
      (dropdown) => dropdown.addOption("sunday", "Sunday").addOption("monday", "Monday").setValue(this.plugin.settings.weekStart).onChange(async (value) => {
        this.plugin.settings.weekStart = value;
        await this.plugin.saveSettings();
        this.plugin.renderViews();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Time format").addDropdown(
      (dropdown) => dropdown.addOption("24h", "24-hour").addOption("12h", "12-hour").setValue(this.plugin.settings.timeFormat).onChange(async (value) => {
        this.plugin.settings.timeFormat = value;
        await this.plugin.saveSettings();
        this.plugin.renderViews();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Today highlight").setDesc("Highlight color for today.").addColorPicker(
      (picker) => picker.setValue(resolveHighlightValue(this.plugin.settings.todayHighlight, "--interactive-accent")).onChange(async (value) => {
        this.plugin.settings.todayHighlight = value;
        await this.plugin.saveSettings();
        this.plugin.applyHighlightVariables();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Selected date highlight").setDesc("Highlight color for the selected date.").addColorPicker(
      (picker) => picker.setValue(resolveHighlightValue(this.plugin.settings.selectedHighlight, "--text-accent")).onChange(async (value) => {
        this.plugin.settings.selectedHighlight = value;
        await this.plugin.saveSettings();
        this.plugin.applyHighlightVariables();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Note date fields").setDesc("Comma-separated frontmatter fields used to link notes to dates.").addText(
      (text) => text.setPlaceholder("date, start, end").setValue(this.plugin.settings.noteDateFields.join(", ")).onChange(async (value) => {
        this.plugin.settings.noteDateFields = value.split(",").map((field) => field.trim()).filter((field) => field.length > 0);
        await this.plugin.saveSettings();
        this.plugin.renderViews();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Allow create note").setDesc("Show a quick action to create a note for the selected date.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.allowCreateNote).onChange(async (value) => {
        this.plugin.settings.allowCreateNote = value;
        await this.plugin.saveSettings();
        this.plugin.renderViews();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Note density bar color").setDesc("Color for the note density indicator bar.").addColorPicker(
      (picker) => picker.setValue(resolveHighlightValue(this.plugin.settings.noteBarColor, "--text-accent")).onChange(async (value) => {
        this.plugin.settings.noteBarColor = value;
        await this.plugin.saveSettings();
        this.plugin.applyHighlightVariables();
      })
    );
    const templateSetting = new import_obsidian2.Setting(containerEl).setName("Note template").setDesc("Choose a vault template file.");
    const templateHint = containerEl.createDiv({ cls: "obsidian-calendar__setting-hint" });
    const updateTemplateHint = (warning = "") => {
      if (warning) {
        templateHint.setText(warning);
        templateHint.addClass("is-error");
        return;
      }
      const path = this.plugin.settings.noteTemplatePath.trim();
      if (!path) {
        templateHint.setText("No template selected.");
        templateHint.removeClass("is-error");
        return;
      }
      const file = this.plugin.getTemplateFile(path);
      if (file) {
        templateHint.setText(`Template: ${file.path}`);
        templateHint.removeClass("is-error");
        return;
      }
      templateHint.setText("Template not found in this vault.");
      templateHint.addClass("is-error");
    };
    const currentPath = this.plugin.settings.noteTemplatePath;
    const currentFolder = currentPath ? currentPath.split("/").slice(0, -1).join("/") : "";
    if (!this.selectedTemplateFolder) {
      this.selectedTemplateFolder = currentFolder;
    }
    const folderOptions = this.plugin.getTemplateFolderOptions();
    templateSetting.addDropdown((dropdown) => {
      dropdown.addOption("", "All folders");
      for (const folder of folderOptions) {
        dropdown.addOption(folder, folder || "(root)");
      }
      dropdown.setValue(this.selectedTemplateFolder);
      dropdown.onChange((value) => {
        this.selectedTemplateFolder = value;
        this.display();
      });
    });
    const templateOptions = this.plugin.getTemplateOptions(this.selectedTemplateFolder);
    templateSetting.addDropdown((dropdown) => {
      dropdown.addOption("", "None");
      for (const option of templateOptions) {
        dropdown.addOption(option.path, option.label);
      }
      dropdown.setValue(this.plugin.settings.noteTemplatePath);
      dropdown.onChange(async (value) => {
        this.plugin.settings.noteTemplatePath = value;
        await this.plugin.saveSettings();
        updateTemplateHint();
      });
    });
    updateTemplateHint();
    containerEl.createEl("h3", { text: "Calendar sources" });
    for (const source of this.plugin.settings.sources) {
      const sourceSetting = new import_obsidian2.Setting(containerEl).setName(source.name || "Unnamed").setDesc("Enabled sources are fetched and merged.");
      sourceSetting.addToggle(
        (toggle) => toggle.setValue(source.enabled).onChange(async (value) => {
          source.enabled = value;
          await this.plugin.saveSettings();
          this.plugin.refreshEvents(true);
        })
      );
      sourceSetting.addButton(
        (button) => button.setButtonText("Remove").setCta().onClick(async () => {
          this.plugin.settings.sources = this.plugin.settings.sources.filter((item) => item.id !== source.id);
          await this.plugin.saveSettings();
          this.plugin.refreshEvents(true);
          this.display();
        })
      );
      new import_obsidian2.Setting(containerEl).setName("Name").addText(
        (text) => text.setValue(source.name).onChange(async (value) => {
          source.name = value;
          sourceSetting.setName(source.name.trim() || "Unnamed");
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian2.Setting(containerEl).setName("iCal URL").addText(
        (text) => text.setPlaceholder("https://calendar.google.com/calendar/ical/...").setValue(source.url).onChange(async (value) => {
          source.url = value.trim();
          await this.plugin.saveSettings();
          this.plugin.refreshEvents(true);
        })
      );
      new import_obsidian2.Setting(containerEl).setName("Color").setDesc("Event color for this source.").addColorPicker(
        (picker) => picker.setValue(source.color).onChange(async (value) => {
          source.color = value;
          await this.plugin.saveSettings();
          this.plugin.renderViews();
        })
      );
    }
    new import_obsidian2.Setting(containerEl).setName("Add calendar source").setDesc("Add another iCal (ICS) source.").addButton(
      (button) => button.setButtonText("Add").onClick(async () => {
        const newIndex = this.plugin.settings.sources.length;
        this.plugin.settings.sources.push({
          id: createSourceId(),
          name: "",
          enabled: true,
          url: "",
          color: getDefaultSourceColor(newIndex)
        });
        await this.plugin.saveSettings();
        this.display();
      })
    );
  }
};
var CalendarPlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.service = new IcalService(parseIcal);
    this.events = [];
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new CalendarSettingTab(this.app, this));
    this.registerView(VIEW_TYPE_CALENDAR, (leaf) => new CalendarView(leaf, this));
    this.registerCommands();
    this.registerStyles();
    this.app.workspace.onLayoutReady(async () => {
      await this.activateView();
      await this.refreshEvents();
    });
    this.startAutoRefresh();
  }
  async onunload() {
    if (this.refreshHandle) {
      window.clearInterval(this.refreshHandle);
    }
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CALENDAR);
  }
  async activateView() {
    const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
    if (existingLeaves.length > 0) {
      this.app.workspace.revealLeaf(existingLeaves[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(false);
    await leaf.setViewState({ type: VIEW_TYPE_CALENDAR, active: true });
    this.app.workspace.revealLeaf(leaf);
    this.applyHighlightVariables();
  }
  async refreshEvents(forceRefresh = false) {
    this.events = await this.service.getEvents(
      this.settings.sources,
      this.settings.refreshIntervalMinutes,
      forceRefresh
    );
    this.renderViews();
  }
  renderViews() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof CalendarView) {
        view.setEvents(this.events);
      }
    }
  }
  restartAutoRefresh() {
    if (this.refreshHandle) {
      window.clearInterval(this.refreshHandle);
    }
    this.startAutoRefresh();
  }
  startAutoRefresh() {
    const intervalMs = Math.max(this.settings.refreshIntervalMinutes, 1) * 60 * 1e3;
    this.refreshHandle = window.setInterval(() => {
      this.refreshEvents();
    }, intervalMs);
  }
  registerCommands() {
    this.addCommand({
      id: "calendar-open",
      name: "Open calendar",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "calendar-today",
      name: "Jump to today",
      callback: () => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
        for (const leaf of leaves) {
          const view = leaf.view;
          if (view instanceof CalendarView) {
            view.jumpToToday();
          }
        }
      }
    });
    this.addCommand({
      id: "calendar-refresh",
      name: "Refresh calendar",
      callback: () => this.refreshEvents(true)
    });
  }
  registerStyles() {
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      .obsidian-calendar {
        height: 100%;
        display: flex;
        flex-direction: column;
        color: var(--text-normal);
        background: var(--background-primary);
        --calendar-today-accent: var(--interactive-accent);
        --calendar-selected-accent: var(--interactive-accent);
        --calendar-note-bar-color: #5eb8d5;
      }
      .obsidian-calendar__header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--background-modifier-border);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .obsidian-calendar__nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
      }
      .obsidian-calendar__nav-left,
      .obsidian-calendar__nav-right {
        flex: 0 0 auto;
      }
      .obsidian-calendar__nav-center {
        display: flex;
        gap: 16px;
      }
      .obsidian-calendar__nav button {
        background: transparent;
        border: none;
        padding: 6px 12px;
        border-radius: 0;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 13px;
        transition: color 0.15s ease;
      }
      .obsidian-calendar__nav button:hover {
        color: var(--text-normal);
        background: transparent;
      }
      .obsidian-calendar__title {
        font-size: 17px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }
      .obsidian-calendar__legend {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .obsidian-calendar__legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .obsidian-calendar__legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .obsidian-calendar__legend-label {
        font-size: 12px;
        color: var(--text-muted);
        white-space: nowrap;
      }
      .obsidian-calendar__body {
        padding: 20px 24px 24px;
        display: flex;
        flex-direction: column;
        gap: 24px;
        overflow: auto;
      }
      .obsidian-calendar__grid {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .obsidian-calendar__weekdays {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 4px;
        font-size: 10px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 500;
        opacity: 0.8;
        margin-bottom: 2px;
      }
      .obsidian-calendar__weekday {
        padding: 4px;
        text-align: center;
      }
      .obsidian-calendar__days {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0;
      }
      .obsidian-calendar__day {
        border: none !important;
        background: transparent !important;
        border-radius: 0 !important;
        padding: 16px 4px 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        gap: 3px;
        min-height: 64px;
        cursor: pointer;
        position: relative;
        box-shadow: none !important;
        outline: none !important;
      }
      .obsidian-calendar__day:hover,
      .obsidian-calendar__day:focus {
        background: transparent !important;
        box-shadow: none !important;
      }
      .obsidian-calendar__day.is-outside {
        opacity: 0.4;
      }
      .obsidian-calendar__day.is-today .obsidian-calendar__day-number::after {
        content: '';
        position: absolute;
        bottom: -2px;
        left: 50%;
        transform: translateX(-50%);
        width: 22px;
        height: 3px;
        background: var(--calendar-today-accent);
        border-radius: 2px;
      }
      .obsidian-calendar__day.is-selected .obsidian-calendar__day-number::after {
        content: '';
        position: absolute;
        bottom: -2px;
        left: 50%;
        transform: translateX(-50%);
        width: 22px;
        height: 3px;
        background: var(--calendar-selected-accent);
        border-radius: 2px;
      }
      .obsidian-calendar__day.is-today.is-selected .obsidian-calendar__day-number::after {
        background: var(--calendar-today-accent);
      }
      .obsidian-calendar__day-number {
        font-size: 17px;
        font-weight: 500;
        line-height: 1;
        position: relative;
        padding-bottom: 4px;
      }
      .obsidian-calendar__day-subtitles {
        display: flex;
        flex-direction: column;
        gap: 2px;
        width: 100%;
        min-height: 24px;
      }
      .obsidian-calendar__day-subtitle {
        font-size: 10px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
        text-align: center;
        line-height: 1.2;
        font-weight: 400;
      }
      .obsidian-calendar__day-note {
        color: var(--text-normal);
        opacity: 0.7;
      }
      .obsidian-calendar__day-event {
        opacity: 0.85;
      }
      .obsidian-calendar__day-indicator {
        min-height: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        margin-top: 2px;
      }
      .obsidian-calendar__day-bar {
        height: 2px;
        border-radius: 1px;
        background: var(--calendar-note-bar-color);
        opacity: 0.5;
      }
      .obsidian-calendar__note-preview {
        position: fixed;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        padding: 10px 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        display: none;
        z-index: 9999;
        pointer-events: none;
      }
      .obsidian-calendar__note-preview-row {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 5px 0;
      }
      .obsidian-calendar__note-preview-title {
        font-size: 12px;
        font-weight: 500;
        color: var(--text-normal);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .obsidian-calendar__note-preview-excerpt {
        font-size: 11px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        opacity: 0.9;
      }
      .obsidian-calendar__details-title {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
        margin-bottom: 4px;
      }
      .obsidian-calendar__details {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .obsidian-calendar__section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .obsidian-calendar__notes-list,
      .obsidian-calendar__event-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .obsidian-calendar__section-title {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 500;
        margin-bottom: 2px;
        opacity: 0.8;
      }
      .obsidian-calendar__note-row {
        border: none;
        background: transparent;
        text-align: left;
        padding: 10px 8px;
        display: block;
        cursor: pointer;
        width: 100%;
        box-sizing: border-box;
        min-height: 52px;
        overflow: hidden;
        border-radius: 4px;
      }
      .obsidian-calendar__note-row:hover {
        opacity: 0.8;
      }
      .obsidian-calendar__note-title {
        font-size: 13px;
        color: var(--text-normal);
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.3;
        margin-bottom: 2px;
      }
      .obsidian-calendar__note-excerpt {
        font-size: 12px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.3;
        opacity: 0.85;
      }
      .obsidian-calendar__event-row {
        display: grid;
        grid-template-columns: 68px 1fr;
        gap: 14px;
        padding: 6px 0;
        width: 100%;
        box-sizing: border-box;
      }
      .obsidian-calendar__event-time {
        font-size: 12px;
        color: var(--text-muted);
        font-weight: 400;
        opacity: 0.85;
      }
      .obsidian-calendar__event-summary {
        font-size: 13px;
        font-weight: 400;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.3;
      }
      .obsidian-calendar__details-action {
        margin-top: 4px;
      }
      .obsidian-calendar__details-action button {
        background: transparent;
        border: 1px solid var(--background-modifier-border);
        padding: 6px 14px;
        border-radius: 4px;
        color: var(--text-normal);
        cursor: pointer;
        font-size: 13px;
      }
      .obsidian-calendar__details-action button:hover {
        background: var(--background-modifier-hover);
      }
      .obsidian-calendar__setting-hint {
        font-size: 12px;
        color: var(--text-muted);
        margin: 4px 0 12px;
      }
      .obsidian-calendar__setting-hint.is-error {
        color: var(--text-accent);
      }
      .obsidian-calendar__details-row {
        display: grid;
        grid-template-columns: 68px 1fr;
        gap: 14px;
        padding: 6px 0;
      }
      .obsidian-calendar__details-time {
        font-size: 12px;
        color: var(--text-muted);
        opacity: 0.85;
      }
      .obsidian-calendar__details-summary {
        font-size: 13px;
      }
      .obsidian-calendar__details-empty {
        font-size: 12px;
        color: var(--text-muted);
        opacity: 0.75;
      }
    `;
    styleEl.dataset.calendarView = "true";
    document.head.appendChild(styleEl);
    this.register(() => styleEl.remove());
  }
  async loadSettings() {
    const data = await this.loadData();
    this.settings = this.normalizeSettings(data);
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.applyHighlightVariables();
  }
  async createNoteForDate(date) {
    const field = this.settings.noteDateFields[0] || "date";
    const title = formatDateKey(date);
    const basePath = (0, import_obsidian2.normalizePath)(`${title}.md`);
    const filePath = await this.getAvailablePath(basePath);
    const templateContent = await this.loadTemplateContent();
    const content = this.buildNoteContent(field, title, templateContent);
    try {
      return await this.app.vault.create(filePath, content);
    } catch (error) {
      console.error("Failed to create note", error);
      return null;
    }
  }
  getTemplateFile(path) {
    const trimmed = path.trim();
    if (!trimmed) {
      return null;
    }
    const normalizedInput = this.normalizeTemplatePath(trimmed).path;
    const normalized = (0, import_obsidian2.normalizePath)(normalizePathSlashes(normalizedInput).replace(/^\//, ""));
    const file = this.app.vault.getAbstractFileByPath(normalized);
    if (file instanceof import_obsidian2.TFile) {
      return file;
    }
    if (!normalized.toLowerCase().endsWith(".md")) {
      const withExtension = this.app.vault.getAbstractFileByPath(`${normalized}.md`);
      if (withExtension instanceof import_obsidian2.TFile) {
        return withExtension;
      }
    }
    return null;
  }
  async loadTemplateContent() {
    const path = this.settings.noteTemplatePath.trim();
    if (!path) {
      return "";
    }
    const file = this.getTemplateFile(path);
    if (!file) {
      return "";
    }
    try {
      return await this.app.vault.cachedRead(file);
    } catch (error) {
      console.error("Failed to read template", error);
      return "";
    }
  }
  buildNoteContent(field, value, template) {
    if (!template.trim()) {
      return `---
${field}: ${value}
---

`;
    }
    const lines = template.split("\n");
    if (lines[0]?.trim() === "---") {
      const endIndex = lines.slice(1).findIndex((line) => line.trim() === "---");
      if (endIndex >= 0) {
        const frontmatterEnd = endIndex + 1;
        const hasField = lines.slice(1, frontmatterEnd).some((line) => line.trim().startsWith(`${field}:`));
        if (!hasField) {
          lines.splice(frontmatterEnd, 0, `${field}: ${value}`);
        }
        return lines.join("\n");
      }
    }
    return `---
${field}: ${value}
---

${template}`;
  }
  async getAvailablePath(path) {
    if (!this.app.vault.getAbstractFileByPath(path)) {
      return path;
    }
    const base = path.replace(/\.md$/i, "");
    let index = 1;
    let candidate = `${base}-${index}.md`;
    while (this.app.vault.getAbstractFileByPath(candidate)) {
      index += 1;
      candidate = `${base}-${index}.md`;
    }
    return candidate;
  }
  applyHighlightVariables() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
    for (const leaf of leaves) {
      const container = leaf.view.containerEl;
      const todayColor = resolveHighlightValue(this.settings.todayHighlight, "--interactive-accent");
      const selectedColor = resolveHighlightValue(this.settings.selectedHighlight, "--text-accent");
      const barColor = resolveHighlightValue(this.settings.noteBarColor, "--text-accent");
      container.style.setProperty(
        "--calendar-today-accent",
        todayColor
      );
      container.style.setProperty(
        "--calendar-selected-accent",
        selectedColor
      );
      container.style.setProperty(
        "--calendar-note-bar-color",
        barColor
      );
    }
  }
  normalizeTemplatePath(rawPath) {
    const trimmed = rawPath.trim();
    if (!trimmed) {
      return { path: "", warning: "" };
    }
    let normalized = normalizePathSlashes(trimmed).replace(/^\//, "");
    if (/^[a-zA-Z]:\//.test(normalized) || normalized.startsWith("//")) {
      const vaultRoot = normalizePathSlashes(this.app.vault.adapter.getFullPath(""));
      const rootWithSlash = vaultRoot.endsWith("/") ? vaultRoot : `${vaultRoot}/`;
      if (normalized.startsWith(rootWithSlash)) {
        normalized = normalized.slice(rootWithSlash.length);
        return { path: (0, import_obsidian2.normalizePath)(normalized), warning: "" };
      }
      return { path: "", warning: "Template path must be inside this vault." };
    }
    return { path: (0, import_obsidian2.normalizePath)(normalized), warning: "" };
  }
  getTemplateFolderOptions() {
    const folders = /* @__PURE__ */ new Set();
    for (const file of this.app.vault.getMarkdownFiles()) {
      const parent = file.parent?.path ?? "";
      folders.add(parent);
    }
    return Array.from(folders).sort((a, b) => a.localeCompare(b));
  }
  getTemplateOptions(folder) {
    return this.app.vault.getMarkdownFiles().filter((file) => folder ? file.parent?.path === folder : true).map((file) => ({
      path: file.path,
      label: file.name
    })).sort((a, b) => a.label.localeCompare(b.label));
  }
  normalizeSettings(data) {
    if (!data || typeof data !== "object") {
      return { ...DEFAULT_SETTINGS };
    }
    const record = data;
    const sources = Array.isArray(record.sources) ? record.sources.map((source, index) => ({
      id: source.id || createSourceId(),
      name: source.name ?? "",
      enabled: source.enabled ?? true,
      url: source.url ?? "",
      color: source.color ?? getDefaultSourceColor(index)
    })) : [];
    if (sources.length === 0 && typeof record.icalUrl === "string" && record.icalUrl.trim().length > 0) {
      sources.push({
        id: createSourceId(),
        name: "Primary",
        enabled: true,
        url: record.icalUrl.trim(),
        color: getDefaultSourceColor(0)
      });
    }
    return {
      sources,
      weekStart: record.weekStart ?? DEFAULT_SETTINGS.weekStart,
      timeFormat: record.timeFormat ?? DEFAULT_SETTINGS.timeFormat,
      language: record.language ?? DEFAULT_SETTINGS.language,
      refreshIntervalMinutes: record.refreshIntervalMinutes ?? DEFAULT_SETTINGS.refreshIntervalMinutes,
      todayHighlight: record.todayHighlight ?? DEFAULT_SETTINGS.todayHighlight,
      selectedHighlight: record.selectedHighlight ?? DEFAULT_SETTINGS.selectedHighlight,
      noteDateFields: Array.isArray(record.noteDateFields) && record.noteDateFields.length > 0 ? record.noteDateFields : DEFAULT_SETTINGS.noteDateFields,
      allowCreateNote: record.allowCreateNote ?? DEFAULT_SETTINGS.allowCreateNote,
      noteTemplatePath: typeof record.noteTemplatePath === "string" ? record.noteTemplatePath : DEFAULT_SETTINGS.noteTemplatePath,
      noteBarColor: typeof record.noteBarColor === "string" ? record.noteBarColor : DEFAULT_SETTINGS.noteBarColor
    };
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL21haW4udHMiLCAiLi4vc3JjL2ljYWwudHMiLCAiLi4vc3JjL3NlcnZpY2VzL2ljYWxTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQge1xyXG4gIEFwcCxcclxuICBJdGVtVmlldyxcclxuICBQbHVnaW4sXHJcbiAgUGx1Z2luU2V0dGluZ1RhYixcclxuICBTZXR0aW5nLFxyXG4gIFRGaWxlLFxyXG4gIFdvcmtzcGFjZUxlYWYsXHJcbiAgbm9ybWFsaXplUGF0aFxyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyBwYXJzZUljYWwgfSBmcm9tIFwiLi9pY2FsXCI7XHJcbmltcG9ydCB7IEljYWxTZXJ2aWNlIH0gZnJvbSBcIi4vc2VydmljZXMvaWNhbFNlcnZpY2VcIjtcclxuaW1wb3J0IHsgQ2FsZW5kYXJFdmVudCwgQ2FsZW5kYXJTZXR0aW5ncywgQ2FsZW5kYXJTb3VyY2UgfSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuY29uc3QgVklFV19UWVBFX0NBTEVOREFSID0gXCJvYnNpZGlhbi1jYWxlbmRhci12aWV3XCI7XHJcblxyXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBDYWxlbmRhclNldHRpbmdzID0ge1xyXG4gIHNvdXJjZXM6IFtdLFxyXG4gIHdlZWtTdGFydDogXCJzdW5kYXlcIixcclxuICB0aW1lRm9ybWF0OiBcIjI0aFwiLFxyXG4gIGxhbmd1YWdlOiBcImVuXCIsXHJcbiAgcmVmcmVzaEludGVydmFsTWludXRlczogMzAsXHJcbiAgdG9kYXlIaWdobGlnaHQ6IFwiIzI5YTVjN1wiLFxyXG4gIHNlbGVjdGVkSGlnaGxpZ2h0OiBcIiM1NGRmMjZcIixcclxuICBub3RlRGF0ZUZpZWxkczogW1wiZGF0ZVwiXSxcclxuICBhbGxvd0NyZWF0ZU5vdGU6IHRydWUsXHJcbiAgbm90ZVRlbXBsYXRlUGF0aDogXCJcIixcclxuICBub3RlQmFyQ29sb3I6IFwiI2VhNjQwYlwiXHJcbn07XHJcblxyXG5jb25zdCBUUkFOU0xBVElPTlM6IFJlY29yZDxzdHJpbmcsIFJlY29yZDxzdHJpbmcsIHN0cmluZz4+ID0ge1xyXG4gIGVuOiB7XHJcbiAgICB0b2RheTogXCJUb2RheVwiLFxyXG4gICAgcmVmcmVzaDogXCJSZWZyZXNoXCIsXHJcbiAgICBjcmVhdGVOb3RlOiBcIkNyZWF0ZSBub3RlXCIsXHJcbiAgICBldmVudHM6IFwiRXZlbnRzXCIsXHJcbiAgICBub3RlczogXCJOb3Rlc1wiLFxyXG4gICAgYWxsRGF5OiBcIkFsbCBkYXlcIixcclxuICAgIG5vTm90ZXNPckV2ZW50czogXCJObyBub3RlcyBvciBldmVudHNcIixcclxuICAgIHN1bjogXCJTdW5cIixcclxuICAgIG1vbjogXCJNb25cIixcclxuICAgIHR1ZTogXCJUdWVcIixcclxuICAgIHdlZDogXCJXZWRcIixcclxuICAgIHRodTogXCJUaHVcIixcclxuICAgIGZyaTogXCJGcmlcIixcclxuICAgIHNhdDogXCJTYXRcIlxyXG4gIH0sXHJcbiAgemg6IHtcclxuICAgIHRvZGF5OiBcIlx1NEVDQVx1NTkyOVwiLFxyXG4gICAgcmVmcmVzaDogXCJcdTUyMzdcdTY1QjBcIixcclxuICAgIGNyZWF0ZU5vdGU6IFwiXHU2NUIwXHU1RUZBXHU3QjE0XHU4QkIwXCIsXHJcbiAgICBldmVudHM6IFwiXHU2NUU1XHU3QTBCXCIsXHJcbiAgICBub3RlczogXCJcdTdCMTRcdThCQjBcIixcclxuICAgIGFsbERheTogXCJcdTUxNjhcdTU5MjlcIixcclxuICAgIG5vTm90ZXNPckV2ZW50czogXCJcdTY2ODJcdTY1RTBcdTdCMTRcdThCQjBcdTYyMTZcdTY1RTVcdTdBMEJcIixcclxuICAgIHN1bjogXCJcdTU0NjhcdTY1RTVcIixcclxuICAgIG1vbjogXCJcdTU0NjhcdTRFMDBcIixcclxuICAgIHR1ZTogXCJcdTU0NjhcdTRFOENcIixcclxuICAgIHdlZDogXCJcdTU0NjhcdTRFMDlcIixcclxuICAgIHRodTogXCJcdTU0NjhcdTU2REJcIixcclxuICAgIGZyaTogXCJcdTU0NjhcdTRFOTRcIixcclxuICAgIHNhdDogXCJcdTU0NjhcdTUxNkRcIlxyXG4gIH1cclxufTtcclxuXHJcbmZ1bmN0aW9uIHRyYW5zbGF0ZShrZXk6IHN0cmluZywgbGFuZzogXCJlblwiIHwgXCJ6aFwiKTogc3RyaW5nIHtcclxuICByZXR1cm4gVFJBTlNMQVRJT05TW2xhbmddPy5ba2V5XSA/PyBUUkFOU0xBVElPTlMuZW5ba2V5XSA/PyBrZXk7XHJcbn1cclxuXHJcbmNvbnN0IFdFRUtEQVlfTEFCRUxTID0gW1wiU3VuXCIsIFwiTW9uXCIsIFwiVHVlXCIsIFwiV2VkXCIsIFwiVGh1XCIsIFwiRnJpXCIsIFwiU2F0XCJdO1xyXG5cclxuZnVuY3Rpb24gcmVzb2x2ZUhpZ2hsaWdodFZhbHVlKHZhbHVlOiBzdHJpbmcsIGZhbGxiYWNrVmFyOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGNvbnN0IHRyaW1tZWQgPSB2YWx1ZS50cmltKCk7XHJcbiAgaWYgKCF0cmltbWVkKSB7XHJcbiAgICByZXR1cm4gZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5KS5nZXRQcm9wZXJ0eVZhbHVlKGZhbGxiYWNrVmFyKS50cmltKCk7XHJcbiAgfVxyXG4gIGlmICh0cmltbWVkLnN0YXJ0c1dpdGgoXCItLVwiKSkge1xyXG4gICAgY29uc3QgcmVzb2x2ZWQgPSBnZXRDb21wdXRlZFN0eWxlKGRvY3VtZW50LmJvZHkpLmdldFByb3BlcnR5VmFsdWUodHJpbW1lZCkudHJpbSgpO1xyXG4gICAgcmV0dXJuIHJlc29sdmVkIHx8IHRyaW1tZWQ7XHJcbiAgfVxyXG4gIHJldHVybiB0cmltbWVkO1xyXG59XHJcblxyXG5mdW5jdGlvbiBub3JtYWxpemVQYXRoU2xhc2hlcyh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICByZXR1cm4gdmFsdWUucmVwbGFjZSgvXFxcXC9nLCBcIi9cIik7XHJcbn1cclxuXHJcbmNvbnN0IERFRkFVTFRfU09VUkNFX0NPTE9SUyA9IFtcclxuICBcIiNlNzRjM2NcIiwgLy8gcmVkXHJcbiAgXCIjMzQ5OGRiXCIsIC8vIGJsdWVcclxuICBcIiMyZWNjNzFcIiwgLy8gZ3JlZW5cclxuICBcIiNmMzljMTJcIiwgLy8gb3JhbmdlXHJcbiAgXCIjOWI1OWI2XCIsIC8vIHB1cnBsZVxyXG4gIFwiIzFhYmM5Y1wiLCAvLyB0dXJxdW9pc2VcclxuICBcIiNlNjdlMjJcIiwgLy8gY2Fycm90XHJcbiAgXCIjMzQ0OTVlXCIgIC8vIGRhcmsgZ3JheVxyXG5dO1xyXG5cclxuZnVuY3Rpb24gZ2V0RGVmYXVsdFNvdXJjZUNvbG9yKGluZGV4OiBudW1iZXIpOiBzdHJpbmcge1xyXG4gIHJldHVybiBERUZBVUxUX1NPVVJDRV9DT0xPUlNbaW5kZXggJSBERUZBVUxUX1NPVVJDRV9DT0xPUlMubGVuZ3RoXTtcclxufVxyXG5cclxudHlwZSBMaW5rZWROb3RlID0ge1xyXG4gIGZpbGU6IFRGaWxlO1xyXG4gIHRpdGxlOiBzdHJpbmc7XHJcbiAgZXhjZXJwdDogc3RyaW5nO1xyXG59O1xyXG5cclxuZnVuY3Rpb24gZm9ybWF0RGF0ZUtleShkYXRlOiBEYXRlKTogc3RyaW5nIHtcclxuICBjb25zdCB5ZWFyID0gZGF0ZS5nZXRGdWxsWWVhcigpO1xyXG4gIGNvbnN0IG1vbnRoID0gU3RyaW5nKGRhdGUuZ2V0TW9udGgoKSArIDEpLnBhZFN0YXJ0KDIsIFwiMFwiKTtcclxuICBjb25zdCBkYXkgPSBTdHJpbmcoZGF0ZS5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsIFwiMFwiKTtcclxuICByZXR1cm4gYCR7eWVhcn0tJHttb250aH0tJHtkYXl9YDtcclxufVxyXG5cclxuZnVuY3Rpb24gcGFyc2VGcm9udG1hdHRlckRhdGUodmFsdWU6IHVua25vd24pOiBEYXRlIHwgbnVsbCB7XHJcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSAmJiAhTnVtYmVyLmlzTmFOKHZhbHVlLmdldFRpbWUoKSkpIHtcclxuICAgIHJldHVybiB2YWx1ZTtcclxuICB9XHJcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIikge1xyXG4gICAgY29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcclxuICAgIGlmICghdHJpbW1lZCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuICAgIGNvbnN0IHBhcnNlZCA9IG5ldyBEYXRlKHRyaW1tZWQpO1xyXG4gICAgaWYgKCFOdW1iZXIuaXNOYU4ocGFyc2VkLmdldFRpbWUoKSkpIHtcclxuICAgICAgcmV0dXJuIHBhcnNlZDtcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIG51bGw7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGV4dHJhY3RGcm9udG1hdHRlckRhdGVzKHZhbHVlOiB1bmtub3duKTogRGF0ZVtdIHtcclxuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcclxuICAgIHJldHVybiB2YWx1ZVxyXG4gICAgICAubWFwKChpdGVtKSA9PiBwYXJzZUZyb250bWF0dGVyRGF0ZShpdGVtKSlcclxuICAgICAgLmZpbHRlcigoaXRlbSk6IGl0ZW0gaXMgRGF0ZSA9PiBpdGVtICE9PSBudWxsKTtcclxuICB9XHJcbiAgY29uc3Qgc2luZ2xlID0gcGFyc2VGcm9udG1hdHRlckRhdGUodmFsdWUpO1xyXG4gIHJldHVybiBzaW5nbGUgPyBbc2luZ2xlXSA6IFtdO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzdGFydE9mTW9udGgoZGF0ZTogRGF0ZSk6IERhdGUge1xyXG4gIHJldHVybiBuZXcgRGF0ZShkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgMSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGVuZE9mTW9udGgoZGF0ZTogRGF0ZSk6IERhdGUge1xyXG4gIHJldHVybiBuZXcgRGF0ZShkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSArIDEsIDApO1xyXG59XHJcblxyXG5mdW5jdGlvbiBhZGREYXlzKGRhdGU6IERhdGUsIGRheXM6IG51bWJlcik6IERhdGUge1xyXG4gIHJldHVybiBuZXcgRGF0ZShkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCkgKyBkYXlzKTtcclxufVxyXG5cclxuZnVuY3Rpb24gaXNTYW1lRGF5KGE6IERhdGUsIGI6IERhdGUpOiBib29sZWFuIHtcclxuICByZXR1cm4gYS5nZXRGdWxsWWVhcigpID09PSBiLmdldEZ1bGxZZWFyKCkgJiZcclxuICAgIGEuZ2V0TW9udGgoKSA9PT0gYi5nZXRNb250aCgpICYmXHJcbiAgICBhLmdldERhdGUoKSA9PT0gYi5nZXREYXRlKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZvcm1hdFRpbWUoZGF0ZTogRGF0ZSwgZm9ybWF0OiBDYWxlbmRhclNldHRpbmdzW1widGltZUZvcm1hdFwiXSk6IHN0cmluZyB7XHJcbiAgaWYgKGZvcm1hdCA9PT0gXCIyNGhcIikge1xyXG4gICAgcmV0dXJuIGRhdGUudG9Mb2NhbGVUaW1lU3RyaW5nKFtdLCB7IGhvdXI6IFwiMi1kaWdpdFwiLCBtaW51dGU6IFwiMi1kaWdpdFwiLCBob3VyMTI6IGZhbHNlIH0pO1xyXG4gIH1cclxuICByZXR1cm4gZGF0ZS50b0xvY2FsZVRpbWVTdHJpbmcoW10sIHsgaG91cjogXCJudW1lcmljXCIsIG1pbnV0ZTogXCIyLWRpZ2l0XCIsIGhvdXIxMjogdHJ1ZSB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gY2xhbXBUb0RheVN0YXJ0KGRhdGU6IERhdGUpOiBEYXRlIHtcclxuICByZXR1cm4gbmV3IERhdGUoZGF0ZS5nZXRGdWxsWWVhcigpLCBkYXRlLmdldE1vbnRoKCksIGRhdGUuZ2V0RGF0ZSgpKTtcclxufVxyXG5cclxuZnVuY3Rpb24gY2xhbXBUb0RheUVuZChkYXRlOiBEYXRlKTogRGF0ZSB7XHJcbiAgcmV0dXJuIG5ldyBEYXRlKGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpLCBkYXRlLmdldERhdGUoKSwgMjMsIDU5LCA1OSwgOTk5KTtcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlU291cmNlSWQoKTogc3RyaW5nIHtcclxuICBpZiAodHlwZW9mIGNyeXB0byAhPT0gXCJ1bmRlZmluZWRcIiAmJiBcInJhbmRvbVVVSURcIiBpbiBjcnlwdG8pIHtcclxuICAgIHJldHVybiBjcnlwdG8ucmFuZG9tVVVJRCgpO1xyXG4gIH1cclxuICByZXR1cm4gYHNyYy0ke0RhdGUubm93KCl9LSR7TWF0aC5yYW5kb20oKS50b1N0cmluZygxNikuc2xpY2UoMil9YDtcclxufVxyXG5cclxuY2xhc3MgQ2FsZW5kYXJWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xyXG4gIHByaXZhdGUgcGx1Z2luOiBDYWxlbmRhclBsdWdpbjtcclxuICBwcml2YXRlIHNlbGVjdGVkRGF0ZSA9IG5ldyBEYXRlKCk7XHJcbiAgcHJpdmF0ZSB2aXNpYmxlTW9udGggPSBuZXcgRGF0ZSgpO1xyXG4gIHByaXZhdGUgZXZlbnRzOiBDYWxlbmRhckV2ZW50W10gPSBbXTtcclxuICBwcml2YXRlIGhlYWRlclRpdGxlPzogSFRNTEVsZW1lbnQ7XHJcbiAgcHJpdmF0ZSBsZWdlbmRFbD86IEhUTUxFbGVtZW50O1xyXG4gIHByaXZhdGUgZ3JpZEVsPzogSFRNTEVsZW1lbnQ7XHJcbiAgcHJpdmF0ZSBuYXZFbD86IEhUTUxFbGVtZW50O1xyXG4gIHByaXZhdGUgZGV0YWlsc0VsPzogSFRNTEVsZW1lbnQ7XHJcbiAgcHJpdmF0ZSBub3Rlc0J5RGF0ZSA9IG5ldyBNYXA8c3RyaW5nLCBMaW5rZWROb3RlW10+KCk7XHJcbiAgcHJpdmF0ZSBub3RlRXhjZXJwdENhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcclxuICBwcml2YXRlIG1heE5vdGVzRm9yR3JpZCA9IDE7XHJcbiAgcHJpdmF0ZSBob3ZlclByZXZpZXdFbD86IEhUTUxFbGVtZW50O1xyXG5cclxuICBjb25zdHJ1Y3RvcihsZWFmOiBXb3Jrc3BhY2VMZWFmLCBwbHVnaW46IENhbGVuZGFyUGx1Z2luKSB7XHJcbiAgICBzdXBlcihsZWFmKTtcclxuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xyXG4gIH1cclxuXHJcbiAgZ2V0Vmlld1R5cGUoKSB7XHJcbiAgICByZXR1cm4gVklFV19UWVBFX0NBTEVOREFSO1xyXG4gIH1cclxuXHJcbiAgZ2V0RGlzcGxheVRleHQoKSB7XHJcbiAgICByZXR1cm4gXCJDYWxlbmRhclwiO1xyXG4gIH1cclxuXHJcbiAgZ2V0SWNvbigpIHtcclxuICAgIHJldHVybiBcImNhbGVuZGFyXCI7XHJcbiAgfVxyXG5cclxuICBhc3luYyBvbk9wZW4oKSB7XHJcbiAgICB0aGlzLmNvbnRhaW5lckVsLmVtcHR5KCk7XHJcbiAgICB0aGlzLmNvbnRhaW5lckVsLmFkZENsYXNzKFwib2JzaWRpYW4tY2FsZW5kYXJcIik7XHJcbiAgICB0aGlzLmJ1aWxkTGF5b3V0KCk7XHJcbiAgICB0aGlzLmVuc3VyZUhvdmVyUHJldmlldygpO1xyXG4gICAgdGhpcy5yZW5kZXIoKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIG9uQ2xvc2UoKSB7XHJcbiAgICB0aGlzLmhvdmVyUHJldmlld0VsPy5yZW1vdmUoKTtcclxuICAgIHRoaXMuaG92ZXJQcmV2aWV3RWwgPSB1bmRlZmluZWQ7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICBzZXRFdmVudHMoZXZlbnRzOiBDYWxlbmRhckV2ZW50W10pIHtcclxuICAgIHRoaXMuZXZlbnRzID0gZXZlbnRzO1xyXG4gICAgdGhpcy5yZW5kZXIoKTtcclxuICB9XHJcblxyXG4gIGp1bXBUb1RvZGF5KCkge1xyXG4gICAgY29uc3QgdG9kYXkgPSBuZXcgRGF0ZSgpO1xyXG4gICAgdGhpcy5zZWxlY3RlZERhdGUgPSB0b2RheTtcclxuICAgIHRoaXMudmlzaWJsZU1vbnRoID0gbmV3IERhdGUodG9kYXkuZ2V0RnVsbFllYXIoKSwgdG9kYXkuZ2V0TW9udGgoKSwgMSk7XHJcbiAgICB0aGlzLnJlbmRlcigpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBidWlsZExheW91dCgpIHtcclxuICAgIGNvbnN0IGhlYWRlciA9IHRoaXMuY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19oZWFkZXJcIiB9KTtcclxuXHJcbiAgICB0aGlzLmhlYWRlclRpdGxlID0gaGVhZGVyLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fdGl0bGVcIiB9KTtcclxuXHJcbiAgICB0aGlzLmxlZ2VuZEVsID0gaGVhZGVyLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fbGVnZW5kXCIgfSk7XHJcblxyXG4gICAgY29uc3QgYm9keSA9IHRoaXMuY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ib2R5XCIgfSk7XHJcbiAgICB0aGlzLmdyaWRFbCA9IGJvZHkuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ncmlkXCIgfSk7XHJcblxyXG4gICAgdGhpcy5uYXZFbCA9IGJvZHkuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19uYXZcIiB9KTtcclxuXHJcbiAgICB0aGlzLmRldGFpbHNFbCA9IGJvZHkuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzXCIgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbmRlck5hdigpIHtcclxuICAgIGlmICghdGhpcy5uYXZFbCkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMubmF2RWwuZW1wdHkoKTtcclxuICAgIGNvbnN0IGxhbmcgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZTtcclxuXHJcbiAgICAvLyBcdTVERTZcdTRGQTdcdUZGMUFcdTRFMEFcdTRFMDBcdTk4NzVcclxuICAgIGNvbnN0IGxlZnRHcm91cCA9IHRoaXMubmF2RWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19uYXYtbGVmdFwiIH0pO1xyXG4gICAgY29uc3QgcHJldkJ0biA9IGxlZnRHcm91cC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHUyMTkwXCIgfSk7XHJcblxyXG4gICAgLy8gXHU0RTJEXHU5NUY0XHVGRjFBXHU0RUNBXHU1OTI5XHU1NDhDXHU1MjM3XHU2NUIwXHJcbiAgICBjb25zdCBjZW50ZXJHcm91cCA9IHRoaXMubmF2RWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19uYXYtY2VudGVyXCIgfSk7XHJcbiAgICBjb25zdCB0b2RheUJ0biA9IGNlbnRlckdyb3VwLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogdHJhbnNsYXRlKFwidG9kYXlcIiwgbGFuZykgfSk7XHJcbiAgICBjb25zdCByZWZyZXNoQnRuID0gY2VudGVyR3JvdXAuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiB0cmFuc2xhdGUoXCJyZWZyZXNoXCIsIGxhbmcpIH0pO1xyXG5cclxuICAgIC8vIFx1NTNGM1x1NEZBN1x1RkYxQVx1NEUwQlx1NEUwMFx1OTg3NVxyXG4gICAgY29uc3QgcmlnaHRHcm91cCA9IHRoaXMubmF2RWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19uYXYtcmlnaHRcIiB9KTtcclxuICAgIGNvbnN0IG5leHRCdG4gPSByaWdodEdyb3VwLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdTIxOTJcIiB9KTtcclxuXHJcbiAgICBwcmV2QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgIHRoaXMudmlzaWJsZU1vbnRoID0gbmV3IERhdGUodGhpcy52aXNpYmxlTW9udGguZ2V0RnVsbFllYXIoKSwgdGhpcy52aXNpYmxlTW9udGguZ2V0TW9udGgoKSAtIDEsIDEpO1xyXG4gICAgICB0aGlzLnJlbmRlcigpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV4dEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICB0aGlzLnZpc2libGVNb250aCA9IG5ldyBEYXRlKHRoaXMudmlzaWJsZU1vbnRoLmdldEZ1bGxZZWFyKCksIHRoaXMudmlzaWJsZU1vbnRoLmdldE1vbnRoKCkgKyAxLCAxKTtcclxuICAgICAgdGhpcy5yZW5kZXIoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRvZGF5QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgIHRoaXMuanVtcFRvVG9kYXkoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJlZnJlc2hCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgdGhpcy5wbHVnaW4ucmVmcmVzaEV2ZW50cyh0cnVlKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZW5kZXIoKSB7XHJcbiAgICBpZiAoIXRoaXMuZ3JpZEVsIHx8ICF0aGlzLmRldGFpbHNFbCB8fCAhdGhpcy5oZWFkZXJUaXRsZSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5ncmlkRWwuZW1wdHkoKTtcclxuICAgIHRoaXMuZGV0YWlsc0VsLmVtcHR5KCk7XHJcblxyXG4gICAgdGhpcy51cGRhdGVMZWdlbmQoKTtcclxuICAgIHRoaXMucmVuZGVyTmF2KCk7XHJcblxyXG4gICAgY29uc3QgbGFuZyA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmxhbmd1YWdlO1xyXG5cclxuICAgIGNvbnN0IG1vbnRoU3RhcnQgPSBzdGFydE9mTW9udGgodGhpcy52aXNpYmxlTW9udGgpO1xyXG4gICAgY29uc3QgbW9udGhFbmQgPSBlbmRPZk1vbnRoKHRoaXMudmlzaWJsZU1vbnRoKTtcclxuICAgIGNvbnN0IHN0YXJ0V2Vla2RheSA9IHRoaXMucGx1Z2luLnNldHRpbmdzLndlZWtTdGFydCA9PT0gXCJtb25kYXlcIiA/IDEgOiAwO1xyXG4gICAgY29uc3Qgb2Zmc2V0ID0gKG1vbnRoU3RhcnQuZ2V0RGF5KCkgLSBzdGFydFdlZWtkYXkgKyA3KSAlIDc7XHJcbiAgICBjb25zdCBncmlkU3RhcnQgPSBhZGREYXlzKG1vbnRoU3RhcnQsIC1vZmZzZXQpO1xyXG4gICAgLy8gXHU1NkZBXHU1QjlBXHU2NjNFXHU3OTNBNlx1ODg0Q1x1RkYwODQyXHU1OTI5XHVGRjA5XHJcbiAgICBjb25zdCBncmlkRW5kID0gYWRkRGF5cyhncmlkU3RhcnQsIDQxKTtcclxuXHJcbiAgICB0aGlzLm5vdGVzQnlEYXRlID0gdGhpcy5idWlsZE5vdGVzSW5kZXgoZ3JpZFN0YXJ0LCBncmlkRW5kKTtcclxuICAgIHRoaXMubWF4Tm90ZXNGb3JHcmlkID0gdGhpcy5nZXRNYXhOb3Rlc0NvdW50KCk7XHJcblxyXG4gICAgdGhpcy5oZWFkZXJUaXRsZS5zZXRUZXh0KFxyXG4gICAgICBtb250aFN0YXJ0LnRvTG9jYWxlRGF0ZVN0cmluZyhsYW5nID09PSBcInpoXCIgPyBcInpoLUNOXCIgOiBcImVuLVVTXCIsIHsgeWVhcjogXCJudW1lcmljXCIsIG1vbnRoOiBcImxvbmdcIiB9KVxyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCB3ZWVrZGF5Um93ID0gdGhpcy5ncmlkRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX193ZWVrZGF5c1wiIH0pO1xyXG4gICAgLy8gXHU0RjdGXHU3NTI4XHU3RkZCXHU4QkQxXHU3Njg0XHU2NjFGXHU2NzFGXHU1NDBEXHU3OUYwXHJcbiAgICBjb25zdCB3ZWVrZGF5S2V5cyA9IHRoaXMucGx1Z2luLnNldHRpbmdzLndlZWtTdGFydCA9PT0gXCJtb25kYXlcIlxyXG4gICAgICA/IFtcIm1vblwiLCBcInR1ZVwiLCBcIndlZFwiLCBcInRodVwiLCBcImZyaVwiLCBcInNhdFwiLCBcInN1blwiXVxyXG4gICAgICA6IFtcInN1blwiLCBcIm1vblwiLCBcInR1ZVwiLCBcIndlZFwiLCBcInRodVwiLCBcImZyaVwiLCBcInNhdFwiXTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IGtleSBvZiB3ZWVrZGF5S2V5cykge1xyXG4gICAgICB3ZWVrZGF5Um93LmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fd2Vla2RheVwiLCB0ZXh0OiB0cmFuc2xhdGUoa2V5LCBsYW5nKSB9KTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBkYXlzR3JpZCA9IHRoaXMuZ3JpZEVsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZGF5c1wiIH0pO1xyXG4gICAgbGV0IGN1cnNvciA9IG5ldyBEYXRlKGdyaWRTdGFydCk7XHJcbiAgICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCk7XHJcblxyXG4gICAgd2hpbGUgKGN1cnNvciA8PSBncmlkRW5kKSB7XHJcbiAgICAgIGNvbnN0IGNlbGxEYXRlID0gbmV3IERhdGUoY3Vyc29yKTtcclxuICAgICAgY29uc3QgY2VsbCA9IGRheXNHcmlkLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19kYXlcIiB9KTtcclxuICAgICAgY2VsbC5zZXRBdHRyKFwidHlwZVwiLCBcImJ1dHRvblwiKTtcclxuXHJcbiAgICAgIGlmIChjZWxsRGF0ZS5nZXRNb250aCgpICE9PSB0aGlzLnZpc2libGVNb250aC5nZXRNb250aCgpKSB7XHJcbiAgICAgICAgY2VsbC5hZGRDbGFzcyhcImlzLW91dHNpZGVcIik7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGlzU2FtZURheShjZWxsRGF0ZSwgdG9kYXkpKSB7XHJcbiAgICAgICAgY2VsbC5hZGRDbGFzcyhcImlzLXRvZGF5XCIpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChpc1NhbWVEYXkoY2VsbERhdGUsIHRoaXMuc2VsZWN0ZWREYXRlKSkge1xyXG4gICAgICAgIGNlbGwuYWRkQ2xhc3MoXCJpcy1zZWxlY3RlZFwiKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgbnVtYmVyRWwgPSBjZWxsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZGF5LW51bWJlclwiIH0pO1xyXG4gICAgICBudW1iZXJFbC5zZXRUZXh0KFN0cmluZyhjZWxsRGF0ZS5nZXREYXRlKCkpKTtcclxuXHJcbiAgICAgIGNvbnN0IHN1YnRpdGxlQ29udGFpbmVyID0gY2VsbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2RheS1zdWJ0aXRsZXNcIiB9KTtcclxuICAgICAgY29uc3Qgbm90ZXNGb3JEYXkgPSB0aGlzLmdldE5vdGVzRm9yRGF5KGNlbGxEYXRlKTtcclxuICAgICAgY29uc3QgZGF5RXZlbnRzID0gdGhpcy5nZXRFdmVudHNGb3JEYXkoY2VsbERhdGUpO1xyXG5cclxuICAgICAgLy8gXHU2NjNFXHU3OTNBXHU2NUU1XHU3QTBCXHVGRjA4XHU0RjdGXHU3NTI4XHU2RTkwXHU5ODlDXHU4MjcyXHVGRjA5XHJcbiAgICAgIGlmIChkYXlFdmVudHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IHRoaXMucGx1Z2luLnNldHRpbmdzLnNvdXJjZXMuZmluZChzID0+IHMuaWQgPT09IGRheUV2ZW50c1swXS5zb3VyY2VJZCk7XHJcbiAgICAgICAgY29uc3QgY29sb3IgPSBzb3VyY2U/LmNvbG9yIHx8IGdldERlZmF1bHRTb3VyY2VDb2xvcigwKTtcclxuICAgICAgICBudW1iZXJFbC5zdHlsZS5jb2xvciA9IGNvbG9yO1xyXG5cclxuICAgICAgICBjb25zdCBldmVudExpbmUgPSBzdWJ0aXRsZUNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2RheS1zdWJ0aXRsZSBvYnNpZGlhbi1jYWxlbmRhcl9fZGF5LWV2ZW50XCIgfSk7XHJcbiAgICAgICAgZXZlbnRMaW5lLnN0eWxlLmNvbG9yID0gY29sb3I7XHJcbiAgICAgICAgZXZlbnRMaW5lLnNldFRleHQoZGF5RXZlbnRzWzBdLnN1bW1hcnkpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBcdTY2M0VcdTc5M0FcdTdCMTRcdThCQjBcdUZGMDhcdTRGRERcdTYzMDFcdTlFRDhcdThCQTRcdTk4OUNcdTgyNzJcdUZGMDlcclxuICAgICAgaWYgKG5vdGVzRm9yRGF5Lmxlbmd0aCA+IDApIHtcclxuICAgICAgICBjb25zdCBub3RlTGluZSA9IHN1YnRpdGxlQ29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZGF5LXN1YnRpdGxlIG9ic2lkaWFuLWNhbGVuZGFyX19kYXktbm90ZVwiIH0pO1xyXG4gICAgICAgIG5vdGVMaW5lLnNldFRleHQobm90ZXNGb3JEYXlbMF0udGl0bGUpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBpbmRpY2F0b3IgPSBjZWxsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZGF5LWluZGljYXRvclwiIH0pO1xyXG4gICAgICBpZiAobm90ZXNGb3JEYXkubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IHJhdGlvID0gTWF0aC5taW4obm90ZXNGb3JEYXkubGVuZ3RoIC8gdGhpcy5tYXhOb3Rlc0ZvckdyaWQsIDEpO1xyXG4gICAgICAgIGNvbnN0IHdpZHRoID0gTWF0aC5tYXgoMC4yNSwgcmF0aW8pICogMTAwO1xyXG4gICAgICAgIGNvbnN0IGJhciA9IGluZGljYXRvci5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2RheS1iYXJcIiB9KTtcclxuICAgICAgICBiYXIuc3R5bGUud2lkdGggPSBgJHt3aWR0aH0lYDtcclxuICAgICAgfVxyXG5cclxuICAgICAgY2VsbC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VlbnRlclwiLCAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5zaG93SG92ZXJQcmV2aWV3KGNlbGwsIG5vdGVzRm9yRGF5KTtcclxuICAgICAgfSk7XHJcbiAgICAgIGNlbGwuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbGVhdmVcIiwgKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuaGlkZUhvdmVyUHJldmlldygpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNlbGwuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgICB0aGlzLnNlbGVjdGVkRGF0ZSA9IGNlbGxEYXRlO1xyXG4gICAgICAgIGlmIChjZWxsRGF0ZS5nZXRNb250aCgpICE9PSB0aGlzLnZpc2libGVNb250aC5nZXRNb250aCgpKSB7XHJcbiAgICAgICAgICB0aGlzLnZpc2libGVNb250aCA9IG5ldyBEYXRlKGNlbGxEYXRlLmdldEZ1bGxZZWFyKCksIGNlbGxEYXRlLmdldE1vbnRoKCksIDEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnJlbmRlcigpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGN1cnNvciA9IGFkZERheXMoY3Vyc29yLCAxKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnJlbmRlckRldGFpbHMoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdXBkYXRlTGVnZW5kKCkge1xyXG4gICAgaWYgKCF0aGlzLmxlZ2VuZEVsKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmxlZ2VuZEVsLmVtcHR5KCk7XHJcblxyXG4gICAgY29uc3QgZW5hYmxlZFNvdXJjZXMgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zb3VyY2VzLmZpbHRlcihzID0+IHMuZW5hYmxlZCAmJiBzLm5hbWUpO1xyXG4gICAgaWYgKGVuYWJsZWRTb3VyY2VzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgZm9yIChjb25zdCBzb3VyY2Ugb2YgZW5hYmxlZFNvdXJjZXMpIHtcclxuICAgICAgY29uc3QgaXRlbSA9IHRoaXMubGVnZW5kRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19sZWdlbmQtaXRlbVwiIH0pO1xyXG4gICAgICBjb25zdCBkb3QgPSBpdGVtLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fbGVnZW5kLWRvdFwiIH0pO1xyXG4gICAgICBkb3Quc3R5bGUuYmFja2dyb3VuZENvbG9yID0gc291cmNlLmNvbG9yO1xyXG4gICAgICBpdGVtLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fbGVnZW5kLWxhYmVsXCIsIHRleHQ6IHNvdXJjZS5uYW1lIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZW5kZXJEZXRhaWxzKCkge1xyXG4gICAgaWYgKCF0aGlzLmRldGFpbHNFbCkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLmRldGFpbHNFbC5lbXB0eSgpO1xyXG5cclxuICAgIGNvbnN0IGxhbmcgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZTtcclxuXHJcbiAgICBjb25zdCB0aXRsZSA9IHRoaXMuZGV0YWlsc0VsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlscy10aXRsZVwiIH0pO1xyXG4gICAgdGl0bGUuc2V0VGV4dChcclxuICAgICAgdGhpcy5zZWxlY3RlZERhdGUudG9Mb2NhbGVEYXRlU3RyaW5nKGxhbmcgPT09IFwiemhcIiA/IFwiemgtQ05cIiA6IFwiZW4tVVNcIiwgeyBtb250aDogXCJsb25nXCIsIGRheTogXCJudW1lcmljXCIsIHllYXI6IFwibnVtZXJpY1wiIH0pXHJcbiAgICApO1xyXG5cclxuICAgIGNvbnN0IG5vdGVzID0gdGhpcy5nZXROb3Rlc0ZvckRheSh0aGlzLnNlbGVjdGVkRGF0ZSk7XHJcbiAgICBjb25zdCBldmVudHMgPSB0aGlzLmdldEV2ZW50c0ZvckRheSh0aGlzLnNlbGVjdGVkRGF0ZSk7XHJcblxyXG4gICAgaWYgKGV2ZW50cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGNvbnN0IGV2ZW50c1NlY3Rpb24gPSB0aGlzLmRldGFpbHNFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX3NlY3Rpb25cIiB9KTtcclxuICAgICAgZXZlbnRzU2VjdGlvbi5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX3NlY3Rpb24tdGl0bGVcIiwgdGV4dDogdHJhbnNsYXRlKFwiZXZlbnRzXCIsIGxhbmcpIH0pO1xyXG4gICAgICBjb25zdCBldmVudHNMaXN0ID0gZXZlbnRzU2VjdGlvbi5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2V2ZW50LWxpc3RcIiB9KTtcclxuICAgICAgZm9yIChjb25zdCBldmVudCBvZiBldmVudHMpIHtcclxuICAgICAgICBjb25zdCByb3cgPSBldmVudHNMaXN0LmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZXZlbnQtcm93XCIgfSk7XHJcblxyXG4gICAgICAgIC8vIEZpbmQgc291cmNlIGNvbG9yXHJcbiAgICAgICAgY29uc3Qgc291cmNlID0gdGhpcy5wbHVnaW4uc2V0dGluZ3Muc291cmNlcy5maW5kKHMgPT4gcy5pZCA9PT0gZXZlbnQuc291cmNlSWQpO1xyXG4gICAgICAgIGNvbnN0IGNvbG9yID0gc291cmNlPy5jb2xvciB8fCBnZXREZWZhdWx0U291cmNlQ29sb3IoMCk7XHJcbiAgICAgICAgcm93LnN0eWxlLmJvcmRlckxlZnQgPSBgM3B4IHNvbGlkICR7Y29sb3J9YDtcclxuXHJcbiAgICAgICAgcm93LmNyZWF0ZURpdih7XHJcbiAgICAgICAgICBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2V2ZW50LXRpbWVcIixcclxuICAgICAgICAgIHRleHQ6IGV2ZW50LmFsbERheSA/IHRyYW5zbGF0ZShcImFsbERheVwiLCBsYW5nKSA6IGZvcm1hdFRpbWUoZXZlbnQuc3RhcnQsIHRoaXMucGx1Z2luLnNldHRpbmdzLnRpbWVGb3JtYXQpXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcm93LmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZXZlbnQtc3VtbWFyeVwiLCB0ZXh0OiBldmVudC5zdW1tYXJ5IH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG5vdGVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgY29uc3Qgbm90ZXNTZWN0aW9uID0gdGhpcy5kZXRhaWxzRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19zZWN0aW9uXCIgfSk7XHJcbiAgICAgIG5vdGVzU2VjdGlvbi5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX3NlY3Rpb24tdGl0bGVcIiwgdGV4dDogdHJhbnNsYXRlKFwibm90ZXNcIiwgbGFuZykgfSk7XHJcbiAgICAgIGNvbnN0IG5vdGVzTGlzdCA9IG5vdGVzU2VjdGlvbi5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX25vdGVzLWxpc3RcIiB9KTtcclxuICAgICAgZm9yIChjb25zdCBub3RlIG9mIG5vdGVzKSB7XHJcbiAgICAgICAgY29uc3Qgcm93ID0gbm90ZXNMaXN0LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXJvd1wiIH0pO1xyXG4gICAgICAgIHJvdy5zZXRBdHRyKFwidHlwZVwiLCBcImJ1dHRvblwiKTtcclxuICAgICAgICByb3cuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXRpdGxlXCIsIHRleHQ6IG5vdGUudGl0bGUgfSk7XHJcbiAgICAgICAgY29uc3QgZXhjZXJwdEVsID0gcm93LmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1leGNlcnB0XCIsIHRleHQ6IG5vdGUuZXhjZXJwdCB9KTtcclxuICAgICAgICB0aGlzLmVuc3VyZUV4Y2VycHQobm90ZS5maWxlLCBleGNlcnB0RWwpO1xyXG4gICAgICAgIHJvdy5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5vcGVuTm90ZShub3RlLmZpbGUpKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChub3Rlcy5sZW5ndGggPT09IDAgJiYgZXZlbnRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICB0aGlzLmRldGFpbHNFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2RldGFpbHMtZW1wdHlcIiwgdGV4dDogdHJhbnNsYXRlKFwibm9Ob3Rlc09yRXZlbnRzXCIsIGxhbmcpIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hbGxvd0NyZWF0ZU5vdGUpIHtcclxuICAgICAgY29uc3QgYWN0aW9uID0gdGhpcy5kZXRhaWxzRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzLWFjdGlvblwiIH0pO1xyXG4gICAgICBjb25zdCBidXR0b24gPSBhY3Rpb24uY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiB0cmFuc2xhdGUoXCJjcmVhdGVOb3RlXCIsIGxhbmcpIH0pO1xyXG4gICAgICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jICgpID0+IHtcclxuICAgICAgICBjb25zdCBmaWxlID0gYXdhaXQgdGhpcy5wbHVnaW4uY3JlYXRlTm90ZUZvckRhdGUodGhpcy5zZWxlY3RlZERhdGUpO1xyXG4gICAgICAgIGlmIChmaWxlKSB7XHJcbiAgICAgICAgICB0aGlzLm9wZW5Ob3RlKGZpbGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldEV2ZW50c0ZvckRheShkYXk6IERhdGUpIHtcclxuICAgIGNvbnN0IHN0YXJ0ID0gY2xhbXBUb0RheVN0YXJ0KGRheSk7XHJcbiAgICBjb25zdCBlbmQgPSBjbGFtcFRvRGF5RW5kKGRheSk7XHJcbiAgICByZXR1cm4gdGhpcy5ldmVudHNcclxuICAgICAgLmZpbHRlcigoZXZlbnQpID0+IGV2ZW50LnN0YXJ0IDw9IGVuZCAmJiBldmVudC5lbmQgPj0gc3RhcnQpXHJcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBhLnN0YXJ0LmdldFRpbWUoKSAtIGIuc3RhcnQuZ2V0VGltZSgpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGROb3Rlc0luZGV4KHN0YXJ0OiBEYXRlLCBlbmQ6IERhdGUpIHtcclxuICAgIGNvbnN0IGluZGV4ID0gbmV3IE1hcDxzdHJpbmcsIExpbmtlZE5vdGVbXT4oKTtcclxuICAgIGNvbnN0IHN0YXJ0RGF5ID0gY2xhbXBUb0RheVN0YXJ0KHN0YXJ0KTtcclxuICAgIGNvbnN0IGVuZERheSA9IGNsYW1wVG9EYXlFbmQoZW5kKTtcclxuICAgIGNvbnN0IGZpZWxkcyA9IHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVEYXRlRmllbGRzXHJcbiAgICAgIC5tYXAoKGZpZWxkKSA9PiBmaWVsZC50cmltKCkpXHJcbiAgICAgIC5maWx0ZXIoKGZpZWxkKSA9PiBmaWVsZC5sZW5ndGggPiAwKTtcclxuXHJcbiAgICBpZiAoZmllbGRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICByZXR1cm4gaW5kZXg7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZmlsZXMgPSB0aGlzLnBsdWdpbi5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xyXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XHJcbiAgICAgIGNvbnN0IGNhY2hlID0gdGhpcy5wbHVnaW4uYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xyXG4gICAgICBpZiAoIWNhY2hlPy5mcm9udG1hdHRlcikge1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBmb3IgKGNvbnN0IGZpZWxkIG9mIGZpZWxkcykge1xyXG4gICAgICAgIGNvbnN0IHJhd1ZhbHVlID0gY2FjaGUuZnJvbnRtYXR0ZXJbZmllbGRdO1xyXG4gICAgICAgIGlmICghcmF3VmFsdWUpIHtcclxuICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBkYXRlcyA9IGV4dHJhY3RGcm9udG1hdHRlckRhdGVzKHJhd1ZhbHVlKTtcclxuICAgICAgICBmb3IgKGNvbnN0IGRhdGUgb2YgZGF0ZXMpIHtcclxuICAgICAgICAgIGlmIChkYXRlIDwgc3RhcnREYXkgfHwgZGF0ZSA+IGVuZERheSkge1xyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGNvbnN0IGtleSA9IGZvcm1hdERhdGVLZXkoZGF0ZSk7XHJcbiAgICAgICAgICBjb25zdCBsaXN0ID0gaW5kZXguZ2V0KGtleSkgPz8gW107XHJcbiAgICAgICAgICBpZiAoIWxpc3Quc29tZSgobm90ZSkgPT4gbm90ZS5maWxlLnBhdGggPT09IGZpbGUucGF0aCkpIHtcclxuICAgICAgICAgICAgY29uc3QgdGl0bGUgPSBmaWxlLmJhc2VuYW1lO1xyXG4gICAgICAgICAgICBsaXN0LnB1c2goe1xyXG4gICAgICAgICAgICAgIGZpbGUsXHJcbiAgICAgICAgICAgICAgdGl0bGUsXHJcbiAgICAgICAgICAgICAgZXhjZXJwdDogdGhpcy5ub3RlRXhjZXJwdENhY2hlLmdldChmaWxlLnBhdGgpID8/IFwiXCJcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGluZGV4LnNldChrZXksIGxpc3QpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZvciAoY29uc3QgW2tleSwgbGlzdF0gb2YgaW5kZXguZW50cmllcygpKSB7XHJcbiAgICAgIGxpc3Quc29ydCgoYSwgYikgPT4gYS50aXRsZS5sb2NhbGVDb21wYXJlKGIudGl0bGUpKTtcclxuICAgICAgaW5kZXguc2V0KGtleSwgbGlzdCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGluZGV4O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXROb3Rlc0ZvckRheShkYXk6IERhdGUpIHtcclxuICAgIHJldHVybiB0aGlzLm5vdGVzQnlEYXRlLmdldChmb3JtYXREYXRlS2V5KGRheSkpID8/IFtdO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRNYXhOb3Rlc0NvdW50KCkge1xyXG4gICAgbGV0IG1heENvdW50ID0gMTtcclxuICAgIGZvciAoY29uc3QgbGlzdCBvZiB0aGlzLm5vdGVzQnlEYXRlLnZhbHVlcygpKSB7XHJcbiAgICAgIGlmIChsaXN0Lmxlbmd0aCA+IG1heENvdW50KSB7XHJcbiAgICAgICAgbWF4Q291bnQgPSBsaXN0Lmxlbmd0aDtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG1heENvdW50O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBlbnN1cmVIb3ZlclByZXZpZXcoKSB7XHJcbiAgICBpZiAodGhpcy5ob3ZlclByZXZpZXdFbCkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLmhvdmVyUHJldmlld0VsID0gZG9jdW1lbnQuYm9keS5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtcHJldmlld1wiIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzaG93SG92ZXJQcmV2aWV3KGFuY2hvcjogSFRNTEVsZW1lbnQsIG5vdGVzOiBMaW5rZWROb3RlW10pIHtcclxuICAgIGlmICghdGhpcy5ob3ZlclByZXZpZXdFbCB8fCBub3Rlcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuaG92ZXJQcmV2aWV3RWwuZW1wdHkoKTtcclxuICAgIGZvciAoY29uc3Qgbm90ZSBvZiBub3Rlcy5zbGljZSgwLCAzKSkge1xyXG4gICAgICBjb25zdCByb3cgPSB0aGlzLmhvdmVyUHJldmlld0VsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1wcmV2aWV3LXJvd1wiIH0pO1xyXG4gICAgICByb3cuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXByZXZpZXctdGl0bGVcIiwgdGV4dDogbm90ZS50aXRsZSB9KTtcclxuICAgICAgY29uc3QgZXhjZXJwdEVsID0gcm93LmNyZWF0ZURpdih7XHJcbiAgICAgICAgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXByZXZpZXctZXhjZXJwdFwiLFxyXG4gICAgICAgIHRleHQ6IG5vdGUuZXhjZXJwdFxyXG4gICAgICB9KTtcclxuICAgICAgdGhpcy5lbnN1cmVFeGNlcnB0KG5vdGUuZmlsZSwgZXhjZXJwdEVsKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmhvdmVyUHJldmlld0VsLnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XHJcblxyXG4gICAgY29uc3QgcmVjdCA9IGFuY2hvci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgIGNvbnN0IHByZXZpZXdXaWR0aCA9IDIyMDtcclxuICAgIGNvbnN0IHByZXZpZXdIZWlnaHQgPSB0aGlzLmhvdmVyUHJldmlld0VsLm9mZnNldEhlaWdodCB8fCA4MDtcclxuICAgIGNvbnN0IHBhZGRpbmcgPSA4O1xyXG4gICAgY29uc3Qgdmlld3BvcnRXaWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xyXG4gICAgY29uc3Qgdmlld3BvcnRIZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XHJcblxyXG4gICAgbGV0IGxlZnQgPSByZWN0LmxlZnQgKyByZWN0LndpZHRoIC8gMiAtIHByZXZpZXdXaWR0aCAvIDI7XHJcbiAgICBsZWZ0ID0gTWF0aC5tYXgocGFkZGluZywgTWF0aC5taW4obGVmdCwgdmlld3BvcnRXaWR0aCAtIHByZXZpZXdXaWR0aCAtIHBhZGRpbmcpKTtcclxuXHJcbiAgICBsZXQgdG9wID0gcmVjdC5ib3R0b20gKyA2O1xyXG4gICAgaWYgKHRvcCArIHByZXZpZXdIZWlnaHQgPiB2aWV3cG9ydEhlaWdodCAtIHBhZGRpbmcpIHtcclxuICAgICAgdG9wID0gcmVjdC50b3AgLSBwcmV2aWV3SGVpZ2h0IC0gNjtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmhvdmVyUHJldmlld0VsLnN0eWxlLndpZHRoID0gYCR7cHJldmlld1dpZHRofXB4YDtcclxuICAgIHRoaXMuaG92ZXJQcmV2aWV3RWwuc3R5bGUubGVmdCA9IGAke2xlZnR9cHhgO1xyXG4gICAgdGhpcy5ob3ZlclByZXZpZXdFbC5zdHlsZS50b3AgPSBgJHtNYXRoLm1heChwYWRkaW5nLCB0b3ApfXB4YDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGlkZUhvdmVyUHJldmlldygpIHtcclxuICAgIGlmICh0aGlzLmhvdmVyUHJldmlld0VsKSB7XHJcbiAgICAgIHRoaXMuaG92ZXJQcmV2aWV3RWwuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBlbnN1cmVFeGNlcnB0KGZpbGU6IFRGaWxlLCB0YXJnZXRFbDogSFRNTEVsZW1lbnQpIHtcclxuICAgIGlmICh0aGlzLm5vdGVFeGNlcnB0Q2FjaGUuaGFzKGZpbGUucGF0aCkpIHtcclxuICAgICAgdGFyZ2V0RWwuc2V0VGV4dCh0aGlzLm5vdGVFeGNlcnB0Q2FjaGUuZ2V0KGZpbGUucGF0aCkgPz8gXCJcIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHRoaXMucGx1Z2luLmFwcC52YXVsdC5jYWNoZWRSZWFkKGZpbGUpLnRoZW4oKGNvbnRlbnQpID0+IHtcclxuICAgICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KFwiXFxuXCIpO1xyXG4gICAgICBsZXQgc3RhcnRJbmRleCA9IDA7XHJcbiAgICAgIGlmIChsaW5lc1swXT8udHJpbSgpID09PSBcIi0tLVwiKSB7XHJcbiAgICAgICAgY29uc3QgZW5kSW5kZXggPSBsaW5lcy5zbGljZSgxKS5maW5kSW5kZXgoKGxpbmUpID0+IGxpbmUudHJpbSgpID09PSBcIi0tLVwiKTtcclxuICAgICAgICBpZiAoZW5kSW5kZXggPj0gMCkge1xyXG4gICAgICAgICAgc3RhcnRJbmRleCA9IGVuZEluZGV4ICsgMjtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgZmlyc3RMaW5lID0gbGluZXMuc2xpY2Uoc3RhcnRJbmRleCkuZmluZCgobGluZSkgPT4gbGluZS50cmltKCkubGVuZ3RoID4gMCkgPz8gXCJcIjtcclxuICAgICAgY29uc3QgZXhjZXJwdCA9IGZpcnN0TGluZS5yZXBsYWNlKC9eI1xccysvLCBcIlwiKS50cmltKCk7XHJcbiAgICAgIHRoaXMubm90ZUV4Y2VycHRDYWNoZS5zZXQoZmlsZS5wYXRoLCBleGNlcnB0KTtcclxuICAgICAgdGFyZ2V0RWwuc2V0VGV4dChleGNlcnB0KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBvcGVuTm90ZShmaWxlOiBURmlsZSkge1xyXG4gICAgY29uc3QgbGVhZiA9IHRoaXMucGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZihmYWxzZSk7XHJcbiAgICBjb25zdCBjYWNoZSA9IHRoaXMucGx1Z2luLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcclxuICAgIGNvbnN0IGxpbmUgPSBjYWNoZT8uZnJvbnRtYXR0ZXJQb3NpdGlvbj8uZW5kPy5saW5lID8/IDA7XHJcbiAgICBhd2FpdCBsZWFmLm9wZW5GaWxlKGZpbGUsIHsgc3RhdGU6IHsgbGluZSB9LCBhY3RpdmU6IHRydWUgfSk7XHJcbiAgfVxyXG59XHJcblxyXG5jbGFzcyBDYWxlbmRhclNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcclxuICBwcml2YXRlIHBsdWdpbjogQ2FsZW5kYXJQbHVnaW47XHJcbiAgcHJpdmF0ZSBzZWxlY3RlZFRlbXBsYXRlRm9sZGVyID0gXCJcIjtcclxuXHJcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogQ2FsZW5kYXJQbHVnaW4pIHtcclxuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcclxuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xyXG4gIH1cclxuXHJcbiAgZGlzcGxheSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XHJcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xyXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiQ2FsZW5kYXJcIiB9KTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJSZWZyZXNoIGludGVydmFsIChtaW51dGVzKVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkhvdyBvZnRlbiBjYWxlbmRhciBzb3VyY2VzIGFyZSByZWZyZXNoZWQuXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHRcclxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcIjMwXCIpXHJcbiAgICAgICAgICAuc2V0VmFsdWUoU3RyaW5nKHRoaXMucGx1Z2luLnNldHRpbmdzLnJlZnJlc2hJbnRlcnZhbE1pbnV0ZXMpKVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBOdW1iZXIodmFsdWUpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5yZWZyZXNoSW50ZXJ2YWxNaW51dGVzID0gTnVtYmVyLmlzRmluaXRlKHBhcnNlZCkgJiYgcGFyc2VkID4gMFxyXG4gICAgICAgICAgICAgID8gcGFyc2VkXHJcbiAgICAgICAgICAgICAgOiBERUZBVUxUX1NFVFRJTkdTLnJlZnJlc2hJbnRlcnZhbE1pbnV0ZXM7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5yZWZyZXNoRXZlbnRzKHRydWUpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5yZXN0YXJ0QXV0b1JlZnJlc2goKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiTGFuZ3VhZ2VcIilcclxuICAgICAgLnNldERlc2MoXCJEaXNwbGF5IGxhbmd1YWdlIGZvciB0aGUgY2FsZW5kYXIgaW50ZXJmYWNlLlwiKVxyXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PlxyXG4gICAgICAgIGRyb3Bkb3duXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwiZW5cIiwgXCJFbmdsaXNoXCIpXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwiemhcIiwgXCJcdTRFMkRcdTY1ODdcIilcclxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWU6IENhbGVuZGFyU2V0dGluZ3NbXCJsYW5ndWFnZVwiXSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZSA9IHZhbHVlO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVuZGVyVmlld3MoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiV2VlayBzdGFydHMgb25cIilcclxuICAgICAgLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT5cclxuICAgICAgICBkcm9wZG93blxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcInN1bmRheVwiLCBcIlN1bmRheVwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcIm1vbmRheVwiLCBcIk1vbmRheVwiKVxyXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLndlZWtTdGFydClcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWU6IENhbGVuZGFyU2V0dGluZ3NbXCJ3ZWVrU3RhcnRcIl0pID0+IHtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mud2Vla1N0YXJ0ID0gdmFsdWU7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5yZW5kZXJWaWV3cygpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJUaW1lIGZvcm1hdFwiKVxyXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PlxyXG4gICAgICAgIGRyb3Bkb3duXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwiMjRoXCIsIFwiMjQtaG91clwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcIjEyaFwiLCBcIjEyLWhvdXJcIilcclxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy50aW1lRm9ybWF0KVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZTogQ2FsZW5kYXJTZXR0aW5nc1tcInRpbWVGb3JtYXRcIl0pID0+IHtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MudGltZUZvcm1hdCA9IHZhbHVlO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVuZGVyVmlld3MoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiVG9kYXkgaGlnaGxpZ2h0XCIpXHJcbiAgICAgIC5zZXREZXNjKFwiSGlnaGxpZ2h0IGNvbG9yIGZvciB0b2RheS5cIilcclxuICAgICAgLmFkZENvbG9yUGlja2VyKChwaWNrZXIpID0+XHJcbiAgICAgICAgcGlja2VyXHJcbiAgICAgICAgICAuc2V0VmFsdWUocmVzb2x2ZUhpZ2hsaWdodFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnRvZGF5SGlnaGxpZ2h0LCBcIi0taW50ZXJhY3RpdmUtYWNjZW50XCIpKVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy50b2RheUhpZ2hsaWdodCA9IHZhbHVlO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uYXBwbHlIaWdobGlnaHRWYXJpYWJsZXMoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiU2VsZWN0ZWQgZGF0ZSBoaWdobGlnaHRcIilcclxuICAgICAgLnNldERlc2MoXCJIaWdobGlnaHQgY29sb3IgZm9yIHRoZSBzZWxlY3RlZCBkYXRlLlwiKVxyXG4gICAgICAuYWRkQ29sb3JQaWNrZXIoKHBpY2tlcikgPT5cclxuICAgICAgICBwaWNrZXJcclxuICAgICAgICAgIC5zZXRWYWx1ZShyZXNvbHZlSGlnaGxpZ2h0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VsZWN0ZWRIaWdobGlnaHQsIFwiLS10ZXh0LWFjY2VudFwiKSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VsZWN0ZWRIaWdobGlnaHQgPSB2YWx1ZTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmFwcGx5SGlnaGxpZ2h0VmFyaWFibGVzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIk5vdGUgZGF0ZSBmaWVsZHNcIilcclxuICAgICAgLnNldERlc2MoXCJDb21tYS1zZXBhcmF0ZWQgZnJvbnRtYXR0ZXIgZmllbGRzIHVzZWQgdG8gbGluayBub3RlcyB0byBkYXRlcy5cIilcclxuICAgICAgLmFkZFRleHQoKHRleHQpID0+XHJcbiAgICAgICAgdGV4dFxyXG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiZGF0ZSwgc3RhcnQsIGVuZFwiKVxyXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVEYXRlRmllbGRzLmpvaW4oXCIsIFwiKSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZURhdGVGaWVsZHMgPSB2YWx1ZVxyXG4gICAgICAgICAgICAgIC5zcGxpdChcIixcIilcclxuICAgICAgICAgICAgICAubWFwKChmaWVsZCkgPT4gZmllbGQudHJpbSgpKVxyXG4gICAgICAgICAgICAgIC5maWx0ZXIoKGZpZWxkKSA9PiBmaWVsZC5sZW5ndGggPiAwKTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnJlbmRlclZpZXdzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIkFsbG93IGNyZWF0ZSBub3RlXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiU2hvdyBhIHF1aWNrIGFjdGlvbiB0byBjcmVhdGUgYSBub3RlIGZvciB0aGUgc2VsZWN0ZWQgZGF0ZS5cIilcclxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hbGxvd0NyZWF0ZU5vdGUpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuYWxsb3dDcmVhdGVOb3RlID0gdmFsdWU7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgIHRoaXMucGx1Z2luLnJlbmRlclZpZXdzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJOb3RlIGRlbnNpdHkgYmFyIGNvbG9yXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiQ29sb3IgZm9yIHRoZSBub3RlIGRlbnNpdHkgaW5kaWNhdG9yIGJhci5cIilcclxuICAgICAgLmFkZENvbG9yUGlja2VyKChwaWNrZXIpID0+XHJcbiAgICAgICAgcGlja2VyXHJcbiAgICAgICAgICAuc2V0VmFsdWUocmVzb2x2ZUhpZ2hsaWdodFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVCYXJDb2xvciwgXCItLXRleHQtYWNjZW50XCIpKVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5ub3RlQmFyQ29sb3IgPSB2YWx1ZTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmFwcGx5SGlnaGxpZ2h0VmFyaWFibGVzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIGNvbnN0IHRlbXBsYXRlU2V0dGluZyA9IG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIk5vdGUgdGVtcGxhdGVcIilcclxuICAgICAgLnNldERlc2MoXCJDaG9vc2UgYSB2YXVsdCB0ZW1wbGF0ZSBmaWxlLlwiKTtcclxuXHJcbiAgICBjb25zdCB0ZW1wbGF0ZUhpbnQgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX3NldHRpbmctaGludFwiIH0pO1xyXG5cclxuICAgIGNvbnN0IHVwZGF0ZVRlbXBsYXRlSGludCA9ICh3YXJuaW5nID0gXCJcIikgPT4ge1xyXG4gICAgICBpZiAod2FybmluZykge1xyXG4gICAgICAgIHRlbXBsYXRlSGludC5zZXRUZXh0KHdhcm5pbmcpO1xyXG4gICAgICAgIHRlbXBsYXRlSGludC5hZGRDbGFzcyhcImlzLWVycm9yXCIpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCBwYXRoID0gdGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZVRlbXBsYXRlUGF0aC50cmltKCk7XHJcbiAgICAgIGlmICghcGF0aCkge1xyXG4gICAgICAgIHRlbXBsYXRlSGludC5zZXRUZXh0KFwiTm8gdGVtcGxhdGUgc2VsZWN0ZWQuXCIpO1xyXG4gICAgICAgIHRlbXBsYXRlSGludC5yZW1vdmVDbGFzcyhcImlzLWVycm9yXCIpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCBmaWxlID0gdGhpcy5wbHVnaW4uZ2V0VGVtcGxhdGVGaWxlKHBhdGgpO1xyXG4gICAgICBpZiAoZmlsZSkge1xyXG4gICAgICAgIHRlbXBsYXRlSGludC5zZXRUZXh0KGBUZW1wbGF0ZTogJHtmaWxlLnBhdGh9YCk7XHJcbiAgICAgICAgdGVtcGxhdGVIaW50LnJlbW92ZUNsYXNzKFwiaXMtZXJyb3JcIik7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIHRlbXBsYXRlSGludC5zZXRUZXh0KFwiVGVtcGxhdGUgbm90IGZvdW5kIGluIHRoaXMgdmF1bHQuXCIpO1xyXG4gICAgICB0ZW1wbGF0ZUhpbnQuYWRkQ2xhc3MoXCJpcy1lcnJvclwiKTtcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgY3VycmVudFBhdGggPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5ub3RlVGVtcGxhdGVQYXRoO1xyXG4gICAgY29uc3QgY3VycmVudEZvbGRlciA9IGN1cnJlbnRQYXRoID8gY3VycmVudFBhdGguc3BsaXQoXCIvXCIpLnNsaWNlKDAsIC0xKS5qb2luKFwiL1wiKSA6IFwiXCI7XHJcbiAgICBpZiAoIXRoaXMuc2VsZWN0ZWRUZW1wbGF0ZUZvbGRlcikge1xyXG4gICAgICB0aGlzLnNlbGVjdGVkVGVtcGxhdGVGb2xkZXIgPSBjdXJyZW50Rm9sZGVyO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZvbGRlck9wdGlvbnMgPSB0aGlzLnBsdWdpbi5nZXRUZW1wbGF0ZUZvbGRlck9wdGlvbnMoKTtcclxuICAgIHRlbXBsYXRlU2V0dGluZy5hZGREcm9wZG93bigoZHJvcGRvd24pID0+IHtcclxuICAgICAgZHJvcGRvd24uYWRkT3B0aW9uKFwiXCIsIFwiQWxsIGZvbGRlcnNcIik7XHJcbiAgICAgIGZvciAoY29uc3QgZm9sZGVyIG9mIGZvbGRlck9wdGlvbnMpIHtcclxuICAgICAgICBkcm9wZG93bi5hZGRPcHRpb24oZm9sZGVyLCBmb2xkZXIgfHwgXCIocm9vdClcIik7XHJcbiAgICAgIH1cclxuICAgICAgZHJvcGRvd24uc2V0VmFsdWUodGhpcy5zZWxlY3RlZFRlbXBsYXRlRm9sZGVyKTtcclxuICAgICAgZHJvcGRvd24ub25DaGFuZ2UoKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgdGhpcy5zZWxlY3RlZFRlbXBsYXRlRm9sZGVyID0gdmFsdWU7XHJcbiAgICAgICAgdGhpcy5kaXNwbGF5KCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgdGVtcGxhdGVPcHRpb25zID0gdGhpcy5wbHVnaW4uZ2V0VGVtcGxhdGVPcHRpb25zKHRoaXMuc2VsZWN0ZWRUZW1wbGF0ZUZvbGRlcik7XHJcbiAgICB0ZW1wbGF0ZVNldHRpbmcuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XHJcbiAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihcIlwiLCBcIk5vbmVcIik7XHJcbiAgICAgIGZvciAoY29uc3Qgb3B0aW9uIG9mIHRlbXBsYXRlT3B0aW9ucykge1xyXG4gICAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihvcHRpb24ucGF0aCwgb3B0aW9uLmxhYmVsKTtcclxuICAgICAgfVxyXG4gICAgICBkcm9wZG93bi5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5ub3RlVGVtcGxhdGVQYXRoKTtcclxuICAgICAgZHJvcGRvd24ub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZVRlbXBsYXRlUGF0aCA9IHZhbHVlO1xyXG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIHVwZGF0ZVRlbXBsYXRlSGludCgpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHVwZGF0ZVRlbXBsYXRlSGludCgpO1xyXG5cclxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBcIkNhbGVuZGFyIHNvdXJjZXNcIiB9KTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zb3VyY2VzKSB7XHJcbiAgICAgIGNvbnN0IHNvdXJjZVNldHRpbmcgPSBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShzb3VyY2UubmFtZSB8fCBcIlVubmFtZWRcIilcclxuICAgICAgICAuc2V0RGVzYyhcIkVuYWJsZWQgc291cmNlcyBhcmUgZmV0Y2hlZCBhbmQgbWVyZ2VkLlwiKTtcclxuXHJcbiAgICAgIHNvdXJjZVNldHRpbmcuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XHJcbiAgICAgICAgdG9nZ2xlXHJcbiAgICAgICAgICAuc2V0VmFsdWUoc291cmNlLmVuYWJsZWQpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgIHNvdXJjZS5lbmFibGVkID0gdmFsdWU7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5yZWZyZXNoRXZlbnRzKHRydWUpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICAgIHNvdXJjZVNldHRpbmcuYWRkQnV0dG9uKChidXR0b24pID0+XHJcbiAgICAgICAgYnV0dG9uXHJcbiAgICAgICAgICAuc2V0QnV0dG9uVGV4dChcIlJlbW92ZVwiKVxyXG4gICAgICAgICAgLnNldEN0YSgpXHJcbiAgICAgICAgICAub25DbGljayhhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnNvdXJjZXMgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zb3VyY2VzLmZpbHRlcigoaXRlbSkgPT4gaXRlbS5pZCAhPT0gc291cmNlLmlkKTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnJlZnJlc2hFdmVudHModHJ1ZSk7XHJcbiAgICAgICAgICAgIHRoaXMuZGlzcGxheSgpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgIC5zZXROYW1lKFwiTmFtZVwiKVxyXG4gICAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgICAgdGV4dFxyXG4gICAgICAgICAgICAuc2V0VmFsdWUoc291cmNlLm5hbWUpXHJcbiAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICBzb3VyY2UubmFtZSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgIHNvdXJjZVNldHRpbmcuc2V0TmFtZShzb3VyY2UubmFtZS50cmltKCkgfHwgXCJVbm5hbWVkXCIpO1xyXG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcImlDYWwgVVJMXCIpXHJcbiAgICAgICAgLmFkZFRleHQoKHRleHQpID0+XHJcbiAgICAgICAgICB0ZXh0XHJcbiAgICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcImh0dHBzOi8vY2FsZW5kYXIuZ29vZ2xlLmNvbS9jYWxlbmRhci9pY2FsLy4uLlwiKVxyXG4gICAgICAgICAgICAuc2V0VmFsdWUoc291cmNlLnVybClcclxuICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgIHNvdXJjZS51cmwgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVmcmVzaEV2ZW50cyh0cnVlKTtcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUoXCJDb2xvclwiKVxyXG4gICAgICAgIC5zZXREZXNjKFwiRXZlbnQgY29sb3IgZm9yIHRoaXMgc291cmNlLlwiKVxyXG4gICAgICAgIC5hZGRDb2xvclBpY2tlcigocGlja2VyKSA9PlxyXG4gICAgICAgICAgcGlja2VyXHJcbiAgICAgICAgICAgIC5zZXRWYWx1ZShzb3VyY2UuY29sb3IpXHJcbiAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICBzb3VyY2UuY29sb3IgPSB2YWx1ZTtcclxuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5yZW5kZXJWaWV3cygpO1xyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiQWRkIGNhbGVuZGFyIHNvdXJjZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkFkZCBhbm90aGVyIGlDYWwgKElDUykgc291cmNlLlwiKVxyXG4gICAgICAuYWRkQnV0dG9uKChidXR0b24pID0+XHJcbiAgICAgICAgYnV0dG9uXHJcbiAgICAgICAgICAuc2V0QnV0dG9uVGV4dChcIkFkZFwiKVxyXG4gICAgICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBuZXdJbmRleCA9IHRoaXMucGx1Z2luLnNldHRpbmdzLnNvdXJjZXMubGVuZ3RoO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zb3VyY2VzLnB1c2goe1xyXG4gICAgICAgICAgICAgIGlkOiBjcmVhdGVTb3VyY2VJZCgpLFxyXG4gICAgICAgICAgICAgIG5hbWU6IFwiXCIsXHJcbiAgICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICAgICAgICB1cmw6IFwiXCIsXHJcbiAgICAgICAgICAgICAgY29sb3I6IGdldERlZmF1bHRTb3VyY2VDb2xvcihuZXdJbmRleClcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB0aGlzLmRpc3BsYXkoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDYWxlbmRhclBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XHJcbiAgc2V0dGluZ3M6IENhbGVuZGFyU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xyXG4gIHByaXZhdGUgc2VydmljZSA9IG5ldyBJY2FsU2VydmljZShwYXJzZUljYWwpO1xyXG4gIHByaXZhdGUgZXZlbnRzOiBDYWxlbmRhckV2ZW50W10gPSBbXTtcclxuICBwcml2YXRlIHJlZnJlc2hIYW5kbGU/OiBudW1iZXI7XHJcblxyXG4gIGFzeW5jIG9ubG9hZCgpIHtcclxuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XHJcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IENhbGVuZGFyU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xyXG5cclxuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFZJRVdfVFlQRV9DQUxFTkRBUiwgKGxlYWYpID0+IG5ldyBDYWxlbmRhclZpZXcobGVhZiwgdGhpcykpO1xyXG4gICAgdGhpcy5yZWdpc3RlckNvbW1hbmRzKCk7XHJcbiAgICB0aGlzLnJlZ2lzdGVyU3R5bGVzKCk7XHJcblxyXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoYXN5bmMgKCkgPT4ge1xyXG4gICAgICBhd2FpdCB0aGlzLmFjdGl2YXRlVmlldygpO1xyXG4gICAgICAvLyBcdTc4NkVcdTRGRERcdTg5QzZcdTU2RkVcdTZGQzBcdTZEM0JcdTU0MEVcdTdBQ0JcdTUzNzNcdTUyMzdcdTY1QjBcdTY1NzBcdTYzNkVcclxuICAgICAgYXdhaXQgdGhpcy5yZWZyZXNoRXZlbnRzKCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnN0YXJ0QXV0b1JlZnJlc2goKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIG9udW5sb2FkKCkge1xyXG4gICAgaWYgKHRoaXMucmVmcmVzaEhhbmRsZSkge1xyXG4gICAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLnJlZnJlc2hIYW5kbGUpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShWSUVXX1RZUEVfQ0FMRU5EQVIpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgYWN0aXZhdGVWaWV3KCkge1xyXG4gICAgLy8gXHU2OEMwXHU2N0U1XHU2NjJGXHU1NDI2XHU1REYyXHU3RUNGXHU1QjU4XHU1NzI4IGNhbGVuZGFyIFx1ODlDNlx1NTZGRVxyXG4gICAgY29uc3QgZXhpc3RpbmdMZWF2ZXMgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9DQUxFTkRBUik7XHJcbiAgICBpZiAoZXhpc3RpbmdMZWF2ZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAvLyBcdTU5ODJcdTY3OUNcdTVERjJcdTVCNThcdTU3MjhcdUZGMENcdTUzRUFcdTk3MDBcdTZGQzBcdTZEM0JcdTdCMkNcdTRFMDBcdTRFMkFcclxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYoZXhpc3RpbmdMZWF2ZXNbMF0pO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgLy8gXHU1OTgyXHU2NzlDXHU0RTBEXHU1QjU4XHU1NzI4XHVGRjBDXHU1MjFCXHU1RUZBXHU2NUIwXHU3Njg0XHJcbiAgICBjb25zdCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldFJpZ2h0TGVhZihmYWxzZSkgPz8gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoZmFsc2UpO1xyXG4gICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoeyB0eXBlOiBWSUVXX1RZUEVfQ0FMRU5EQVIsIGFjdGl2ZTogdHJ1ZSB9KTtcclxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGxlYWYpO1xyXG4gICAgdGhpcy5hcHBseUhpZ2hsaWdodFZhcmlhYmxlcygpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgcmVmcmVzaEV2ZW50cyhmb3JjZVJlZnJlc2ggPSBmYWxzZSkge1xyXG4gICAgdGhpcy5ldmVudHMgPSBhd2FpdCB0aGlzLnNlcnZpY2UuZ2V0RXZlbnRzKFxyXG4gICAgICB0aGlzLnNldHRpbmdzLnNvdXJjZXMsXHJcbiAgICAgIHRoaXMuc2V0dGluZ3MucmVmcmVzaEludGVydmFsTWludXRlcyxcclxuICAgICAgZm9yY2VSZWZyZXNoXHJcbiAgICApO1xyXG4gICAgdGhpcy5yZW5kZXJWaWV3cygpO1xyXG4gIH1cclxuXHJcbiAgcmVuZGVyVmlld3MoKSB7XHJcbiAgICBjb25zdCBsZWF2ZXMgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9DQUxFTkRBUik7XHJcbiAgICBmb3IgKGNvbnN0IGxlYWYgb2YgbGVhdmVzKSB7XHJcbiAgICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXc7XHJcbiAgICAgIGlmICh2aWV3IGluc3RhbmNlb2YgQ2FsZW5kYXJWaWV3KSB7XHJcbiAgICAgICAgdmlldy5zZXRFdmVudHModGhpcy5ldmVudHMpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXN0YXJ0QXV0b1JlZnJlc2goKSB7XHJcbiAgICBpZiAodGhpcy5yZWZyZXNoSGFuZGxlKSB7XHJcbiAgICAgIHdpbmRvdy5jbGVhckludGVydmFsKHRoaXMucmVmcmVzaEhhbmRsZSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnN0YXJ0QXV0b1JlZnJlc2goKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhcnRBdXRvUmVmcmVzaCgpIHtcclxuICAgIGNvbnN0IGludGVydmFsTXMgPSBNYXRoLm1heCh0aGlzLnNldHRpbmdzLnJlZnJlc2hJbnRlcnZhbE1pbnV0ZXMsIDEpICogNjAgKiAxMDAwO1xyXG4gICAgdGhpcy5yZWZyZXNoSGFuZGxlID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgdGhpcy5yZWZyZXNoRXZlbnRzKCk7XHJcbiAgICB9LCBpbnRlcnZhbE1zKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVnaXN0ZXJDb21tYW5kcygpIHtcclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImNhbGVuZGFyLW9wZW5cIixcclxuICAgICAgbmFtZTogXCJPcGVuIGNhbGVuZGFyXCIsXHJcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB0aGlzLmFjdGl2YXRlVmlldygpXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJjYWxlbmRhci10b2RheVwiLFxyXG4gICAgICBuYW1lOiBcIkp1bXAgdG8gdG9kYXlcIixcclxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBsZWF2ZXMgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9DQUxFTkRBUik7XHJcbiAgICAgICAgZm9yIChjb25zdCBsZWFmIG9mIGxlYXZlcykge1xyXG4gICAgICAgICAgY29uc3QgdmlldyA9IGxlYWYudmlldztcclxuICAgICAgICAgIGlmICh2aWV3IGluc3RhbmNlb2YgQ2FsZW5kYXJWaWV3KSB7XHJcbiAgICAgICAgICAgIHZpZXcuanVtcFRvVG9kYXkoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImNhbGVuZGFyLXJlZnJlc2hcIixcclxuICAgICAgbmFtZTogXCJSZWZyZXNoIGNhbGVuZGFyXCIsXHJcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB0aGlzLnJlZnJlc2hFdmVudHModHJ1ZSlcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWdpc3RlclN0eWxlcygpIHtcclxuICAgIGNvbnN0IHN0eWxlRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XHJcbiAgICBzdHlsZUVsLnRleHRDb250ZW50ID0gYFxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXIge1xyXG4gICAgICAgIGhlaWdodDogMTAwJTtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbm9ybWFsKTtcclxuICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iYWNrZ3JvdW5kLXByaW1hcnkpO1xyXG4gICAgICAgIC0tY2FsZW5kYXItdG9kYXktYWNjZW50OiB2YXIoLS1pbnRlcmFjdGl2ZS1hY2NlbnQpO1xyXG4gICAgICAgIC0tY2FsZW5kYXItc2VsZWN0ZWQtYWNjZW50OiB2YXIoLS1pbnRlcmFjdGl2ZS1hY2NlbnQpO1xyXG4gICAgICAgIC0tY2FsZW5kYXItbm90ZS1iYXItY29sb3I6ICM1ZWI4ZDU7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19oZWFkZXIge1xyXG4gICAgICAgIHBhZGRpbmc6IDE2cHggMjBweDtcclxuICAgICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpO1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgICBnYXA6IDEwcHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19uYXYge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xyXG4gICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgICAgcGFkZGluZzogMTJweCAwO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbmF2LWxlZnQsXHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbmF2LXJpZ2h0IHtcclxuICAgICAgICBmbGV4OiAwIDAgYXV0bztcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25hdi1jZW50ZXIge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZ2FwOiAxNnB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbmF2IGJ1dHRvbiB7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICAgIHBhZGRpbmc6IDZweCAxMnB4O1xyXG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDA7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgICAgdHJhbnNpdGlvbjogY29sb3IgMC4xNXMgZWFzZTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25hdiBidXR0b246aG92ZXIge1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW5vcm1hbCk7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX190aXRsZSB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxN3B4O1xyXG4gICAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgICAgbGV0dGVyLXNwYWNpbmc6IC0wLjAxZW07XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19sZWdlbmQge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC13cmFwOiB3cmFwO1xyXG4gICAgICAgIGdhcDogMTJweDtcclxuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbGVnZW5kLWl0ZW0ge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgICBnYXA6IDZweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2xlZ2VuZC1kb3Qge1xyXG4gICAgICAgIHdpZHRoOiAxMHB4O1xyXG4gICAgICAgIGhlaWdodDogMTBweDtcclxuICAgICAgICBib3JkZXItcmFkaXVzOiA1MCU7XHJcbiAgICAgICAgZmxleC1zaHJpbms6IDA7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19sZWdlbmQtbGFiZWwge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7XHJcbiAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2JvZHkge1xyXG4gICAgICAgIHBhZGRpbmc6IDIwcHggMjRweCAyNHB4O1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgICBnYXA6IDI0cHg7XHJcbiAgICAgICAgb3ZlcmZsb3c6IGF1dG87XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ncmlkIHtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgICAgZ2FwOiAxMnB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fd2Vla2RheXMge1xyXG4gICAgICAgIGRpc3BsYXk6IGdyaWQ7XHJcbiAgICAgICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiByZXBlYXQoNywgbWlubWF4KDAsIDFmcikpO1xyXG4gICAgICAgIGdhcDogNHB4O1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTBweDtcclxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7XHJcbiAgICAgICAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTtcclxuICAgICAgICBsZXR0ZXItc3BhY2luZzogMC4wNWVtO1xyXG4gICAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XHJcbiAgICAgICAgb3BhY2l0eTogMC44O1xyXG4gICAgICAgIG1hcmdpbi1ib3R0b206IDJweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX3dlZWtkYXkge1xyXG4gICAgICAgIHBhZGRpbmc6IDRweDtcclxuICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXlzIHtcclxuICAgICAgICBkaXNwbGF5OiBncmlkO1xyXG4gICAgICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczogcmVwZWF0KDcsIG1pbm1heCgwLCAxZnIpKTtcclxuICAgICAgICBnYXA6IDA7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXkge1xyXG4gICAgICAgIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50O1xyXG4gICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogMCAhaW1wb3J0YW50O1xyXG4gICAgICAgIHBhZGRpbmc6IDE2cHggNHB4IDEycHg7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xyXG4gICAgICAgIGdhcDogM3B4O1xyXG4gICAgICAgIG1pbi1oZWlnaHQ6IDY0cHg7XHJcbiAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgICBib3gtc2hhZG93OiBub25lICFpbXBvcnRhbnQ7XHJcbiAgICAgICAgb3V0bGluZTogbm9uZSAhaW1wb3J0YW50O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5OmhvdmVyLFxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RheTpmb2N1cyB7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDtcclxuICAgICAgICBib3gtc2hhZG93OiBub25lICFpbXBvcnRhbnQ7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXkuaXMtb3V0c2lkZSB7XHJcbiAgICAgICAgb3BhY2l0eTogMC40O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LmlzLXRvZGF5IC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LW51bWJlcjo6YWZ0ZXIge1xyXG4gICAgICAgIGNvbnRlbnQ6ICcnO1xyXG4gICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgICBib3R0b206IC0ycHg7XHJcbiAgICAgICAgbGVmdDogNTAlO1xyXG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcclxuICAgICAgICB3aWR0aDogMjJweDtcclxuICAgICAgICBoZWlnaHQ6IDNweDtcclxuICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1jYWxlbmRhci10b2RheS1hY2NlbnQpO1xyXG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDJweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RheS5pcy1zZWxlY3RlZCAub2JzaWRpYW4tY2FsZW5kYXJfX2RheS1udW1iZXI6OmFmdGVyIHtcclxuICAgICAgICBjb250ZW50OiAnJztcclxuICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgICAgYm90dG9tOiAtMnB4O1xyXG4gICAgICAgIGxlZnQ6IDUwJTtcclxuICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XHJcbiAgICAgICAgd2lkdGg6IDIycHg7XHJcbiAgICAgICAgaGVpZ2h0OiAzcHg7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tY2FsZW5kYXItc2VsZWN0ZWQtYWNjZW50KTtcclxuICAgICAgICBib3JkZXItcmFkaXVzOiAycHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXkuaXMtdG9kYXkuaXMtc2VsZWN0ZWQgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXktbnVtYmVyOjphZnRlciB7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tY2FsZW5kYXItdG9kYXktYWNjZW50KTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RheS1udW1iZXIge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTdweDtcclxuICAgICAgICBmb250LXdlaWdodDogNTAwO1xyXG4gICAgICAgIGxpbmUtaGVpZ2h0OiAxO1xyXG4gICAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgICBwYWRkaW5nLWJvdHRvbTogNHB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LXN1YnRpdGxlcyB7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGdhcDogMnB4O1xyXG4gICAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICAgIG1pbi1oZWlnaHQ6IDI0cHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXktc3VidGl0bGUge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTBweDtcclxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7XHJcbiAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xyXG4gICAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcclxuICAgICAgICBsaW5lLWhlaWdodDogMS4yO1xyXG4gICAgICAgIGZvbnQtd2VpZ2h0OiA0MDA7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXktbm90ZSB7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbm9ybWFsKTtcclxuICAgICAgICBvcGFjaXR5OiAwLjc7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXktZXZlbnQge1xyXG4gICAgICAgIG9wYWNpdHk6IDAuODU7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXktaW5kaWNhdG9yIHtcclxuICAgICAgICBtaW4taGVpZ2h0OiA2cHg7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICAgIG1hcmdpbi10b3A6IDJweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RheS1iYXIge1xyXG4gICAgICAgIGhlaWdodDogMnB4O1xyXG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDFweDtcclxuICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1jYWxlbmRhci1ub3RlLWJhci1jb2xvcik7XHJcbiAgICAgICAgb3BhY2l0eTogMC41O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1wcmV2aWV3IHtcclxuICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmFja2dyb3VuZC1wcmltYXJ5KTtcclxuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlcik7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xyXG4gICAgICAgIHBhZGRpbmc6IDEwcHggMTJweDtcclxuICAgICAgICBib3gtc2hhZG93OiAwIDRweCAxMnB4IHJnYmEoMCwgMCwgMCwgMC4wOCk7XHJcbiAgICAgICAgZGlzcGxheTogbm9uZTtcclxuICAgICAgICB6LWluZGV4OiA5OTk5O1xyXG4gICAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1wcmV2aWV3LXJvdyB7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGdhcDogM3B4O1xyXG4gICAgICAgIHBhZGRpbmc6IDVweCAwO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1wcmV2aWV3LXRpdGxlIHtcclxuICAgICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcclxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1ub3JtYWwpO1xyXG4gICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtcHJldmlldy1leGNlcnB0IHtcclxuICAgICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG4gICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcclxuICAgICAgICBvcGFjaXR5OiAwLjk7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzLXRpdGxlIHtcclxuICAgICAgICBmb250LXNpemU6IDE1cHg7XHJcbiAgICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgICBsZXR0ZXItc3BhY2luZzogLTAuMDFlbTtcclxuICAgICAgICBtYXJnaW4tYm90dG9tOiA0cHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzIHtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgICAgZ2FwOiAxNnB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fc2VjdGlvbiB7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGdhcDogOHB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbm90ZXMtbGlzdCxcclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ldmVudC1saXN0IHtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgICAgZ2FwOiA0cHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19zZWN0aW9uLXRpdGxlIHtcclxuICAgICAgICBmb250LXNpemU6IDExcHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG4gICAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XHJcbiAgICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMDZlbTtcclxuICAgICAgICBmb250LXdlaWdodDogNTAwO1xyXG4gICAgICAgIG1hcmdpbi1ib3R0b206IDJweDtcclxuICAgICAgICBvcGFjaXR5OiAwLjg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXJvdyB7XHJcbiAgICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICAgIHRleHQtYWxpZ246IGxlZnQ7XHJcbiAgICAgICAgcGFkZGluZzogMTBweCA4cHg7XHJcbiAgICAgICAgZGlzcGxheTogYmxvY2s7XHJcbiAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XHJcbiAgICAgICAgbWluLWhlaWdodDogNTJweDtcclxuICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtcm93OmhvdmVyIHtcclxuICAgICAgICBvcGFjaXR5OiAwLjg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXRpdGxlIHtcclxuICAgICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbm9ybWFsKTtcclxuICAgICAgICBmb250LXdlaWdodDogNTAwO1xyXG4gICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcclxuICAgICAgICBsaW5lLWhlaWdodDogMS4zO1xyXG4gICAgICAgIG1hcmdpbi1ib3R0b206IDJweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtZXhjZXJwdCB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxuICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xyXG4gICAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgICAgbGluZS1oZWlnaHQ6IDEuMztcclxuICAgICAgICBvcGFjaXR5OiAwLjg1O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZXZlbnQtcm93IHtcclxuICAgICAgICBkaXNwbGF5OiBncmlkO1xyXG4gICAgICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczogNjhweCAxZnI7XHJcbiAgICAgICAgZ2FwOiAxNHB4O1xyXG4gICAgICAgIHBhZGRpbmc6IDZweCAwO1xyXG4gICAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ldmVudC10aW1lIHtcclxuICAgICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG4gICAgICAgIGZvbnQtd2VpZ2h0OiA0MDA7XHJcbiAgICAgICAgb3BhY2l0eTogMC44NTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2V2ZW50LXN1bW1hcnkge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgICBmb250LXdlaWdodDogNDAwO1xyXG4gICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcclxuICAgICAgICBsaW5lLWhlaWdodDogMS4zO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlscy1hY3Rpb24ge1xyXG4gICAgICAgIG1hcmdpbi10b3A6IDRweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RldGFpbHMtYWN0aW9uIGJ1dHRvbiB7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpO1xyXG4gICAgICAgIHBhZGRpbmc6IDZweCAxNHB4O1xyXG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcclxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1ub3JtYWwpO1xyXG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzLWFjdGlvbiBidXR0b246aG92ZXIge1xyXG4gICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItaG92ZXIpO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fc2V0dGluZy1oaW50IHtcclxuICAgICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG4gICAgICAgIG1hcmdpbjogNHB4IDAgMTJweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX3NldHRpbmctaGludC5pcy1lcnJvciB7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtYWNjZW50KTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RldGFpbHMtcm93IHtcclxuICAgICAgICBkaXNwbGF5OiBncmlkO1xyXG4gICAgICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczogNjhweCAxZnI7XHJcbiAgICAgICAgZ2FwOiAxNHB4O1xyXG4gICAgICAgIHBhZGRpbmc6IDZweCAwO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlscy10aW1lIHtcclxuICAgICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG4gICAgICAgIG9wYWNpdHk6IDAuODU7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzLXN1bW1hcnkge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RldGFpbHMtZW1wdHkge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7XHJcbiAgICAgICAgb3BhY2l0eTogMC43NTtcclxuICAgICAgfVxyXG4gICAgYDtcclxuICAgIHN0eWxlRWwuZGF0YXNldC5jYWxlbmRhclZpZXcgPSBcInRydWVcIjtcclxuICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGVFbCk7XHJcbiAgICB0aGlzLnJlZ2lzdGVyKCgpID0+IHN0eWxlRWwucmVtb3ZlKCkpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xyXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMubG9hZERhdGEoKTtcclxuICAgIHRoaXMuc2V0dGluZ3MgPSB0aGlzLm5vcm1hbGl6ZVNldHRpbmdzKGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xyXG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcclxuICAgIHRoaXMuYXBwbHlIaWdobGlnaHRWYXJpYWJsZXMoKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGNyZWF0ZU5vdGVGb3JEYXRlKGRhdGU6IERhdGUpIHtcclxuICAgIGNvbnN0IGZpZWxkID0gdGhpcy5zZXR0aW5ncy5ub3RlRGF0ZUZpZWxkc1swXSB8fCBcImRhdGVcIjtcclxuICAgIGNvbnN0IHRpdGxlID0gZm9ybWF0RGF0ZUtleShkYXRlKTtcclxuICAgIGNvbnN0IGJhc2VQYXRoID0gbm9ybWFsaXplUGF0aChgJHt0aXRsZX0ubWRgKTtcclxuICAgIGNvbnN0IGZpbGVQYXRoID0gYXdhaXQgdGhpcy5nZXRBdmFpbGFibGVQYXRoKGJhc2VQYXRoKTtcclxuICAgIGNvbnN0IHRlbXBsYXRlQ29udGVudCA9IGF3YWl0IHRoaXMubG9hZFRlbXBsYXRlQ29udGVudCgpO1xyXG4gICAgY29uc3QgY29udGVudCA9IHRoaXMuYnVpbGROb3RlQ29udGVudChmaWVsZCwgdGl0bGUsIHRlbXBsYXRlQ29udGVudCk7XHJcbiAgICB0cnkge1xyXG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5hcHAudmF1bHQuY3JlYXRlKGZpbGVQYXRoLCBjb250ZW50KTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gY3JlYXRlIG5vdGVcIiwgZXJyb3IpO1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGdldFRlbXBsYXRlRmlsZShwYXRoOiBzdHJpbmcpIHtcclxuICAgIGNvbnN0IHRyaW1tZWQgPSBwYXRoLnRyaW0oKTtcclxuICAgIGlmICghdHJpbW1lZCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBub3JtYWxpemVkSW5wdXQgPSB0aGlzLm5vcm1hbGl6ZVRlbXBsYXRlUGF0aCh0cmltbWVkKS5wYXRoO1xyXG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZVBhdGgobm9ybWFsaXplUGF0aFNsYXNoZXMobm9ybWFsaXplZElucHV0KS5yZXBsYWNlKC9eXFwvLywgXCJcIikpO1xyXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChub3JtYWxpemVkKTtcclxuICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcclxuICAgICAgcmV0dXJuIGZpbGU7XHJcbiAgICB9XHJcbiAgICBpZiAoIW5vcm1hbGl6ZWQudG9Mb3dlckNhc2UoKS5lbmRzV2l0aChcIi5tZFwiKSkge1xyXG4gICAgICBjb25zdCB3aXRoRXh0ZW5zaW9uID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGAke25vcm1hbGl6ZWR9Lm1kYCk7XHJcbiAgICAgIGlmICh3aXRoRXh0ZW5zaW9uIGluc3RhbmNlb2YgVEZpbGUpIHtcclxuICAgICAgICByZXR1cm4gd2l0aEV4dGVuc2lvbjtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIGxvYWRUZW1wbGF0ZUNvbnRlbnQoKSB7XHJcbiAgICBjb25zdCBwYXRoID0gdGhpcy5zZXR0aW5ncy5ub3RlVGVtcGxhdGVQYXRoLnRyaW0oKTtcclxuICAgIGlmICghcGF0aCkge1xyXG4gICAgICByZXR1cm4gXCJcIjtcclxuICAgIH1cclxuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmdldFRlbXBsYXRlRmlsZShwYXRoKTtcclxuICAgIGlmICghZmlsZSkge1xyXG4gICAgICByZXR1cm4gXCJcIjtcclxuICAgIH1cclxuICAgIHRyeSB7XHJcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmFwcC52YXVsdC5jYWNoZWRSZWFkKGZpbGUpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihcIkZhaWxlZCB0byByZWFkIHRlbXBsYXRlXCIsIGVycm9yKTtcclxuICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGJ1aWxkTm90ZUNvbnRlbnQoZmllbGQ6IHN0cmluZywgdmFsdWU6IHN0cmluZywgdGVtcGxhdGU6IHN0cmluZykge1xyXG4gICAgaWYgKCF0ZW1wbGF0ZS50cmltKCkpIHtcclxuICAgICAgcmV0dXJuIGAtLS1cXG4ke2ZpZWxkfTogJHt2YWx1ZX1cXG4tLS1cXG5cXG5gO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGxpbmVzID0gdGVtcGxhdGUuc3BsaXQoXCJcXG5cIik7XHJcbiAgICBpZiAobGluZXNbMF0/LnRyaW0oKSA9PT0gXCItLS1cIikge1xyXG4gICAgICBjb25zdCBlbmRJbmRleCA9IGxpbmVzLnNsaWNlKDEpLmZpbmRJbmRleCgobGluZSkgPT4gbGluZS50cmltKCkgPT09IFwiLS0tXCIpO1xyXG4gICAgICBpZiAoZW5kSW5kZXggPj0gMCkge1xyXG4gICAgICAgIGNvbnN0IGZyb250bWF0dGVyRW5kID0gZW5kSW5kZXggKyAxO1xyXG4gICAgICAgIGNvbnN0IGhhc0ZpZWxkID0gbGluZXMuc2xpY2UoMSwgZnJvbnRtYXR0ZXJFbmQpLnNvbWUoKGxpbmUpID0+IGxpbmUudHJpbSgpLnN0YXJ0c1dpdGgoYCR7ZmllbGR9OmApKTtcclxuICAgICAgICBpZiAoIWhhc0ZpZWxkKSB7XHJcbiAgICAgICAgICBsaW5lcy5zcGxpY2UoZnJvbnRtYXR0ZXJFbmQsIDAsIGAke2ZpZWxkfTogJHt2YWx1ZX1gKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGxpbmVzLmpvaW4oXCJcXG5cIik7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gYC0tLVxcbiR7ZmllbGR9OiAke3ZhbHVlfVxcbi0tLVxcblxcbiR7dGVtcGxhdGV9YDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgZ2V0QXZhaWxhYmxlUGF0aChwYXRoOiBzdHJpbmcpIHtcclxuICAgIGlmICghdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpKSB7XHJcbiAgICAgIHJldHVybiBwYXRoO1xyXG4gICAgfVxyXG4gICAgY29uc3QgYmFzZSA9IHBhdGgucmVwbGFjZSgvXFwubWQkL2ksIFwiXCIpO1xyXG4gICAgbGV0IGluZGV4ID0gMTtcclxuICAgIGxldCBjYW5kaWRhdGUgPSBgJHtiYXNlfS0ke2luZGV4fS5tZGA7XHJcbiAgICB3aGlsZSAodGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNhbmRpZGF0ZSkpIHtcclxuICAgICAgaW5kZXggKz0gMTtcclxuICAgICAgY2FuZGlkYXRlID0gYCR7YmFzZX0tJHtpbmRleH0ubWRgO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGNhbmRpZGF0ZTtcclxuICB9XHJcblxyXG4gIGFwcGx5SGlnaGxpZ2h0VmFyaWFibGVzKCkge1xyXG4gICAgY29uc3QgbGVhdmVzID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfQ0FMRU5EQVIpO1xyXG4gICAgZm9yIChjb25zdCBsZWFmIG9mIGxlYXZlcykge1xyXG4gICAgICBjb25zdCBjb250YWluZXIgPSBsZWFmLnZpZXcuY29udGFpbmVyRWw7XHJcbiAgICAgIGNvbnN0IHRvZGF5Q29sb3IgPSByZXNvbHZlSGlnaGxpZ2h0VmFsdWUodGhpcy5zZXR0aW5ncy50b2RheUhpZ2hsaWdodCwgXCItLWludGVyYWN0aXZlLWFjY2VudFwiKTtcclxuICAgICAgY29uc3Qgc2VsZWN0ZWRDb2xvciA9IHJlc29sdmVIaWdobGlnaHRWYWx1ZSh0aGlzLnNldHRpbmdzLnNlbGVjdGVkSGlnaGxpZ2h0LCBcIi0tdGV4dC1hY2NlbnRcIik7XHJcbiAgICAgIGNvbnN0IGJhckNvbG9yID0gcmVzb2x2ZUhpZ2hsaWdodFZhbHVlKHRoaXMuc2V0dGluZ3Mubm90ZUJhckNvbG9yLCBcIi0tdGV4dC1hY2NlbnRcIik7XHJcbiAgICAgIGNvbnRhaW5lci5zdHlsZS5zZXRQcm9wZXJ0eShcclxuICAgICAgICBcIi0tY2FsZW5kYXItdG9kYXktYWNjZW50XCIsXHJcbiAgICAgICAgdG9kYXlDb2xvclxyXG4gICAgICApO1xyXG4gICAgICBjb250YWluZXIuc3R5bGUuc2V0UHJvcGVydHkoXHJcbiAgICAgICAgXCItLWNhbGVuZGFyLXNlbGVjdGVkLWFjY2VudFwiLFxyXG4gICAgICAgIHNlbGVjdGVkQ29sb3JcclxuICAgICAgKTtcclxuICAgICAgY29udGFpbmVyLnN0eWxlLnNldFByb3BlcnR5KFxyXG4gICAgICAgIFwiLS1jYWxlbmRhci1ub3RlLWJhci1jb2xvclwiLFxyXG4gICAgICAgIGJhckNvbG9yXHJcbiAgICAgICk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBub3JtYWxpemVUZW1wbGF0ZVBhdGgocmF3UGF0aDogc3RyaW5nKSB7XHJcbiAgICBjb25zdCB0cmltbWVkID0gcmF3UGF0aC50cmltKCk7XHJcbiAgICBpZiAoIXRyaW1tZWQpIHtcclxuICAgICAgcmV0dXJuIHsgcGF0aDogXCJcIiwgd2FybmluZzogXCJcIiB9O1xyXG4gICAgfVxyXG5cclxuICAgIGxldCBub3JtYWxpemVkID0gbm9ybWFsaXplUGF0aFNsYXNoZXModHJpbW1lZCkucmVwbGFjZSgvXlxcLy8sIFwiXCIpO1xyXG4gICAgaWYgKC9eW2EtekEtWl06XFwvLy50ZXN0KG5vcm1hbGl6ZWQpIHx8IG5vcm1hbGl6ZWQuc3RhcnRzV2l0aChcIi8vXCIpKSB7XHJcbiAgICAgIGNvbnN0IHZhdWx0Um9vdCA9IG5vcm1hbGl6ZVBhdGhTbGFzaGVzKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuZ2V0RnVsbFBhdGgoXCJcIikpO1xyXG4gICAgICBjb25zdCByb290V2l0aFNsYXNoID0gdmF1bHRSb290LmVuZHNXaXRoKFwiL1wiKSA/IHZhdWx0Um9vdCA6IGAke3ZhdWx0Um9vdH0vYDtcclxuICAgICAgaWYgKG5vcm1hbGl6ZWQuc3RhcnRzV2l0aChyb290V2l0aFNsYXNoKSkge1xyXG4gICAgICAgIG5vcm1hbGl6ZWQgPSBub3JtYWxpemVkLnNsaWNlKHJvb3RXaXRoU2xhc2gubGVuZ3RoKTtcclxuICAgICAgICByZXR1cm4geyBwYXRoOiBub3JtYWxpemVQYXRoKG5vcm1hbGl6ZWQpLCB3YXJuaW5nOiBcIlwiIH07XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHsgcGF0aDogXCJcIiwgd2FybmluZzogXCJUZW1wbGF0ZSBwYXRoIG11c3QgYmUgaW5zaWRlIHRoaXMgdmF1bHQuXCIgfTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4geyBwYXRoOiBub3JtYWxpemVQYXRoKG5vcm1hbGl6ZWQpLCB3YXJuaW5nOiBcIlwiIH07XHJcbiAgfVxyXG5cclxuICBnZXRUZW1wbGF0ZUZvbGRlck9wdGlvbnMoKSB7XHJcbiAgICBjb25zdCBmb2xkZXJzID0gbmV3IFNldDxzdHJpbmc+KCk7XHJcbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpKSB7XHJcbiAgICAgIGNvbnN0IHBhcmVudCA9IGZpbGUucGFyZW50Py5wYXRoID8/IFwiXCI7XHJcbiAgICAgIGZvbGRlcnMuYWRkKHBhcmVudCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gQXJyYXkuZnJvbShmb2xkZXJzKS5zb3J0KChhLCBiKSA9PiBhLmxvY2FsZUNvbXBhcmUoYikpO1xyXG4gIH1cclxuXHJcbiAgZ2V0VGVtcGxhdGVPcHRpb25zKGZvbGRlcjogc3RyaW5nKSB7XHJcbiAgICByZXR1cm4gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpXHJcbiAgICAgIC5maWx0ZXIoKGZpbGUpID0+IChmb2xkZXIgPyBmaWxlLnBhcmVudD8ucGF0aCA9PT0gZm9sZGVyIDogdHJ1ZSkpXHJcbiAgICAgIC5tYXAoKGZpbGUpID0+ICh7XHJcbiAgICAgICAgcGF0aDogZmlsZS5wYXRoLFxyXG4gICAgICAgIGxhYmVsOiBmaWxlLm5hbWVcclxuICAgICAgfSkpXHJcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBhLmxhYmVsLmxvY2FsZUNvbXBhcmUoYi5sYWJlbCkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBub3JtYWxpemVTZXR0aW5ncyhkYXRhOiB1bmtub3duKTogQ2FsZW5kYXJTZXR0aW5ncyB7XHJcbiAgICBpZiAoIWRhdGEgfHwgdHlwZW9mIGRhdGEgIT09IFwib2JqZWN0XCIpIHtcclxuICAgICAgcmV0dXJuIHsgLi4uREVGQVVMVF9TRVRUSU5HUyB9O1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHJlY29yZCA9IGRhdGEgYXMgUGFydGlhbDxDYWxlbmRhclNldHRpbmdzPiAmIHsgaWNhbFVybD86IHN0cmluZyB9O1xyXG5cclxuICAgIGNvbnN0IHNvdXJjZXM6IENhbGVuZGFyU291cmNlW10gPSBBcnJheS5pc0FycmF5KHJlY29yZC5zb3VyY2VzKVxyXG4gICAgICA/IHJlY29yZC5zb3VyY2VzLm1hcCgoc291cmNlLCBpbmRleCkgPT4gKHtcclxuICAgICAgICBpZDogc291cmNlLmlkIHx8IGNyZWF0ZVNvdXJjZUlkKCksXHJcbiAgICAgICAgbmFtZTogc291cmNlLm5hbWUgPz8gXCJcIixcclxuICAgICAgICBlbmFibGVkOiBzb3VyY2UuZW5hYmxlZCA/PyB0cnVlLFxyXG4gICAgICAgIHVybDogc291cmNlLnVybCA/PyBcIlwiLFxyXG4gICAgICAgIGNvbG9yOiBzb3VyY2UuY29sb3IgPz8gZ2V0RGVmYXVsdFNvdXJjZUNvbG9yKGluZGV4KVxyXG4gICAgICB9KSlcclxuICAgICAgOiBbXTtcclxuXHJcbiAgICBpZiAoc291cmNlcy5sZW5ndGggPT09IDAgJiYgdHlwZW9mIHJlY29yZC5pY2FsVXJsID09PSBcInN0cmluZ1wiICYmIHJlY29yZC5pY2FsVXJsLnRyaW0oKS5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHNvdXJjZXMucHVzaCh7XHJcbiAgICAgICAgaWQ6IGNyZWF0ZVNvdXJjZUlkKCksXHJcbiAgICAgICAgbmFtZTogXCJQcmltYXJ5XCIsXHJcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICB1cmw6IHJlY29yZC5pY2FsVXJsLnRyaW0oKSxcclxuICAgICAgICBjb2xvcjogZ2V0RGVmYXVsdFNvdXJjZUNvbG9yKDApXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIHNvdXJjZXMsXHJcbiAgICAgIHdlZWtTdGFydDogcmVjb3JkLndlZWtTdGFydCA/PyBERUZBVUxUX1NFVFRJTkdTLndlZWtTdGFydCxcclxuICAgICAgdGltZUZvcm1hdDogcmVjb3JkLnRpbWVGb3JtYXQgPz8gREVGQVVMVF9TRVRUSU5HUy50aW1lRm9ybWF0LFxyXG4gICAgICBsYW5ndWFnZTogcmVjb3JkLmxhbmd1YWdlID8/IERFRkFVTFRfU0VUVElOR1MubGFuZ3VhZ2UsXHJcbiAgICAgIHJlZnJlc2hJbnRlcnZhbE1pbnV0ZXM6IHJlY29yZC5yZWZyZXNoSW50ZXJ2YWxNaW51dGVzID8/IERFRkFVTFRfU0VUVElOR1MucmVmcmVzaEludGVydmFsTWludXRlcyxcclxuICAgICAgdG9kYXlIaWdobGlnaHQ6IHJlY29yZC50b2RheUhpZ2hsaWdodCA/PyBERUZBVUxUX1NFVFRJTkdTLnRvZGF5SGlnaGxpZ2h0LFxyXG4gICAgICBzZWxlY3RlZEhpZ2hsaWdodDogcmVjb3JkLnNlbGVjdGVkSGlnaGxpZ2h0ID8/IERFRkFVTFRfU0VUVElOR1Muc2VsZWN0ZWRIaWdobGlnaHQsXHJcbiAgICAgIG5vdGVEYXRlRmllbGRzOiBBcnJheS5pc0FycmF5KHJlY29yZC5ub3RlRGF0ZUZpZWxkcykgJiYgcmVjb3JkLm5vdGVEYXRlRmllbGRzLmxlbmd0aCA+IDBcclxuICAgICAgICA/IHJlY29yZC5ub3RlRGF0ZUZpZWxkc1xyXG4gICAgICAgIDogREVGQVVMVF9TRVRUSU5HUy5ub3RlRGF0ZUZpZWxkcyxcclxuICAgICAgYWxsb3dDcmVhdGVOb3RlOiByZWNvcmQuYWxsb3dDcmVhdGVOb3RlID8/IERFRkFVTFRfU0VUVElOR1MuYWxsb3dDcmVhdGVOb3RlLFxyXG4gICAgICBub3RlVGVtcGxhdGVQYXRoOiB0eXBlb2YgcmVjb3JkLm5vdGVUZW1wbGF0ZVBhdGggPT09IFwic3RyaW5nXCJcclxuICAgICAgICA/IHJlY29yZC5ub3RlVGVtcGxhdGVQYXRoXHJcbiAgICAgICAgOiBERUZBVUxUX1NFVFRJTkdTLm5vdGVUZW1wbGF0ZVBhdGgsXHJcbiAgICAgIG5vdGVCYXJDb2xvcjogdHlwZW9mIHJlY29yZC5ub3RlQmFyQ29sb3IgPT09IFwic3RyaW5nXCJcclxuICAgICAgICA/IHJlY29yZC5ub3RlQmFyQ29sb3JcclxuICAgICAgICA6IERFRkFVTFRfU0VUVElOR1Mubm90ZUJhckNvbG9yXHJcbiAgICB9O1xyXG4gIH1cclxufVxyXG4iLCAiaW1wb3J0IHsgUGFyc2VkSWNhbEV2ZW50IH0gZnJvbSBcIi4vdHlwZXNcIjtcclxuXHJcbmNvbnN0IERBVEVfT05MWSA9IC9eXFxkezh9JC87XHJcbmNvbnN0IERBVEVfVElNRSA9IC9eXFxkezh9VFxcZHs2fVo/JC87XHJcblxyXG5jb25zdCBhZGREYXlzID0gKGRhdGU6IERhdGUsIGRheXM6IG51bWJlcikgPT5cclxuICBuZXcgRGF0ZShkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCkgKyBkYXlzKTtcclxuXHJcbmNvbnN0IHBhcnNlRGF0ZVZhbHVlID0gKHJhdzogc3RyaW5nKTogeyBkYXRlOiBEYXRlOyBhbGxEYXk6IGJvb2xlYW4gfSA9PiB7XHJcbiAgaWYgKERBVEVfT05MWS50ZXN0KHJhdykpIHtcclxuICAgIGNvbnN0IHllYXIgPSBOdW1iZXIocmF3LnNsaWNlKDAsIDQpKTtcclxuICAgIGNvbnN0IG1vbnRoID0gTnVtYmVyKHJhdy5zbGljZSg0LCA2KSkgLSAxO1xyXG4gICAgY29uc3QgZGF5ID0gTnVtYmVyKHJhdy5zbGljZSg2LCA4KSk7XHJcbiAgICByZXR1cm4geyBkYXRlOiBuZXcgRGF0ZSh5ZWFyLCBtb250aCwgZGF5KSwgYWxsRGF5OiB0cnVlIH07XHJcbiAgfVxyXG5cclxuICBpZiAoREFURV9USU1FLnRlc3QocmF3KSkge1xyXG4gICAgY29uc3QgeWVhciA9IE51bWJlcihyYXcuc2xpY2UoMCwgNCkpO1xyXG4gICAgY29uc3QgbW9udGggPSBOdW1iZXIocmF3LnNsaWNlKDQsIDYpKSAtIDE7XHJcbiAgICBjb25zdCBkYXkgPSBOdW1iZXIocmF3LnNsaWNlKDYsIDgpKTtcclxuICAgIGNvbnN0IGhvdXIgPSBOdW1iZXIocmF3LnNsaWNlKDksIDExKSk7XHJcbiAgICBjb25zdCBtaW51dGUgPSBOdW1iZXIocmF3LnNsaWNlKDExLCAxMykpO1xyXG4gICAgY29uc3Qgc2Vjb25kID0gTnVtYmVyKHJhdy5zbGljZSgxMywgMTUpKTtcclxuICAgIGlmIChyYXcuZW5kc1dpdGgoXCJaXCIpKSB7XHJcbiAgICAgIHJldHVybiB7IGRhdGU6IG5ldyBEYXRlKERhdGUuVVRDKHllYXIsIG1vbnRoLCBkYXksIGhvdXIsIG1pbnV0ZSwgc2Vjb25kKSksIGFsbERheTogZmFsc2UgfTtcclxuICAgIH1cclxuICAgIHJldHVybiB7IGRhdGU6IG5ldyBEYXRlKHllYXIsIG1vbnRoLCBkYXksIGhvdXIsIG1pbnV0ZSwgc2Vjb25kKSwgYWxsRGF5OiBmYWxzZSB9O1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHsgZGF0ZTogbmV3IERhdGUocmF3KSwgYWxsRGF5OiBmYWxzZSB9O1xyXG59O1xyXG5cclxuY29uc3QgdW5mb2xkTGluZXMgPSAodGV4dDogc3RyaW5nKTogc3RyaW5nW10gPT4ge1xyXG4gIGNvbnN0IGxpbmVzID0gdGV4dC5yZXBsYWNlKC9cXHJcXG4vZywgXCJcXG5cIikuc3BsaXQoXCJcXG5cIik7XHJcbiAgY29uc3QgdW5mb2xkZWQ6IHN0cmluZ1tdID0gW107XHJcbiAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XHJcbiAgICBpZiAobGluZS5zdGFydHNXaXRoKFwiIFwiKSB8fCBsaW5lLnN0YXJ0c1dpdGgoXCJcXHRcIikpIHtcclxuICAgICAgY29uc3QgbGFzdEluZGV4ID0gdW5mb2xkZWQubGVuZ3RoIC0gMTtcclxuICAgICAgaWYgKGxhc3RJbmRleCA+PSAwKSB7XHJcbiAgICAgICAgdW5mb2xkZWRbbGFzdEluZGV4XSArPSBsaW5lLnNsaWNlKDEpO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2UgaWYgKGxpbmUudHJpbSgpLmxlbmd0aCkge1xyXG4gICAgICB1bmZvbGRlZC5wdXNoKGxpbmUudHJpbSgpKTtcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIHVuZm9sZGVkO1xyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IHBhcnNlSWNhbCA9ICh0ZXh0OiBzdHJpbmcpOiBQYXJzZWRJY2FsRXZlbnRbXSA9PiB7XHJcbiAgY29uc3QgZXZlbnRzOiBQYXJzZWRJY2FsRXZlbnRbXSA9IFtdO1xyXG4gIGNvbnN0IGxpbmVzID0gdW5mb2xkTGluZXModGV4dCk7XHJcbiAgbGV0IGN1cnJlbnQ6IFBhcnRpYWw8UGFyc2VkSWNhbEV2ZW50PiA9IHt9O1xyXG5cclxuICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcclxuICAgIGlmIChsaW5lID09PSBcIkJFR0lOOlZFVkVOVFwiKSB7XHJcbiAgICAgIGN1cnJlbnQgPSB7fTtcclxuICAgICAgY29udGludWU7XHJcbiAgICB9XHJcbiAgICBpZiAobGluZSA9PT0gXCJFTkQ6VkVWRU5UXCIpIHtcclxuICAgICAgaWYgKGN1cnJlbnQuc3RhcnQpIHtcclxuICAgICAgICBpZiAoIWN1cnJlbnQuZW5kKSB7XHJcbiAgICAgICAgICBjdXJyZW50LmVuZCA9IGN1cnJlbnQuc3RhcnQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChjdXJyZW50LmFsbERheSAmJiBjdXJyZW50LmVuZC5nZXRUaW1lKCkgPiBjdXJyZW50LnN0YXJ0LmdldFRpbWUoKSkge1xyXG4gICAgICAgICAgY3VycmVudC5lbmQgPSBhZGREYXlzKGN1cnJlbnQuZW5kLCAtMSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGV2ZW50cy5wdXNoKHtcclxuICAgICAgICAgIGlkOiBjdXJyZW50LmlkID8/IGNyeXB0by5yYW5kb21VVUlEKCksXHJcbiAgICAgICAgICBzdW1tYXJ5OiBjdXJyZW50LnN1bW1hcnkgPz8gXCJVbnRpdGxlZFwiLFxyXG4gICAgICAgICAgc3RhcnQ6IGN1cnJlbnQuc3RhcnQsXHJcbiAgICAgICAgICBlbmQ6IGN1cnJlbnQuZW5kLFxyXG4gICAgICAgICAgYWxsRGF5OiBjdXJyZW50LmFsbERheSA/PyBmYWxzZVxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICAgIGN1cnJlbnQgPSB7fTtcclxuICAgICAgY29udGludWU7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgW3Jhd0tleSwgcmF3VmFsdWVdID0gbGluZS5zcGxpdChcIjpcIiwgMik7XHJcbiAgICBpZiAoIXJhd0tleSB8fCByYXdWYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG4gICAgY29uc3Qga2V5ID0gcmF3S2V5LnNwbGl0KFwiO1wiKVswXTtcclxuXHJcbiAgICBpZiAoa2V5ID09PSBcIlVJRFwiKSB7XHJcbiAgICAgIGN1cnJlbnQuaWQgPSByYXdWYWx1ZS50cmltKCk7XHJcbiAgICB9XHJcbiAgICBpZiAoa2V5ID09PSBcIlNVTU1BUllcIikge1xyXG4gICAgICBjdXJyZW50LnN1bW1hcnkgPSByYXdWYWx1ZS50cmltKCk7XHJcbiAgICB9XHJcbiAgICBpZiAoa2V5ID09PSBcIkRUU1RBUlRcIikge1xyXG4gICAgICBjb25zdCB7IGRhdGUsIGFsbERheSB9ID0gcGFyc2VEYXRlVmFsdWUocmF3VmFsdWUudHJpbSgpKTtcclxuICAgICAgY3VycmVudC5zdGFydCA9IGRhdGU7XHJcbiAgICAgIGN1cnJlbnQuYWxsRGF5ID0gYWxsRGF5O1xyXG4gICAgfVxyXG4gICAgaWYgKGtleSA9PT0gXCJEVEVORFwiKSB7XHJcbiAgICAgIGNvbnN0IHsgZGF0ZSwgYWxsRGF5IH0gPSBwYXJzZURhdGVWYWx1ZShyYXdWYWx1ZS50cmltKCkpO1xyXG4gICAgICBjdXJyZW50LmVuZCA9IGRhdGU7XHJcbiAgICAgIGN1cnJlbnQuYWxsRGF5ID0gY3VycmVudC5hbGxEYXkgPz8gYWxsRGF5O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGV2ZW50cztcclxufTtcclxuIiwgImltcG9ydCB7IHJlcXVlc3RVcmwgfSBmcm9tIFwib2JzaWRpYW5cIjtcclxuaW1wb3J0IHsgQ2FsZW5kYXJFdmVudCwgQ2FsZW5kYXJTb3VyY2UsIFBhcnNlZEljYWxFdmVudCB9IGZyb20gXCIuLi90eXBlc1wiO1xyXG5cclxuZXhwb3J0IHR5cGUgSWNhbFBhcnNlciA9ICh0ZXh0OiBzdHJpbmcpID0+IFBhcnNlZEljYWxFdmVudFtdO1xyXG5cclxudHlwZSBDYWNoZUVudHJ5ID0ge1xyXG4gICAgZmV0Y2hlZEF0OiBudW1iZXI7XHJcbiAgICBldmVudHM6IENhbGVuZGFyRXZlbnRbXTtcclxuICAgIHVybDogc3RyaW5nO1xyXG59O1xyXG5cclxuZXhwb3J0IGNsYXNzIEljYWxTZXJ2aWNlIHtcclxuICAgIHByaXZhdGUgY2FjaGUgPSBuZXcgTWFwPHN0cmluZywgQ2FjaGVFbnRyeT4oKTtcclxuICAgIHByaXZhdGUgcGFyc2VyOiBJY2FsUGFyc2VyO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHBhcnNlcjogSWNhbFBhcnNlcikge1xyXG4gICAgICAgIHRoaXMucGFyc2VyID0gcGFyc2VyO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGdldEV2ZW50cyhcclxuICAgICAgICBzb3VyY2VzOiBDYWxlbmRhclNvdXJjZVtdLFxyXG4gICAgICAgIHJlZnJlc2hJbnRlcnZhbE1pbnV0ZXM6IG51bWJlcixcclxuICAgICAgICBmb3JjZVJlZnJlc2ggPSBmYWxzZVxyXG4gICAgKTogUHJvbWlzZTxDYWxlbmRhckV2ZW50W10+IHtcclxuICAgICAgICBjb25zdCBlbmFibGVkU291cmNlcyA9IHNvdXJjZXMuZmlsdGVyKChzb3VyY2UpID0+IHNvdXJjZS5lbmFibGVkICYmIHNvdXJjZS51cmwudHJpbSgpLmxlbmd0aCA+IDApO1xyXG4gICAgICAgIGlmIChlbmFibGVkU291cmNlcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuIFtdO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcclxuICAgICAgICBjb25zdCByZWZyZXNoTXMgPSBNYXRoLm1heChyZWZyZXNoSW50ZXJ2YWxNaW51dGVzLCAxKSAqIDYwICogMTAwMDtcclxuXHJcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKFxyXG4gICAgICAgICAgICBlbmFibGVkU291cmNlcy5tYXAoKHNvdXJjZSkgPT4gdGhpcy5nZXRTb3VyY2VFdmVudHMoc291cmNlLCBub3csIHJlZnJlc2hNcywgZm9yY2VSZWZyZXNoKSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICByZXR1cm4gcmVzdWx0cy5mbGF0KCkuc29ydCgoYSwgYikgPT4gYS5zdGFydC5nZXRUaW1lKCkgLSBiLnN0YXJ0LmdldFRpbWUoKSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRTb3VyY2VFdmVudHMoXHJcbiAgICAgICAgc291cmNlOiBDYWxlbmRhclNvdXJjZSxcclxuICAgICAgICBub3c6IG51bWJlcixcclxuICAgICAgICByZWZyZXNoTXM6IG51bWJlcixcclxuICAgICAgICBmb3JjZVJlZnJlc2g6IGJvb2xlYW5cclxuICAgICk6IFByb21pc2U8Q2FsZW5kYXJFdmVudFtdPiB7XHJcbiAgICAgICAgY29uc3QgY2FjaGVkID0gdGhpcy5jYWNoZS5nZXQoc291cmNlLmlkKTtcclxuICAgICAgICBpZiAoIWZvcmNlUmVmcmVzaCAmJiBjYWNoZWQgJiYgY2FjaGVkLnVybCA9PT0gc291cmNlLnVybCAmJiBub3cgLSBjYWNoZWQuZmV0Y2hlZEF0IDwgcmVmcmVzaE1zKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWQuZXZlbnRzO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHsgdXJsOiBzb3VyY2UudXJsIH0pO1xyXG4gICAgICAgICAgICBjb25zdCBwYXJzZWQgPSB0aGlzLnBhcnNlcihyZXNwb25zZS50ZXh0KTtcclxuICAgICAgICAgICAgY29uc3QgZXZlbnRzID0gcGFyc2VkLm1hcCgoZXZlbnQpID0+ICh7XHJcbiAgICAgICAgICAgICAgICAuLi5ldmVudCxcclxuICAgICAgICAgICAgICAgIHNvdXJjZUlkOiBzb3VyY2UuaWQsXHJcbiAgICAgICAgICAgICAgICBzb3VyY2VOYW1lOiBzb3VyY2UubmFtZSB8fCBcIkNhbGVuZGFyXCJcclxuICAgICAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5jYWNoZS5zZXQoc291cmNlLmlkLCB7IGZldGNoZWRBdDogbm93LCBldmVudHMsIHVybDogc291cmNlLnVybCB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIGV2ZW50cztcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRmFpbGVkIHRvIGZldGNoIGlDYWwgc291cmNlXCIsIHNvdXJjZS5uYW1lLCBlcnJvcik7XHJcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWQgPyBjYWNoZWQuZXZlbnRzIDogW107XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBQUFBLG1CQVNPOzs7QUNQUCxJQUFNLFlBQVk7QUFDbEIsSUFBTSxZQUFZO0FBRWxCLElBQU0sVUFBVSxDQUFDLE1BQVksU0FDM0IsSUFBSSxLQUFLLEtBQUssWUFBWSxHQUFHLEtBQUssU0FBUyxHQUFHLEtBQUssUUFBUSxJQUFJLElBQUk7QUFFckUsSUFBTSxpQkFBaUIsQ0FBQyxRQUFpRDtBQUN2RSxNQUFJLFVBQVUsS0FBSyxHQUFHLEdBQUc7QUFDdkIsVUFBTSxPQUFPLE9BQU8sSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDO0FBQ25DLFVBQU0sUUFBUSxPQUFPLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJO0FBQ3hDLFVBQU0sTUFBTSxPQUFPLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztBQUNsQyxXQUFPLEVBQUUsTUFBTSxJQUFJLEtBQUssTUFBTSxPQUFPLEdBQUcsR0FBRyxRQUFRLEtBQUs7QUFBQSxFQUMxRDtBQUVBLE1BQUksVUFBVSxLQUFL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QUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQTZXdEIsWUFBUSxRQUFRLGVBQWU7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QyxVQUFVO0FBQUEsTUFDZCxNQUFNLEtBQUs7QUFBQSxNQUNYLE9BQU8sS0FBSztBQUFBLElBQ2QsRUFBRSxFQUNELEtBQUssQ0FBQyxHQUFHLE1BQU0sRUFBRSxNQUFNLGNBQWMsRUFBRSxLQUFLLENBQUM7QUFBQSxFQUNsRDtBQUFBLEVBRVEsa0JBQWtCLE1BQWlDO0FBQ3pELFFBQUksQ0FBQyxRQUFRLE9BQU8sU0FBUyxVQUFVO0FBQ3JDLGFBQU8sRUFBRSxHQUFHLGlCQUFpQjtBQUFBLElBQy9CO0FBRUEsVUFBTSxTQUFTO0FBRWYsVUFBTSxVQUE0QixNQUFNLFFBQVEsT0FBTyxPQUFPLElBQzFELE9BQU8sUUFBUSxJQUFJLENBQUMsUUFBUSxXQUFXO0FBQUEsTUFDdkMsSUFBSSxPQUFPLE1BQU0sZUFBZTtBQUFBLE1BQ2hDLE1BQU0sT0FBTyxRQUFRO0FBQUEsTUFDckIsU0FBUyxPQUFPLFdBQVc7QUFBQSxNQUMzQixLQUFLLE9BQU8sT0FBTztBQUFBLE1BQ25CLE9BQU8sT0FBTyxTQUFTLHNCQUFzQixLQUFLO0FBQUEsSUFDcEQsRUFBRSxJQUNBLENBQUM7QUFFTCxRQUFJLFFBQVEsV0FBVyxLQUFLLE9BQU8sT0FBTyxZQUFZLFlBQVksT0FBTyxRQUFRLEtBQUssRUFBRSxTQUFTLEdBQUc7QUFDbEcsY0FBUSxLQUFLO0FBQUEsUUFDWCxJQUFJLGVBQWU7QUFBQSxRQUNuQixNQUFNO0FBQUEsUUFDTixTQUFTO0FBQUEsUUFDVCxLQUFLLE9BQU8sUUFBUSxLQUFLO0FBQUEsUUFDekIsT0FBTyxzQkFBc0IsQ0FBQztBQUFBLE1BQ2hDLENBQUM7QUFBQSxJQUNIO0FBRUEsV0FBTztBQUFBLE1BQ0w7QUFBQSxNQUNBLFdBQVcsT0FBTyxhQUFhLGlCQUFpQjtBQUFBLE1BQ2hELFlBQVksT0FBTyxjQUFjLGlCQUFpQjtBQUFBLE1BQ2xELFVBQVUsT0FBTyxZQUFZLGlCQUFpQjtBQUFBLE1BQzlDLHdCQUF3QixPQUFPLDBCQUEwQixpQkFBaUI7QUFBQSxNQUMxRSxnQkFBZ0IsT0FBTyxrQkFBa0IsaUJBQWlCO0FBQUEsTUFDMUQsbUJBQW1CLE9BQU8scUJBQXFCLGlCQUFpQjtBQUFBLE1BQ2hFLGdCQUFnQixNQUFNLFFBQVEsT0FBTyxjQUFjLEtBQUssT0FBTyxlQUFlLFNBQVMsSUFDbkYsT0FBTyxpQkFDUCxpQkFBaUI7QUFBQSxNQUNyQixpQkFBaUIsT0FBTyxtQkFBbUIsaUJBQWlCO0FBQUEsTUFDNUQsa0JBQWtCLE9BQU8sT0FBTyxxQkFBcUIsV0FDakQsT0FBTyxtQkFDUCxpQkFBaUI7QUFBQSxNQUNyQixjQUFjLE9BQU8sT0FBTyxpQkFBaUIsV0FDekMsT0FBTyxlQUNQLGlCQUFpQjtBQUFBLElBQ3ZCO0FBQUEsRUFDRjtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiYWRkRGF5cyJdCn0K
