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
var t = (key, lang) => {
  return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
};
var resolveHighlightValue = (value, fallbackVar) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return getComputedStyle(document.body).getPropertyValue(fallbackVar).trim();
  }
  if (trimmed.startsWith("--")) {
    const resolved = getComputedStyle(document.body).getPropertyValue(trimmed).trim();
    return resolved || trimmed;
  }
  return trimmed;
};
var normalizePathSlashes = (value) => value.replace(/\\/g, "/");
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
var getDefaultSourceColor = (index) => {
  return DEFAULT_SOURCE_COLORS[index % DEFAULT_SOURCE_COLORS.length];
};
var formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
var parseFrontmatterDate = (value) => {
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
};
var extractFrontmatterDates = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => parseFrontmatterDate(item)).filter((item) => item !== null);
  }
  const single = parseFrontmatterDate(value);
  return single ? [single] : [];
};
var startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
var endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
var addDays2 = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
var isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
var formatTime = (date, format) => {
  if (format === "24h") {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
};
var clampToDayStart = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
var clampToDayEnd = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
var createSourceId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `src-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
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
    const todayBtn = centerGroup.createEl("button", { text: t("today", lang) });
    const refreshBtn = centerGroup.createEl("button", { text: t("refresh", lang) });
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
      weekdayRow.createDiv({ cls: "obsidian-calendar__weekday", text: t(key, lang) });
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
      eventsSection.createDiv({ cls: "obsidian-calendar__section-title", text: t("events", lang) });
      const eventsList = eventsSection.createDiv({ cls: "obsidian-calendar__event-list" });
      for (const event of events) {
        const row = eventsList.createDiv({ cls: "obsidian-calendar__event-row" });
        const source = this.plugin.settings.sources.find((s) => s.id === event.sourceId);
        const color = source?.color || getDefaultSourceColor(0);
        row.style.borderLeft = `3px solid ${color}`;
        row.createDiv({
          cls: "obsidian-calendar__event-time",
          text: event.allDay ? t("allDay", lang) : formatTime(event.start, this.plugin.settings.timeFormat)
        });
        row.createDiv({ cls: "obsidian-calendar__event-summary", text: event.summary });
      }
    }
    if (notes.length > 0) {
      const notesSection = this.detailsEl.createDiv({ cls: "obsidian-calendar__section" });
      notesSection.createDiv({ cls: "obsidian-calendar__section-title", text: t("notes", lang) });
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
      this.detailsEl.createDiv({ cls: "obsidian-calendar__details-empty", text: t("noNotesOrEvents", lang) });
    }
    if (this.plugin.settings.allowCreateNote) {
      const action = this.detailsEl.createDiv({ cls: "obsidian-calendar__details-action" });
      const button = action.createEl("button", { text: t("createNote", lang) });
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL21haW4udHMiLCAiLi4vc3JjL2ljYWwudHMiLCAiLi4vc3JjL3NlcnZpY2VzL2ljYWxTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQge1xyXG4gIEFwcCxcclxuICBJdGVtVmlldyxcclxuICBQbHVnaW4sXHJcbiAgUGx1Z2luU2V0dGluZ1RhYixcclxuICBTZXR0aW5nLFxyXG4gIFRGaWxlLFxyXG4gIFdvcmtzcGFjZUxlYWYsXHJcbiAgbm9ybWFsaXplUGF0aFxyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyBwYXJzZUljYWwgfSBmcm9tIFwiLi9pY2FsXCI7XHJcbmltcG9ydCB7IEljYWxTZXJ2aWNlIH0gZnJvbSBcIi4vc2VydmljZXMvaWNhbFNlcnZpY2VcIjtcclxuaW1wb3J0IHsgQ2FsZW5kYXJFdmVudCwgQ2FsZW5kYXJTZXR0aW5ncywgQ2FsZW5kYXJTb3VyY2UgfSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuY29uc3QgVklFV19UWVBFX0NBTEVOREFSID0gXCJvYnNpZGlhbi1jYWxlbmRhci12aWV3XCI7XHJcblxyXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBDYWxlbmRhclNldHRpbmdzID0ge1xyXG4gIHNvdXJjZXM6IFtdLFxyXG4gIHdlZWtTdGFydDogXCJzdW5kYXlcIixcclxuICB0aW1lRm9ybWF0OiBcIjI0aFwiLFxyXG4gIGxhbmd1YWdlOiBcImVuXCIsXHJcbiAgcmVmcmVzaEludGVydmFsTWludXRlczogMzAsXHJcbiAgdG9kYXlIaWdobGlnaHQ6IFwiIzI5YTVjN1wiLFxyXG4gIHNlbGVjdGVkSGlnaGxpZ2h0OiBcIiM1NGRmMjZcIixcclxuICBub3RlRGF0ZUZpZWxkczogW1wiZGF0ZVwiXSxcclxuICBhbGxvd0NyZWF0ZU5vdGU6IHRydWUsXHJcbiAgbm90ZVRlbXBsYXRlUGF0aDogXCJcIixcclxuICBub3RlQmFyQ29sb3I6IFwiI2VhNjQwYlwiXHJcbn07XHJcblxyXG5jb25zdCBUUkFOU0xBVElPTlM6IFJlY29yZDxzdHJpbmcsIFJlY29yZDxzdHJpbmcsIHN0cmluZz4+ID0ge1xyXG4gIGVuOiB7XHJcbiAgICB0b2RheTogXCJUb2RheVwiLFxyXG4gICAgcmVmcmVzaDogXCJSZWZyZXNoXCIsXHJcbiAgICBjcmVhdGVOb3RlOiBcIkNyZWF0ZSBub3RlXCIsXHJcbiAgICBldmVudHM6IFwiRXZlbnRzXCIsXHJcbiAgICBub3RlczogXCJOb3Rlc1wiLFxyXG4gICAgYWxsRGF5OiBcIkFsbCBkYXlcIixcclxuICAgIG5vTm90ZXNPckV2ZW50czogXCJObyBub3RlcyBvciBldmVudHNcIixcclxuICAgIHN1bjogXCJTdW5cIixcclxuICAgIG1vbjogXCJNb25cIixcclxuICAgIHR1ZTogXCJUdWVcIixcclxuICAgIHdlZDogXCJXZWRcIixcclxuICAgIHRodTogXCJUaHVcIixcclxuICAgIGZyaTogXCJGcmlcIixcclxuICAgIHNhdDogXCJTYXRcIlxyXG4gIH0sXHJcbiAgemg6IHtcclxuICAgIHRvZGF5OiBcIlx1NEVDQVx1NTkyOVwiLFxyXG4gICAgcmVmcmVzaDogXCJcdTUyMzdcdTY1QjBcIixcclxuICAgIGNyZWF0ZU5vdGU6IFwiXHU2NUIwXHU1RUZBXHU3QjE0XHU4QkIwXCIsXHJcbiAgICBldmVudHM6IFwiXHU2NUU1XHU3QTBCXCIsXHJcbiAgICBub3RlczogXCJcdTdCMTRcdThCQjBcIixcclxuICAgIGFsbERheTogXCJcdTUxNjhcdTU5MjlcIixcclxuICAgIG5vTm90ZXNPckV2ZW50czogXCJcdTY2ODJcdTY1RTBcdTdCMTRcdThCQjBcdTYyMTZcdTY1RTVcdTdBMEJcIixcclxuICAgIHN1bjogXCJcdTU0NjhcdTY1RTVcIixcclxuICAgIG1vbjogXCJcdTU0NjhcdTRFMDBcIixcclxuICAgIHR1ZTogXCJcdTU0NjhcdTRFOENcIixcclxuICAgIHdlZDogXCJcdTU0NjhcdTRFMDlcIixcclxuICAgIHRodTogXCJcdTU0NjhcdTU2REJcIixcclxuICAgIGZyaTogXCJcdTU0NjhcdTRFOTRcIixcclxuICAgIHNhdDogXCJcdTU0NjhcdTUxNkRcIlxyXG4gIH1cclxufTtcclxuXHJcbmNvbnN0IHQgPSAoa2V5OiBzdHJpbmcsIGxhbmc6IFwiZW5cIiB8IFwiemhcIik6IHN0cmluZyA9PiB7XHJcbiAgcmV0dXJuIFRSQU5TTEFUSU9OU1tsYW5nXT8uW2tleV0gPz8gVFJBTlNMQVRJT05TLmVuW2tleV0gPz8ga2V5O1xyXG59O1xyXG5cclxuY29uc3QgV0VFS0RBWV9MQUJFTFMgPSBbXCJTdW5cIiwgXCJNb25cIiwgXCJUdWVcIiwgXCJXZWRcIiwgXCJUaHVcIiwgXCJGcmlcIiwgXCJTYXRcIl07XHJcblxyXG5jb25zdCByZXNvbHZlSGlnaGxpZ2h0VmFsdWUgPSAodmFsdWU6IHN0cmluZywgZmFsbGJhY2tWYXI6IHN0cmluZykgPT4ge1xyXG4gIGNvbnN0IHRyaW1tZWQgPSB2YWx1ZS50cmltKCk7XHJcbiAgaWYgKCF0cmltbWVkKSB7XHJcbiAgICByZXR1cm4gZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5KS5nZXRQcm9wZXJ0eVZhbHVlKGZhbGxiYWNrVmFyKS50cmltKCk7XHJcbiAgfVxyXG4gIGlmICh0cmltbWVkLnN0YXJ0c1dpdGgoXCItLVwiKSkge1xyXG4gICAgY29uc3QgcmVzb2x2ZWQgPSBnZXRDb21wdXRlZFN0eWxlKGRvY3VtZW50LmJvZHkpLmdldFByb3BlcnR5VmFsdWUodHJpbW1lZCkudHJpbSgpO1xyXG4gICAgcmV0dXJuIHJlc29sdmVkIHx8IHRyaW1tZWQ7XHJcbiAgfVxyXG4gIHJldHVybiB0cmltbWVkO1xyXG59O1xyXG5cclxuY29uc3Qgbm9ybWFsaXplUGF0aFNsYXNoZXMgPSAodmFsdWU6IHN0cmluZykgPT4gdmFsdWUucmVwbGFjZSgvXFxcXC9nLCBcIi9cIik7XHJcblxyXG5jb25zdCBERUZBVUxUX1NPVVJDRV9DT0xPUlMgPSBbXHJcbiAgXCIjZTc0YzNjXCIsIC8vIHJlZFxyXG4gIFwiIzM0OThkYlwiLCAvLyBibHVlXHJcbiAgXCIjMmVjYzcxXCIsIC8vIGdyZWVuXHJcbiAgXCIjZjM5YzEyXCIsIC8vIG9yYW5nZVxyXG4gIFwiIzliNTliNlwiLCAvLyBwdXJwbGVcclxuICBcIiMxYWJjOWNcIiwgLy8gdHVycXVvaXNlXHJcbiAgXCIjZTY3ZTIyXCIsIC8vIGNhcnJvdFxyXG4gIFwiIzM0NDk1ZVwiICAvLyBkYXJrIGdyYXlcclxuXTtcclxuXHJcbmNvbnN0IGdldERlZmF1bHRTb3VyY2VDb2xvciA9IChpbmRleDogbnVtYmVyKTogc3RyaW5nID0+IHtcclxuICByZXR1cm4gREVGQVVMVF9TT1VSQ0VfQ09MT1JTW2luZGV4ICUgREVGQVVMVF9TT1VSQ0VfQ09MT1JTLmxlbmd0aF07XHJcbn07XHJcblxyXG50eXBlIExpbmtlZE5vdGUgPSB7XHJcbiAgZmlsZTogVEZpbGU7XHJcbiAgdGl0bGU6IHN0cmluZztcclxuICBleGNlcnB0OiBzdHJpbmc7XHJcbn07XHJcblxyXG5jb25zdCBmb3JtYXREYXRlS2V5ID0gKGRhdGU6IERhdGUpID0+IHtcclxuICBjb25zdCB5ZWFyID0gZGF0ZS5nZXRGdWxsWWVhcigpO1xyXG4gIGNvbnN0IG1vbnRoID0gU3RyaW5nKGRhdGUuZ2V0TW9udGgoKSArIDEpLnBhZFN0YXJ0KDIsIFwiMFwiKTtcclxuICBjb25zdCBkYXkgPSBTdHJpbmcoZGF0ZS5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsIFwiMFwiKTtcclxuICByZXR1cm4gYCR7eWVhcn0tJHttb250aH0tJHtkYXl9YDtcclxufTtcclxuXHJcbmNvbnN0IHBhcnNlRnJvbnRtYXR0ZXJEYXRlID0gKHZhbHVlOiB1bmtub3duKTogRGF0ZSB8IG51bGwgPT4ge1xyXG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERhdGUgJiYgIU51bWJlci5pc05hTih2YWx1ZS5nZXRUaW1lKCkpKSB7XHJcbiAgICByZXR1cm4gdmFsdWU7XHJcbiAgfVxyXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpIHtcclxuICAgIGNvbnN0IHRyaW1tZWQgPSB2YWx1ZS50cmltKCk7XHJcbiAgICBpZiAoIXRyaW1tZWQpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgICBjb25zdCBwYXJzZWQgPSBuZXcgRGF0ZSh0cmltbWVkKTtcclxuICAgIGlmICghTnVtYmVyLmlzTmFOKHBhcnNlZC5nZXRUaW1lKCkpKSB7XHJcbiAgICAgIHJldHVybiBwYXJzZWQ7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiBudWxsO1xyXG59O1xyXG5cclxuY29uc3QgZXh0cmFjdEZyb250bWF0dGVyRGF0ZXMgPSAodmFsdWU6IHVua25vd24pOiBEYXRlW10gPT4ge1xyXG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xyXG4gICAgcmV0dXJuIHZhbHVlXHJcbiAgICAgIC5tYXAoKGl0ZW0pID0+IHBhcnNlRnJvbnRtYXR0ZXJEYXRlKGl0ZW0pKVxyXG4gICAgICAuZmlsdGVyKChpdGVtKTogaXRlbSBpcyBEYXRlID0+IGl0ZW0gIT09IG51bGwpO1xyXG4gIH1cclxuICBjb25zdCBzaW5nbGUgPSBwYXJzZUZyb250bWF0dGVyRGF0ZSh2YWx1ZSk7XHJcbiAgcmV0dXJuIHNpbmdsZSA/IFtzaW5nbGVdIDogW107XHJcbn07XHJcblxyXG5jb25zdCBzdGFydE9mTW9udGggPSAoZGF0ZTogRGF0ZSkgPT4gbmV3IERhdGUoZGF0ZS5nZXRGdWxsWWVhcigpLCBkYXRlLmdldE1vbnRoKCksIDEpO1xyXG5jb25zdCBlbmRPZk1vbnRoID0gKGRhdGU6IERhdGUpID0+IG5ldyBEYXRlKGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpICsgMSwgMCk7XHJcblxyXG5jb25zdCBhZGREYXlzID0gKGRhdGU6IERhdGUsIGRheXM6IG51bWJlcikgPT5cclxuICBuZXcgRGF0ZShkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCkgKyBkYXlzKTtcclxuXHJcbmNvbnN0IGlzU2FtZURheSA9IChhOiBEYXRlLCBiOiBEYXRlKSA9PlxyXG4gIGEuZ2V0RnVsbFllYXIoKSA9PT0gYi5nZXRGdWxsWWVhcigpICYmXHJcbiAgYS5nZXRNb250aCgpID09PSBiLmdldE1vbnRoKCkgJiZcclxuICBhLmdldERhdGUoKSA9PT0gYi5nZXREYXRlKCk7XHJcblxyXG5jb25zdCBmb3JtYXRUaW1lID0gKGRhdGU6IERhdGUsIGZvcm1hdDogQ2FsZW5kYXJTZXR0aW5nc1tcInRpbWVGb3JtYXRcIl0pID0+IHtcclxuICBpZiAoZm9ybWF0ID09PSBcIjI0aFwiKSB7XHJcbiAgICByZXR1cm4gZGF0ZS50b0xvY2FsZVRpbWVTdHJpbmcoW10sIHsgaG91cjogXCIyLWRpZ2l0XCIsIG1pbnV0ZTogXCIyLWRpZ2l0XCIsIGhvdXIxMjogZmFsc2UgfSk7XHJcbiAgfVxyXG4gIHJldHVybiBkYXRlLnRvTG9jYWxlVGltZVN0cmluZyhbXSwgeyBob3VyOiBcIm51bWVyaWNcIiwgbWludXRlOiBcIjItZGlnaXRcIiwgaG91cjEyOiB0cnVlIH0pO1xyXG59O1xyXG5cclxuY29uc3QgY2xhbXBUb0RheVN0YXJ0ID0gKGRhdGU6IERhdGUpID0+IG5ldyBEYXRlKGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpLCBkYXRlLmdldERhdGUoKSk7XHJcblxyXG5jb25zdCBjbGFtcFRvRGF5RW5kID0gKGRhdGU6IERhdGUpID0+XHJcbiAgbmV3IERhdGUoZGF0ZS5nZXRGdWxsWWVhcigpLCBkYXRlLmdldE1vbnRoKCksIGRhdGUuZ2V0RGF0ZSgpLCAyMywgNTksIDU5LCA5OTkpO1xyXG5cclxuY29uc3QgY3JlYXRlU291cmNlSWQgPSAoKSA9PiB7XHJcbiAgaWYgKHR5cGVvZiBjcnlwdG8gIT09IFwidW5kZWZpbmVkXCIgJiYgXCJyYW5kb21VVUlEXCIgaW4gY3J5cHRvKSB7XHJcbiAgICByZXR1cm4gY3J5cHRvLnJhbmRvbVVVSUQoKTtcclxuICB9XHJcbiAgcmV0dXJuIGBzcmMtJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMTYpLnNsaWNlKDIpfWA7XHJcbn07XHJcblxyXG5jbGFzcyBDYWxlbmRhclZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XHJcbiAgcHJpdmF0ZSBwbHVnaW46IENhbGVuZGFyUGx1Z2luO1xyXG4gIHByaXZhdGUgc2VsZWN0ZWREYXRlID0gbmV3IERhdGUoKTtcclxuICBwcml2YXRlIHZpc2libGVNb250aCA9IG5ldyBEYXRlKCk7XHJcbiAgcHJpdmF0ZSBldmVudHM6IENhbGVuZGFyRXZlbnRbXSA9IFtdO1xyXG4gIHByaXZhdGUgaGVhZGVyVGl0bGU/OiBIVE1MRWxlbWVudDtcclxuICBwcml2YXRlIGxlZ2VuZEVsPzogSFRNTEVsZW1lbnQ7XHJcbiAgcHJpdmF0ZSBncmlkRWw/OiBIVE1MRWxlbWVudDtcclxuICBwcml2YXRlIG5hdkVsPzogSFRNTEVsZW1lbnQ7XHJcbiAgcHJpdmF0ZSBkZXRhaWxzRWw/OiBIVE1MRWxlbWVudDtcclxuICBwcml2YXRlIG5vdGVzQnlEYXRlID0gbmV3IE1hcDxzdHJpbmcsIExpbmtlZE5vdGVbXT4oKTtcclxuICBwcml2YXRlIG5vdGVFeGNlcnB0Q2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xyXG4gIHByaXZhdGUgbWF4Tm90ZXNGb3JHcmlkID0gMTtcclxuICBwcml2YXRlIGhvdmVyUHJldmlld0VsPzogSFRNTEVsZW1lbnQ7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHBsdWdpbjogQ2FsZW5kYXJQbHVnaW4pIHtcclxuICAgIHN1cGVyKGxlYWYpO1xyXG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XHJcbiAgfVxyXG5cclxuICBnZXRWaWV3VHlwZSgpIHtcclxuICAgIHJldHVybiBWSUVXX1RZUEVfQ0FMRU5EQVI7XHJcbiAgfVxyXG5cclxuICBnZXREaXNwbGF5VGV4dCgpIHtcclxuICAgIHJldHVybiBcIkNhbGVuZGFyXCI7XHJcbiAgfVxyXG5cclxuICBnZXRJY29uKCkge1xyXG4gICAgcmV0dXJuIFwiY2FsZW5kYXJcIjtcclxuICB9XHJcblxyXG4gIGFzeW5jIG9uT3BlbigpIHtcclxuICAgIHRoaXMuY29udGFpbmVyRWwuZW1wdHkoKTtcclxuICAgIHRoaXMuY29udGFpbmVyRWwuYWRkQ2xhc3MoXCJvYnNpZGlhbi1jYWxlbmRhclwiKTtcclxuICAgIHRoaXMuYnVpbGRMYXlvdXQoKTtcclxuICAgIHRoaXMuZW5zdXJlSG92ZXJQcmV2aWV3KCk7XHJcbiAgICB0aGlzLnJlbmRlcigpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgb25DbG9zZSgpIHtcclxuICAgIHRoaXMuaG92ZXJQcmV2aWV3RWw/LnJlbW92ZSgpO1xyXG4gICAgdGhpcy5ob3ZlclByZXZpZXdFbCA9IHVuZGVmaW5lZDtcclxuICAgIHJldHVybjtcclxuICB9XHJcblxyXG4gIHNldEV2ZW50cyhldmVudHM6IENhbGVuZGFyRXZlbnRbXSkge1xyXG4gICAgdGhpcy5ldmVudHMgPSBldmVudHM7XHJcbiAgICB0aGlzLnJlbmRlcigpO1xyXG4gIH1cclxuXHJcbiAganVtcFRvVG9kYXkoKSB7XHJcbiAgICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCk7XHJcbiAgICB0aGlzLnNlbGVjdGVkRGF0ZSA9IHRvZGF5O1xyXG4gICAgdGhpcy52aXNpYmxlTW9udGggPSBuZXcgRGF0ZSh0b2RheS5nZXRGdWxsWWVhcigpLCB0b2RheS5nZXRNb250aCgpLCAxKTtcclxuICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGJ1aWxkTGF5b3V0KCkge1xyXG4gICAgY29uc3QgaGVhZGVyID0gdGhpcy5jb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2hlYWRlclwiIH0pO1xyXG5cclxuICAgIHRoaXMuaGVhZGVyVGl0bGUgPSBoZWFkZXIuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX190aXRsZVwiIH0pO1xyXG5cclxuICAgIHRoaXMubGVnZW5kRWwgPSBoZWFkZXIuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19sZWdlbmRcIiB9KTtcclxuXHJcbiAgICBjb25zdCBib2R5ID0gdGhpcy5jb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2JvZHlcIiB9KTtcclxuICAgIHRoaXMuZ3JpZEVsID0gYm9keS5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2dyaWRcIiB9KTtcclxuXHJcbiAgICB0aGlzLm5hdkVsID0gYm9keS5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX25hdlwiIH0pO1xyXG5cclxuICAgIHRoaXMuZGV0YWlsc0VsID0gYm9keS5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2RldGFpbHNcIiB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVuZGVyTmF2KCkge1xyXG4gICAgaWYgKCF0aGlzLm5hdkVsKSByZXR1cm47XHJcblxyXG4gICAgdGhpcy5uYXZFbC5lbXB0eSgpO1xyXG4gICAgY29uc3QgbGFuZyA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmxhbmd1YWdlO1xyXG5cclxuICAgIC8vIFx1NURFNlx1NEZBN1x1RkYxQVx1NEUwQVx1NEUwMFx1OTg3NVxyXG4gICAgY29uc3QgbGVmdEdyb3VwID0gdGhpcy5uYXZFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX25hdi1sZWZ0XCIgfSk7XHJcbiAgICBjb25zdCBwcmV2QnRuID0gbGVmdEdyb3VwLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdTIxOTBcIiB9KTtcclxuXHJcbiAgICAvLyBcdTRFMkRcdTk1RjRcdUZGMUFcdTRFQ0FcdTU5MjlcdTU0OENcdTUyMzdcdTY1QjBcclxuICAgIGNvbnN0IGNlbnRlckdyb3VwID0gdGhpcy5uYXZFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX25hdi1jZW50ZXJcIiB9KTtcclxuICAgIGNvbnN0IHRvZGF5QnRuID0gY2VudGVyR3JvdXAuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiB0KFwidG9kYXlcIiwgbGFuZykgfSk7XHJcbiAgICBjb25zdCByZWZyZXNoQnRuID0gY2VudGVyR3JvdXAuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiB0KFwicmVmcmVzaFwiLCBsYW5nKSB9KTtcclxuXHJcbiAgICAvLyBcdTUzRjNcdTRGQTdcdUZGMUFcdTRFMEJcdTRFMDBcdTk4NzVcclxuICAgIGNvbnN0IHJpZ2h0R3JvdXAgPSB0aGlzLm5hdkVsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fbmF2LXJpZ2h0XCIgfSk7XHJcbiAgICBjb25zdCBuZXh0QnRuID0gcmlnaHRHcm91cC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHUyMTkyXCIgfSk7XHJcblxyXG4gICAgcHJldkJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICB0aGlzLnZpc2libGVNb250aCA9IG5ldyBEYXRlKHRoaXMudmlzaWJsZU1vbnRoLmdldEZ1bGxZZWFyKCksIHRoaXMudmlzaWJsZU1vbnRoLmdldE1vbnRoKCkgLSAxLCAxKTtcclxuICAgICAgdGhpcy5yZW5kZXIoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIG5leHRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgdGhpcy52aXNpYmxlTW9udGggPSBuZXcgRGF0ZSh0aGlzLnZpc2libGVNb250aC5nZXRGdWxsWWVhcigpLCB0aGlzLnZpc2libGVNb250aC5nZXRNb250aCgpICsgMSwgMSk7XHJcbiAgICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0b2RheUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICB0aGlzLmp1bXBUb1RvZGF5KCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICByZWZyZXNoQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgIHRoaXMucGx1Z2luLnJlZnJlc2hFdmVudHModHJ1ZSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVuZGVyKCkge1xyXG4gICAgaWYgKCF0aGlzLmdyaWRFbCB8fCAhdGhpcy5kZXRhaWxzRWwgfHwgIXRoaXMuaGVhZGVyVGl0bGUpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuZ3JpZEVsLmVtcHR5KCk7XHJcbiAgICB0aGlzLmRldGFpbHNFbC5lbXB0eSgpO1xyXG5cclxuICAgIHRoaXMudXBkYXRlTGVnZW5kKCk7XHJcbiAgICB0aGlzLnJlbmRlck5hdigpO1xyXG5cclxuICAgIGNvbnN0IGxhbmcgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5sYW5ndWFnZTtcclxuXHJcbiAgICBjb25zdCBtb250aFN0YXJ0ID0gc3RhcnRPZk1vbnRoKHRoaXMudmlzaWJsZU1vbnRoKTtcclxuICAgIGNvbnN0IG1vbnRoRW5kID0gZW5kT2ZNb250aCh0aGlzLnZpc2libGVNb250aCk7XHJcbiAgICBjb25zdCBzdGFydFdlZWtkYXkgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy53ZWVrU3RhcnQgPT09IFwibW9uZGF5XCIgPyAxIDogMDtcclxuICAgIGNvbnN0IG9mZnNldCA9IChtb250aFN0YXJ0LmdldERheSgpIC0gc3RhcnRXZWVrZGF5ICsgNykgJSA3O1xyXG4gICAgY29uc3QgZ3JpZFN0YXJ0ID0gYWRkRGF5cyhtb250aFN0YXJ0LCAtb2Zmc2V0KTtcclxuICAgIC8vIFx1NTZGQVx1NUI5QVx1NjYzRVx1NzkzQTZcdTg4NENcdUZGMDg0Mlx1NTkyOVx1RkYwOVxyXG4gICAgY29uc3QgZ3JpZEVuZCA9IGFkZERheXMoZ3JpZFN0YXJ0LCA0MSk7XHJcblxyXG4gICAgdGhpcy5ub3Rlc0J5RGF0ZSA9IHRoaXMuYnVpbGROb3Rlc0luZGV4KGdyaWRTdGFydCwgZ3JpZEVuZCk7XHJcbiAgICB0aGlzLm1heE5vdGVzRm9yR3JpZCA9IHRoaXMuZ2V0TWF4Tm90ZXNDb3VudCgpO1xyXG5cclxuICAgIHRoaXMuaGVhZGVyVGl0bGUuc2V0VGV4dChcclxuICAgICAgbW9udGhTdGFydC50b0xvY2FsZURhdGVTdHJpbmcobGFuZyA9PT0gXCJ6aFwiID8gXCJ6aC1DTlwiIDogXCJlbi1VU1wiLCB7IHllYXI6IFwibnVtZXJpY1wiLCBtb250aDogXCJsb25nXCIgfSlcclxuICAgICk7XHJcblxyXG4gICAgY29uc3Qgd2Vla2RheVJvdyA9IHRoaXMuZ3JpZEVsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fd2Vla2RheXNcIiB9KTtcclxuICAgIC8vIFx1NEY3Rlx1NzUyOFx1N0ZGQlx1OEJEMVx1NzY4NFx1NjYxRlx1NjcxRlx1NTQwRFx1NzlGMFxyXG4gICAgY29uc3Qgd2Vla2RheUtleXMgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy53ZWVrU3RhcnQgPT09IFwibW9uZGF5XCJcclxuICAgICAgPyBbXCJtb25cIiwgXCJ0dWVcIiwgXCJ3ZWRcIiwgXCJ0aHVcIiwgXCJmcmlcIiwgXCJzYXRcIiwgXCJzdW5cIl1cclxuICAgICAgOiBbXCJzdW5cIiwgXCJtb25cIiwgXCJ0dWVcIiwgXCJ3ZWRcIiwgXCJ0aHVcIiwgXCJmcmlcIiwgXCJzYXRcIl07XHJcblxyXG4gICAgZm9yIChjb25zdCBrZXkgb2Ygd2Vla2RheUtleXMpIHtcclxuICAgICAgd2Vla2RheVJvdy5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX3dlZWtkYXlcIiwgdGV4dDogdChrZXksIGxhbmcpIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGRheXNHcmlkID0gdGhpcy5ncmlkRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19kYXlzXCIgfSk7XHJcbiAgICBsZXQgY3Vyc29yID0gbmV3IERhdGUoZ3JpZFN0YXJ0KTtcclxuICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcclxuXHJcbiAgICB3aGlsZSAoY3Vyc29yIDw9IGdyaWRFbmQpIHtcclxuICAgICAgY29uc3QgY2VsbERhdGUgPSBuZXcgRGF0ZShjdXJzb3IpO1xyXG4gICAgICBjb25zdCBjZWxsID0gZGF5c0dyaWQuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2RheVwiIH0pO1xyXG4gICAgICBjZWxsLnNldEF0dHIoXCJ0eXBlXCIsIFwiYnV0dG9uXCIpO1xyXG5cclxuICAgICAgaWYgKGNlbGxEYXRlLmdldE1vbnRoKCkgIT09IHRoaXMudmlzaWJsZU1vbnRoLmdldE1vbnRoKCkpIHtcclxuICAgICAgICBjZWxsLmFkZENsYXNzKFwiaXMtb3V0c2lkZVwiKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAoaXNTYW1lRGF5KGNlbGxEYXRlLCB0b2RheSkpIHtcclxuICAgICAgICBjZWxsLmFkZENsYXNzKFwiaXMtdG9kYXlcIik7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGlzU2FtZURheShjZWxsRGF0ZSwgdGhpcy5zZWxlY3RlZERhdGUpKSB7XHJcbiAgICAgICAgY2VsbC5hZGRDbGFzcyhcImlzLXNlbGVjdGVkXCIpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBudW1iZXJFbCA9IGNlbGwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19kYXktbnVtYmVyXCIgfSk7XHJcbiAgICAgIG51bWJlckVsLnNldFRleHQoU3RyaW5nKGNlbGxEYXRlLmdldERhdGUoKSkpO1xyXG5cclxuICAgICAgY29uc3Qgc3VidGl0bGVDb250YWluZXIgPSBjZWxsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZGF5LXN1YnRpdGxlc1wiIH0pO1xyXG4gICAgICBjb25zdCBub3Rlc0ZvckRheSA9IHRoaXMuZ2V0Tm90ZXNGb3JEYXkoY2VsbERhdGUpO1xyXG4gICAgICBjb25zdCBkYXlFdmVudHMgPSB0aGlzLmdldEV2ZW50c0ZvckRheShjZWxsRGF0ZSk7XHJcblxyXG4gICAgICAvLyBcdTY2M0VcdTc5M0FcdTY1RTVcdTdBMEJcdUZGMDhcdTRGN0ZcdTc1MjhcdTZFOTBcdTk4OUNcdTgyNzJcdUZGMDlcclxuICAgICAgaWYgKGRheUV2ZW50cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgY29uc3Qgc291cmNlID0gdGhpcy5wbHVnaW4uc2V0dGluZ3Muc291cmNlcy5maW5kKHMgPT4gcy5pZCA9PT0gZGF5RXZlbnRzWzBdLnNvdXJjZUlkKTtcclxuICAgICAgICBjb25zdCBjb2xvciA9IHNvdXJjZT8uY29sb3IgfHwgZ2V0RGVmYXVsdFNvdXJjZUNvbG9yKDApO1xyXG4gICAgICAgIG51bWJlckVsLnN0eWxlLmNvbG9yID0gY29sb3I7XHJcblxyXG4gICAgICAgIGNvbnN0IGV2ZW50TGluZSA9IHN1YnRpdGxlQ29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZGF5LXN1YnRpdGxlIG9ic2lkaWFuLWNhbGVuZGFyX19kYXktZXZlbnRcIiB9KTtcclxuICAgICAgICBldmVudExpbmUuc3R5bGUuY29sb3IgPSBjb2xvcjtcclxuICAgICAgICBldmVudExpbmUuc2V0VGV4dChkYXlFdmVudHNbMF0uc3VtbWFyeSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIFx1NjYzRVx1NzkzQVx1N0IxNFx1OEJCMFx1RkYwOFx1NEZERFx1NjMwMVx1OUVEOFx1OEJBNFx1OTg5Q1x1ODI3Mlx1RkYwOVxyXG4gICAgICBpZiAobm90ZXNGb3JEYXkubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IG5vdGVMaW5lID0gc3VidGl0bGVDb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19kYXktc3VidGl0bGUgb2JzaWRpYW4tY2FsZW5kYXJfX2RheS1ub3RlXCIgfSk7XHJcbiAgICAgICAgbm90ZUxpbmUuc2V0VGV4dChub3Rlc0ZvckRheVswXS50aXRsZSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IGluZGljYXRvciA9IGNlbGwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19kYXktaW5kaWNhdG9yXCIgfSk7XHJcbiAgICAgIGlmIChub3Rlc0ZvckRheS5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgY29uc3QgcmF0aW8gPSBNYXRoLm1pbihub3Rlc0ZvckRheS5sZW5ndGggLyB0aGlzLm1heE5vdGVzRm9yR3JpZCwgMSk7XHJcbiAgICAgICAgY29uc3Qgd2lkdGggPSBNYXRoLm1heCgwLjI1LCByYXRpbykgKiAxMDA7XHJcbiAgICAgICAgY29uc3QgYmFyID0gaW5kaWNhdG9yLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZGF5LWJhclwiIH0pO1xyXG4gICAgICAgIGJhci5zdHlsZS53aWR0aCA9IGAke3dpZHRofSVgO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjZWxsLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWVudGVyXCIsICgpID0+IHtcclxuICAgICAgICB0aGlzLnNob3dIb3ZlclByZXZpZXcoY2VsbCwgbm90ZXNGb3JEYXkpO1xyXG4gICAgICB9KTtcclxuICAgICAgY2VsbC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VsZWF2ZVwiLCAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5oaWRlSG92ZXJQcmV2aWV3KCk7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgY2VsbC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuc2VsZWN0ZWREYXRlID0gY2VsbERhdGU7XHJcbiAgICAgICAgaWYgKGNlbGxEYXRlLmdldE1vbnRoKCkgIT09IHRoaXMudmlzaWJsZU1vbnRoLmdldE1vbnRoKCkpIHtcclxuICAgICAgICAgIHRoaXMudmlzaWJsZU1vbnRoID0gbmV3IERhdGUoY2VsbERhdGUuZ2V0RnVsbFllYXIoKSwgY2VsbERhdGUuZ2V0TW9udGgoKSwgMSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgY3Vyc29yID0gYWRkRGF5cyhjdXJzb3IsIDEpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMucmVuZGVyRGV0YWlscygpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB1cGRhdGVMZWdlbmQoKSB7XHJcbiAgICBpZiAoIXRoaXMubGVnZW5kRWwpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMubGVnZW5kRWwuZW1wdHkoKTtcclxuXHJcbiAgICBjb25zdCBlbmFibGVkU291cmNlcyA9IHRoaXMucGx1Z2luLnNldHRpbmdzLnNvdXJjZXMuZmlsdGVyKHMgPT4gcy5lbmFibGVkICYmIHMubmFtZSk7XHJcbiAgICBpZiAoZW5hYmxlZFNvdXJjZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiBlbmFibGVkU291cmNlcykge1xyXG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5sZWdlbmRFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2xlZ2VuZC1pdGVtXCIgfSk7XHJcbiAgICAgIGNvbnN0IGRvdCA9IGl0ZW0uY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19sZWdlbmQtZG90XCIgfSk7XHJcbiAgICAgIGRvdC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBzb3VyY2UuY29sb3I7XHJcbiAgICAgIGl0ZW0uY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19sZWdlbmQtbGFiZWxcIiwgdGV4dDogc291cmNlLm5hbWUgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbmRlckRldGFpbHMoKSB7XHJcbiAgICBpZiAoIXRoaXMuZGV0YWlsc0VsKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHRoaXMuZGV0YWlsc0VsLmVtcHR5KCk7XHJcblxyXG4gICAgY29uc3QgbGFuZyA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmxhbmd1YWdlO1xyXG5cclxuICAgIGNvbnN0IHRpdGxlID0gdGhpcy5kZXRhaWxzRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzLXRpdGxlXCIgfSk7XHJcbiAgICB0aXRsZS5zZXRUZXh0KFxyXG4gICAgICB0aGlzLnNlbGVjdGVkRGF0ZS50b0xvY2FsZURhdGVTdHJpbmcobGFuZyA9PT0gXCJ6aFwiID8gXCJ6aC1DTlwiIDogXCJlbi1VU1wiLCB7IG1vbnRoOiBcImxvbmdcIiwgZGF5OiBcIm51bWVyaWNcIiwgeWVhcjogXCJudW1lcmljXCIgfSlcclxuICAgICk7XHJcblxyXG4gICAgY29uc3Qgbm90ZXMgPSB0aGlzLmdldE5vdGVzRm9yRGF5KHRoaXMuc2VsZWN0ZWREYXRlKTtcclxuICAgIGNvbnN0IGV2ZW50cyA9IHRoaXMuZ2V0RXZlbnRzRm9yRGF5KHRoaXMuc2VsZWN0ZWREYXRlKTtcclxuXHJcbiAgICBpZiAoZXZlbnRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgY29uc3QgZXZlbnRzU2VjdGlvbiA9IHRoaXMuZGV0YWlsc0VsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fc2VjdGlvblwiIH0pO1xyXG4gICAgICBldmVudHNTZWN0aW9uLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fc2VjdGlvbi10aXRsZVwiLCB0ZXh0OiB0KFwiZXZlbnRzXCIsIGxhbmcpIH0pO1xyXG4gICAgICBjb25zdCBldmVudHNMaXN0ID0gZXZlbnRzU2VjdGlvbi5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2V2ZW50LWxpc3RcIiB9KTtcclxuICAgICAgZm9yIChjb25zdCBldmVudCBvZiBldmVudHMpIHtcclxuICAgICAgICBjb25zdCByb3cgPSBldmVudHNMaXN0LmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZXZlbnQtcm93XCIgfSk7XHJcblxyXG4gICAgICAgIC8vIEZpbmQgc291cmNlIGNvbG9yXHJcbiAgICAgICAgY29uc3Qgc291cmNlID0gdGhpcy5wbHVnaW4uc2V0dGluZ3Muc291cmNlcy5maW5kKHMgPT4gcy5pZCA9PT0gZXZlbnQuc291cmNlSWQpO1xyXG4gICAgICAgIGNvbnN0IGNvbG9yID0gc291cmNlPy5jb2xvciB8fCBnZXREZWZhdWx0U291cmNlQ29sb3IoMCk7XHJcbiAgICAgICAgcm93LnN0eWxlLmJvcmRlckxlZnQgPSBgM3B4IHNvbGlkICR7Y29sb3J9YDtcclxuXHJcbiAgICAgICAgcm93LmNyZWF0ZURpdih7XHJcbiAgICAgICAgICBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2V2ZW50LXRpbWVcIixcclxuICAgICAgICAgIHRleHQ6IGV2ZW50LmFsbERheSA/IHQoXCJhbGxEYXlcIiwgbGFuZykgOiBmb3JtYXRUaW1lKGV2ZW50LnN0YXJ0LCB0aGlzLnBsdWdpbi5zZXR0aW5ncy50aW1lRm9ybWF0KVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJvdy5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2V2ZW50LXN1bW1hcnlcIiwgdGV4dDogZXZlbnQuc3VtbWFyeSB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChub3Rlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGNvbnN0IG5vdGVzU2VjdGlvbiA9IHRoaXMuZGV0YWlsc0VsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fc2VjdGlvblwiIH0pO1xyXG4gICAgICBub3Rlc1NlY3Rpb24uY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19zZWN0aW9uLXRpdGxlXCIsIHRleHQ6IHQoXCJub3Rlc1wiLCBsYW5nKSB9KTtcclxuICAgICAgY29uc3Qgbm90ZXNMaXN0ID0gbm90ZXNTZWN0aW9uLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fbm90ZXMtbGlzdFwiIH0pO1xyXG4gICAgICBmb3IgKGNvbnN0IG5vdGUgb2Ygbm90ZXMpIHtcclxuICAgICAgICBjb25zdCByb3cgPSBub3Rlc0xpc3QuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtcm93XCIgfSk7XHJcbiAgICAgICAgcm93LnNldEF0dHIoXCJ0eXBlXCIsIFwiYnV0dG9uXCIpO1xyXG4gICAgICAgIHJvdy5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtdGl0bGVcIiwgdGV4dDogbm90ZS50aXRsZSB9KTtcclxuICAgICAgICBjb25zdCBleGNlcnB0RWwgPSByb3cuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLWV4Y2VycHRcIiwgdGV4dDogbm90ZS5leGNlcnB0IH0pO1xyXG4gICAgICAgIHRoaXMuZW5zdXJlRXhjZXJwdChub3RlLmZpbGUsIGV4Y2VycHRFbCk7XHJcbiAgICAgICAgcm93LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB0aGlzLm9wZW5Ob3RlKG5vdGUuZmlsZSkpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG5vdGVzLmxlbmd0aCA9PT0gMCAmJiBldmVudHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIHRoaXMuZGV0YWlsc0VsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlscy1lbXB0eVwiLCB0ZXh0OiB0KFwibm9Ob3Rlc09yRXZlbnRzXCIsIGxhbmcpIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hbGxvd0NyZWF0ZU5vdGUpIHtcclxuICAgICAgY29uc3QgYWN0aW9uID0gdGhpcy5kZXRhaWxzRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzLWFjdGlvblwiIH0pO1xyXG4gICAgICBjb25zdCBidXR0b24gPSBhY3Rpb24uY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiB0KFwiY3JlYXRlTm90ZVwiLCBsYW5nKSB9KTtcclxuICAgICAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IHRoaXMucGx1Z2luLmNyZWF0ZU5vdGVGb3JEYXRlKHRoaXMuc2VsZWN0ZWREYXRlKTtcclxuICAgICAgICBpZiAoZmlsZSkge1xyXG4gICAgICAgICAgdGhpcy5vcGVuTm90ZShmaWxlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRFdmVudHNGb3JEYXkoZGF5OiBEYXRlKSB7XHJcbiAgICBjb25zdCBzdGFydCA9IGNsYW1wVG9EYXlTdGFydChkYXkpO1xyXG4gICAgY29uc3QgZW5kID0gY2xhbXBUb0RheUVuZChkYXkpO1xyXG4gICAgcmV0dXJuIHRoaXMuZXZlbnRzXHJcbiAgICAgIC5maWx0ZXIoKGV2ZW50KSA9PiBldmVudC5zdGFydCA8PSBlbmQgJiYgZXZlbnQuZW5kID49IHN0YXJ0KVxyXG4gICAgICAuc29ydCgoYSwgYikgPT4gYS5zdGFydC5nZXRUaW1lKCkgLSBiLnN0YXJ0LmdldFRpbWUoKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGJ1aWxkTm90ZXNJbmRleChzdGFydDogRGF0ZSwgZW5kOiBEYXRlKSB7XHJcbiAgICBjb25zdCBpbmRleCA9IG5ldyBNYXA8c3RyaW5nLCBMaW5rZWROb3RlW10+KCk7XHJcbiAgICBjb25zdCBzdGFydERheSA9IGNsYW1wVG9EYXlTdGFydChzdGFydCk7XHJcbiAgICBjb25zdCBlbmREYXkgPSBjbGFtcFRvRGF5RW5kKGVuZCk7XHJcbiAgICBjb25zdCBmaWVsZHMgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5ub3RlRGF0ZUZpZWxkc1xyXG4gICAgICAubWFwKChmaWVsZCkgPT4gZmllbGQudHJpbSgpKVxyXG4gICAgICAuZmlsdGVyKChmaWVsZCkgPT4gZmllbGQubGVuZ3RoID4gMCk7XHJcblxyXG4gICAgaWYgKGZpZWxkcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgcmV0dXJuIGluZGV4O1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZpbGVzID0gdGhpcy5wbHVnaW4uYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcclxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xyXG4gICAgICBjb25zdCBjYWNoZSA9IHRoaXMucGx1Z2luLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcclxuICAgICAgaWYgKCFjYWNoZT8uZnJvbnRtYXR0ZXIpIHtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgZm9yIChjb25zdCBmaWVsZCBvZiBmaWVsZHMpIHtcclxuICAgICAgICBjb25zdCByYXdWYWx1ZSA9IGNhY2hlLmZyb250bWF0dGVyW2ZpZWxkXTtcclxuICAgICAgICBpZiAoIXJhd1ZhbHVlKSB7XHJcbiAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgZGF0ZXMgPSBleHRyYWN0RnJvbnRtYXR0ZXJEYXRlcyhyYXdWYWx1ZSk7XHJcbiAgICAgICAgZm9yIChjb25zdCBkYXRlIG9mIGRhdGVzKSB7XHJcbiAgICAgICAgICBpZiAoZGF0ZSA8IHN0YXJ0RGF5IHx8IGRhdGUgPiBlbmREYXkpIHtcclxuICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBjb25zdCBrZXkgPSBmb3JtYXREYXRlS2V5KGRhdGUpO1xyXG4gICAgICAgICAgY29uc3QgbGlzdCA9IGluZGV4LmdldChrZXkpID8/IFtdO1xyXG4gICAgICAgICAgaWYgKCFsaXN0LnNvbWUoKG5vdGUpID0+IG5vdGUuZmlsZS5wYXRoID09PSBmaWxlLnBhdGgpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRpdGxlID0gZmlsZS5iYXNlbmFtZTtcclxuICAgICAgICAgICAgbGlzdC5wdXNoKHtcclxuICAgICAgICAgICAgICBmaWxlLFxyXG4gICAgICAgICAgICAgIHRpdGxlLFxyXG4gICAgICAgICAgICAgIGV4Y2VycHQ6IHRoaXMubm90ZUV4Y2VycHRDYWNoZS5nZXQoZmlsZS5wYXRoKSA/PyBcIlwiXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBpbmRleC5zZXQoa2V5LCBsaXN0KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmb3IgKGNvbnN0IFtrZXksIGxpc3RdIG9mIGluZGV4LmVudHJpZXMoKSkge1xyXG4gICAgICBsaXN0LnNvcnQoKGEsIGIpID0+IGEudGl0bGUubG9jYWxlQ29tcGFyZShiLnRpdGxlKSk7XHJcbiAgICAgIGluZGV4LnNldChrZXksIGxpc3QpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBpbmRleDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0Tm90ZXNGb3JEYXkoZGF5OiBEYXRlKSB7XHJcbiAgICByZXR1cm4gdGhpcy5ub3Rlc0J5RGF0ZS5nZXQoZm9ybWF0RGF0ZUtleShkYXkpKSA/PyBbXTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0TWF4Tm90ZXNDb3VudCgpIHtcclxuICAgIGxldCBtYXhDb3VudCA9IDE7XHJcbiAgICBmb3IgKGNvbnN0IGxpc3Qgb2YgdGhpcy5ub3Rlc0J5RGF0ZS52YWx1ZXMoKSkge1xyXG4gICAgICBpZiAobGlzdC5sZW5ndGggPiBtYXhDb3VudCkge1xyXG4gICAgICAgIG1heENvdW50ID0gbGlzdC5sZW5ndGg7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBtYXhDb3VudDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZW5zdXJlSG92ZXJQcmV2aWV3KCkge1xyXG4gICAgaWYgKHRoaXMuaG92ZXJQcmV2aWV3RWwpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5ob3ZlclByZXZpZXdFbCA9IGRvY3VtZW50LmJvZHkuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXByZXZpZXdcIiB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2hvd0hvdmVyUHJldmlldyhhbmNob3I6IEhUTUxFbGVtZW50LCBub3RlczogTGlua2VkTm90ZVtdKSB7XHJcbiAgICBpZiAoIXRoaXMuaG92ZXJQcmV2aWV3RWwgfHwgbm90ZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmhvdmVyUHJldmlld0VsLmVtcHR5KCk7XHJcbiAgICBmb3IgKGNvbnN0IG5vdGUgb2Ygbm90ZXMuc2xpY2UoMCwgMykpIHtcclxuICAgICAgY29uc3Qgcm93ID0gdGhpcy5ob3ZlclByZXZpZXdFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtcHJldmlldy1yb3dcIiB9KTtcclxuICAgICAgcm93LmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1wcmV2aWV3LXRpdGxlXCIsIHRleHQ6IG5vdGUudGl0bGUgfSk7XHJcbiAgICAgIGNvbnN0IGV4Y2VycHRFbCA9IHJvdy5jcmVhdGVEaXYoe1xyXG4gICAgICAgIGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1wcmV2aWV3LWV4Y2VycHRcIixcclxuICAgICAgICB0ZXh0OiBub3RlLmV4Y2VycHRcclxuICAgICAgfSk7XHJcbiAgICAgIHRoaXMuZW5zdXJlRXhjZXJwdChub3RlLmZpbGUsIGV4Y2VycHRFbCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5ob3ZlclByZXZpZXdFbC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xyXG5cclxuICAgIGNvbnN0IHJlY3QgPSBhbmNob3IuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICBjb25zdCBwcmV2aWV3V2lkdGggPSAyMjA7XHJcbiAgICBjb25zdCBwcmV2aWV3SGVpZ2h0ID0gdGhpcy5ob3ZlclByZXZpZXdFbC5vZmZzZXRIZWlnaHQgfHwgODA7XHJcbiAgICBjb25zdCBwYWRkaW5nID0gODtcclxuICAgIGNvbnN0IHZpZXdwb3J0V2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aDtcclxuICAgIGNvbnN0IHZpZXdwb3J0SGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xyXG5cclxuICAgIGxldCBsZWZ0ID0gcmVjdC5sZWZ0ICsgcmVjdC53aWR0aCAvIDIgLSBwcmV2aWV3V2lkdGggLyAyO1xyXG4gICAgbGVmdCA9IE1hdGgubWF4KHBhZGRpbmcsIE1hdGgubWluKGxlZnQsIHZpZXdwb3J0V2lkdGggLSBwcmV2aWV3V2lkdGggLSBwYWRkaW5nKSk7XHJcblxyXG4gICAgbGV0IHRvcCA9IHJlY3QuYm90dG9tICsgNjtcclxuICAgIGlmICh0b3AgKyBwcmV2aWV3SGVpZ2h0ID4gdmlld3BvcnRIZWlnaHQgLSBwYWRkaW5nKSB7XHJcbiAgICAgIHRvcCA9IHJlY3QudG9wIC0gcHJldmlld0hlaWdodCAtIDY7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5ob3ZlclByZXZpZXdFbC5zdHlsZS53aWR0aCA9IGAke3ByZXZpZXdXaWR0aH1weGA7XHJcbiAgICB0aGlzLmhvdmVyUHJldmlld0VsLnN0eWxlLmxlZnQgPSBgJHtsZWZ0fXB4YDtcclxuICAgIHRoaXMuaG92ZXJQcmV2aWV3RWwuc3R5bGUudG9wID0gYCR7TWF0aC5tYXgocGFkZGluZywgdG9wKX1weGA7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhpZGVIb3ZlclByZXZpZXcoKSB7XHJcbiAgICBpZiAodGhpcy5ob3ZlclByZXZpZXdFbCkge1xyXG4gICAgICB0aGlzLmhvdmVyUHJldmlld0VsLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZW5zdXJlRXhjZXJwdChmaWxlOiBURmlsZSwgdGFyZ2V0RWw6IEhUTUxFbGVtZW50KSB7XHJcbiAgICBpZiAodGhpcy5ub3RlRXhjZXJwdENhY2hlLmhhcyhmaWxlLnBhdGgpKSB7XHJcbiAgICAgIHRhcmdldEVsLnNldFRleHQodGhpcy5ub3RlRXhjZXJwdENhY2hlLmdldChmaWxlLnBhdGgpID8/IFwiXCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLnBsdWdpbi5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKS50aGVuKChjb250ZW50KSA9PiB7XHJcbiAgICAgIGNvbnN0IGxpbmVzID0gY29udGVudC5zcGxpdChcIlxcblwiKTtcclxuICAgICAgbGV0IHN0YXJ0SW5kZXggPSAwO1xyXG4gICAgICBpZiAobGluZXNbMF0/LnRyaW0oKSA9PT0gXCItLS1cIikge1xyXG4gICAgICAgIGNvbnN0IGVuZEluZGV4ID0gbGluZXMuc2xpY2UoMSkuZmluZEluZGV4KChsaW5lKSA9PiBsaW5lLnRyaW0oKSA9PT0gXCItLS1cIik7XHJcbiAgICAgICAgaWYgKGVuZEluZGV4ID49IDApIHtcclxuICAgICAgICAgIHN0YXJ0SW5kZXggPSBlbmRJbmRleCArIDI7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IGZpcnN0TGluZSA9IGxpbmVzLnNsaWNlKHN0YXJ0SW5kZXgpLmZpbmQoKGxpbmUpID0+IGxpbmUudHJpbSgpLmxlbmd0aCA+IDApID8/IFwiXCI7XHJcbiAgICAgIGNvbnN0IGV4Y2VycHQgPSBmaXJzdExpbmUucmVwbGFjZSgvXiNcXHMrLywgXCJcIikudHJpbSgpO1xyXG4gICAgICB0aGlzLm5vdGVFeGNlcnB0Q2FjaGUuc2V0KGZpbGUucGF0aCwgZXhjZXJwdCk7XHJcbiAgICAgIHRhcmdldEVsLnNldFRleHQoZXhjZXJwdCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgb3Blbk5vdGUoZmlsZTogVEZpbGUpIHtcclxuICAgIGNvbnN0IGxlYWYgPSB0aGlzLnBsdWdpbi5hcHAud29ya3NwYWNlLmdldExlYWYoZmFsc2UpO1xyXG4gICAgY29uc3QgY2FjaGUgPSB0aGlzLnBsdWdpbi5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XHJcbiAgICBjb25zdCBsaW5lID0gY2FjaGU/LmZyb250bWF0dGVyUG9zaXRpb24/LmVuZD8ubGluZSA/PyAwO1xyXG4gICAgYXdhaXQgbGVhZi5vcGVuRmlsZShmaWxlLCB7IHN0YXRlOiB7IGxpbmUgfSwgYWN0aXZlOiB0cnVlIH0pO1xyXG4gIH1cclxufVxyXG5cclxuY2xhc3MgQ2FsZW5kYXJTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XHJcbiAgcHJpdmF0ZSBwbHVnaW46IENhbGVuZGFyUGx1Z2luO1xyXG4gIHByaXZhdGUgc2VsZWN0ZWRUZW1wbGF0ZUZvbGRlciA9IFwiXCI7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IENhbGVuZGFyUGx1Z2luKSB7XHJcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XHJcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICB9XHJcblxyXG4gIGRpc3BsYXkoKTogdm9pZCB7XHJcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xyXG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcclxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIkNhbGVuZGFyXCIgfSk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiUmVmcmVzaCBpbnRlcnZhbCAobWludXRlcylcIilcclxuICAgICAgLnNldERlc2MoXCJIb3cgb2Z0ZW4gY2FsZW5kYXIgc291cmNlcyBhcmUgcmVmcmVzaGVkLlwiKVxyXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cclxuICAgICAgICB0ZXh0XHJcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCIzMFwiKVxyXG4gICAgICAgICAgLnNldFZhbHVlKFN0cmluZyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5yZWZyZXNoSW50ZXJ2YWxNaW51dGVzKSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gTnVtYmVyKHZhbHVlKTtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MucmVmcmVzaEludGVydmFsTWludXRlcyA9IE51bWJlci5pc0Zpbml0ZShwYXJzZWQpICYmIHBhcnNlZCA+IDBcclxuICAgICAgICAgICAgICA/IHBhcnNlZFxyXG4gICAgICAgICAgICAgIDogREVGQVVMVF9TRVRUSU5HUy5yZWZyZXNoSW50ZXJ2YWxNaW51dGVzO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVmcmVzaEV2ZW50cyh0cnVlKTtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVzdGFydEF1dG9SZWZyZXNoKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIkxhbmd1YWdlXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiRGlzcGxheSBsYW5ndWFnZSBmb3IgdGhlIGNhbGVuZGFyIGludGVyZmFjZS5cIilcclxuICAgICAgLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT5cclxuICAgICAgICBkcm9wZG93blxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcImVuXCIsIFwiRW5nbGlzaFwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcInpoXCIsIFwiXHU0RTJEXHU2NTg3XCIpXHJcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MubGFuZ3VhZ2UpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlOiBDYWxlbmRhclNldHRpbmdzW1wibGFuZ3VhZ2VcIl0pID0+IHtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MubGFuZ3VhZ2UgPSB2YWx1ZTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnJlbmRlclZpZXdzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIldlZWsgc3RhcnRzIG9uXCIpXHJcbiAgICAgIC5hZGREcm9wZG93bigoZHJvcGRvd24pID0+XHJcbiAgICAgICAgZHJvcGRvd25cclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJzdW5kYXlcIiwgXCJTdW5kYXlcIilcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJtb25kYXlcIiwgXCJNb25kYXlcIilcclxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy53ZWVrU3RhcnQpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlOiBDYWxlbmRhclNldHRpbmdzW1wid2Vla1N0YXJ0XCJdKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLndlZWtTdGFydCA9IHZhbHVlO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVuZGVyVmlld3MoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiVGltZSBmb3JtYXRcIilcclxuICAgICAgLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT5cclxuICAgICAgICBkcm9wZG93blxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcIjI0aFwiLCBcIjI0LWhvdXJcIilcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCIxMmhcIiwgXCIxMi1ob3VyXCIpXHJcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MudGltZUZvcm1hdClcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWU6IENhbGVuZGFyU2V0dGluZ3NbXCJ0aW1lRm9ybWF0XCJdKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnRpbWVGb3JtYXQgPSB2YWx1ZTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnJlbmRlclZpZXdzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlRvZGF5IGhpZ2hsaWdodFwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkhpZ2hsaWdodCBjb2xvciBmb3IgdG9kYXkuXCIpXHJcbiAgICAgIC5hZGRDb2xvclBpY2tlcigocGlja2VyKSA9PlxyXG4gICAgICAgIHBpY2tlclxyXG4gICAgICAgICAgLnNldFZhbHVlKHJlc29sdmVIaWdobGlnaHRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy50b2RheUhpZ2hsaWdodCwgXCItLWludGVyYWN0aXZlLWFjY2VudFwiKSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MudG9kYXlIaWdobGlnaHQgPSB2YWx1ZTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmFwcGx5SGlnaGxpZ2h0VmFyaWFibGVzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlNlbGVjdGVkIGRhdGUgaGlnaGxpZ2h0XCIpXHJcbiAgICAgIC5zZXREZXNjKFwiSGlnaGxpZ2h0IGNvbG9yIGZvciB0aGUgc2VsZWN0ZWQgZGF0ZS5cIilcclxuICAgICAgLmFkZENvbG9yUGlja2VyKChwaWNrZXIpID0+XHJcbiAgICAgICAgcGlja2VyXHJcbiAgICAgICAgICAuc2V0VmFsdWUocmVzb2x2ZUhpZ2hsaWdodFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNlbGVjdGVkSGlnaGxpZ2h0LCBcIi0tdGV4dC1hY2NlbnRcIikpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnNlbGVjdGVkSGlnaGxpZ2h0ID0gdmFsdWU7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5hcHBseUhpZ2hsaWdodFZhcmlhYmxlcygpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJOb3RlIGRhdGUgZmllbGRzXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiQ29tbWEtc2VwYXJhdGVkIGZyb250bWF0dGVyIGZpZWxkcyB1c2VkIHRvIGxpbmsgbm90ZXMgdG8gZGF0ZXMuXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHRcclxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcImRhdGUsIHN0YXJ0LCBlbmRcIilcclxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5ub3RlRGF0ZUZpZWxkcy5qb2luKFwiLCBcIikpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVEYXRlRmllbGRzID0gdmFsdWVcclxuICAgICAgICAgICAgICAuc3BsaXQoXCIsXCIpXHJcbiAgICAgICAgICAgICAgLm1hcCgoZmllbGQpID0+IGZpZWxkLnRyaW0oKSlcclxuICAgICAgICAgICAgICAuZmlsdGVyKChmaWVsZCkgPT4gZmllbGQubGVuZ3RoID4gMCk7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5yZW5kZXJWaWV3cygpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJBbGxvdyBjcmVhdGUgbm90ZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlNob3cgYSBxdWljayBhY3Rpb24gdG8gY3JlYXRlIGEgbm90ZSBmb3IgdGhlIHNlbGVjdGVkIGRhdGUuXCIpXHJcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cclxuICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWxsb3dDcmVhdGVOb3RlKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmFsbG93Q3JlYXRlTm90ZSA9IHZhbHVlO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICB0aGlzLnBsdWdpbi5yZW5kZXJWaWV3cygpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiTm90ZSBkZW5zaXR5IGJhciBjb2xvclwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkNvbG9yIGZvciB0aGUgbm90ZSBkZW5zaXR5IGluZGljYXRvciBiYXIuXCIpXHJcbiAgICAgIC5hZGRDb2xvclBpY2tlcigocGlja2VyKSA9PlxyXG4gICAgICAgIHBpY2tlclxyXG4gICAgICAgICAgLnNldFZhbHVlKHJlc29sdmVIaWdobGlnaHRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5ub3RlQmFyQ29sb3IsIFwiLS10ZXh0LWFjY2VudFwiKSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZUJhckNvbG9yID0gdmFsdWU7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5hcHBseUhpZ2hsaWdodFZhcmlhYmxlcygpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBjb25zdCB0ZW1wbGF0ZVNldHRpbmcgPSBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJOb3RlIHRlbXBsYXRlXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiQ2hvb3NlIGEgdmF1bHQgdGVtcGxhdGUgZmlsZS5cIik7XHJcblxyXG4gICAgY29uc3QgdGVtcGxhdGVIaW50ID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19zZXR0aW5nLWhpbnRcIiB9KTtcclxuXHJcbiAgICBjb25zdCB1cGRhdGVUZW1wbGF0ZUhpbnQgPSAod2FybmluZyA9IFwiXCIpID0+IHtcclxuICAgICAgaWYgKHdhcm5pbmcpIHtcclxuICAgICAgICB0ZW1wbGF0ZUhpbnQuc2V0VGV4dCh3YXJuaW5nKTtcclxuICAgICAgICB0ZW1wbGF0ZUhpbnQuYWRkQ2xhc3MoXCJpcy1lcnJvclwiKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgcGF0aCA9IHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVUZW1wbGF0ZVBhdGgudHJpbSgpO1xyXG4gICAgICBpZiAoIXBhdGgpIHtcclxuICAgICAgICB0ZW1wbGF0ZUhpbnQuc2V0VGV4dChcIk5vIHRlbXBsYXRlIHNlbGVjdGVkLlwiKTtcclxuICAgICAgICB0ZW1wbGF0ZUhpbnQucmVtb3ZlQ2xhc3MoXCJpcy1lcnJvclwiKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgZmlsZSA9IHRoaXMucGx1Z2luLmdldFRlbXBsYXRlRmlsZShwYXRoKTtcclxuICAgICAgaWYgKGZpbGUpIHtcclxuICAgICAgICB0ZW1wbGF0ZUhpbnQuc2V0VGV4dChgVGVtcGxhdGU6ICR7ZmlsZS5wYXRofWApO1xyXG4gICAgICAgIHRlbXBsYXRlSGludC5yZW1vdmVDbGFzcyhcImlzLWVycm9yXCIpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICB0ZW1wbGF0ZUhpbnQuc2V0VGV4dChcIlRlbXBsYXRlIG5vdCBmb3VuZCBpbiB0aGlzIHZhdWx0LlwiKTtcclxuICAgICAgdGVtcGxhdGVIaW50LmFkZENsYXNzKFwiaXMtZXJyb3JcIik7XHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IGN1cnJlbnRQYXRoID0gdGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZVRlbXBsYXRlUGF0aDtcclxuICAgIGNvbnN0IGN1cnJlbnRGb2xkZXIgPSBjdXJyZW50UGF0aCA/IGN1cnJlbnRQYXRoLnNwbGl0KFwiL1wiKS5zbGljZSgwLCAtMSkuam9pbihcIi9cIikgOiBcIlwiO1xyXG4gICAgaWYgKCF0aGlzLnNlbGVjdGVkVGVtcGxhdGVGb2xkZXIpIHtcclxuICAgICAgdGhpcy5zZWxlY3RlZFRlbXBsYXRlRm9sZGVyID0gY3VycmVudEZvbGRlcjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmb2xkZXJPcHRpb25zID0gdGhpcy5wbHVnaW4uZ2V0VGVtcGxhdGVGb2xkZXJPcHRpb25zKCk7XHJcbiAgICB0ZW1wbGF0ZVNldHRpbmcuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XHJcbiAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihcIlwiLCBcIkFsbCBmb2xkZXJzXCIpO1xyXG4gICAgICBmb3IgKGNvbnN0IGZvbGRlciBvZiBmb2xkZXJPcHRpb25zKSB7XHJcbiAgICAgICAgZHJvcGRvd24uYWRkT3B0aW9uKGZvbGRlciwgZm9sZGVyIHx8IFwiKHJvb3QpXCIpO1xyXG4gICAgICB9XHJcbiAgICAgIGRyb3Bkb3duLnNldFZhbHVlKHRoaXMuc2VsZWN0ZWRUZW1wbGF0ZUZvbGRlcik7XHJcbiAgICAgIGRyb3Bkb3duLm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xyXG4gICAgICAgIHRoaXMuc2VsZWN0ZWRUZW1wbGF0ZUZvbGRlciA9IHZhbHVlO1xyXG4gICAgICAgIHRoaXMuZGlzcGxheSgpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHRlbXBsYXRlT3B0aW9ucyA9IHRoaXMucGx1Z2luLmdldFRlbXBsYXRlT3B0aW9ucyh0aGlzLnNlbGVjdGVkVGVtcGxhdGVGb2xkZXIpO1xyXG4gICAgdGVtcGxhdGVTZXR0aW5nLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT4ge1xyXG4gICAgICBkcm9wZG93bi5hZGRPcHRpb24oXCJcIiwgXCJOb25lXCIpO1xyXG4gICAgICBmb3IgKGNvbnN0IG9wdGlvbiBvZiB0ZW1wbGF0ZU9wdGlvbnMpIHtcclxuICAgICAgICBkcm9wZG93bi5hZGRPcHRpb24ob3B0aW9uLnBhdGgsIG9wdGlvbi5sYWJlbCk7XHJcbiAgICAgIH1cclxuICAgICAgZHJvcGRvd24uc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZVRlbXBsYXRlUGF0aCk7XHJcbiAgICAgIGRyb3Bkb3duLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVUZW1wbGF0ZVBhdGggPSB2YWx1ZTtcclxuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB1cGRhdGVUZW1wbGF0ZUhpbnQoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB1cGRhdGVUZW1wbGF0ZUhpbnQoKTtcclxuXHJcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogXCJDYWxlbmRhciBzb3VyY2VzXCIgfSk7XHJcblxyXG4gICAgZm9yIChjb25zdCBzb3VyY2Ugb2YgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc291cmNlcykge1xyXG4gICAgICBjb25zdCBzb3VyY2VTZXR0aW5nID0gbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUoc291cmNlLm5hbWUgfHwgXCJVbm5hbWVkXCIpXHJcbiAgICAgICAgLnNldERlc2MoXCJFbmFibGVkIHNvdXJjZXMgYXJlIGZldGNoZWQgYW5kIG1lcmdlZC5cIik7XHJcblxyXG4gICAgICBzb3VyY2VTZXR0aW5nLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgIHRvZ2dsZVxyXG4gICAgICAgICAgLnNldFZhbHVlKHNvdXJjZS5lbmFibGVkKVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICBzb3VyY2UuZW5hYmxlZCA9IHZhbHVlO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVmcmVzaEV2ZW50cyh0cnVlKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgICBzb3VyY2VTZXR0aW5nLmFkZEJ1dHRvbigoYnV0dG9uKSA9PlxyXG4gICAgICAgIGJ1dHRvblxyXG4gICAgICAgICAgLnNldEJ1dHRvblRleHQoXCJSZW1vdmVcIilcclxuICAgICAgICAgIC5zZXRDdGEoKVxyXG4gICAgICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zb3VyY2VzID0gdGhpcy5wbHVnaW4uc2V0dGluZ3Muc291cmNlcy5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0uaWQgIT09IHNvdXJjZS5pZCk7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5yZWZyZXNoRXZlbnRzKHRydWUpO1xyXG4gICAgICAgICAgICB0aGlzLmRpc3BsYXkoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIk5hbWVcIilcclxuICAgICAgICAuYWRkVGV4dCgodGV4dCkgPT5cclxuICAgICAgICAgIHRleHRcclxuICAgICAgICAgICAgLnNldFZhbHVlKHNvdXJjZS5uYW1lKVxyXG4gICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgc291cmNlLm5hbWUgPSB2YWx1ZTtcclxuICAgICAgICAgICAgICBzb3VyY2VTZXR0aW5nLnNldE5hbWUoc291cmNlLm5hbWUudHJpbSgpIHx8IFwiVW5uYW1lZFwiKTtcclxuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUoXCJpQ2FsIFVSTFwiKVxyXG4gICAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgICAgdGV4dFxyXG4gICAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJodHRwczovL2NhbGVuZGFyLmdvb2dsZS5jb20vY2FsZW5kYXIvaWNhbC8uLi5cIilcclxuICAgICAgICAgICAgLnNldFZhbHVlKHNvdXJjZS51cmwpXHJcbiAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICBzb3VyY2UudXJsID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnJlZnJlc2hFdmVudHModHJ1ZSk7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgIC5zZXROYW1lKFwiQ29sb3JcIilcclxuICAgICAgICAuc2V0RGVzYyhcIkV2ZW50IGNvbG9yIGZvciB0aGlzIHNvdXJjZS5cIilcclxuICAgICAgICAuYWRkQ29sb3JQaWNrZXIoKHBpY2tlcikgPT5cclxuICAgICAgICAgIHBpY2tlclxyXG4gICAgICAgICAgICAuc2V0VmFsdWUoc291cmNlLmNvbG9yKVxyXG4gICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgc291cmNlLmNvbG9yID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVuZGVyVmlld3MoKTtcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIkFkZCBjYWxlbmRhciBzb3VyY2VcIilcclxuICAgICAgLnNldERlc2MoXCJBZGQgYW5vdGhlciBpQ2FsIChJQ1MpIHNvdXJjZS5cIilcclxuICAgICAgLmFkZEJ1dHRvbigoYnV0dG9uKSA9PlxyXG4gICAgICAgIGJ1dHRvblxyXG4gICAgICAgICAgLnNldEJ1dHRvblRleHQoXCJBZGRcIilcclxuICAgICAgICAgIC5vbkNsaWNrKGFzeW5jICgpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgbmV3SW5kZXggPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zb3VyY2VzLmxlbmd0aDtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc291cmNlcy5wdXNoKHtcclxuICAgICAgICAgICAgICBpZDogY3JlYXRlU291cmNlSWQoKSxcclxuICAgICAgICAgICAgICBuYW1lOiBcIlwiLFxyXG4gICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgdXJsOiBcIlwiLFxyXG4gICAgICAgICAgICAgIGNvbG9yOiBnZXREZWZhdWx0U291cmNlQ29sb3IobmV3SW5kZXgpXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgdGhpcy5kaXNwbGF5KCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ2FsZW5kYXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xyXG4gIHNldHRpbmdzOiBDYWxlbmRhclNldHRpbmdzID0gREVGQVVMVF9TRVRUSU5HUztcclxuICBwcml2YXRlIHNlcnZpY2UgPSBuZXcgSWNhbFNlcnZpY2UocGFyc2VJY2FsKTtcclxuICBwcml2YXRlIGV2ZW50czogQ2FsZW5kYXJFdmVudFtdID0gW107XHJcbiAgcHJpdmF0ZSByZWZyZXNoSGFuZGxlPzogbnVtYmVyO1xyXG5cclxuICBhc3luYyBvbmxvYWQoKSB7XHJcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBDYWxlbmRhclNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcclxuXHJcbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhWSUVXX1RZUEVfQ0FMRU5EQVIsIChsZWFmKSA9PiBuZXcgQ2FsZW5kYXJWaWV3KGxlYWYsIHRoaXMpKTtcclxuICAgIHRoaXMucmVnaXN0ZXJDb21tYW5kcygpO1xyXG4gICAgdGhpcy5yZWdpc3RlclN0eWxlcygpO1xyXG5cclxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KGFzeW5jICgpID0+IHtcclxuICAgICAgYXdhaXQgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcclxuICAgICAgLy8gXHU3ODZFXHU0RkREXHU4OUM2XHU1NkZFXHU2RkMwXHU2RDNCXHU1NDBFXHU3QUNCXHU1MzczXHU1MjM3XHU2NUIwXHU2NTcwXHU2MzZFXHJcbiAgICAgIGF3YWl0IHRoaXMucmVmcmVzaEV2ZW50cygpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5zdGFydEF1dG9SZWZyZXNoKCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBvbnVubG9hZCgpIHtcclxuICAgIGlmICh0aGlzLnJlZnJlc2hIYW5kbGUpIHtcclxuICAgICAgd2luZG93LmNsZWFySW50ZXJ2YWwodGhpcy5yZWZyZXNoSGFuZGxlKTtcclxuICAgIH1cclxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoVklFV19UWVBFX0NBTEVOREFSKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGFjdGl2YXRlVmlldygpIHtcclxuICAgIC8vIFx1NjhDMFx1NjdFNVx1NjYyRlx1NTQyNlx1NURGMlx1N0VDRlx1NUI1OFx1NTcyOCBjYWxlbmRhciBcdTg5QzZcdTU2RkVcclxuICAgIGNvbnN0IGV4aXN0aW5nTGVhdmVzID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfQ0FMRU5EQVIpO1xyXG4gICAgaWYgKGV4aXN0aW5nTGVhdmVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgLy8gXHU1OTgyXHU2NzlDXHU1REYyXHU1QjU4XHU1NzI4XHVGRjBDXHU1M0VBXHU5NzAwXHU2RkMwXHU2RDNCXHU3QjJDXHU0RTAwXHU0RTJBXHJcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGV4aXN0aW5nTGVhdmVzWzBdKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFx1NTk4Mlx1Njc5Q1x1NEUwRFx1NUI1OFx1NTcyOFx1RkYwQ1x1NTIxQlx1NUVGQVx1NjVCMFx1NzY4NFxyXG4gICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRSaWdodExlYWYoZmFsc2UpID8/IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKGZhbHNlKTtcclxuICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHsgdHlwZTogVklFV19UWVBFX0NBTEVOREFSLCBhY3RpdmU6IHRydWUgfSk7XHJcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcclxuICAgIHRoaXMuYXBwbHlIaWdobGlnaHRWYXJpYWJsZXMoKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIHJlZnJlc2hFdmVudHMoZm9yY2VSZWZyZXNoID0gZmFsc2UpIHtcclxuICAgIHRoaXMuZXZlbnRzID0gYXdhaXQgdGhpcy5zZXJ2aWNlLmdldEV2ZW50cyhcclxuICAgICAgdGhpcy5zZXR0aW5ncy5zb3VyY2VzLFxyXG4gICAgICB0aGlzLnNldHRpbmdzLnJlZnJlc2hJbnRlcnZhbE1pbnV0ZXMsXHJcbiAgICAgIGZvcmNlUmVmcmVzaFxyXG4gICAgKTtcclxuICAgIHRoaXMucmVuZGVyVmlld3MoKTtcclxuICB9XHJcblxyXG4gIHJlbmRlclZpZXdzKCkge1xyXG4gICAgY29uc3QgbGVhdmVzID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfQ0FMRU5EQVIpO1xyXG4gICAgZm9yIChjb25zdCBsZWFmIG9mIGxlYXZlcykge1xyXG4gICAgICBjb25zdCB2aWV3ID0gbGVhZi52aWV3O1xyXG4gICAgICBpZiAodmlldyBpbnN0YW5jZW9mIENhbGVuZGFyVmlldykge1xyXG4gICAgICAgIHZpZXcuc2V0RXZlbnRzKHRoaXMuZXZlbnRzKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmVzdGFydEF1dG9SZWZyZXNoKCkge1xyXG4gICAgaWYgKHRoaXMucmVmcmVzaEhhbmRsZSkge1xyXG4gICAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLnJlZnJlc2hIYW5kbGUpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5zdGFydEF1dG9SZWZyZXNoKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXJ0QXV0b1JlZnJlc2goKSB7XHJcbiAgICBjb25zdCBpbnRlcnZhbE1zID0gTWF0aC5tYXgodGhpcy5zZXR0aW5ncy5yZWZyZXNoSW50ZXJ2YWxNaW51dGVzLCAxKSAqIDYwICogMTAwMDtcclxuICAgIHRoaXMucmVmcmVzaEhhbmRsZSA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XHJcbiAgICAgIHRoaXMucmVmcmVzaEV2ZW50cygpO1xyXG4gICAgfSwgaW50ZXJ2YWxNcyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlZ2lzdGVyQ29tbWFuZHMoKSB7XHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJjYWxlbmRhci1vcGVuXCIsXHJcbiAgICAgIG5hbWU6IFwiT3BlbiBjYWxlbmRhclwiLFxyXG4gICAgICBjYWxsYmFjazogKCkgPT4gdGhpcy5hY3RpdmF0ZVZpZXcoKVxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwiY2FsZW5kYXItdG9kYXlcIixcclxuICAgICAgbmFtZTogXCJKdW1wIHRvIHRvZGF5XCIsXHJcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgbGVhdmVzID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfQ0FMRU5EQVIpO1xyXG4gICAgICAgIGZvciAoY29uc3QgbGVhZiBvZiBsZWF2ZXMpIHtcclxuICAgICAgICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXc7XHJcbiAgICAgICAgICBpZiAodmlldyBpbnN0YW5jZW9mIENhbGVuZGFyVmlldykge1xyXG4gICAgICAgICAgICB2aWV3Lmp1bXBUb1RvZGF5KCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJjYWxlbmRhci1yZWZyZXNoXCIsXHJcbiAgICAgIG5hbWU6IFwiUmVmcmVzaCBjYWxlbmRhclwiLFxyXG4gICAgICBjYWxsYmFjazogKCkgPT4gdGhpcy5yZWZyZXNoRXZlbnRzKHRydWUpXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVnaXN0ZXJTdHlsZXMoKSB7XHJcbiAgICBjb25zdCBzdHlsZUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpO1xyXG4gICAgc3R5bGVFbC50ZXh0Q29udGVudCA9IGBcclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyIHtcclxuICAgICAgICBoZWlnaHQ6IDEwMCU7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW5vcm1hbCk7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmFja2dyb3VuZC1wcmltYXJ5KTtcclxuICAgICAgICAtLWNhbGVuZGFyLXRvZGF5LWFjY2VudDogdmFyKC0taW50ZXJhY3RpdmUtYWNjZW50KTtcclxuICAgICAgICAtLWNhbGVuZGFyLXNlbGVjdGVkLWFjY2VudDogdmFyKC0taW50ZXJhY3RpdmUtYWNjZW50KTtcclxuICAgICAgICAtLWNhbGVuZGFyLW5vdGUtYmFyLWNvbG9yOiAjNWViOGQ1O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9faGVhZGVyIHtcclxuICAgICAgICBwYWRkaW5nOiAxNnB4IDIwcHg7XHJcbiAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItYm9yZGVyKTtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgICAgZ2FwOiAxMHB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbmF2IHtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcclxuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICAgIHBhZGRpbmc6IDEycHggMDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25hdi1sZWZ0LFxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25hdi1yaWdodCB7XHJcbiAgICAgICAgZmxleDogMCAwIGF1dG87XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19uYXYtY2VudGVyIHtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGdhcDogMTZweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25hdiBidXR0b24ge1xyXG4gICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICAgIGJvcmRlcjogbm9uZTtcclxuICAgICAgICBwYWRkaW5nOiA2cHggMTJweDtcclxuICAgICAgICBib3JkZXItcmFkaXVzOiAwO1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxuICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICAgIHRyYW5zaXRpb246IGNvbG9yIDAuMTVzIGVhc2U7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19uYXYgYnV0dG9uOmhvdmVyIHtcclxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1ub3JtYWwpO1xyXG4gICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fdGl0bGUge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTdweDtcclxuICAgICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICAgIGxldHRlci1zcGFjaW5nOiAtMC4wMWVtO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbGVnZW5kIHtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtd3JhcDogd3JhcDtcclxuICAgICAgICBnYXA6IDEycHg7XHJcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2xlZ2VuZC1pdGVtIHtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgICAgZ2FwOiA2cHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19sZWdlbmQtZG90IHtcclxuICAgICAgICB3aWR0aDogMTBweDtcclxuICAgICAgICBoZWlnaHQ6IDEwcHg7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNTAlO1xyXG4gICAgICAgIGZsZXgtc2hyaW5rOiAwO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbGVnZW5kLWxhYmVsIHtcclxuICAgICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG4gICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ib2R5IHtcclxuICAgICAgICBwYWRkaW5nOiAyMHB4IDI0cHggMjRweDtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgICAgZ2FwOiAyNHB4O1xyXG4gICAgICAgIG92ZXJmbG93OiBhdXRvO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZ3JpZCB7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGdhcDogMTJweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX3dlZWtkYXlzIHtcclxuICAgICAgICBkaXNwbGF5OiBncmlkO1xyXG4gICAgICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczogcmVwZWF0KDcsIG1pbm1heCgwLCAxZnIpKTtcclxuICAgICAgICBnYXA6IDRweDtcclxuICAgICAgICBmb250LXNpemU6IDEwcHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG4gICAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XHJcbiAgICAgICAgbGV0dGVyLXNwYWNpbmc6IDAuMDVlbTtcclxuICAgICAgICBmb250LXdlaWdodDogNTAwO1xyXG4gICAgICAgIG9wYWNpdHk6IDAuODtcclxuICAgICAgICBtYXJnaW4tYm90dG9tOiAycHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX193ZWVrZGF5IHtcclxuICAgICAgICBwYWRkaW5nOiA0cHg7XHJcbiAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5cyB7XHJcbiAgICAgICAgZGlzcGxheTogZ3JpZDtcclxuICAgICAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IHJlcGVhdCg3LCBtaW5tYXgoMCwgMWZyKSk7XHJcbiAgICAgICAgZ2FwOiAwO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5IHtcclxuICAgICAgICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDtcclxuICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudCAhaW1wb3J0YW50O1xyXG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDAgIWltcG9ydGFudDtcclxuICAgICAgICBwYWRkaW5nOiAxNnB4IDRweCAxMnB4O1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcclxuICAgICAgICBnYXA6IDNweDtcclxuICAgICAgICBtaW4taGVpZ2h0OiA2NHB4O1xyXG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICAgICAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50O1xyXG4gICAgICAgIG91dGxpbmU6IG5vbmUgIWltcG9ydGFudDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RheTpob3ZlcixcclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXk6Zm9jdXMge1xyXG4gICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7XHJcbiAgICAgICAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LmlzLW91dHNpZGUge1xyXG4gICAgICAgIG9wYWNpdHk6IDAuNDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RheS5pcy10b2RheSAub2JzaWRpYW4tY2FsZW5kYXJfX2RheS1udW1iZXI6OmFmdGVyIHtcclxuICAgICAgICBjb250ZW50OiAnJztcclxuICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgICAgYm90dG9tOiAtMnB4O1xyXG4gICAgICAgIGxlZnQ6IDUwJTtcclxuICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XHJcbiAgICAgICAgd2lkdGg6IDIycHg7XHJcbiAgICAgICAgaGVpZ2h0OiAzcHg7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tY2FsZW5kYXItdG9kYXktYWNjZW50KTtcclxuICAgICAgICBib3JkZXItcmFkaXVzOiAycHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXkuaXMtc2VsZWN0ZWQgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXktbnVtYmVyOjphZnRlciB7XHJcbiAgICAgICAgY29udGVudDogJyc7XHJcbiAgICAgICAgcG9zaXRpb246IGFic29sdXRlO1xyXG4gICAgICAgIGJvdHRvbTogLTJweDtcclxuICAgICAgICBsZWZ0OiA1MCU7XHJcbiAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xyXG4gICAgICAgIHdpZHRoOiAyMnB4O1xyXG4gICAgICAgIGhlaWdodDogM3B4O1xyXG4gICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWNhbGVuZGFyLXNlbGVjdGVkLWFjY2VudCk7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogMnB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LmlzLXRvZGF5LmlzLXNlbGVjdGVkIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LW51bWJlcjo6YWZ0ZXIge1xyXG4gICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWNhbGVuZGFyLXRvZGF5LWFjY2VudCk7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXktbnVtYmVyIHtcclxuICAgICAgICBmb250LXNpemU6IDE3cHg7XHJcbiAgICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcclxuICAgICAgICBsaW5lLWhlaWdodDogMTtcclxuICAgICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XHJcbiAgICAgICAgcGFkZGluZy1ib3R0b206IDRweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RheS1zdWJ0aXRsZXMge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgICBnYXA6IDJweDtcclxuICAgICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgICBtaW4taGVpZ2h0OiAyNHB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LXN1YnRpdGxlIHtcclxuICAgICAgICBmb250LXNpemU6IDEwcHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG4gICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcclxuICAgICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XHJcbiAgICAgICAgbGluZS1oZWlnaHQ6IDEuMjtcclxuICAgICAgICBmb250LXdlaWdodDogNDAwO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LW5vdGUge1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW5vcm1hbCk7XHJcbiAgICAgICAgb3BhY2l0eTogMC43O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LWV2ZW50IHtcclxuICAgICAgICBvcGFjaXR5OiAwLjg1O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LWluZGljYXRvciB7XHJcbiAgICAgICAgbWluLWhlaWdodDogNnB4O1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcclxuICAgICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgICBtYXJnaW4tdG9wOiAycHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXktYmFyIHtcclxuICAgICAgICBoZWlnaHQ6IDJweDtcclxuICAgICAgICBib3JkZXItcmFkaXVzOiAxcHg7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tY2FsZW5kYXItbm90ZS1iYXItY29sb3IpO1xyXG4gICAgICAgIG9wYWNpdHk6IDAuNTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtcHJldmlldyB7XHJcbiAgICAgICAgcG9zaXRpb246IGZpeGVkO1xyXG4gICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJhY2tncm91bmQtcHJpbWFyeSk7XHJcbiAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpO1xyXG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcclxuICAgICAgICBwYWRkaW5nOiAxMHB4IDEycHg7XHJcbiAgICAgICAgYm94LXNoYWRvdzogMCA0cHggMTJweCByZ2JhKDAsIDAsIDAsIDAuMDgpO1xyXG4gICAgICAgIGRpc3BsYXk6IG5vbmU7XHJcbiAgICAgICAgei1pbmRleDogOTk5OTtcclxuICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtcHJldmlldy1yb3cge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgICBnYXA6IDNweDtcclxuICAgICAgICBwYWRkaW5nOiA1cHggMDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtcHJldmlldy10aXRsZSB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbm9ybWFsKTtcclxuICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xyXG4gICAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXByZXZpZXctZXhjZXJwdCB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxuICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xyXG4gICAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgICAgb3BhY2l0eTogMC45O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlscy10aXRsZSB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxNXB4O1xyXG4gICAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgICAgbGV0dGVyLXNwYWNpbmc6IC0wLjAxZW07XHJcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogNHB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlscyB7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGdhcDogMTZweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX3NlY3Rpb24ge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgICBnYXA6IDhweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25vdGVzLWxpc3QsXHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZXZlbnQtbGlzdCB7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGdhcDogNHB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fc2VjdGlvbi10aXRsZSB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxuICAgICAgICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlO1xyXG4gICAgICAgIGxldHRlci1zcGFjaW5nOiAwLjA2ZW07XHJcbiAgICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcclxuICAgICAgICBtYXJnaW4tYm90dG9tOiAycHg7XHJcbiAgICAgICAgb3BhY2l0eTogMC44O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1yb3cge1xyXG4gICAgICAgIGJvcmRlcjogbm9uZTtcclxuICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgICB0ZXh0LWFsaWduOiBsZWZ0O1xyXG4gICAgICAgIHBhZGRpbmc6IDEwcHggOHB4O1xyXG4gICAgICAgIGRpc3BsYXk6IGJsb2NrO1xyXG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgICAgIG1pbi1oZWlnaHQ6IDUycHg7XHJcbiAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXJvdzpob3ZlciB7XHJcbiAgICAgICAgb3BhY2l0eTogMC44O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS10aXRsZSB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW5vcm1hbCk7XHJcbiAgICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcclxuICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xyXG4gICAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgICAgbGluZS1oZWlnaHQ6IDEuMztcclxuICAgICAgICBtYXJnaW4tYm90dG9tOiAycHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLWV4Y2VycHQge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7XHJcbiAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xyXG4gICAgICAgIGxpbmUtaGVpZ2h0OiAxLjM7XHJcbiAgICAgICAgb3BhY2l0eTogMC44NTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2V2ZW50LXJvdyB7XHJcbiAgICAgICAgZGlzcGxheTogZ3JpZDtcclxuICAgICAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDY4cHggMWZyO1xyXG4gICAgICAgIGdhcDogMTRweDtcclxuICAgICAgICBwYWRkaW5nOiA2cHggMDtcclxuICAgICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZXZlbnQtdGltZSB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxuICAgICAgICBmb250LXdlaWdodDogNDAwO1xyXG4gICAgICAgIG9wYWNpdHk6IDAuODU7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ldmVudC1zdW1tYXJ5IHtcclxuICAgICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgICAgZm9udC13ZWlnaHQ6IDQwMDtcclxuICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xyXG4gICAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgICAgbGluZS1oZWlnaHQ6IDEuMztcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RldGFpbHMtYWN0aW9uIHtcclxuICAgICAgICBtYXJnaW4tdG9wOiA0cHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzLWFjdGlvbiBidXR0b24ge1xyXG4gICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItYm9yZGVyKTtcclxuICAgICAgICBwYWRkaW5nOiA2cHggMTRweDtcclxuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbm9ybWFsKTtcclxuICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlscy1hY3Rpb24gYnV0dG9uOmhvdmVyIHtcclxuICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWhvdmVyKTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX3NldHRpbmctaGludCB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxuICAgICAgICBtYXJnaW46IDRweCAwIDEycHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19zZXR0aW5nLWhpbnQuaXMtZXJyb3Ige1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LWFjY2VudCk7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzLXJvdyB7XHJcbiAgICAgICAgZGlzcGxheTogZ3JpZDtcclxuICAgICAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDY4cHggMWZyO1xyXG4gICAgICAgIGdhcDogMTRweDtcclxuICAgICAgICBwYWRkaW5nOiA2cHggMDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RldGFpbHMtdGltZSB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxuICAgICAgICBvcGFjaXR5OiAwLjg1O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlscy1zdW1tYXJ5IHtcclxuICAgICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzLWVtcHR5IHtcclxuICAgICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG4gICAgICAgIG9wYWNpdHk6IDAuNzU7XHJcbiAgICAgIH1cclxuICAgIGA7XHJcbiAgICBzdHlsZUVsLmRhdGFzZXQuY2FsZW5kYXJWaWV3ID0gXCJ0cnVlXCI7XHJcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlRWwpO1xyXG4gICAgdGhpcy5yZWdpc3RlcigoKSA9PiBzdHlsZUVsLnJlbW92ZSgpKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcclxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmxvYWREYXRhKCk7XHJcbiAgICB0aGlzLnNldHRpbmdzID0gdGhpcy5ub3JtYWxpemVTZXR0aW5ncyhkYXRhKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcclxuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XHJcbiAgICB0aGlzLmFwcGx5SGlnaGxpZ2h0VmFyaWFibGVzKCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBjcmVhdGVOb3RlRm9yRGF0ZShkYXRlOiBEYXRlKSB7XHJcbiAgICBjb25zdCBmaWVsZCA9IHRoaXMuc2V0dGluZ3Mubm90ZURhdGVGaWVsZHNbMF0gfHwgXCJkYXRlXCI7XHJcbiAgICBjb25zdCB0aXRsZSA9IGZvcm1hdERhdGVLZXkoZGF0ZSk7XHJcbiAgICBjb25zdCBiYXNlUGF0aCA9IG5vcm1hbGl6ZVBhdGgoYCR7dGl0bGV9Lm1kYCk7XHJcbiAgICBjb25zdCBmaWxlUGF0aCA9IGF3YWl0IHRoaXMuZ2V0QXZhaWxhYmxlUGF0aChiYXNlUGF0aCk7XHJcbiAgICBjb25zdCB0ZW1wbGF0ZUNvbnRlbnQgPSBhd2FpdCB0aGlzLmxvYWRUZW1wbGF0ZUNvbnRlbnQoKTtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0aGlzLmJ1aWxkTm90ZUNvbnRlbnQoZmllbGQsIHRpdGxlLCB0ZW1wbGF0ZUNvbnRlbnQpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNyZWF0ZShmaWxlUGF0aCwgY29udGVudCk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKFwiRmFpbGVkIHRvIGNyZWF0ZSBub3RlXCIsIGVycm9yKTtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBnZXRUZW1wbGF0ZUZpbGUocGF0aDogc3RyaW5nKSB7XHJcbiAgICBjb25zdCB0cmltbWVkID0gcGF0aC50cmltKCk7XHJcbiAgICBpZiAoIXRyaW1tZWQpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgbm9ybWFsaXplZElucHV0ID0gdGhpcy5ub3JtYWxpemVUZW1wbGF0ZVBhdGgodHJpbW1lZCkucGF0aDtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVQYXRoKG5vcm1hbGl6ZVBhdGhTbGFzaGVzKG5vcm1hbGl6ZWRJbnB1dCkucmVwbGFjZSgvXlxcLy8sIFwiXCIpKTtcclxuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgobm9ybWFsaXplZCk7XHJcbiAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XHJcbiAgICAgIHJldHVybiBmaWxlO1xyXG4gICAgfVxyXG4gICAgaWYgKCFub3JtYWxpemVkLnRvTG93ZXJDYXNlKCkuZW5kc1dpdGgoXCIubWRcIikpIHtcclxuICAgICAgY29uc3Qgd2l0aEV4dGVuc2lvbiA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChgJHtub3JtYWxpemVkfS5tZGApO1xyXG4gICAgICBpZiAod2l0aEV4dGVuc2lvbiBpbnN0YW5jZW9mIFRGaWxlKSB7XHJcbiAgICAgICAgcmV0dXJuIHdpdGhFeHRlbnNpb247XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBsb2FkVGVtcGxhdGVDb250ZW50KCkge1xyXG4gICAgY29uc3QgcGF0aCA9IHRoaXMuc2V0dGluZ3Mubm90ZVRlbXBsYXRlUGF0aC50cmltKCk7XHJcbiAgICBpZiAoIXBhdGgpIHtcclxuICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICB9XHJcbiAgICBjb25zdCBmaWxlID0gdGhpcy5nZXRUZW1wbGF0ZUZpbGUocGF0aCk7XHJcbiAgICBpZiAoIWZpbGUpIHtcclxuICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICB9XHJcbiAgICB0cnkge1xyXG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gcmVhZCB0ZW1wbGF0ZVwiLCBlcnJvcik7XHJcbiAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBidWlsZE5vdGVDb250ZW50KGZpZWxkOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcsIHRlbXBsYXRlOiBzdHJpbmcpIHtcclxuICAgIGlmICghdGVtcGxhdGUudHJpbSgpKSB7XHJcbiAgICAgIHJldHVybiBgLS0tXFxuJHtmaWVsZH06ICR7dmFsdWV9XFxuLS0tXFxuXFxuYDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBsaW5lcyA9IHRlbXBsYXRlLnNwbGl0KFwiXFxuXCIpO1xyXG4gICAgaWYgKGxpbmVzWzBdPy50cmltKCkgPT09IFwiLS0tXCIpIHtcclxuICAgICAgY29uc3QgZW5kSW5kZXggPSBsaW5lcy5zbGljZSgxKS5maW5kSW5kZXgoKGxpbmUpID0+IGxpbmUudHJpbSgpID09PSBcIi0tLVwiKTtcclxuICAgICAgaWYgKGVuZEluZGV4ID49IDApIHtcclxuICAgICAgICBjb25zdCBmcm9udG1hdHRlckVuZCA9IGVuZEluZGV4ICsgMTtcclxuICAgICAgICBjb25zdCBoYXNGaWVsZCA9IGxpbmVzLnNsaWNlKDEsIGZyb250bWF0dGVyRW5kKS5zb21lKChsaW5lKSA9PiBsaW5lLnRyaW0oKS5zdGFydHNXaXRoKGAke2ZpZWxkfTpgKSk7XHJcbiAgICAgICAgaWYgKCFoYXNGaWVsZCkge1xyXG4gICAgICAgICAgbGluZXMuc3BsaWNlKGZyb250bWF0dGVyRW5kLCAwLCBgJHtmaWVsZH06ICR7dmFsdWV9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGAtLS1cXG4ke2ZpZWxkfTogJHt2YWx1ZX1cXG4tLS1cXG5cXG4ke3RlbXBsYXRlfWA7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIGdldEF2YWlsYWJsZVBhdGgocGF0aDogc3RyaW5nKSB7XHJcbiAgICBpZiAoIXRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKSkge1xyXG4gICAgICByZXR1cm4gcGF0aDtcclxuICAgIH1cclxuICAgIGNvbnN0IGJhc2UgPSBwYXRoLnJlcGxhY2UoL1xcLm1kJC9pLCBcIlwiKTtcclxuICAgIGxldCBpbmRleCA9IDE7XHJcbiAgICBsZXQgY2FuZGlkYXRlID0gYCR7YmFzZX0tJHtpbmRleH0ubWRgO1xyXG4gICAgd2hpbGUgKHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjYW5kaWRhdGUpKSB7XHJcbiAgICAgIGluZGV4ICs9IDE7XHJcbiAgICAgIGNhbmRpZGF0ZSA9IGAke2Jhc2V9LSR7aW5kZXh9Lm1kYDtcclxuICAgIH1cclxuICAgIHJldHVybiBjYW5kaWRhdGU7XHJcbiAgfVxyXG5cclxuICBhcHBseUhpZ2hsaWdodFZhcmlhYmxlcygpIHtcclxuICAgIGNvbnN0IGxlYXZlcyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFX0NBTEVOREFSKTtcclxuICAgIGZvciAoY29uc3QgbGVhZiBvZiBsZWF2ZXMpIHtcclxuICAgICAgY29uc3QgY29udGFpbmVyID0gbGVhZi52aWV3LmNvbnRhaW5lckVsO1xyXG4gICAgICBjb25zdCB0b2RheUNvbG9yID0gcmVzb2x2ZUhpZ2hsaWdodFZhbHVlKHRoaXMuc2V0dGluZ3MudG9kYXlIaWdobGlnaHQsIFwiLS1pbnRlcmFjdGl2ZS1hY2NlbnRcIik7XHJcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ29sb3IgPSByZXNvbHZlSGlnaGxpZ2h0VmFsdWUodGhpcy5zZXR0aW5ncy5zZWxlY3RlZEhpZ2hsaWdodCwgXCItLXRleHQtYWNjZW50XCIpO1xyXG4gICAgICBjb25zdCBiYXJDb2xvciA9IHJlc29sdmVIaWdobGlnaHRWYWx1ZSh0aGlzLnNldHRpbmdzLm5vdGVCYXJDb2xvciwgXCItLXRleHQtYWNjZW50XCIpO1xyXG4gICAgICBjb250YWluZXIuc3R5bGUuc2V0UHJvcGVydHkoXHJcbiAgICAgICAgXCItLWNhbGVuZGFyLXRvZGF5LWFjY2VudFwiLFxyXG4gICAgICAgIHRvZGF5Q29sb3JcclxuICAgICAgKTtcclxuICAgICAgY29udGFpbmVyLnN0eWxlLnNldFByb3BlcnR5KFxyXG4gICAgICAgIFwiLS1jYWxlbmRhci1zZWxlY3RlZC1hY2NlbnRcIixcclxuICAgICAgICBzZWxlY3RlZENvbG9yXHJcbiAgICAgICk7XHJcbiAgICAgIGNvbnRhaW5lci5zdHlsZS5zZXRQcm9wZXJ0eShcclxuICAgICAgICBcIi0tY2FsZW5kYXItbm90ZS1iYXItY29sb3JcIixcclxuICAgICAgICBiYXJDb2xvclxyXG4gICAgICApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgbm9ybWFsaXplVGVtcGxhdGVQYXRoKHJhd1BhdGg6IHN0cmluZykge1xyXG4gICAgY29uc3QgdHJpbW1lZCA9IHJhd1BhdGgudHJpbSgpO1xyXG4gICAgaWYgKCF0cmltbWVkKSB7XHJcbiAgICAgIHJldHVybiB7IHBhdGg6IFwiXCIsIHdhcm5pbmc6IFwiXCIgfTtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZVBhdGhTbGFzaGVzKHRyaW1tZWQpLnJlcGxhY2UoL15cXC8vLCBcIlwiKTtcclxuICAgIGlmICgvXlthLXpBLVpdOlxcLy8udGVzdChub3JtYWxpemVkKSB8fCBub3JtYWxpemVkLnN0YXJ0c1dpdGgoXCIvL1wiKSkge1xyXG4gICAgICBjb25zdCB2YXVsdFJvb3QgPSBub3JtYWxpemVQYXRoU2xhc2hlcyh0aGlzLmFwcC52YXVsdC5hZGFwdGVyLmdldEZ1bGxQYXRoKFwiXCIpKTtcclxuICAgICAgY29uc3Qgcm9vdFdpdGhTbGFzaCA9IHZhdWx0Um9vdC5lbmRzV2l0aChcIi9cIikgPyB2YXVsdFJvb3QgOiBgJHt2YXVsdFJvb3R9L2A7XHJcbiAgICAgIGlmIChub3JtYWxpemVkLnN0YXJ0c1dpdGgocm9vdFdpdGhTbGFzaCkpIHtcclxuICAgICAgICBub3JtYWxpemVkID0gbm9ybWFsaXplZC5zbGljZShyb290V2l0aFNsYXNoLmxlbmd0aCk7XHJcbiAgICAgICAgcmV0dXJuIHsgcGF0aDogbm9ybWFsaXplUGF0aChub3JtYWxpemVkKSwgd2FybmluZzogXCJcIiB9O1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB7IHBhdGg6IFwiXCIsIHdhcm5pbmc6IFwiVGVtcGxhdGUgcGF0aCBtdXN0IGJlIGluc2lkZSB0aGlzIHZhdWx0LlwiIH07XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHsgcGF0aDogbm9ybWFsaXplUGF0aChub3JtYWxpemVkKSwgd2FybmluZzogXCJcIiB9O1xyXG4gIH1cclxuXHJcbiAgZ2V0VGVtcGxhdGVGb2xkZXJPcHRpb25zKCkge1xyXG4gICAgY29uc3QgZm9sZGVycyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xyXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKSkge1xyXG4gICAgICBjb25zdCBwYXJlbnQgPSBmaWxlLnBhcmVudD8ucGF0aCA/PyBcIlwiO1xyXG4gICAgICBmb2xkZXJzLmFkZChwYXJlbnQpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIEFycmF5LmZyb20oZm9sZGVycykuc29ydCgoYSwgYikgPT4gYS5sb2NhbGVDb21wYXJlKGIpKTtcclxuICB9XHJcblxyXG4gIGdldFRlbXBsYXRlT3B0aW9ucyhmb2xkZXI6IHN0cmluZykge1xyXG4gICAgcmV0dXJuIHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKVxyXG4gICAgICAuZmlsdGVyKChmaWxlKSA9PiAoZm9sZGVyID8gZmlsZS5wYXJlbnQ/LnBhdGggPT09IGZvbGRlciA6IHRydWUpKVxyXG4gICAgICAubWFwKChmaWxlKSA9PiAoe1xyXG4gICAgICAgIHBhdGg6IGZpbGUucGF0aCxcclxuICAgICAgICBsYWJlbDogZmlsZS5uYW1lXHJcbiAgICAgIH0pKVxyXG4gICAgICAuc29ydCgoYSwgYikgPT4gYS5sYWJlbC5sb2NhbGVDb21wYXJlKGIubGFiZWwpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbm9ybWFsaXplU2V0dGluZ3MoZGF0YTogdW5rbm93bik6IENhbGVuZGFyU2V0dGluZ3Mge1xyXG4gICAgaWYgKCFkYXRhIHx8IHR5cGVvZiBkYXRhICE9PSBcIm9iamVjdFwiKSB7XHJcbiAgICAgIHJldHVybiB7IC4uLkRFRkFVTFRfU0VUVElOR1MgfTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCByZWNvcmQgPSBkYXRhIGFzIFBhcnRpYWw8Q2FsZW5kYXJTZXR0aW5ncz4gJiB7IGljYWxVcmw/OiBzdHJpbmcgfTtcclxuXHJcbiAgICBjb25zdCBzb3VyY2VzOiBDYWxlbmRhclNvdXJjZVtdID0gQXJyYXkuaXNBcnJheShyZWNvcmQuc291cmNlcylcclxuICAgICAgPyByZWNvcmQuc291cmNlcy5tYXAoKHNvdXJjZSwgaW5kZXgpID0+ICh7XHJcbiAgICAgICAgaWQ6IHNvdXJjZS5pZCB8fCBjcmVhdGVTb3VyY2VJZCgpLFxyXG4gICAgICAgIG5hbWU6IHNvdXJjZS5uYW1lID8/IFwiXCIsXHJcbiAgICAgICAgZW5hYmxlZDogc291cmNlLmVuYWJsZWQgPz8gdHJ1ZSxcclxuICAgICAgICB1cmw6IHNvdXJjZS51cmwgPz8gXCJcIixcclxuICAgICAgICBjb2xvcjogc291cmNlLmNvbG9yID8/IGdldERlZmF1bHRTb3VyY2VDb2xvcihpbmRleClcclxuICAgICAgfSkpXHJcbiAgICAgIDogW107XHJcblxyXG4gICAgaWYgKHNvdXJjZXMubGVuZ3RoID09PSAwICYmIHR5cGVvZiByZWNvcmQuaWNhbFVybCA9PT0gXCJzdHJpbmdcIiAmJiByZWNvcmQuaWNhbFVybC50cmltKCkubGVuZ3RoID4gMCkge1xyXG4gICAgICBzb3VyY2VzLnB1c2goe1xyXG4gICAgICAgIGlkOiBjcmVhdGVTb3VyY2VJZCgpLFxyXG4gICAgICAgIG5hbWU6IFwiUHJpbWFyeVwiLFxyXG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgdXJsOiByZWNvcmQuaWNhbFVybC50cmltKCksXHJcbiAgICAgICAgY29sb3I6IGdldERlZmF1bHRTb3VyY2VDb2xvcigwKVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBzb3VyY2VzLFxyXG4gICAgICB3ZWVrU3RhcnQ6IHJlY29yZC53ZWVrU3RhcnQgPz8gREVGQVVMVF9TRVRUSU5HUy53ZWVrU3RhcnQsXHJcbiAgICAgIHRpbWVGb3JtYXQ6IHJlY29yZC50aW1lRm9ybWF0ID8/IERFRkFVTFRfU0VUVElOR1MudGltZUZvcm1hdCxcclxuICAgICAgbGFuZ3VhZ2U6IHJlY29yZC5sYW5ndWFnZSA/PyBERUZBVUxUX1NFVFRJTkdTLmxhbmd1YWdlLFxyXG4gICAgICByZWZyZXNoSW50ZXJ2YWxNaW51dGVzOiByZWNvcmQucmVmcmVzaEludGVydmFsTWludXRlcyA/PyBERUZBVUxUX1NFVFRJTkdTLnJlZnJlc2hJbnRlcnZhbE1pbnV0ZXMsXHJcbiAgICAgIHRvZGF5SGlnaGxpZ2h0OiByZWNvcmQudG9kYXlIaWdobGlnaHQgPz8gREVGQVVMVF9TRVRUSU5HUy50b2RheUhpZ2hsaWdodCxcclxuICAgICAgc2VsZWN0ZWRIaWdobGlnaHQ6IHJlY29yZC5zZWxlY3RlZEhpZ2hsaWdodCA/PyBERUZBVUxUX1NFVFRJTkdTLnNlbGVjdGVkSGlnaGxpZ2h0LFxyXG4gICAgICBub3RlRGF0ZUZpZWxkczogQXJyYXkuaXNBcnJheShyZWNvcmQubm90ZURhdGVGaWVsZHMpICYmIHJlY29yZC5ub3RlRGF0ZUZpZWxkcy5sZW5ndGggPiAwXHJcbiAgICAgICAgPyByZWNvcmQubm90ZURhdGVGaWVsZHNcclxuICAgICAgICA6IERFRkFVTFRfU0VUVElOR1Mubm90ZURhdGVGaWVsZHMsXHJcbiAgICAgIGFsbG93Q3JlYXRlTm90ZTogcmVjb3JkLmFsbG93Q3JlYXRlTm90ZSA/PyBERUZBVUxUX1NFVFRJTkdTLmFsbG93Q3JlYXRlTm90ZSxcclxuICAgICAgbm90ZVRlbXBsYXRlUGF0aDogdHlwZW9mIHJlY29yZC5ub3RlVGVtcGxhdGVQYXRoID09PSBcInN0cmluZ1wiXHJcbiAgICAgICAgPyByZWNvcmQubm90ZVRlbXBsYXRlUGF0aFxyXG4gICAgICAgIDogREVGQVVMVF9TRVRUSU5HUy5ub3RlVGVtcGxhdGVQYXRoLFxyXG4gICAgICBub3RlQmFyQ29sb3I6IHR5cGVvZiByZWNvcmQubm90ZUJhckNvbG9yID09PSBcInN0cmluZ1wiXHJcbiAgICAgICAgPyByZWNvcmQubm90ZUJhckNvbG9yXHJcbiAgICAgICAgOiBERUZBVUxUX1NFVFRJTkdTLm5vdGVCYXJDb2xvclxyXG4gICAgfTtcclxuICB9XHJcbn1cclxuIiwgImltcG9ydCB7IFBhcnNlZEljYWxFdmVudCB9IGZyb20gXCIuL3R5cGVzXCI7XHJcblxyXG5jb25zdCBEQVRFX09OTFkgPSAvXlxcZHs4fSQvO1xyXG5jb25zdCBEQVRFX1RJTUUgPSAvXlxcZHs4fVRcXGR7Nn1aPyQvO1xyXG5cclxuY29uc3QgYWRkRGF5cyA9IChkYXRlOiBEYXRlLCBkYXlzOiBudW1iZXIpID0+XHJcbiAgbmV3IERhdGUoZGF0ZS5nZXRGdWxsWWVhcigpLCBkYXRlLmdldE1vbnRoKCksIGRhdGUuZ2V0RGF0ZSgpICsgZGF5cyk7XHJcblxyXG5jb25zdCBwYXJzZURhdGVWYWx1ZSA9IChyYXc6IHN0cmluZyk6IHsgZGF0ZTogRGF0ZTsgYWxsRGF5OiBib29sZWFuIH0gPT4ge1xyXG4gIGlmIChEQVRFX09OTFkudGVzdChyYXcpKSB7XHJcbiAgICBjb25zdCB5ZWFyID0gTnVtYmVyKHJhdy5zbGljZSgwLCA0KSk7XHJcbiAgICBjb25zdCBtb250aCA9IE51bWJlcihyYXcuc2xpY2UoNCwgNikpIC0gMTtcclxuICAgIGNvbnN0IGRheSA9IE51bWJlcihyYXcuc2xpY2UoNiwgOCkpO1xyXG4gICAgcmV0dXJuIHsgZGF0ZTogbmV3IERhdGUoeWVhciwgbW9udGgsIGRheSksIGFsbERheTogdHJ1ZSB9O1xyXG4gIH1cclxuXHJcbiAgaWYgKERBVEVfVElNRS50ZXN0KHJhdykpIHtcclxuICAgIGNvbnN0IHllYXIgPSBOdW1iZXIocmF3LnNsaWNlKDAsIDQpKTtcclxuICAgIGNvbnN0IG1vbnRoID0gTnVtYmVyKHJhdy5zbGljZSg0LCA2KSkgLSAxO1xyXG4gICAgY29uc3QgZGF5ID0gTnVtYmVyKHJhdy5zbGljZSg2LCA4KSk7XHJcbiAgICBjb25zdCBob3VyID0gTnVtYmVyKHJhdy5zbGljZSg5LCAxMSkpO1xyXG4gICAgY29uc3QgbWludXRlID0gTnVtYmVyKHJhdy5zbGljZSgxMSwgMTMpKTtcclxuICAgIGNvbnN0IHNlY29uZCA9IE51bWJlcihyYXcuc2xpY2UoMTMsIDE1KSk7XHJcbiAgICBpZiAocmF3LmVuZHNXaXRoKFwiWlwiKSkge1xyXG4gICAgICByZXR1cm4geyBkYXRlOiBuZXcgRGF0ZShEYXRlLlVUQyh5ZWFyLCBtb250aCwgZGF5LCBob3VyLCBtaW51dGUsIHNlY29uZCkpLCBhbGxEYXk6IGZhbHNlIH07XHJcbiAgICB9XHJcbiAgICByZXR1cm4geyBkYXRlOiBuZXcgRGF0ZSh5ZWFyLCBtb250aCwgZGF5LCBob3VyLCBtaW51dGUsIHNlY29uZCksIGFsbERheTogZmFsc2UgfTtcclxuICB9XHJcblxyXG4gIHJldHVybiB7IGRhdGU6IG5ldyBEYXRlKHJhdyksIGFsbERheTogZmFsc2UgfTtcclxufTtcclxuXHJcbmNvbnN0IHVuZm9sZExpbmVzID0gKHRleHQ6IHN0cmluZyk6IHN0cmluZ1tdID0+IHtcclxuICBjb25zdCBsaW5lcyA9IHRleHQucmVwbGFjZSgvXFxyXFxuL2csIFwiXFxuXCIpLnNwbGl0KFwiXFxuXCIpO1xyXG4gIGNvbnN0IHVuZm9sZGVkOiBzdHJpbmdbXSA9IFtdO1xyXG4gIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xyXG4gICAgaWYgKGxpbmUuc3RhcnRzV2l0aChcIiBcIikgfHwgbGluZS5zdGFydHNXaXRoKFwiXFx0XCIpKSB7XHJcbiAgICAgIGNvbnN0IGxhc3RJbmRleCA9IHVuZm9sZGVkLmxlbmd0aCAtIDE7XHJcbiAgICAgIGlmIChsYXN0SW5kZXggPj0gMCkge1xyXG4gICAgICAgIHVuZm9sZGVkW2xhc3RJbmRleF0gKz0gbGluZS5zbGljZSgxKTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIGlmIChsaW5lLnRyaW0oKS5sZW5ndGgpIHtcclxuICAgICAgdW5mb2xkZWQucHVzaChsaW5lLnRyaW0oKSk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiB1bmZvbGRlZDtcclxufTtcclxuXHJcbmV4cG9ydCBjb25zdCBwYXJzZUljYWwgPSAodGV4dDogc3RyaW5nKTogUGFyc2VkSWNhbEV2ZW50W10gPT4ge1xyXG4gIGNvbnN0IGV2ZW50czogUGFyc2VkSWNhbEV2ZW50W10gPSBbXTtcclxuICBjb25zdCBsaW5lcyA9IHVuZm9sZExpbmVzKHRleHQpO1xyXG4gIGxldCBjdXJyZW50OiBQYXJ0aWFsPFBhcnNlZEljYWxFdmVudD4gPSB7fTtcclxuXHJcbiAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XHJcbiAgICBpZiAobGluZSA9PT0gXCJCRUdJTjpWRVZFTlRcIikge1xyXG4gICAgICBjdXJyZW50ID0ge307XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG4gICAgaWYgKGxpbmUgPT09IFwiRU5EOlZFVkVOVFwiKSB7XHJcbiAgICAgIGlmIChjdXJyZW50LnN0YXJ0KSB7XHJcbiAgICAgICAgaWYgKCFjdXJyZW50LmVuZCkge1xyXG4gICAgICAgICAgY3VycmVudC5lbmQgPSBjdXJyZW50LnN0YXJ0O1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoY3VycmVudC5hbGxEYXkgJiYgY3VycmVudC5lbmQuZ2V0VGltZSgpID4gY3VycmVudC5zdGFydC5nZXRUaW1lKCkpIHtcclxuICAgICAgICAgIGN1cnJlbnQuZW5kID0gYWRkRGF5cyhjdXJyZW50LmVuZCwgLTEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBldmVudHMucHVzaCh7XHJcbiAgICAgICAgICBpZDogY3VycmVudC5pZCA/PyBjcnlwdG8ucmFuZG9tVVVJRCgpLFxyXG4gICAgICAgICAgc3VtbWFyeTogY3VycmVudC5zdW1tYXJ5ID8/IFwiVW50aXRsZWRcIixcclxuICAgICAgICAgIHN0YXJ0OiBjdXJyZW50LnN0YXJ0LFxyXG4gICAgICAgICAgZW5kOiBjdXJyZW50LmVuZCxcclxuICAgICAgICAgIGFsbERheTogY3VycmVudC5hbGxEYXkgPz8gZmFsc2VcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgICBjdXJyZW50ID0ge307XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IFtyYXdLZXksIHJhd1ZhbHVlXSA9IGxpbmUuc3BsaXQoXCI6XCIsIDIpO1xyXG4gICAgaWYgKCFyYXdLZXkgfHwgcmF3VmFsdWUgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuICAgIGNvbnN0IGtleSA9IHJhd0tleS5zcGxpdChcIjtcIilbMF07XHJcblxyXG4gICAgaWYgKGtleSA9PT0gXCJVSURcIikge1xyXG4gICAgICBjdXJyZW50LmlkID0gcmF3VmFsdWUudHJpbSgpO1xyXG4gICAgfVxyXG4gICAgaWYgKGtleSA9PT0gXCJTVU1NQVJZXCIpIHtcclxuICAgICAgY3VycmVudC5zdW1tYXJ5ID0gcmF3VmFsdWUudHJpbSgpO1xyXG4gICAgfVxyXG4gICAgaWYgKGtleSA9PT0gXCJEVFNUQVJUXCIpIHtcclxuICAgICAgY29uc3QgeyBkYXRlLCBhbGxEYXkgfSA9IHBhcnNlRGF0ZVZhbHVlKHJhd1ZhbHVlLnRyaW0oKSk7XHJcbiAgICAgIGN1cnJlbnQuc3RhcnQgPSBkYXRlO1xyXG4gICAgICBjdXJyZW50LmFsbERheSA9IGFsbERheTtcclxuICAgIH1cclxuICAgIGlmIChrZXkgPT09IFwiRFRFTkRcIikge1xyXG4gICAgICBjb25zdCB7IGRhdGUsIGFsbERheSB9ID0gcGFyc2VEYXRlVmFsdWUocmF3VmFsdWUudHJpbSgpKTtcclxuICAgICAgY3VycmVudC5lbmQgPSBkYXRlO1xyXG4gICAgICBjdXJyZW50LmFsbERheSA9IGN1cnJlbnQuYWxsRGF5ID8/IGFsbERheTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiBldmVudHM7XHJcbn07XHJcbiIsICJpbXBvcnQgeyByZXF1ZXN0VXJsIH0gZnJvbSBcIm9ic2lkaWFuXCI7XHJcbmltcG9ydCB7IENhbGVuZGFyRXZlbnQsIENhbGVuZGFyU291cmNlLCBQYXJzZWRJY2FsRXZlbnQgfSBmcm9tIFwiLi4vdHlwZXNcIjtcclxuXHJcbmV4cG9ydCB0eXBlIEljYWxQYXJzZXIgPSAodGV4dDogc3RyaW5nKSA9PiBQYXJzZWRJY2FsRXZlbnRbXTtcclxuXHJcbnR5cGUgQ2FjaGVFbnRyeSA9IHtcclxuICAgIGZldGNoZWRBdDogbnVtYmVyO1xyXG4gICAgZXZlbnRzOiBDYWxlbmRhckV2ZW50W107XHJcbiAgICB1cmw6IHN0cmluZztcclxufTtcclxuXHJcbmV4cG9ydCBjbGFzcyBJY2FsU2VydmljZSB7XHJcbiAgICBwcml2YXRlIGNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIENhY2hlRW50cnk+KCk7XHJcbiAgICBwcml2YXRlIHBhcnNlcjogSWNhbFBhcnNlcjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihwYXJzZXI6IEljYWxQYXJzZXIpIHtcclxuICAgICAgICB0aGlzLnBhcnNlciA9IHBhcnNlcjtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBnZXRFdmVudHMoXHJcbiAgICAgICAgc291cmNlczogQ2FsZW5kYXJTb3VyY2VbXSxcclxuICAgICAgICByZWZyZXNoSW50ZXJ2YWxNaW51dGVzOiBudW1iZXIsXHJcbiAgICAgICAgZm9yY2VSZWZyZXNoID0gZmFsc2VcclxuICAgICk6IFByb21pc2U8Q2FsZW5kYXJFdmVudFtdPiB7XHJcbiAgICAgICAgY29uc3QgZW5hYmxlZFNvdXJjZXMgPSBzb3VyY2VzLmZpbHRlcigoc291cmNlKSA9PiBzb3VyY2UuZW5hYmxlZCAmJiBzb3VyY2UudXJsLnRyaW0oKS5sZW5ndGggPiAwKTtcclxuICAgICAgICBpZiAoZW5hYmxlZFNvdXJjZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBbXTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XHJcbiAgICAgICAgY29uc3QgcmVmcmVzaE1zID0gTWF0aC5tYXgocmVmcmVzaEludGVydmFsTWludXRlcywgMSkgKiA2MCAqIDEwMDA7XHJcblxyXG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChcclxuICAgICAgICAgICAgZW5hYmxlZFNvdXJjZXMubWFwKChzb3VyY2UpID0+IHRoaXMuZ2V0U291cmNlRXZlbnRzKHNvdXJjZSwgbm93LCByZWZyZXNoTXMsIGZvcmNlUmVmcmVzaCkpXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdHMuZmxhdCgpLnNvcnQoKGEsIGIpID0+IGEuc3RhcnQuZ2V0VGltZSgpIC0gYi5zdGFydC5nZXRUaW1lKCkpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgZ2V0U291cmNlRXZlbnRzKFxyXG4gICAgICAgIHNvdXJjZTogQ2FsZW5kYXJTb3VyY2UsXHJcbiAgICAgICAgbm93OiBudW1iZXIsXHJcbiAgICAgICAgcmVmcmVzaE1zOiBudW1iZXIsXHJcbiAgICAgICAgZm9yY2VSZWZyZXNoOiBib29sZWFuXHJcbiAgICApOiBQcm9taXNlPENhbGVuZGFyRXZlbnRbXT4ge1xyXG4gICAgICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuY2FjaGUuZ2V0KHNvdXJjZS5pZCk7XHJcbiAgICAgICAgaWYgKCFmb3JjZVJlZnJlc2ggJiYgY2FjaGVkICYmIGNhY2hlZC51cmwgPT09IHNvdXJjZS51cmwgJiYgbm93IC0gY2FjaGVkLmZldGNoZWRBdCA8IHJlZnJlc2hNcykge1xyXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkLmV2ZW50cztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybDogc291cmNlLnVybCB9KTtcclxuICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gdGhpcy5wYXJzZXIocmVzcG9uc2UudGV4dCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50cyA9IHBhcnNlZC5tYXAoKGV2ZW50KSA9PiAoe1xyXG4gICAgICAgICAgICAgICAgLi4uZXZlbnQsXHJcbiAgICAgICAgICAgICAgICBzb3VyY2VJZDogc291cmNlLmlkLFxyXG4gICAgICAgICAgICAgICAgc291cmNlTmFtZTogc291cmNlLm5hbWUgfHwgXCJDYWxlbmRhclwiXHJcbiAgICAgICAgICAgIH0pKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuY2FjaGUuc2V0KHNvdXJjZS5pZCwgeyBmZXRjaGVkQXQ6IG5vdywgZXZlbnRzLCB1cmw6IHNvdXJjZS51cmwgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiBldmVudHM7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkZhaWxlZCB0byBmZXRjaCBpQ2FsIHNvdXJjZVwiLCBzb3VyY2UubmFtZSwgZXJyb3IpO1xyXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkID8gY2FjaGVkLmV2ZW50cyA6IFtdO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUFBQSxtQkFTTzs7O0FDUFAsSUFBTSxZQUFZO0FBQ2xCLElBQU0sWUFBWTtBQUVsQixJQUFNLFVBQVUsQ0FBQyxNQUFZLFNBQzNCLElBQUksS0FBSyxLQUFLLFlBQVksR0FBRyxLQUFLLFNBQVMsR0FBRyxLQUFLLFFBQVEsSUFBSSxJQUFJO0FBRXJFLElBQU0saUJBQWlCLENBQUMsUUFBaUQ7QUFDdkUsTUFBSSxVQUFVLEtBQUssR0FBRyxHQUFHO0FBQ3ZCLFVBQU0sT0FBTyxPQUFPLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztBQUNuQyxVQUFNLFFBQVEsT0FBTyxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSTtBQUN4QyxVQUFNLE1BQU0sT0FBTyxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUM7QUFDbEMsV0FBTyxFQUFFLE1BQU0sSUFBSSxLQUFLLE1BQU0sT0FBTyxHQUFHLEdBQUcsUUFBUSxLQUFLO0FBQUEsRUFDMUQ7QUFFQSxNQUFJLFVBQVUsS0FBSyxHQUFHLEdBQUc7QUFDdkIsVUFBTSxPQUFPLE9BQU8sSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDO0FBQ25DLFVBQU0sUUFBUSxPQUFPLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJO0FBQ3hDLFVBQU0sTUFBTSxPQUFPLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztBQUNsQyxVQUFNLE9BQU8sT0FBTyxJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDcEMsVUFBTSxTQUFTLE9BQU8sSUFB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QUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FB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
