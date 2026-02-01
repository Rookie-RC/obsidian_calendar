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
  refreshIntervalMinutes: 30,
  todayHighlight: "--interactive-accent",
  selectedHighlight: "--text-accent",
  noteDateFields: ["date"],
  allowCreateNote: true,
  noteTemplatePath: "",
  noteBarColor: "--text-accent"
};
var WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
    const nav = header.createDiv({ cls: "obsidian-calendar__nav" });
    const prevBtn = nav.createEl("button", { text: "\u2190" });
    const nextBtn = nav.createEl("button", { text: "\u2192" });
    const todayBtn = nav.createEl("button", { text: "Today" });
    const refreshBtn = nav.createEl("button", { text: "Refresh" });
    this.headerTitle = header.createDiv({ cls: "obsidian-calendar__title" });
    const body = this.containerEl.createDiv({ cls: "obsidian-calendar__body" });
    this.gridEl = body.createDiv({ cls: "obsidian-calendar__grid" });
    this.detailsEl = body.createDiv({ cls: "obsidian-calendar__details" });
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
    const monthStart = startOfMonth(this.visibleMonth);
    const monthEnd = endOfMonth(this.visibleMonth);
    const startWeekday = this.plugin.settings.weekStart === "monday" ? 1 : 0;
    const offset = (monthStart.getDay() - startWeekday + 7) % 7;
    const gridStart = addDays2(monthStart, -offset);
    const gridEnd = addDays2(monthEnd, 6 - (monthEnd.getDay() - startWeekday + 7) % 7);
    this.notesByDate = this.buildNotesIndex(gridStart, gridEnd);
    this.maxNotesForGrid = this.getMaxNotesCount();
    this.headerTitle.setText(
      monthStart.toLocaleDateString([], { year: "numeric", month: "long" })
    );
    const weekdayRow = this.gridEl.createDiv({ cls: "obsidian-calendar__weekdays" });
    const labels = this.plugin.settings.weekStart === "monday" ? [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]] : WEEKDAY_LABELS;
    for (const label of labels) {
      weekdayRow.createDiv({ cls: "obsidian-calendar__weekday", text: label });
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
      if (cellDate.getDay() === 0 || cellDate.getDay() === 6) {
        cell.addClass("is-weekend");
      }
      if (isSameDay(cellDate, today)) {
        cell.addClass("is-today");
      }
      if (isSameDay(cellDate, this.selectedDate)) {
        cell.addClass("is-selected");
      }
      const numberEl = cell.createDiv({ cls: "obsidian-calendar__day-number" });
      numberEl.setText(String(cellDate.getDate()));
      const subtitle = cell.createDiv({ cls: "obsidian-calendar__day-subtitle" });
      const notesForDay = this.getNotesForDay(cellDate);
      if (notesForDay.length > 0) {
        subtitle.setText(notesForDay[0].title);
      } else {
        const dayEvents = this.getEventsForDay(cellDate);
        if (dayEvents.length > 0) {
          subtitle.setText(dayEvents[0].summary);
        }
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
  renderDetails() {
    if (!this.detailsEl) {
      return;
    }
    this.detailsEl.empty();
    const title = this.detailsEl.createDiv({ cls: "obsidian-calendar__details-title" });
    title.setText(
      this.selectedDate.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })
    );
    const notes = this.getNotesForDay(this.selectedDate);
    const events = this.getEventsForDay(this.selectedDate);
    if (events.length > 0) {
      const eventsSection = this.detailsEl.createDiv({ cls: "obsidian-calendar__section" });
      eventsSection.createDiv({ cls: "obsidian-calendar__section-title", text: "Events" });
      const eventsList = eventsSection.createDiv({ cls: "obsidian-calendar__event-list" });
      for (const event of events) {
        const row = eventsList.createDiv({ cls: "obsidian-calendar__event-row" });
        row.createDiv({
          cls: "obsidian-calendar__event-time",
          text: event.allDay ? "All day" : formatTime(event.start, this.plugin.settings.timeFormat)
        });
        row.createDiv({ cls: "obsidian-calendar__event-summary", text: event.summary });
      }
    }
    if (notes.length > 0) {
      const notesSection = this.detailsEl.createDiv({ cls: "obsidian-calendar__section" });
      notesSection.createDiv({ cls: "obsidian-calendar__section-title", text: "Notes" });
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
      this.detailsEl.createDiv({ cls: "obsidian-calendar__details-empty", text: "No notes or events" });
    }
    if (notes.length === 0 && this.plugin.settings.allowCreateNote) {
      const action = this.detailsEl.createDiv({ cls: "obsidian-calendar__details-action" });
      const button = action.createEl("button", { text: "Create note" });
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
    }
    new import_obsidian2.Setting(containerEl).setName("Add calendar source").setDesc("Add another iCal (ICS) source.").addButton(
      (button) => button.setButtonText("Add").onClick(async () => {
        this.plugin.settings.sources.push({
          id: createSourceId(),
          name: "",
          enabled: true,
          url: ""
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
    this.applyHighlightVariables();
    this.app.workspace.onLayoutReady(() => {
      this.activateView();
    });
    this.refreshEvents();
    this.startAutoRefresh();
  }
  async onunload() {
    if (this.refreshHandle) {
      window.clearInterval(this.refreshHandle);
    }
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CALENDAR);
  }
  async activateView() {
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
        --calendar-note-bar-color: var(--text-accent);
      }
      .obsidian-calendar__header {
        padding: 12px 16px;
        border-bottom: 1px solid var(--background-modifier-border);
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .obsidian-calendar__nav {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .obsidian-calendar__nav button {
        background: transparent;
        border: 1px solid var(--background-modifier-border);
        padding: 4px 10px;
        border-radius: 6px;
        color: var(--text-normal);
        cursor: pointer;
      }
      .obsidian-calendar__nav button:hover {
        background: var(--background-modifier-hover);
      }
      .obsidian-calendar__title {
        font-size: 16px;
        font-weight: 600;
      }
      .obsidian-calendar__body {
        padding: 12px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        overflow: auto;
      }
      .obsidian-calendar__grid {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .obsidian-calendar__weekdays {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        opacity: 0.9;
      }
      .obsidian-calendar__weekday {
        padding: 2px 4px;
      }
      .obsidian-calendar__days {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 6px;
      }
      .obsidian-calendar__day {
        border: none;
        background: transparent;
        border-radius: 10px;
        padding: 8px 6px 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-height: 58px;
        cursor: pointer;
      }
      .obsidian-calendar__day.is-outside {
        color: var(--text-muted);
      }
      .obsidian-calendar__day.is-weekend {
        color: var(--text-muted);
      }
      .obsidian-calendar__day.is-today {
        background: color-mix(in srgb, var(--calendar-today-accent) 14%, var(--background-primary));
      }
      .obsidian-calendar__day.is-selected {
        box-shadow: inset 0 0 0 1px var(--calendar-selected-accent);
      }
      .obsidian-calendar__day.is-today.is-selected {
        background: color-mix(in srgb, var(--calendar-today-accent) 14%, var(--background-primary));
        box-shadow: inset 0 0 0 1px var(--calendar-selected-accent);
      }
      .obsidian-calendar__day-number {
        font-size: 16px;
        font-weight: 600;
      }
      .obsidian-calendar__day-subtitle {
        font-size: 11px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
        text-align: center;
        min-height: 14px;
      }
      .obsidian-calendar__day-indicator {
        min-height: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
      }
      .obsidian-calendar__day-bar {
        height: 2px;
        border-radius: 999px;
        background: var(--calendar-note-bar-color);
        opacity: 0.6;
      }
      .obsidian-calendar__note-preview {
        position: fixed;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        padding: 8px;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
        display: none;
        z-index: 9999;
        pointer-events: none;
      }
      .obsidian-calendar__note-preview-row {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 4px 0;
      }
      .obsidian-calendar__note-preview-title {
        font-size: 12px;
        font-weight: 600;
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
      }
      .obsidian-calendar__details-title {
        font-size: 14px;
        font-weight: 600;
      }
      .obsidian-calendar__details {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .obsidian-calendar__section {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .obsidian-calendar__notes-list,
      .obsidian-calendar__event-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .obsidian-calendar__section-title {
        font-size: 12px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-top: 4px;
      }
      .obsidian-calendar__note-row {
        border: none;
        background: transparent;
        text-align: left;
        padding: 6px 0;
        display: block;
        cursor: pointer;
        width: 100%;
        box-sizing: border-box;
        height: 40px;
        overflow: hidden;
      }
      .obsidian-calendar__note-title {
        font-size: 13px;
        color: var(--text-normal);
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;
      }
      .obsidian-calendar__note-excerpt {
        font-size: 12px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;
      }
      .obsidian-calendar__event-row {
        display: grid;
        grid-template-columns: 72px 1fr;
        gap: 12px;
        padding: 4px 0;
        width: 100%;
        box-sizing: border-box;
      }
      .obsidian-calendar__event-time {
        font-size: 12px;
        color: var(--text-muted);
      }
      .obsidian-calendar__event-summary {
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .obsidian-calendar__details-action {
        margin-top: 8px;
      }
      .obsidian-calendar__details-action button {
        background: transparent;
        border: 1px solid var(--background-modifier-border);
        padding: 4px 10px;
        border-radius: 6px;
        color: var(--text-normal);
        cursor: pointer;
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
        grid-template-columns: 72px 1fr;
        gap: 12px;
        padding: 4px 0;
      }
      .obsidian-calendar__details-time {
        font-size: 12px;
        color: var(--text-muted);
      }
      .obsidian-calendar__details-summary {
        font-size: 13px;
      }
      .obsidian-calendar__details-empty {
        font-size: 12px;
        color: var(--text-muted);
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
    const sources = Array.isArray(record.sources) ? record.sources.map((source) => ({
      id: source.id || createSourceId(),
      name: source.name ?? "",
      enabled: source.enabled ?? true,
      url: source.url ?? ""
    })) : [];
    if (sources.length === 0 && typeof record.icalUrl === "string" && record.icalUrl.trim().length > 0) {
      sources.push({
        id: createSourceId(),
        name: "Primary",
        enabled: true,
        url: record.icalUrl.trim()
      });
    }
    return {
      sources,
      weekStart: record.weekStart ?? DEFAULT_SETTINGS.weekStart,
      timeFormat: record.timeFormat ?? DEFAULT_SETTINGS.timeFormat,
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL21haW4udHMiLCAiLi4vc3JjL2ljYWwudHMiLCAiLi4vc3JjL3NlcnZpY2VzL2ljYWxTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQge1xyXG4gIEFwcCxcclxuICBJdGVtVmlldyxcclxuICBQbHVnaW4sXHJcbiAgUGx1Z2luU2V0dGluZ1RhYixcclxuICBTZXR0aW5nLFxyXG4gIFRGaWxlLFxyXG4gIFdvcmtzcGFjZUxlYWYsXHJcbiAgbm9ybWFsaXplUGF0aFxyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyBwYXJzZUljYWwgfSBmcm9tIFwiLi9pY2FsXCI7XHJcbmltcG9ydCB7IEljYWxTZXJ2aWNlIH0gZnJvbSBcIi4vc2VydmljZXMvaWNhbFNlcnZpY2VcIjtcclxuaW1wb3J0IHsgQ2FsZW5kYXJFdmVudCwgQ2FsZW5kYXJTZXR0aW5ncywgQ2FsZW5kYXJTb3VyY2UgfSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuY29uc3QgVklFV19UWVBFX0NBTEVOREFSID0gXCJvYnNpZGlhbi1jYWxlbmRhci12aWV3XCI7XHJcblxyXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBDYWxlbmRhclNldHRpbmdzID0ge1xyXG4gIHNvdXJjZXM6IFtdLFxyXG4gIHdlZWtTdGFydDogXCJzdW5kYXlcIixcclxuICB0aW1lRm9ybWF0OiBcIjI0aFwiLFxyXG4gIHJlZnJlc2hJbnRlcnZhbE1pbnV0ZXM6IDMwLFxyXG4gIHRvZGF5SGlnaGxpZ2h0OiBcIi0taW50ZXJhY3RpdmUtYWNjZW50XCIsXHJcbiAgc2VsZWN0ZWRIaWdobGlnaHQ6IFwiLS10ZXh0LWFjY2VudFwiLFxyXG4gIG5vdGVEYXRlRmllbGRzOiBbXCJkYXRlXCJdLFxyXG4gIGFsbG93Q3JlYXRlTm90ZTogdHJ1ZSxcclxuICBub3RlVGVtcGxhdGVQYXRoOiBcIlwiLFxyXG4gIG5vdGVCYXJDb2xvcjogXCItLXRleHQtYWNjZW50XCJcclxufTtcclxuXHJcbmNvbnN0IFdFRUtEQVlfTEFCRUxTID0gW1wiU3VuXCIsIFwiTW9uXCIsIFwiVHVlXCIsIFwiV2VkXCIsIFwiVGh1XCIsIFwiRnJpXCIsIFwiU2F0XCJdO1xyXG5cclxuY29uc3QgcmVzb2x2ZUhpZ2hsaWdodFZhbHVlID0gKHZhbHVlOiBzdHJpbmcsIGZhbGxiYWNrVmFyOiBzdHJpbmcpID0+IHtcclxuICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xyXG4gIGlmICghdHJpbW1lZCkge1xyXG4gICAgcmV0dXJuIGdldENvbXB1dGVkU3R5bGUoZG9jdW1lbnQuYm9keSkuZ2V0UHJvcGVydHlWYWx1ZShmYWxsYmFja1ZhcikudHJpbSgpO1xyXG4gIH1cclxuICBpZiAodHJpbW1lZC5zdGFydHNXaXRoKFwiLS1cIikpIHtcclxuICAgIGNvbnN0IHJlc29sdmVkID0gZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5KS5nZXRQcm9wZXJ0eVZhbHVlKHRyaW1tZWQpLnRyaW0oKTtcclxuICAgIHJldHVybiByZXNvbHZlZCB8fCB0cmltbWVkO1xyXG4gIH1cclxuICByZXR1cm4gdHJpbW1lZDtcclxufTtcclxuXHJcbmNvbnN0IG5vcm1hbGl6ZVBhdGhTbGFzaGVzID0gKHZhbHVlOiBzdHJpbmcpID0+IHZhbHVlLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpO1xyXG5cclxudHlwZSBMaW5rZWROb3RlID0ge1xyXG4gIGZpbGU6IFRGaWxlO1xyXG4gIHRpdGxlOiBzdHJpbmc7XHJcbiAgZXhjZXJwdDogc3RyaW5nO1xyXG59O1xyXG5cclxuY29uc3QgZm9ybWF0RGF0ZUtleSA9IChkYXRlOiBEYXRlKSA9PiB7XHJcbiAgY29uc3QgeWVhciA9IGRhdGUuZ2V0RnVsbFllYXIoKTtcclxuICBjb25zdCBtb250aCA9IFN0cmluZyhkYXRlLmdldE1vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCBcIjBcIik7XHJcbiAgY29uc3QgZGF5ID0gU3RyaW5nKGRhdGUuZ2V0RGF0ZSgpKS5wYWRTdGFydCgyLCBcIjBcIik7XHJcbiAgcmV0dXJuIGAke3llYXJ9LSR7bW9udGh9LSR7ZGF5fWA7XHJcbn07XHJcblxyXG5jb25zdCBwYXJzZUZyb250bWF0dGVyRGF0ZSA9ICh2YWx1ZTogdW5rbm93bik6IERhdGUgfCBudWxsID0+IHtcclxuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBEYXRlICYmICFOdW1iZXIuaXNOYU4odmFsdWUuZ2V0VGltZSgpKSkge1xyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG4gIH1cclxuICBpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSB7XHJcbiAgICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xyXG4gICAgaWYgKCF0cmltbWVkKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gICAgY29uc3QgcGFyc2VkID0gbmV3IERhdGUodHJpbW1lZCk7XHJcbiAgICBpZiAoIU51bWJlci5pc05hTihwYXJzZWQuZ2V0VGltZSgpKSkge1xyXG4gICAgICByZXR1cm4gcGFyc2VkO1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gbnVsbDtcclxufTtcclxuXHJcbmNvbnN0IGV4dHJhY3RGcm9udG1hdHRlckRhdGVzID0gKHZhbHVlOiB1bmtub3duKTogRGF0ZVtdID0+IHtcclxuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcclxuICAgIHJldHVybiB2YWx1ZVxyXG4gICAgICAubWFwKChpdGVtKSA9PiBwYXJzZUZyb250bWF0dGVyRGF0ZShpdGVtKSlcclxuICAgICAgLmZpbHRlcigoaXRlbSk6IGl0ZW0gaXMgRGF0ZSA9PiBpdGVtICE9PSBudWxsKTtcclxuICB9XHJcbiAgY29uc3Qgc2luZ2xlID0gcGFyc2VGcm9udG1hdHRlckRhdGUodmFsdWUpO1xyXG4gIHJldHVybiBzaW5nbGUgPyBbc2luZ2xlXSA6IFtdO1xyXG59O1xyXG5cclxuY29uc3Qgc3RhcnRPZk1vbnRoID0gKGRhdGU6IERhdGUpID0+IG5ldyBEYXRlKGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpLCAxKTtcclxuY29uc3QgZW5kT2ZNb250aCA9IChkYXRlOiBEYXRlKSA9PiBuZXcgRGF0ZShkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSArIDEsIDApO1xyXG5cclxuY29uc3QgYWRkRGF5cyA9IChkYXRlOiBEYXRlLCBkYXlzOiBudW1iZXIpID0+XHJcbiAgbmV3IERhdGUoZGF0ZS5nZXRGdWxsWWVhcigpLCBkYXRlLmdldE1vbnRoKCksIGRhdGUuZ2V0RGF0ZSgpICsgZGF5cyk7XHJcblxyXG5jb25zdCBpc1NhbWVEYXkgPSAoYTogRGF0ZSwgYjogRGF0ZSkgPT5cclxuICBhLmdldEZ1bGxZZWFyKCkgPT09IGIuZ2V0RnVsbFllYXIoKSAmJlxyXG4gIGEuZ2V0TW9udGgoKSA9PT0gYi5nZXRNb250aCgpICYmXHJcbiAgYS5nZXREYXRlKCkgPT09IGIuZ2V0RGF0ZSgpO1xyXG5cclxuY29uc3QgZm9ybWF0VGltZSA9IChkYXRlOiBEYXRlLCBmb3JtYXQ6IENhbGVuZGFyU2V0dGluZ3NbXCJ0aW1lRm9ybWF0XCJdKSA9PiB7XHJcbiAgaWYgKGZvcm1hdCA9PT0gXCIyNGhcIikge1xyXG4gICAgcmV0dXJuIGRhdGUudG9Mb2NhbGVUaW1lU3RyaW5nKFtdLCB7IGhvdXI6IFwiMi1kaWdpdFwiLCBtaW51dGU6IFwiMi1kaWdpdFwiLCBob3VyMTI6IGZhbHNlIH0pO1xyXG4gIH1cclxuICByZXR1cm4gZGF0ZS50b0xvY2FsZVRpbWVTdHJpbmcoW10sIHsgaG91cjogXCJudW1lcmljXCIsIG1pbnV0ZTogXCIyLWRpZ2l0XCIsIGhvdXIxMjogdHJ1ZSB9KTtcclxufTtcclxuXHJcbmNvbnN0IGNsYW1wVG9EYXlTdGFydCA9IChkYXRlOiBEYXRlKSA9PiBuZXcgRGF0ZShkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCkpO1xyXG5cclxuY29uc3QgY2xhbXBUb0RheUVuZCA9IChkYXRlOiBEYXRlKSA9PlxyXG4gIG5ldyBEYXRlKGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpLCBkYXRlLmdldERhdGUoKSwgMjMsIDU5LCA1OSwgOTk5KTtcclxuXHJcbmNvbnN0IGNyZWF0ZVNvdXJjZUlkID0gKCkgPT4ge1xyXG4gIGlmICh0eXBlb2YgY3J5cHRvICE9PSBcInVuZGVmaW5lZFwiICYmIFwicmFuZG9tVVVJRFwiIGluIGNyeXB0bykge1xyXG4gICAgcmV0dXJuIGNyeXB0by5yYW5kb21VVUlEKCk7XHJcbiAgfVxyXG4gIHJldHVybiBgc3JjLSR7RGF0ZS5ub3coKX0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDE2KS5zbGljZSgyKX1gO1xyXG59O1xyXG5cclxuY2xhc3MgQ2FsZW5kYXJWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xyXG4gIHByaXZhdGUgcGx1Z2luOiBDYWxlbmRhclBsdWdpbjtcclxuICBwcml2YXRlIHNlbGVjdGVkRGF0ZSA9IG5ldyBEYXRlKCk7XHJcbiAgcHJpdmF0ZSB2aXNpYmxlTW9udGggPSBuZXcgRGF0ZSgpO1xyXG4gIHByaXZhdGUgZXZlbnRzOiBDYWxlbmRhckV2ZW50W10gPSBbXTtcclxuICBwcml2YXRlIGhlYWRlclRpdGxlPzogSFRNTEVsZW1lbnQ7XHJcbiAgcHJpdmF0ZSBncmlkRWw/OiBIVE1MRWxlbWVudDtcclxuICBwcml2YXRlIGRldGFpbHNFbD86IEhUTUxFbGVtZW50O1xyXG4gIHByaXZhdGUgbm90ZXNCeURhdGUgPSBuZXcgTWFwPHN0cmluZywgTGlua2VkTm90ZVtdPigpO1xyXG4gIHByaXZhdGUgbm90ZUV4Y2VycHRDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XHJcbiAgcHJpdmF0ZSBtYXhOb3Rlc0ZvckdyaWQgPSAxO1xyXG4gIHByaXZhdGUgaG92ZXJQcmV2aWV3RWw/OiBIVE1MRWxlbWVudDtcclxuXHJcbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZiwgcGx1Z2luOiBDYWxlbmRhclBsdWdpbikge1xyXG4gICAgc3VwZXIobGVhZik7XHJcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICB9XHJcblxyXG4gIGdldFZpZXdUeXBlKCkge1xyXG4gICAgcmV0dXJuIFZJRVdfVFlQRV9DQUxFTkRBUjtcclxuICB9XHJcblxyXG4gIGdldERpc3BsYXlUZXh0KCkge1xyXG4gICAgcmV0dXJuIFwiQ2FsZW5kYXJcIjtcclxuICB9XHJcblxyXG4gIGFzeW5jIG9uT3BlbigpIHtcclxuICAgIHRoaXMuY29udGFpbmVyRWwuZW1wdHkoKTtcclxuICAgIHRoaXMuY29udGFpbmVyRWwuYWRkQ2xhc3MoXCJvYnNpZGlhbi1jYWxlbmRhclwiKTtcclxuICAgIHRoaXMuYnVpbGRMYXlvdXQoKTtcclxuICAgIHRoaXMuZW5zdXJlSG92ZXJQcmV2aWV3KCk7XHJcbiAgICB0aGlzLnJlbmRlcigpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgb25DbG9zZSgpIHtcclxuICAgIHRoaXMuaG92ZXJQcmV2aWV3RWw/LnJlbW92ZSgpO1xyXG4gICAgdGhpcy5ob3ZlclByZXZpZXdFbCA9IHVuZGVmaW5lZDtcclxuICAgIHJldHVybjtcclxuICB9XHJcblxyXG4gIHNldEV2ZW50cyhldmVudHM6IENhbGVuZGFyRXZlbnRbXSkge1xyXG4gICAgdGhpcy5ldmVudHMgPSBldmVudHM7XHJcbiAgICB0aGlzLnJlbmRlcigpO1xyXG4gIH1cclxuXHJcbiAganVtcFRvVG9kYXkoKSB7XHJcbiAgICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCk7XHJcbiAgICB0aGlzLnNlbGVjdGVkRGF0ZSA9IHRvZGF5O1xyXG4gICAgdGhpcy52aXNpYmxlTW9udGggPSBuZXcgRGF0ZSh0b2RheS5nZXRGdWxsWWVhcigpLCB0b2RheS5nZXRNb250aCgpLCAxKTtcclxuICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGJ1aWxkTGF5b3V0KCkge1xyXG4gICAgY29uc3QgaGVhZGVyID0gdGhpcy5jb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2hlYWRlclwiIH0pO1xyXG4gICAgY29uc3QgbmF2ID0gaGVhZGVyLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fbmF2XCIgfSk7XHJcblxyXG4gICAgY29uc3QgcHJldkJ0biA9IG5hdi5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHUyMTkwXCIgfSk7XHJcbiAgICBjb25zdCBuZXh0QnRuID0gbmF2LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdTIxOTJcIiB9KTtcclxuICAgIGNvbnN0IHRvZGF5QnRuID0gbmF2LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJUb2RheVwiIH0pO1xyXG4gICAgY29uc3QgcmVmcmVzaEJ0biA9IG5hdi5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiUmVmcmVzaFwiIH0pO1xyXG5cclxuICAgIHRoaXMuaGVhZGVyVGl0bGUgPSBoZWFkZXIuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX190aXRsZVwiIH0pO1xyXG5cclxuICAgIGNvbnN0IGJvZHkgPSB0aGlzLmNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fYm9keVwiIH0pO1xyXG4gICAgdGhpcy5ncmlkRWwgPSBib2R5LmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZ3JpZFwiIH0pO1xyXG4gICAgdGhpcy5kZXRhaWxzRWwgPSBib2R5LmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlsc1wiIH0pO1xyXG5cclxuICAgIHByZXZCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgdGhpcy52aXNpYmxlTW9udGggPSBuZXcgRGF0ZSh0aGlzLnZpc2libGVNb250aC5nZXRGdWxsWWVhcigpLCB0aGlzLnZpc2libGVNb250aC5nZXRNb250aCgpIC0gMSwgMSk7XHJcbiAgICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXh0QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgIHRoaXMudmlzaWJsZU1vbnRoID0gbmV3IERhdGUodGhpcy52aXNpYmxlTW9udGguZ2V0RnVsbFllYXIoKSwgdGhpcy52aXNpYmxlTW9udGguZ2V0TW9udGgoKSArIDEsIDEpO1xyXG4gICAgICB0aGlzLnJlbmRlcigpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdG9kYXlCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgdGhpcy5qdW1wVG9Ub2RheSgpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgcmVmcmVzaEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICB0aGlzLnBsdWdpbi5yZWZyZXNoRXZlbnRzKHRydWUpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbmRlcigpIHtcclxuICAgIGlmICghdGhpcy5ncmlkRWwgfHwgIXRoaXMuZGV0YWlsc0VsIHx8ICF0aGlzLmhlYWRlclRpdGxlKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmdyaWRFbC5lbXB0eSgpO1xyXG4gICAgdGhpcy5kZXRhaWxzRWwuZW1wdHkoKTtcclxuXHJcbiAgICBjb25zdCBtb250aFN0YXJ0ID0gc3RhcnRPZk1vbnRoKHRoaXMudmlzaWJsZU1vbnRoKTtcclxuICAgIGNvbnN0IG1vbnRoRW5kID0gZW5kT2ZNb250aCh0aGlzLnZpc2libGVNb250aCk7XHJcbiAgICBjb25zdCBzdGFydFdlZWtkYXkgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy53ZWVrU3RhcnQgPT09IFwibW9uZGF5XCIgPyAxIDogMDtcclxuICAgIGNvbnN0IG9mZnNldCA9IChtb250aFN0YXJ0LmdldERheSgpIC0gc3RhcnRXZWVrZGF5ICsgNykgJSA3O1xyXG4gICAgY29uc3QgZ3JpZFN0YXJ0ID0gYWRkRGF5cyhtb250aFN0YXJ0LCAtb2Zmc2V0KTtcclxuICAgIGNvbnN0IGdyaWRFbmQgPSBhZGREYXlzKG1vbnRoRW5kLCAoNiAtICgobW9udGhFbmQuZ2V0RGF5KCkgLSBzdGFydFdlZWtkYXkgKyA3KSAlIDcpKSk7XHJcblxyXG4gICAgdGhpcy5ub3Rlc0J5RGF0ZSA9IHRoaXMuYnVpbGROb3Rlc0luZGV4KGdyaWRTdGFydCwgZ3JpZEVuZCk7XHJcbiAgICB0aGlzLm1heE5vdGVzRm9yR3JpZCA9IHRoaXMuZ2V0TWF4Tm90ZXNDb3VudCgpO1xyXG5cclxuICAgIHRoaXMuaGVhZGVyVGl0bGUuc2V0VGV4dChcclxuICAgICAgbW9udGhTdGFydC50b0xvY2FsZURhdGVTdHJpbmcoW10sIHsgeWVhcjogXCJudW1lcmljXCIsIG1vbnRoOiBcImxvbmdcIiB9KVxyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCB3ZWVrZGF5Um93ID0gdGhpcy5ncmlkRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX193ZWVrZGF5c1wiIH0pO1xyXG4gICAgY29uc3QgbGFiZWxzID0gdGhpcy5wbHVnaW4uc2V0dGluZ3Mud2Vla1N0YXJ0ID09PSBcIm1vbmRheVwiXHJcbiAgICAgID8gWy4uLldFRUtEQVlfTEFCRUxTLnNsaWNlKDEpLCBXRUVLREFZX0xBQkVMU1swXV1cclxuICAgICAgOiBXRUVLREFZX0xBQkVMUztcclxuXHJcbiAgICBmb3IgKGNvbnN0IGxhYmVsIG9mIGxhYmVscykge1xyXG4gICAgICB3ZWVrZGF5Um93LmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fd2Vla2RheVwiLCB0ZXh0OiBsYWJlbCB9KTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBkYXlzR3JpZCA9IHRoaXMuZ3JpZEVsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZGF5c1wiIH0pO1xyXG4gICAgbGV0IGN1cnNvciA9IG5ldyBEYXRlKGdyaWRTdGFydCk7XHJcbiAgICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCk7XHJcblxyXG4gICAgd2hpbGUgKGN1cnNvciA8PSBncmlkRW5kKSB7XHJcbiAgICAgIGNvbnN0IGNlbGxEYXRlID0gbmV3IERhdGUoY3Vyc29yKTtcclxuICAgICAgY29uc3QgY2VsbCA9IGRheXNHcmlkLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19kYXlcIiB9KTtcclxuICAgICAgY2VsbC5zZXRBdHRyKFwidHlwZVwiLCBcImJ1dHRvblwiKTtcclxuXHJcbiAgICAgIGlmIChjZWxsRGF0ZS5nZXRNb250aCgpICE9PSB0aGlzLnZpc2libGVNb250aC5nZXRNb250aCgpKSB7XHJcbiAgICAgICAgY2VsbC5hZGRDbGFzcyhcImlzLW91dHNpZGVcIik7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGNlbGxEYXRlLmdldERheSgpID09PSAwIHx8IGNlbGxEYXRlLmdldERheSgpID09PSA2KSB7XHJcbiAgICAgICAgY2VsbC5hZGRDbGFzcyhcImlzLXdlZWtlbmRcIik7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGlzU2FtZURheShjZWxsRGF0ZSwgdG9kYXkpKSB7XHJcbiAgICAgICAgY2VsbC5hZGRDbGFzcyhcImlzLXRvZGF5XCIpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChpc1NhbWVEYXkoY2VsbERhdGUsIHRoaXMuc2VsZWN0ZWREYXRlKSkge1xyXG4gICAgICAgIGNlbGwuYWRkQ2xhc3MoXCJpcy1zZWxlY3RlZFwiKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgbnVtYmVyRWwgPSBjZWxsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZGF5LW51bWJlclwiIH0pO1xyXG4gICAgICBudW1iZXJFbC5zZXRUZXh0KFN0cmluZyhjZWxsRGF0ZS5nZXREYXRlKCkpKTtcclxuXHJcbiAgICAgIGNvbnN0IHN1YnRpdGxlID0gY2VsbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2RheS1zdWJ0aXRsZVwiIH0pO1xyXG4gICAgICBjb25zdCBub3Rlc0ZvckRheSA9IHRoaXMuZ2V0Tm90ZXNGb3JEYXkoY2VsbERhdGUpO1xyXG4gICAgICBpZiAobm90ZXNGb3JEYXkubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIHN1YnRpdGxlLnNldFRleHQobm90ZXNGb3JEYXlbMF0udGl0bGUpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnN0IGRheUV2ZW50cyA9IHRoaXMuZ2V0RXZlbnRzRm9yRGF5KGNlbGxEYXRlKTtcclxuICAgICAgICBpZiAoZGF5RXZlbnRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIHN1YnRpdGxlLnNldFRleHQoZGF5RXZlbnRzWzBdLnN1bW1hcnkpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgaW5kaWNhdG9yID0gY2VsbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2RheS1pbmRpY2F0b3JcIiB9KTtcclxuICAgICAgaWYgKG5vdGVzRm9yRGF5Lmxlbmd0aCA+IDApIHtcclxuICAgICAgICBjb25zdCByYXRpbyA9IE1hdGgubWluKG5vdGVzRm9yRGF5Lmxlbmd0aCAvIHRoaXMubWF4Tm90ZXNGb3JHcmlkLCAxKTtcclxuICAgICAgICBjb25zdCB3aWR0aCA9IE1hdGgubWF4KDAuMjUsIHJhdGlvKSAqIDEwMDtcclxuICAgICAgICBjb25zdCBiYXIgPSBpbmRpY2F0b3IuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19kYXktYmFyXCIgfSk7XHJcbiAgICAgICAgYmFyLnN0eWxlLndpZHRoID0gYCR7d2lkdGh9JWA7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNlbGwuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZW50ZXJcIiwgKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuc2hvd0hvdmVyUHJldmlldyhjZWxsLCBub3Rlc0ZvckRheSk7XHJcbiAgICAgIH0pO1xyXG4gICAgICBjZWxsLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWxlYXZlXCIsICgpID0+IHtcclxuICAgICAgICB0aGlzLmhpZGVIb3ZlclByZXZpZXcoKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBjZWxsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5zZWxlY3RlZERhdGUgPSBjZWxsRGF0ZTtcclxuICAgICAgICBpZiAoY2VsbERhdGUuZ2V0TW9udGgoKSAhPT0gdGhpcy52aXNpYmxlTW9udGguZ2V0TW9udGgoKSkge1xyXG4gICAgICAgICAgdGhpcy52aXNpYmxlTW9udGggPSBuZXcgRGF0ZShjZWxsRGF0ZS5nZXRGdWxsWWVhcigpLCBjZWxsRGF0ZS5nZXRNb250aCgpLCAxKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5yZW5kZXIoKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBjdXJzb3IgPSBhZGREYXlzKGN1cnNvciwgMSk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5yZW5kZXJEZXRhaWxzKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbmRlckRldGFpbHMoKSB7XHJcbiAgICBpZiAoIXRoaXMuZGV0YWlsc0VsKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHRoaXMuZGV0YWlsc0VsLmVtcHR5KCk7XHJcblxyXG4gICAgY29uc3QgdGl0bGUgPSB0aGlzLmRldGFpbHNFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2RldGFpbHMtdGl0bGVcIiB9KTtcclxuICAgIHRpdGxlLnNldFRleHQoXHJcbiAgICAgIHRoaXMuc2VsZWN0ZWREYXRlLnRvTG9jYWxlRGF0ZVN0cmluZyhbXSwgeyBtb250aDogXCJsb25nXCIsIGRheTogXCJudW1lcmljXCIsIHllYXI6IFwibnVtZXJpY1wiIH0pXHJcbiAgICApO1xyXG5cclxuICAgIGNvbnN0IG5vdGVzID0gdGhpcy5nZXROb3Rlc0ZvckRheSh0aGlzLnNlbGVjdGVkRGF0ZSk7XHJcbiAgICBjb25zdCBldmVudHMgPSB0aGlzLmdldEV2ZW50c0ZvckRheSh0aGlzLnNlbGVjdGVkRGF0ZSk7XHJcblxyXG4gICAgaWYgKGV2ZW50cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGNvbnN0IGV2ZW50c1NlY3Rpb24gPSB0aGlzLmRldGFpbHNFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX3NlY3Rpb25cIiB9KTtcclxuICAgICAgZXZlbnRzU2VjdGlvbi5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX3NlY3Rpb24tdGl0bGVcIiwgdGV4dDogXCJFdmVudHNcIiB9KTtcclxuICAgICAgY29uc3QgZXZlbnRzTGlzdCA9IGV2ZW50c1NlY3Rpb24uY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ldmVudC1saXN0XCIgfSk7XHJcbiAgICAgIGZvciAoY29uc3QgZXZlbnQgb2YgZXZlbnRzKSB7XHJcbiAgICAgICAgY29uc3Qgcm93ID0gZXZlbnRzTGlzdC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2V2ZW50LXJvd1wiIH0pO1xyXG4gICAgICAgIHJvdy5jcmVhdGVEaXYoe1xyXG4gICAgICAgICAgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ldmVudC10aW1lXCIsXHJcbiAgICAgICAgICB0ZXh0OiBldmVudC5hbGxEYXkgPyBcIkFsbCBkYXlcIiA6IGZvcm1hdFRpbWUoZXZlbnQuc3RhcnQsIHRoaXMucGx1Z2luLnNldHRpbmdzLnRpbWVGb3JtYXQpXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcm93LmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZXZlbnQtc3VtbWFyeVwiLCB0ZXh0OiBldmVudC5zdW1tYXJ5IH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG5vdGVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgY29uc3Qgbm90ZXNTZWN0aW9uID0gdGhpcy5kZXRhaWxzRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19zZWN0aW9uXCIgfSk7XHJcbiAgICAgIG5vdGVzU2VjdGlvbi5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX3NlY3Rpb24tdGl0bGVcIiwgdGV4dDogXCJOb3Rlc1wiIH0pO1xyXG4gICAgICBjb25zdCBub3Rlc0xpc3QgPSBub3Rlc1NlY3Rpb24uY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ub3Rlcy1saXN0XCIgfSk7XHJcbiAgICAgIGZvciAoY29uc3Qgbm90ZSBvZiBub3Rlcykge1xyXG4gICAgICAgIGNvbnN0IHJvdyA9IG5vdGVzTGlzdC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1yb3dcIiB9KTtcclxuICAgICAgICByb3cuc2V0QXR0cihcInR5cGVcIiwgXCJidXR0b25cIik7XHJcbiAgICAgICAgcm93LmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS10aXRsZVwiLCB0ZXh0OiBub3RlLnRpdGxlIH0pO1xyXG4gICAgICAgIGNvbnN0IGV4Y2VycHRFbCA9IHJvdy5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtZXhjZXJwdFwiLCB0ZXh0OiBub3RlLmV4Y2VycHQgfSk7XHJcbiAgICAgICAgdGhpcy5lbnN1cmVFeGNlcnB0KG5vdGUuZmlsZSwgZXhjZXJwdEVsKTtcclxuICAgICAgICByb3cuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHRoaXMub3Blbk5vdGUobm90ZS5maWxlKSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAobm90ZXMubGVuZ3RoID09PSAwICYmIGV2ZW50cy5sZW5ndGggPT09IDApIHtcclxuICAgICAgdGhpcy5kZXRhaWxzRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzLWVtcHR5XCIsIHRleHQ6IFwiTm8gbm90ZXMgb3IgZXZlbnRzXCIgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG5vdGVzLmxlbmd0aCA9PT0gMCAmJiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hbGxvd0NyZWF0ZU5vdGUpIHtcclxuICAgICAgY29uc3QgYWN0aW9uID0gdGhpcy5kZXRhaWxzRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzLWFjdGlvblwiIH0pO1xyXG4gICAgICBjb25zdCBidXR0b24gPSBhY3Rpb24uY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIkNyZWF0ZSBub3RlXCIgfSk7XHJcbiAgICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCB0aGlzLnBsdWdpbi5jcmVhdGVOb3RlRm9yRGF0ZSh0aGlzLnNlbGVjdGVkRGF0ZSk7XHJcbiAgICAgICAgaWYgKGZpbGUpIHtcclxuICAgICAgICAgIHRoaXMub3Blbk5vdGUoZmlsZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0RXZlbnRzRm9yRGF5KGRheTogRGF0ZSkge1xyXG4gICAgY29uc3Qgc3RhcnQgPSBjbGFtcFRvRGF5U3RhcnQoZGF5KTtcclxuICAgIGNvbnN0IGVuZCA9IGNsYW1wVG9EYXlFbmQoZGF5KTtcclxuICAgIHJldHVybiB0aGlzLmV2ZW50c1xyXG4gICAgICAuZmlsdGVyKChldmVudCkgPT4gZXZlbnQuc3RhcnQgPD0gZW5kICYmIGV2ZW50LmVuZCA+PSBzdGFydClcclxuICAgICAgLnNvcnQoKGEsIGIpID0+IGEuc3RhcnQuZ2V0VGltZSgpIC0gYi5zdGFydC5nZXRUaW1lKCkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBidWlsZE5vdGVzSW5kZXgoc3RhcnQ6IERhdGUsIGVuZDogRGF0ZSkge1xyXG4gICAgY29uc3QgaW5kZXggPSBuZXcgTWFwPHN0cmluZywgTGlua2VkTm90ZVtdPigpO1xyXG4gICAgY29uc3Qgc3RhcnREYXkgPSBjbGFtcFRvRGF5U3RhcnQoc3RhcnQpO1xyXG4gICAgY29uc3QgZW5kRGF5ID0gY2xhbXBUb0RheUVuZChlbmQpO1xyXG4gICAgY29uc3QgZmllbGRzID0gdGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZURhdGVGaWVsZHNcclxuICAgICAgLm1hcCgoZmllbGQpID0+IGZpZWxkLnRyaW0oKSlcclxuICAgICAgLmZpbHRlcigoZmllbGQpID0+IGZpZWxkLmxlbmd0aCA+IDApO1xyXG5cclxuICAgIGlmIChmaWVsZHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIHJldHVybiBpbmRleDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmaWxlcyA9IHRoaXMucGx1Z2luLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCk7XHJcbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcclxuICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLnBsdWdpbi5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XHJcbiAgICAgIGlmICghY2FjaGU/LmZyb250bWF0dGVyKSB7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGZvciAoY29uc3QgZmllbGQgb2YgZmllbGRzKSB7XHJcbiAgICAgICAgY29uc3QgcmF3VmFsdWUgPSBjYWNoZS5mcm9udG1hdHRlcltmaWVsZF07XHJcbiAgICAgICAgaWYgKCFyYXdWYWx1ZSkge1xyXG4gICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IGRhdGVzID0gZXh0cmFjdEZyb250bWF0dGVyRGF0ZXMocmF3VmFsdWUpO1xyXG4gICAgICAgIGZvciAoY29uc3QgZGF0ZSBvZiBkYXRlcykge1xyXG4gICAgICAgICAgaWYgKGRhdGUgPCBzdGFydERheSB8fCBkYXRlID4gZW5kRGF5KSB7XHJcbiAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgY29uc3Qga2V5ID0gZm9ybWF0RGF0ZUtleShkYXRlKTtcclxuICAgICAgICAgIGNvbnN0IGxpc3QgPSBpbmRleC5nZXQoa2V5KSA/PyBbXTtcclxuICAgICAgICAgIGNvbnN0IHRpdGxlID0gZmlsZS5iYXNlbmFtZTtcclxuICAgICAgICAgIGxpc3QucHVzaCh7XHJcbiAgICAgICAgICAgIGZpbGUsXHJcbiAgICAgICAgICAgIHRpdGxlLFxyXG4gICAgICAgICAgICBleGNlcnB0OiB0aGlzLm5vdGVFeGNlcnB0Q2FjaGUuZ2V0KGZpbGUucGF0aCkgPz8gXCJcIlxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICBpbmRleC5zZXQoa2V5LCBsaXN0KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmb3IgKGNvbnN0IFtrZXksIGxpc3RdIG9mIGluZGV4LmVudHJpZXMoKSkge1xyXG4gICAgICBsaXN0LnNvcnQoKGEsIGIpID0+IGEudGl0bGUubG9jYWxlQ29tcGFyZShiLnRpdGxlKSk7XHJcbiAgICAgIGluZGV4LnNldChrZXksIGxpc3QpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBpbmRleDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0Tm90ZXNGb3JEYXkoZGF5OiBEYXRlKSB7XHJcbiAgICByZXR1cm4gdGhpcy5ub3Rlc0J5RGF0ZS5nZXQoZm9ybWF0RGF0ZUtleShkYXkpKSA/PyBbXTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0TWF4Tm90ZXNDb3VudCgpIHtcclxuICAgIGxldCBtYXhDb3VudCA9IDE7XHJcbiAgICBmb3IgKGNvbnN0IGxpc3Qgb2YgdGhpcy5ub3Rlc0J5RGF0ZS52YWx1ZXMoKSkge1xyXG4gICAgICBpZiAobGlzdC5sZW5ndGggPiBtYXhDb3VudCkge1xyXG4gICAgICAgIG1heENvdW50ID0gbGlzdC5sZW5ndGg7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBtYXhDb3VudDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZW5zdXJlSG92ZXJQcmV2aWV3KCkge1xyXG4gICAgaWYgKHRoaXMuaG92ZXJQcmV2aWV3RWwpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5ob3ZlclByZXZpZXdFbCA9IGRvY3VtZW50LmJvZHkuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXByZXZpZXdcIiB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2hvd0hvdmVyUHJldmlldyhhbmNob3I6IEhUTUxFbGVtZW50LCBub3RlczogTGlua2VkTm90ZVtdKSB7XHJcbiAgICBpZiAoIXRoaXMuaG92ZXJQcmV2aWV3RWwgfHwgbm90ZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmhvdmVyUHJldmlld0VsLmVtcHR5KCk7XHJcbiAgICBmb3IgKGNvbnN0IG5vdGUgb2Ygbm90ZXMuc2xpY2UoMCwgMykpIHtcclxuICAgICAgY29uc3Qgcm93ID0gdGhpcy5ob3ZlclByZXZpZXdFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtcHJldmlldy1yb3dcIiB9KTtcclxuICAgICAgcm93LmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1wcmV2aWV3LXRpdGxlXCIsIHRleHQ6IG5vdGUudGl0bGUgfSk7XHJcbiAgICAgIGNvbnN0IGV4Y2VycHRFbCA9IHJvdy5jcmVhdGVEaXYoe1xyXG4gICAgICAgIGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1wcmV2aWV3LWV4Y2VycHRcIixcclxuICAgICAgICB0ZXh0OiBub3RlLmV4Y2VycHRcclxuICAgICAgfSk7XHJcbiAgICAgIHRoaXMuZW5zdXJlRXhjZXJwdChub3RlLmZpbGUsIGV4Y2VycHRFbCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5ob3ZlclByZXZpZXdFbC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xyXG5cclxuICAgIGNvbnN0IHJlY3QgPSBhbmNob3IuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICBjb25zdCBwcmV2aWV3V2lkdGggPSAyMjA7XHJcbiAgICBjb25zdCBwcmV2aWV3SGVpZ2h0ID0gdGhpcy5ob3ZlclByZXZpZXdFbC5vZmZzZXRIZWlnaHQgfHwgODA7XHJcbiAgICBjb25zdCBwYWRkaW5nID0gODtcclxuICAgIGNvbnN0IHZpZXdwb3J0V2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aDtcclxuICAgIGNvbnN0IHZpZXdwb3J0SGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xyXG5cclxuICAgIGxldCBsZWZ0ID0gcmVjdC5sZWZ0ICsgcmVjdC53aWR0aCAvIDIgLSBwcmV2aWV3V2lkdGggLyAyO1xyXG4gICAgbGVmdCA9IE1hdGgubWF4KHBhZGRpbmcsIE1hdGgubWluKGxlZnQsIHZpZXdwb3J0V2lkdGggLSBwcmV2aWV3V2lkdGggLSBwYWRkaW5nKSk7XHJcblxyXG4gICAgbGV0IHRvcCA9IHJlY3QuYm90dG9tICsgNjtcclxuICAgIGlmICh0b3AgKyBwcmV2aWV3SGVpZ2h0ID4gdmlld3BvcnRIZWlnaHQgLSBwYWRkaW5nKSB7XHJcbiAgICAgIHRvcCA9IHJlY3QudG9wIC0gcHJldmlld0hlaWdodCAtIDY7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5ob3ZlclByZXZpZXdFbC5zdHlsZS53aWR0aCA9IGAke3ByZXZpZXdXaWR0aH1weGA7XHJcbiAgICB0aGlzLmhvdmVyUHJldmlld0VsLnN0eWxlLmxlZnQgPSBgJHtsZWZ0fXB4YDtcclxuICAgIHRoaXMuaG92ZXJQcmV2aWV3RWwuc3R5bGUudG9wID0gYCR7TWF0aC5tYXgocGFkZGluZywgdG9wKX1weGA7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhpZGVIb3ZlclByZXZpZXcoKSB7XHJcbiAgICBpZiAodGhpcy5ob3ZlclByZXZpZXdFbCkge1xyXG4gICAgICB0aGlzLmhvdmVyUHJldmlld0VsLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZW5zdXJlRXhjZXJwdChmaWxlOiBURmlsZSwgdGFyZ2V0RWw6IEhUTUxFbGVtZW50KSB7XHJcbiAgICBpZiAodGhpcy5ub3RlRXhjZXJwdENhY2hlLmhhcyhmaWxlLnBhdGgpKSB7XHJcbiAgICAgIHRhcmdldEVsLnNldFRleHQodGhpcy5ub3RlRXhjZXJwdENhY2hlLmdldChmaWxlLnBhdGgpID8/IFwiXCIpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLnBsdWdpbi5hcHAudmF1bHQuY2FjaGVkUmVhZChmaWxlKS50aGVuKChjb250ZW50KSA9PiB7XHJcbiAgICAgIGNvbnN0IGxpbmVzID0gY29udGVudC5zcGxpdChcIlxcblwiKTtcclxuICAgICAgbGV0IHN0YXJ0SW5kZXggPSAwO1xyXG4gICAgICBpZiAobGluZXNbMF0/LnRyaW0oKSA9PT0gXCItLS1cIikge1xyXG4gICAgICAgIGNvbnN0IGVuZEluZGV4ID0gbGluZXMuc2xpY2UoMSkuZmluZEluZGV4KChsaW5lKSA9PiBsaW5lLnRyaW0oKSA9PT0gXCItLS1cIik7XHJcbiAgICAgICAgaWYgKGVuZEluZGV4ID49IDApIHtcclxuICAgICAgICAgIHN0YXJ0SW5kZXggPSBlbmRJbmRleCArIDI7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IGZpcnN0TGluZSA9IGxpbmVzLnNsaWNlKHN0YXJ0SW5kZXgpLmZpbmQoKGxpbmUpID0+IGxpbmUudHJpbSgpLmxlbmd0aCA+IDApID8/IFwiXCI7XHJcbiAgICAgIGNvbnN0IGV4Y2VycHQgPSBmaXJzdExpbmUucmVwbGFjZSgvXiNcXHMrLywgXCJcIikudHJpbSgpO1xyXG4gICAgICB0aGlzLm5vdGVFeGNlcnB0Q2FjaGUuc2V0KGZpbGUucGF0aCwgZXhjZXJwdCk7XHJcbiAgICAgIHRhcmdldEVsLnNldFRleHQoZXhjZXJwdCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgb3Blbk5vdGUoZmlsZTogVEZpbGUpIHtcclxuICAgIGNvbnN0IGxlYWYgPSB0aGlzLnBsdWdpbi5hcHAud29ya3NwYWNlLmdldExlYWYoZmFsc2UpO1xyXG4gICAgY29uc3QgY2FjaGUgPSB0aGlzLnBsdWdpbi5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XHJcbiAgICBjb25zdCBsaW5lID0gY2FjaGU/LmZyb250bWF0dGVyUG9zaXRpb24/LmVuZD8ubGluZSA/PyAwO1xyXG4gICAgYXdhaXQgbGVhZi5vcGVuRmlsZShmaWxlLCB7IHN0YXRlOiB7IGxpbmUgfSwgYWN0aXZlOiB0cnVlIH0pO1xyXG4gIH1cclxufVxyXG5cclxuY2xhc3MgQ2FsZW5kYXJTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XHJcbiAgcHJpdmF0ZSBwbHVnaW46IENhbGVuZGFyUGx1Z2luO1xyXG4gIHByaXZhdGUgc2VsZWN0ZWRUZW1wbGF0ZUZvbGRlciA9IFwiXCI7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IENhbGVuZGFyUGx1Z2luKSB7XHJcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XHJcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICB9XHJcblxyXG4gIGRpc3BsYXkoKTogdm9pZCB7XHJcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xyXG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcclxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIkNhbGVuZGFyXCIgfSk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiUmVmcmVzaCBpbnRlcnZhbCAobWludXRlcylcIilcclxuICAgICAgLnNldERlc2MoXCJIb3cgb2Z0ZW4gY2FsZW5kYXIgc291cmNlcyBhcmUgcmVmcmVzaGVkLlwiKVxyXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cclxuICAgICAgICB0ZXh0XHJcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCIzMFwiKVxyXG4gICAgICAgICAgLnNldFZhbHVlKFN0cmluZyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5yZWZyZXNoSW50ZXJ2YWxNaW51dGVzKSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gTnVtYmVyKHZhbHVlKTtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MucmVmcmVzaEludGVydmFsTWludXRlcyA9IE51bWJlci5pc0Zpbml0ZShwYXJzZWQpICYmIHBhcnNlZCA+IDBcclxuICAgICAgICAgICAgICA/IHBhcnNlZFxyXG4gICAgICAgICAgICAgIDogREVGQVVMVF9TRVRUSU5HUy5yZWZyZXNoSW50ZXJ2YWxNaW51dGVzO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVmcmVzaEV2ZW50cyh0cnVlKTtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVzdGFydEF1dG9SZWZyZXNoKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIldlZWsgc3RhcnRzIG9uXCIpXHJcbiAgICAgIC5hZGREcm9wZG93bigoZHJvcGRvd24pID0+XHJcbiAgICAgICAgZHJvcGRvd25cclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJzdW5kYXlcIiwgXCJTdW5kYXlcIilcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCJtb25kYXlcIiwgXCJNb25kYXlcIilcclxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy53ZWVrU3RhcnQpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlOiBDYWxlbmRhclNldHRpbmdzW1wid2Vla1N0YXJ0XCJdKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLndlZWtTdGFydCA9IHZhbHVlO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVuZGVyVmlld3MoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiVGltZSBmb3JtYXRcIilcclxuICAgICAgLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT5cclxuICAgICAgICBkcm9wZG93blxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcIjI0aFwiLCBcIjI0LWhvdXJcIilcclxuICAgICAgICAgIC5hZGRPcHRpb24oXCIxMmhcIiwgXCIxMi1ob3VyXCIpXHJcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MudGltZUZvcm1hdClcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWU6IENhbGVuZGFyU2V0dGluZ3NbXCJ0aW1lRm9ybWF0XCJdKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnRpbWVGb3JtYXQgPSB2YWx1ZTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnJlbmRlclZpZXdzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlRvZGF5IGhpZ2hsaWdodFwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkhpZ2hsaWdodCBjb2xvciBmb3IgdG9kYXkuXCIpXHJcbiAgICAgIC5hZGRDb2xvclBpY2tlcigocGlja2VyKSA9PlxyXG4gICAgICAgIHBpY2tlclxyXG4gICAgICAgICAgLnNldFZhbHVlKHJlc29sdmVIaWdobGlnaHRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy50b2RheUhpZ2hsaWdodCwgXCItLWludGVyYWN0aXZlLWFjY2VudFwiKSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MudG9kYXlIaWdobGlnaHQgPSB2YWx1ZTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmFwcGx5SGlnaGxpZ2h0VmFyaWFibGVzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIlNlbGVjdGVkIGRhdGUgaGlnaGxpZ2h0XCIpXHJcbiAgICAgIC5zZXREZXNjKFwiSGlnaGxpZ2h0IGNvbG9yIGZvciB0aGUgc2VsZWN0ZWQgZGF0ZS5cIilcclxuICAgICAgLmFkZENvbG9yUGlja2VyKChwaWNrZXIpID0+XHJcbiAgICAgICAgcGlja2VyXHJcbiAgICAgICAgICAuc2V0VmFsdWUocmVzb2x2ZUhpZ2hsaWdodFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNlbGVjdGVkSGlnaGxpZ2h0LCBcIi0tdGV4dC1hY2NlbnRcIikpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnNlbGVjdGVkSGlnaGxpZ2h0ID0gdmFsdWU7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5hcHBseUhpZ2hsaWdodFZhcmlhYmxlcygpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJOb3RlIGRhdGUgZmllbGRzXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiQ29tbWEtc2VwYXJhdGVkIGZyb250bWF0dGVyIGZpZWxkcyB1c2VkIHRvIGxpbmsgbm90ZXMgdG8gZGF0ZXMuXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHRcclxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcImRhdGUsIHN0YXJ0LCBlbmRcIilcclxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5ub3RlRGF0ZUZpZWxkcy5qb2luKFwiLCBcIikpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVEYXRlRmllbGRzID0gdmFsdWVcclxuICAgICAgICAgICAgICAuc3BsaXQoXCIsXCIpXHJcbiAgICAgICAgICAgICAgLm1hcCgoZmllbGQpID0+IGZpZWxkLnRyaW0oKSlcclxuICAgICAgICAgICAgICAuZmlsdGVyKChmaWVsZCkgPT4gZmllbGQubGVuZ3RoID4gMCk7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5yZW5kZXJWaWV3cygpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJBbGxvdyBjcmVhdGUgbm90ZVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIlNob3cgYSBxdWljayBhY3Rpb24gdG8gY3JlYXRlIGEgbm90ZSBmb3IgdGhlIHNlbGVjdGVkIGRhdGUuXCIpXHJcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cclxuICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWxsb3dDcmVhdGVOb3RlKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmFsbG93Q3JlYXRlTm90ZSA9IHZhbHVlO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICB0aGlzLnBsdWdpbi5yZW5kZXJWaWV3cygpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiTm90ZSBkZW5zaXR5IGJhciBjb2xvclwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkNvbG9yIGZvciB0aGUgbm90ZSBkZW5zaXR5IGluZGljYXRvciBiYXIuXCIpXHJcbiAgICAgIC5hZGRDb2xvclBpY2tlcigocGlja2VyKSA9PlxyXG4gICAgICAgIHBpY2tlclxyXG4gICAgICAgICAgLnNldFZhbHVlKHJlc29sdmVIaWdobGlnaHRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5ub3RlQmFyQ29sb3IsIFwiLS10ZXh0LWFjY2VudFwiKSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZUJhckNvbG9yID0gdmFsdWU7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5hcHBseUhpZ2hsaWdodFZhcmlhYmxlcygpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBjb25zdCB0ZW1wbGF0ZVNldHRpbmcgPSBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJOb3RlIHRlbXBsYXRlXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiQ2hvb3NlIGEgdmF1bHQgdGVtcGxhdGUgZmlsZS5cIik7XHJcblxyXG4gICAgY29uc3QgdGVtcGxhdGVIaW50ID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19zZXR0aW5nLWhpbnRcIiB9KTtcclxuXHJcbiAgICBjb25zdCB1cGRhdGVUZW1wbGF0ZUhpbnQgPSAod2FybmluZyA9IFwiXCIpID0+IHtcclxuICAgICAgaWYgKHdhcm5pbmcpIHtcclxuICAgICAgICB0ZW1wbGF0ZUhpbnQuc2V0VGV4dCh3YXJuaW5nKTtcclxuICAgICAgICB0ZW1wbGF0ZUhpbnQuYWRkQ2xhc3MoXCJpcy1lcnJvclwiKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgcGF0aCA9IHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVUZW1wbGF0ZVBhdGgudHJpbSgpO1xyXG4gICAgICBpZiAoIXBhdGgpIHtcclxuICAgICAgICB0ZW1wbGF0ZUhpbnQuc2V0VGV4dChcIk5vIHRlbXBsYXRlIHNlbGVjdGVkLlwiKTtcclxuICAgICAgICB0ZW1wbGF0ZUhpbnQucmVtb3ZlQ2xhc3MoXCJpcy1lcnJvclwiKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgZmlsZSA9IHRoaXMucGx1Z2luLmdldFRlbXBsYXRlRmlsZShwYXRoKTtcclxuICAgICAgaWYgKGZpbGUpIHtcclxuICAgICAgICB0ZW1wbGF0ZUhpbnQuc2V0VGV4dChgVGVtcGxhdGU6ICR7ZmlsZS5wYXRofWApO1xyXG4gICAgICAgIHRlbXBsYXRlSGludC5yZW1vdmVDbGFzcyhcImlzLWVycm9yXCIpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICB0ZW1wbGF0ZUhpbnQuc2V0VGV4dChcIlRlbXBsYXRlIG5vdCBmb3VuZCBpbiB0aGlzIHZhdWx0LlwiKTtcclxuICAgICAgdGVtcGxhdGVIaW50LmFkZENsYXNzKFwiaXMtZXJyb3JcIik7XHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IGN1cnJlbnRQYXRoID0gdGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZVRlbXBsYXRlUGF0aDtcclxuICAgIGNvbnN0IGN1cnJlbnRGb2xkZXIgPSBjdXJyZW50UGF0aCA/IGN1cnJlbnRQYXRoLnNwbGl0KFwiL1wiKS5zbGljZSgwLCAtMSkuam9pbihcIi9cIikgOiBcIlwiO1xyXG4gICAgaWYgKCF0aGlzLnNlbGVjdGVkVGVtcGxhdGVGb2xkZXIpIHtcclxuICAgICAgdGhpcy5zZWxlY3RlZFRlbXBsYXRlRm9sZGVyID0gY3VycmVudEZvbGRlcjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmb2xkZXJPcHRpb25zID0gdGhpcy5wbHVnaW4uZ2V0VGVtcGxhdGVGb2xkZXJPcHRpb25zKCk7XHJcbiAgICB0ZW1wbGF0ZVNldHRpbmcuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XHJcbiAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihcIlwiLCBcIkFsbCBmb2xkZXJzXCIpO1xyXG4gICAgICBmb3IgKGNvbnN0IGZvbGRlciBvZiBmb2xkZXJPcHRpb25zKSB7XHJcbiAgICAgICAgZHJvcGRvd24uYWRkT3B0aW9uKGZvbGRlciwgZm9sZGVyIHx8IFwiKHJvb3QpXCIpO1xyXG4gICAgICB9XHJcbiAgICAgIGRyb3Bkb3duLnNldFZhbHVlKHRoaXMuc2VsZWN0ZWRUZW1wbGF0ZUZvbGRlcik7XHJcbiAgICAgIGRyb3Bkb3duLm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xyXG4gICAgICAgIHRoaXMuc2VsZWN0ZWRUZW1wbGF0ZUZvbGRlciA9IHZhbHVlO1xyXG4gICAgICAgIHRoaXMuZGlzcGxheSgpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHRlbXBsYXRlT3B0aW9ucyA9IHRoaXMucGx1Z2luLmdldFRlbXBsYXRlT3B0aW9ucyh0aGlzLnNlbGVjdGVkVGVtcGxhdGVGb2xkZXIpO1xyXG4gICAgdGVtcGxhdGVTZXR0aW5nLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT4ge1xyXG4gICAgICBkcm9wZG93bi5hZGRPcHRpb24oXCJcIiwgXCJOb25lXCIpO1xyXG4gICAgICBmb3IgKGNvbnN0IG9wdGlvbiBvZiB0ZW1wbGF0ZU9wdGlvbnMpIHtcclxuICAgICAgICBkcm9wZG93bi5hZGRPcHRpb24ob3B0aW9uLnBhdGgsIG9wdGlvbi5sYWJlbCk7XHJcbiAgICAgIH1cclxuICAgICAgZHJvcGRvd24uc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZVRlbXBsYXRlUGF0aCk7XHJcbiAgICAgIGRyb3Bkb3duLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVUZW1wbGF0ZVBhdGggPSB2YWx1ZTtcclxuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICB1cGRhdGVUZW1wbGF0ZUhpbnQoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB1cGRhdGVUZW1wbGF0ZUhpbnQoKTtcclxuXHJcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogXCJDYWxlbmRhciBzb3VyY2VzXCIgfSk7XHJcblxyXG4gICAgZm9yIChjb25zdCBzb3VyY2Ugb2YgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc291cmNlcykge1xyXG4gICAgICBjb25zdCBzb3VyY2VTZXR0aW5nID0gbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUoc291cmNlLm5hbWUgfHwgXCJVbm5hbWVkXCIpXHJcbiAgICAgICAgLnNldERlc2MoXCJFbmFibGVkIHNvdXJjZXMgYXJlIGZldGNoZWQgYW5kIG1lcmdlZC5cIik7XHJcblxyXG4gICAgICBzb3VyY2VTZXR0aW5nLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgIHRvZ2dsZVxyXG4gICAgICAgICAgLnNldFZhbHVlKHNvdXJjZS5lbmFibGVkKVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICBzb3VyY2UuZW5hYmxlZCA9IHZhbHVlO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVmcmVzaEV2ZW50cyh0cnVlKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgICBzb3VyY2VTZXR0aW5nLmFkZEJ1dHRvbigoYnV0dG9uKSA9PlxyXG4gICAgICAgIGJ1dHRvblxyXG4gICAgICAgICAgLnNldEJ1dHRvblRleHQoXCJSZW1vdmVcIilcclxuICAgICAgICAgIC5zZXRDdGEoKVxyXG4gICAgICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zb3VyY2VzID0gdGhpcy5wbHVnaW4uc2V0dGluZ3Muc291cmNlcy5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0uaWQgIT09IHNvdXJjZS5pZCk7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5yZWZyZXNoRXZlbnRzKHRydWUpO1xyXG4gICAgICAgICAgICB0aGlzLmRpc3BsYXkoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcIk5hbWVcIilcclxuICAgICAgICAuYWRkVGV4dCgodGV4dCkgPT5cclxuICAgICAgICAgIHRleHRcclxuICAgICAgICAgICAgLnNldFZhbHVlKHNvdXJjZS5uYW1lKVxyXG4gICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgc291cmNlLm5hbWUgPSB2YWx1ZTtcclxuICAgICAgICAgICAgICBzb3VyY2VTZXR0aW5nLnNldE5hbWUoc291cmNlLm5hbWUudHJpbSgpIHx8IFwiVW5uYW1lZFwiKTtcclxuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUoXCJpQ2FsIFVSTFwiKVxyXG4gICAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgICAgdGV4dFxyXG4gICAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJodHRwczovL2NhbGVuZGFyLmdvb2dsZS5jb20vY2FsZW5kYXIvaWNhbC8uLi5cIilcclxuICAgICAgICAgICAgLnNldFZhbHVlKHNvdXJjZS51cmwpXHJcbiAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICBzb3VyY2UudXJsID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnJlZnJlc2hFdmVudHModHJ1ZSk7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJBZGQgY2FsZW5kYXIgc291cmNlXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiQWRkIGFub3RoZXIgaUNhbCAoSUNTKSBzb3VyY2UuXCIpXHJcbiAgICAgIC5hZGRCdXR0b24oKGJ1dHRvbikgPT5cclxuICAgICAgICBidXR0b25cclxuICAgICAgICAgIC5zZXRCdXR0b25UZXh0KFwiQWRkXCIpXHJcbiAgICAgICAgICAub25DbGljayhhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnNvdXJjZXMucHVzaCh7XHJcbiAgICAgICAgICAgICAgaWQ6IGNyZWF0ZVNvdXJjZUlkKCksXHJcbiAgICAgICAgICAgICAgbmFtZTogXCJcIixcclxuICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxyXG4gICAgICAgICAgICAgIHVybDogXCJcIlxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIHRoaXMuZGlzcGxheSgpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENhbGVuZGFyUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcclxuICBzZXR0aW5nczogQ2FsZW5kYXJTZXR0aW5ncyA9IERFRkFVTFRfU0VUVElOR1M7XHJcbiAgcHJpdmF0ZSBzZXJ2aWNlID0gbmV3IEljYWxTZXJ2aWNlKHBhcnNlSWNhbCk7XHJcbiAgcHJpdmF0ZSBldmVudHM6IENhbGVuZGFyRXZlbnRbXSA9IFtdO1xyXG4gIHByaXZhdGUgcmVmcmVzaEhhbmRsZT86IG51bWJlcjtcclxuXHJcbiAgYXN5bmMgb25sb2FkKCkge1xyXG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcclxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgQ2FsZW5kYXJTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XHJcblxyXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoVklFV19UWVBFX0NBTEVOREFSLCAobGVhZikgPT4gbmV3IENhbGVuZGFyVmlldyhsZWFmLCB0aGlzKSk7XHJcbiAgICB0aGlzLnJlZ2lzdGVyQ29tbWFuZHMoKTtcclxuICAgIHRoaXMucmVnaXN0ZXJTdHlsZXMoKTtcclxuICAgIHRoaXMuYXBwbHlIaWdobGlnaHRWYXJpYWJsZXMoKTtcclxuXHJcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB7XHJcbiAgICAgIHRoaXMuYWN0aXZhdGVWaWV3KCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnJlZnJlc2hFdmVudHMoKTtcclxuICAgIHRoaXMuc3RhcnRBdXRvUmVmcmVzaCgpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgb251bmxvYWQoKSB7XHJcbiAgICBpZiAodGhpcy5yZWZyZXNoSGFuZGxlKSB7XHJcbiAgICAgIHdpbmRvdy5jbGVhckludGVydmFsKHRoaXMucmVmcmVzaEhhbmRsZSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9DQUxFTkRBUik7XHJcbiAgfVxyXG5cclxuICBhc3luYyBhY3RpdmF0ZVZpZXcoKSB7XHJcbiAgICBjb25zdCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldFJpZ2h0TGVhZihmYWxzZSkgPz8gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoZmFsc2UpO1xyXG4gICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoeyB0eXBlOiBWSUVXX1RZUEVfQ0FMRU5EQVIsIGFjdGl2ZTogdHJ1ZSB9KTtcclxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGxlYWYpO1xyXG4gICAgdGhpcy5hcHBseUhpZ2hsaWdodFZhcmlhYmxlcygpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgcmVmcmVzaEV2ZW50cyhmb3JjZVJlZnJlc2ggPSBmYWxzZSkge1xyXG4gICAgdGhpcy5ldmVudHMgPSBhd2FpdCB0aGlzLnNlcnZpY2UuZ2V0RXZlbnRzKFxyXG4gICAgICB0aGlzLnNldHRpbmdzLnNvdXJjZXMsXHJcbiAgICAgIHRoaXMuc2V0dGluZ3MucmVmcmVzaEludGVydmFsTWludXRlcyxcclxuICAgICAgZm9yY2VSZWZyZXNoXHJcbiAgICApO1xyXG4gICAgdGhpcy5yZW5kZXJWaWV3cygpO1xyXG4gIH1cclxuXHJcbiAgcmVuZGVyVmlld3MoKSB7XHJcbiAgICBjb25zdCBsZWF2ZXMgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9DQUxFTkRBUik7XHJcbiAgICBmb3IgKGNvbnN0IGxlYWYgb2YgbGVhdmVzKSB7XHJcbiAgICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXc7XHJcbiAgICAgIGlmICh2aWV3IGluc3RhbmNlb2YgQ2FsZW5kYXJWaWV3KSB7XHJcbiAgICAgICAgdmlldy5zZXRFdmVudHModGhpcy5ldmVudHMpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXN0YXJ0QXV0b1JlZnJlc2goKSB7XHJcbiAgICBpZiAodGhpcy5yZWZyZXNoSGFuZGxlKSB7XHJcbiAgICAgIHdpbmRvdy5jbGVhckludGVydmFsKHRoaXMucmVmcmVzaEhhbmRsZSk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnN0YXJ0QXV0b1JlZnJlc2goKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3RhcnRBdXRvUmVmcmVzaCgpIHtcclxuICAgIGNvbnN0IGludGVydmFsTXMgPSBNYXRoLm1heCh0aGlzLnNldHRpbmdzLnJlZnJlc2hJbnRlcnZhbE1pbnV0ZXMsIDEpICogNjAgKiAxMDAwO1xyXG4gICAgdGhpcy5yZWZyZXNoSGFuZGxlID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgdGhpcy5yZWZyZXNoRXZlbnRzKCk7XHJcbiAgICB9LCBpbnRlcnZhbE1zKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVnaXN0ZXJDb21tYW5kcygpIHtcclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImNhbGVuZGFyLW9wZW5cIixcclxuICAgICAgbmFtZTogXCJPcGVuIGNhbGVuZGFyXCIsXHJcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB0aGlzLmFjdGl2YXRlVmlldygpXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJjYWxlbmRhci10b2RheVwiLFxyXG4gICAgICBuYW1lOiBcIkp1bXAgdG8gdG9kYXlcIixcclxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuICAgICAgICBjb25zdCBsZWF2ZXMgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9DQUxFTkRBUik7XHJcbiAgICAgICAgZm9yIChjb25zdCBsZWFmIG9mIGxlYXZlcykge1xyXG4gICAgICAgICAgY29uc3QgdmlldyA9IGxlYWYudmlldztcclxuICAgICAgICAgIGlmICh2aWV3IGluc3RhbmNlb2YgQ2FsZW5kYXJWaWV3KSB7XHJcbiAgICAgICAgICAgIHZpZXcuanVtcFRvVG9kYXkoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImNhbGVuZGFyLXJlZnJlc2hcIixcclxuICAgICAgbmFtZTogXCJSZWZyZXNoIGNhbGVuZGFyXCIsXHJcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB0aGlzLnJlZnJlc2hFdmVudHModHJ1ZSlcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWdpc3RlclN0eWxlcygpIHtcclxuICAgIGNvbnN0IHN0eWxlRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XHJcbiAgICBzdHlsZUVsLnRleHRDb250ZW50ID0gYFxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXIge1xyXG4gICAgICAgIGhlaWdodDogMTAwJTtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbm9ybWFsKTtcclxuICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iYWNrZ3JvdW5kLXByaW1hcnkpO1xyXG4gICAgICAgIC0tY2FsZW5kYXItdG9kYXktYWNjZW50OiB2YXIoLS1pbnRlcmFjdGl2ZS1hY2NlbnQpO1xyXG4gICAgICAgIC0tY2FsZW5kYXItc2VsZWN0ZWQtYWNjZW50OiB2YXIoLS1pbnRlcmFjdGl2ZS1hY2NlbnQpO1xyXG4gICAgICAgIC0tY2FsZW5kYXItbm90ZS1iYXItY29sb3I6IHZhcigtLXRleHQtYWNjZW50KTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2hlYWRlciB7XHJcbiAgICAgICAgcGFkZGluZzogMTJweCAxNnB4O1xyXG4gICAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlcik7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGdhcDogOHB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbmF2IHtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGdhcDogOHB4O1xyXG4gICAgICAgIGZsZXgtd3JhcDogd3JhcDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25hdiBidXR0b24ge1xyXG4gICAgICAgIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50O1xyXG4gICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItYm9yZGVyKTtcclxuICAgICAgICBwYWRkaW5nOiA0cHggMTBweDtcclxuICAgICAgICBib3JkZXItcmFkaXVzOiA2cHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbm9ybWFsKTtcclxuICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19uYXYgYnV0dG9uOmhvdmVyIHtcclxuICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWhvdmVyKTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX3RpdGxlIHtcclxuICAgICAgICBmb250LXNpemU6IDE2cHg7XHJcbiAgICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2JvZHkge1xyXG4gICAgICAgIHBhZGRpbmc6IDEycHggMTZweCAxNnB4O1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgICBnYXA6IDE2cHg7XHJcbiAgICAgICAgb3ZlcmZsb3c6IGF1dG87XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ncmlkIHtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX193ZWVrZGF5cyB7XHJcbiAgICAgICAgZGlzcGxheTogZ3JpZDtcclxuICAgICAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IHJlcGVhdCg3LCBtaW5tYXgoMCwgMWZyKSk7XHJcbiAgICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxuICAgICAgICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlO1xyXG4gICAgICAgIGxldHRlci1zcGFjaW5nOiAwLjA0ZW07XHJcbiAgICAgICAgb3BhY2l0eTogMC45O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fd2Vla2RheSB7XHJcbiAgICAgICAgcGFkZGluZzogMnB4IDRweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RheXMge1xyXG4gICAgICAgIGRpc3BsYXk6IGdyaWQ7XHJcbiAgICAgICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiByZXBlYXQoNywgbWlubWF4KDAsIDFmcikpO1xyXG4gICAgICAgIGdhcDogNnB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5IHtcclxuICAgICAgICBib3JkZXI6IG5vbmU7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogMTBweDtcclxuICAgICAgICBwYWRkaW5nOiA4cHggNnB4IDEwcHg7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgICAgZ2FwOiA0cHg7XHJcbiAgICAgICAgbWluLWhlaWdodDogNThweDtcclxuICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXkuaXMtb3V0c2lkZSB7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LmlzLXdlZWtlbmQge1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RheS5pcy10b2RheSB7XHJcbiAgICAgICAgYmFja2dyb3VuZDogY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWNhbGVuZGFyLXRvZGF5LWFjY2VudCkgMTQlLCB2YXIoLS1iYWNrZ3JvdW5kLXByaW1hcnkpKTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RheS5pcy1zZWxlY3RlZCB7XHJcbiAgICAgICAgYm94LXNoYWRvdzogaW5zZXQgMCAwIDAgMXB4IHZhcigtLWNhbGVuZGFyLXNlbGVjdGVkLWFjY2VudCk7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXkuaXMtdG9kYXkuaXMtc2VsZWN0ZWQge1xyXG4gICAgICAgIGJhY2tncm91bmQ6IGNvbG9yLW1peChpbiBzcmdiLCB2YXIoLS1jYWxlbmRhci10b2RheS1hY2NlbnQpIDE0JSwgdmFyKC0tYmFja2dyb3VuZC1wcmltYXJ5KSk7XHJcbiAgICAgICAgYm94LXNoYWRvdzogaW5zZXQgMCAwIDAgMXB4IHZhcigtLWNhbGVuZGFyLXNlbGVjdGVkLWFjY2VudCk7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXktbnVtYmVyIHtcclxuICAgICAgICBmb250LXNpemU6IDE2cHg7XHJcbiAgICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RheS1zdWJ0aXRsZSB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxuICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xyXG4gICAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgICAgIG1pbi1oZWlnaHQ6IDE0cHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXktaW5kaWNhdG9yIHtcclxuICAgICAgICBtaW4taGVpZ2h0OiA4cHg7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xyXG4gICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xyXG4gICAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LWJhciB7XHJcbiAgICAgICAgaGVpZ2h0OiAycHg7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogOTk5cHg7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tY2FsZW5kYXItbm90ZS1iYXItY29sb3IpO1xyXG4gICAgICAgIG9wYWNpdHk6IDAuNjtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtcHJldmlldyB7XHJcbiAgICAgICAgcG9zaXRpb246IGZpeGVkO1xyXG4gICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJhY2tncm91bmQtcHJpbWFyeSk7XHJcbiAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpO1xyXG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcclxuICAgICAgICBwYWRkaW5nOiA4cHg7XHJcbiAgICAgICAgYm94LXNoYWRvdzogMCA2cHggMThweCByZ2JhKDAsIDAsIDAsIDAuMTIpO1xyXG4gICAgICAgIGRpc3BsYXk6IG5vbmU7XHJcbiAgICAgICAgei1pbmRleDogOTk5OTtcclxuICAgICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtcHJldmlldy1yb3cge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgICBnYXA6IDJweDtcclxuICAgICAgICBwYWRkaW5nOiA0cHggMDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtcHJldmlldy10aXRsZSB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbm9ybWFsKTtcclxuICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xyXG4gICAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXByZXZpZXctZXhjZXJwdCB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxMXB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxuICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xyXG4gICAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzLXRpdGxlIHtcclxuICAgICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RldGFpbHMge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgICBnYXA6IDhweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX3NlY3Rpb24ge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgICBnYXA6IDZweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25vdGVzLWxpc3QsXHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZXZlbnQtbGlzdCB7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGdhcDogNnB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fc2VjdGlvbi10aXRsZSB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxuICAgICAgICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlO1xyXG4gICAgICAgIGxldHRlci1zcGFjaW5nOiAwLjA0ZW07XHJcbiAgICAgICAgbWFyZ2luLXRvcDogNHB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1yb3cge1xyXG4gICAgICAgIGJvcmRlcjogbm9uZTtcclxuICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgICB0ZXh0LWFsaWduOiBsZWZ0O1xyXG4gICAgICAgIHBhZGRpbmc6IDZweCAwO1xyXG4gICAgICAgIGRpc3BsYXk6IGJsb2NrO1xyXG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcclxuICAgICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgICAgIGhlaWdodDogNDBweDtcclxuICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS10aXRsZSB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW5vcm1hbCk7XHJcbiAgICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xyXG4gICAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgICAgbGluZS1oZWlnaHQ6IDEuMjtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtZXhjZXJwdCB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxuICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xyXG4gICAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgICAgbGluZS1oZWlnaHQ6IDEuMjtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2V2ZW50LXJvdyB7XHJcbiAgICAgICAgZGlzcGxheTogZ3JpZDtcclxuICAgICAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDcycHggMWZyO1xyXG4gICAgICAgIGdhcDogMTJweDtcclxuICAgICAgICBwYWRkaW5nOiA0cHggMDtcclxuICAgICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZXZlbnQtdGltZSB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2V2ZW50LXN1bW1hcnkge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xyXG4gICAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzLWFjdGlvbiB7XHJcbiAgICAgICAgbWFyZ2luLXRvcDogOHB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlscy1hY3Rpb24gYnV0dG9uIHtcclxuICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlcik7XHJcbiAgICAgICAgcGFkZGluZzogNHB4IDEwcHg7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNnB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW5vcm1hbCk7XHJcbiAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fc2V0dGluZy1oaW50IHtcclxuICAgICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG4gICAgICAgIG1hcmdpbjogNHB4IDAgMTJweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX3NldHRpbmctaGludC5pcy1lcnJvciB7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtYWNjZW50KTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RldGFpbHMtcm93IHtcclxuICAgICAgICBkaXNwbGF5OiBncmlkO1xyXG4gICAgICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczogNzJweCAxZnI7XHJcbiAgICAgICAgZ2FwOiAxMnB4O1xyXG4gICAgICAgIHBhZGRpbmc6IDRweCAwO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlscy10aW1lIHtcclxuICAgICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlscy1zdW1tYXJ5IHtcclxuICAgICAgICBmb250LXNpemU6IDEzcHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzLWVtcHR5IHtcclxuICAgICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG4gICAgICB9XHJcbiAgICBgO1xyXG4gICAgc3R5bGVFbC5kYXRhc2V0LmNhbGVuZGFyVmlldyA9IFwidHJ1ZVwiO1xyXG4gICAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzdHlsZUVsKTtcclxuICAgIHRoaXMucmVnaXN0ZXIoKCkgPT4gc3R5bGVFbC5yZW1vdmUoKSk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5sb2FkRGF0YSgpO1xyXG4gICAgdGhpcy5zZXR0aW5ncyA9IHRoaXMubm9ybWFsaXplU2V0dGluZ3MoZGF0YSk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBzYXZlU2V0dGluZ3MoKSB7XHJcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xyXG4gICAgdGhpcy5hcHBseUhpZ2hsaWdodFZhcmlhYmxlcygpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgY3JlYXRlTm90ZUZvckRhdGUoZGF0ZTogRGF0ZSkge1xyXG4gICAgY29uc3QgZmllbGQgPSB0aGlzLnNldHRpbmdzLm5vdGVEYXRlRmllbGRzWzBdIHx8IFwiZGF0ZVwiO1xyXG4gICAgY29uc3QgdGl0bGUgPSBmb3JtYXREYXRlS2V5KGRhdGUpO1xyXG4gICAgY29uc3QgYmFzZVBhdGggPSBub3JtYWxpemVQYXRoKGAke3RpdGxlfS5tZGApO1xyXG4gICAgY29uc3QgZmlsZVBhdGggPSBhd2FpdCB0aGlzLmdldEF2YWlsYWJsZVBhdGgoYmFzZVBhdGgpO1xyXG4gICAgY29uc3QgdGVtcGxhdGVDb250ZW50ID0gYXdhaXQgdGhpcy5sb2FkVGVtcGxhdGVDb250ZW50KCk7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdGhpcy5idWlsZE5vdGVDb250ZW50KGZpZWxkLCB0aXRsZSwgdGVtcGxhdGVDb250ZW50KTtcclxuICAgIHRyeSB7XHJcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUoZmlsZVBhdGgsIGNvbnRlbnQpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihcIkZhaWxlZCB0byBjcmVhdGUgbm90ZVwiLCBlcnJvcik7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZ2V0VGVtcGxhdGVGaWxlKHBhdGg6IHN0cmluZykge1xyXG4gICAgY29uc3QgdHJpbW1lZCA9IHBhdGgudHJpbSgpO1xyXG4gICAgaWYgKCF0cmltbWVkKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG5vcm1hbGl6ZWRJbnB1dCA9IHRoaXMubm9ybWFsaXplVGVtcGxhdGVQYXRoKHRyaW1tZWQpLnBhdGg7XHJcbiAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplUGF0aChub3JtYWxpemVQYXRoU2xhc2hlcyhub3JtYWxpemVkSW5wdXQpLnJlcGxhY2UoL15cXC8vLCBcIlwiKSk7XHJcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKG5vcm1hbGl6ZWQpO1xyXG4gICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xyXG4gICAgICByZXR1cm4gZmlsZTtcclxuICAgIH1cclxuICAgIGlmICghbm9ybWFsaXplZC50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKFwiLm1kXCIpKSB7XHJcbiAgICAgIGNvbnN0IHdpdGhFeHRlbnNpb24gPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoYCR7bm9ybWFsaXplZH0ubWRgKTtcclxuICAgICAgaWYgKHdpdGhFeHRlbnNpb24gaW5zdGFuY2VvZiBURmlsZSkge1xyXG4gICAgICAgIHJldHVybiB3aXRoRXh0ZW5zaW9uO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgbG9hZFRlbXBsYXRlQ29udGVudCgpIHtcclxuICAgIGNvbnN0IHBhdGggPSB0aGlzLnNldHRpbmdzLm5vdGVUZW1wbGF0ZVBhdGgudHJpbSgpO1xyXG4gICAgaWYgKCFwYXRoKSB7XHJcbiAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgfVxyXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuZ2V0VGVtcGxhdGVGaWxlKHBhdGgpO1xyXG4gICAgaWYgKCFmaWxlKSB7XHJcbiAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgfVxyXG4gICAgdHJ5IHtcclxuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKFwiRmFpbGVkIHRvIHJlYWQgdGVtcGxhdGVcIiwgZXJyb3IpO1xyXG4gICAgICByZXR1cm4gXCJcIjtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGROb3RlQ29udGVudChmaWVsZDogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCB0ZW1wbGF0ZTogc3RyaW5nKSB7XHJcbiAgICBpZiAoIXRlbXBsYXRlLnRyaW0oKSkge1xyXG4gICAgICByZXR1cm4gYC0tLVxcbiR7ZmllbGR9OiAke3ZhbHVlfVxcbi0tLVxcblxcbmA7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgbGluZXMgPSB0ZW1wbGF0ZS5zcGxpdChcIlxcblwiKTtcclxuICAgIGlmIChsaW5lc1swXT8udHJpbSgpID09PSBcIi0tLVwiKSB7XHJcbiAgICAgIGNvbnN0IGVuZEluZGV4ID0gbGluZXMuc2xpY2UoMSkuZmluZEluZGV4KChsaW5lKSA9PiBsaW5lLnRyaW0oKSA9PT0gXCItLS1cIik7XHJcbiAgICAgIGlmIChlbmRJbmRleCA+PSAwKSB7XHJcbiAgICAgICAgY29uc3QgZnJvbnRtYXR0ZXJFbmQgPSBlbmRJbmRleCArIDE7XHJcbiAgICAgICAgY29uc3QgaGFzRmllbGQgPSBsaW5lcy5zbGljZSgxLCBmcm9udG1hdHRlckVuZCkuc29tZSgobGluZSkgPT4gbGluZS50cmltKCkuc3RhcnRzV2l0aChgJHtmaWVsZH06YCkpO1xyXG4gICAgICAgIGlmICghaGFzRmllbGQpIHtcclxuICAgICAgICAgIGxpbmVzLnNwbGljZShmcm9udG1hdHRlckVuZCwgMCwgYCR7ZmllbGR9OiAke3ZhbHVlfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBgLS0tXFxuJHtmaWVsZH06ICR7dmFsdWV9XFxuLS0tXFxuXFxuJHt0ZW1wbGF0ZX1gO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBnZXRBdmFpbGFibGVQYXRoKHBhdGg6IHN0cmluZykge1xyXG4gICAgaWYgKCF0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCkpIHtcclxuICAgICAgcmV0dXJuIHBhdGg7XHJcbiAgICB9XHJcbiAgICBjb25zdCBiYXNlID0gcGF0aC5yZXBsYWNlKC9cXC5tZCQvaSwgXCJcIik7XHJcbiAgICBsZXQgaW5kZXggPSAxO1xyXG4gICAgbGV0IGNhbmRpZGF0ZSA9IGAke2Jhc2V9LSR7aW5kZXh9Lm1kYDtcclxuICAgIHdoaWxlICh0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY2FuZGlkYXRlKSkge1xyXG4gICAgICBpbmRleCArPSAxO1xyXG4gICAgICBjYW5kaWRhdGUgPSBgJHtiYXNlfS0ke2luZGV4fS5tZGA7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gY2FuZGlkYXRlO1xyXG4gIH1cclxuXHJcbiAgYXBwbHlIaWdobGlnaHRWYXJpYWJsZXMoKSB7XHJcbiAgICBjb25zdCBsZWF2ZXMgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9DQUxFTkRBUik7XHJcbiAgICBmb3IgKGNvbnN0IGxlYWYgb2YgbGVhdmVzKSB7XHJcbiAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGxlYWYudmlldy5jb250YWluZXJFbDtcclxuICAgICAgY29uc3QgdG9kYXlDb2xvciA9IHJlc29sdmVIaWdobGlnaHRWYWx1ZSh0aGlzLnNldHRpbmdzLnRvZGF5SGlnaGxpZ2h0LCBcIi0taW50ZXJhY3RpdmUtYWNjZW50XCIpO1xyXG4gICAgICBjb25zdCBzZWxlY3RlZENvbG9yID0gcmVzb2x2ZUhpZ2hsaWdodFZhbHVlKHRoaXMuc2V0dGluZ3Muc2VsZWN0ZWRIaWdobGlnaHQsIFwiLS10ZXh0LWFjY2VudFwiKTtcclxuICAgICAgY29uc3QgYmFyQ29sb3IgPSByZXNvbHZlSGlnaGxpZ2h0VmFsdWUodGhpcy5zZXR0aW5ncy5ub3RlQmFyQ29sb3IsIFwiLS10ZXh0LWFjY2VudFwiKTtcclxuICAgICAgY29udGFpbmVyLnN0eWxlLnNldFByb3BlcnR5KFxyXG4gICAgICAgIFwiLS1jYWxlbmRhci10b2RheS1hY2NlbnRcIixcclxuICAgICAgICB0b2RheUNvbG9yXHJcbiAgICAgICk7XHJcbiAgICAgIGNvbnRhaW5lci5zdHlsZS5zZXRQcm9wZXJ0eShcclxuICAgICAgICBcIi0tY2FsZW5kYXItc2VsZWN0ZWQtYWNjZW50XCIsXHJcbiAgICAgICAgc2VsZWN0ZWRDb2xvclxyXG4gICAgICApO1xyXG4gICAgICBjb250YWluZXIuc3R5bGUuc2V0UHJvcGVydHkoXHJcbiAgICAgICAgXCItLWNhbGVuZGFyLW5vdGUtYmFyLWNvbG9yXCIsXHJcbiAgICAgICAgYmFyQ29sb3JcclxuICAgICAgKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG5vcm1hbGl6ZVRlbXBsYXRlUGF0aChyYXdQYXRoOiBzdHJpbmcpIHtcclxuICAgIGNvbnN0IHRyaW1tZWQgPSByYXdQYXRoLnRyaW0oKTtcclxuICAgIGlmICghdHJpbW1lZCkge1xyXG4gICAgICByZXR1cm4geyBwYXRoOiBcIlwiLCB3YXJuaW5nOiBcIlwiIH07XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVQYXRoU2xhc2hlcyh0cmltbWVkKS5yZXBsYWNlKC9eXFwvLywgXCJcIik7XHJcbiAgICBpZiAoL15bYS16QS1aXTpcXC8vLnRlc3Qobm9ybWFsaXplZCkgfHwgbm9ybWFsaXplZC5zdGFydHNXaXRoKFwiLy9cIikpIHtcclxuICAgICAgY29uc3QgdmF1bHRSb290ID0gbm9ybWFsaXplUGF0aFNsYXNoZXModGhpcy5hcHAudmF1bHQuYWRhcHRlci5nZXRGdWxsUGF0aChcIlwiKSk7XHJcbiAgICAgIGNvbnN0IHJvb3RXaXRoU2xhc2ggPSB2YXVsdFJvb3QuZW5kc1dpdGgoXCIvXCIpID8gdmF1bHRSb290IDogYCR7dmF1bHRSb290fS9gO1xyXG4gICAgICBpZiAobm9ybWFsaXplZC5zdGFydHNXaXRoKHJvb3RXaXRoU2xhc2gpKSB7XHJcbiAgICAgICAgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZWQuc2xpY2Uocm9vdFdpdGhTbGFzaC5sZW5ndGgpO1xyXG4gICAgICAgIHJldHVybiB7IHBhdGg6IG5vcm1hbGl6ZVBhdGgobm9ybWFsaXplZCksIHdhcm5pbmc6IFwiXCIgfTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4geyBwYXRoOiBcIlwiLCB3YXJuaW5nOiBcIlRlbXBsYXRlIHBhdGggbXVzdCBiZSBpbnNpZGUgdGhpcyB2YXVsdC5cIiB9O1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7IHBhdGg6IG5vcm1hbGl6ZVBhdGgobm9ybWFsaXplZCksIHdhcm5pbmc6IFwiXCIgfTtcclxuICB9XHJcblxyXG4gIGdldFRlbXBsYXRlRm9sZGVyT3B0aW9ucygpIHtcclxuICAgIGNvbnN0IGZvbGRlcnMgPSBuZXcgU2V0PHN0cmluZz4oKTtcclxuICAgIGZvciAoY29uc3QgZmlsZSBvZiB0aGlzLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCkpIHtcclxuICAgICAgY29uc3QgcGFyZW50ID0gZmlsZS5wYXJlbnQ/LnBhdGggPz8gXCJcIjtcclxuICAgICAgZm9sZGVycy5hZGQocGFyZW50KTtcclxuICAgIH1cclxuICAgIHJldHVybiBBcnJheS5mcm9tKGZvbGRlcnMpLnNvcnQoKGEsIGIpID0+IGEubG9jYWxlQ29tcGFyZShiKSk7XHJcbiAgfVxyXG5cclxuICBnZXRUZW1wbGF0ZU9wdGlvbnMoZm9sZGVyOiBzdHJpbmcpIHtcclxuICAgIHJldHVybiB0aGlzLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKClcclxuICAgICAgLmZpbHRlcigoZmlsZSkgPT4gKGZvbGRlciA/IGZpbGUucGFyZW50Py5wYXRoID09PSBmb2xkZXIgOiB0cnVlKSlcclxuICAgICAgLm1hcCgoZmlsZSkgPT4gKHtcclxuICAgICAgICBwYXRoOiBmaWxlLnBhdGgsXHJcbiAgICAgICAgbGFiZWw6IGZpbGUubmFtZVxyXG4gICAgICB9KSlcclxuICAgICAgLnNvcnQoKGEsIGIpID0+IGEubGFiZWwubG9jYWxlQ29tcGFyZShiLmxhYmVsKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG5vcm1hbGl6ZVNldHRpbmdzKGRhdGE6IHVua25vd24pOiBDYWxlbmRhclNldHRpbmdzIHtcclxuICAgIGlmICghZGF0YSB8fCB0eXBlb2YgZGF0YSAhPT0gXCJvYmplY3RcIikge1xyXG4gICAgICByZXR1cm4geyAuLi5ERUZBVUxUX1NFVFRJTkdTIH07XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcmVjb3JkID0gZGF0YSBhcyBQYXJ0aWFsPENhbGVuZGFyU2V0dGluZ3M+ICYgeyBpY2FsVXJsPzogc3RyaW5nIH07XHJcblxyXG4gICAgY29uc3Qgc291cmNlczogQ2FsZW5kYXJTb3VyY2VbXSA9IEFycmF5LmlzQXJyYXkocmVjb3JkLnNvdXJjZXMpXHJcbiAgICAgID8gcmVjb3JkLnNvdXJjZXMubWFwKChzb3VyY2UpID0+ICh7XHJcbiAgICAgICAgaWQ6IHNvdXJjZS5pZCB8fCBjcmVhdGVTb3VyY2VJZCgpLFxyXG4gICAgICAgIG5hbWU6IHNvdXJjZS5uYW1lID8/IFwiXCIsXHJcbiAgICAgICAgZW5hYmxlZDogc291cmNlLmVuYWJsZWQgPz8gdHJ1ZSxcclxuICAgICAgICB1cmw6IHNvdXJjZS51cmwgPz8gXCJcIlxyXG4gICAgICB9KSlcclxuICAgICAgOiBbXTtcclxuXHJcbiAgICBpZiAoc291cmNlcy5sZW5ndGggPT09IDAgJiYgdHlwZW9mIHJlY29yZC5pY2FsVXJsID09PSBcInN0cmluZ1wiICYmIHJlY29yZC5pY2FsVXJsLnRyaW0oKS5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHNvdXJjZXMucHVzaCh7XHJcbiAgICAgICAgaWQ6IGNyZWF0ZVNvdXJjZUlkKCksXHJcbiAgICAgICAgbmFtZTogXCJQcmltYXJ5XCIsXHJcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICB1cmw6IHJlY29yZC5pY2FsVXJsLnRyaW0oKVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBzb3VyY2VzLFxyXG4gICAgICB3ZWVrU3RhcnQ6IHJlY29yZC53ZWVrU3RhcnQgPz8gREVGQVVMVF9TRVRUSU5HUy53ZWVrU3RhcnQsXHJcbiAgICAgIHRpbWVGb3JtYXQ6IHJlY29yZC50aW1lRm9ybWF0ID8/IERFRkFVTFRfU0VUVElOR1MudGltZUZvcm1hdCxcclxuICAgICAgcmVmcmVzaEludGVydmFsTWludXRlczogcmVjb3JkLnJlZnJlc2hJbnRlcnZhbE1pbnV0ZXMgPz8gREVGQVVMVF9TRVRUSU5HUy5yZWZyZXNoSW50ZXJ2YWxNaW51dGVzLFxyXG4gICAgICB0b2RheUhpZ2hsaWdodDogcmVjb3JkLnRvZGF5SGlnaGxpZ2h0ID8/IERFRkFVTFRfU0VUVElOR1MudG9kYXlIaWdobGlnaHQsXHJcbiAgICAgIHNlbGVjdGVkSGlnaGxpZ2h0OiByZWNvcmQuc2VsZWN0ZWRIaWdobGlnaHQgPz8gREVGQVVMVF9TRVRUSU5HUy5zZWxlY3RlZEhpZ2hsaWdodCxcclxuICAgICAgbm90ZURhdGVGaWVsZHM6IEFycmF5LmlzQXJyYXkocmVjb3JkLm5vdGVEYXRlRmllbGRzKSAmJiByZWNvcmQubm90ZURhdGVGaWVsZHMubGVuZ3RoID4gMFxyXG4gICAgICAgID8gcmVjb3JkLm5vdGVEYXRlRmllbGRzXHJcbiAgICAgICAgOiBERUZBVUxUX1NFVFRJTkdTLm5vdGVEYXRlRmllbGRzLFxyXG4gICAgICBhbGxvd0NyZWF0ZU5vdGU6IHJlY29yZC5hbGxvd0NyZWF0ZU5vdGUgPz8gREVGQVVMVF9TRVRUSU5HUy5hbGxvd0NyZWF0ZU5vdGUsXHJcbiAgICAgIG5vdGVUZW1wbGF0ZVBhdGg6IHR5cGVvZiByZWNvcmQubm90ZVRlbXBsYXRlUGF0aCA9PT0gXCJzdHJpbmdcIlxyXG4gICAgICAgID8gcmVjb3JkLm5vdGVUZW1wbGF0ZVBhdGhcclxuICAgICAgICA6IERFRkFVTFRfU0VUVElOR1Mubm90ZVRlbXBsYXRlUGF0aCxcclxuICAgICAgbm90ZUJhckNvbG9yOiB0eXBlb2YgcmVjb3JkLm5vdGVCYXJDb2xvciA9PT0gXCJzdHJpbmdcIlxyXG4gICAgICAgID8gcmVjb3JkLm5vdGVCYXJDb2xvclxyXG4gICAgICAgIDogREVGQVVMVF9TRVRUSU5HUy5ub3RlQmFyQ29sb3JcclxuICAgIH07XHJcbiAgfVxyXG59XHJcbiIsICJpbXBvcnQgeyBQYXJzZWRJY2FsRXZlbnQgfSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuY29uc3QgREFURV9PTkxZID0gL15cXGR7OH0kLztcclxuY29uc3QgREFURV9USU1FID0gL15cXGR7OH1UXFxkezZ9Wj8kLztcclxuXHJcbmNvbnN0IGFkZERheXMgPSAoZGF0ZTogRGF0ZSwgZGF5czogbnVtYmVyKSA9PlxyXG4gIG5ldyBEYXRlKGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpLCBkYXRlLmdldERhdGUoKSArIGRheXMpO1xyXG5cclxuY29uc3QgcGFyc2VEYXRlVmFsdWUgPSAocmF3OiBzdHJpbmcpOiB7IGRhdGU6IERhdGU7IGFsbERheTogYm9vbGVhbiB9ID0+IHtcclxuICBpZiAoREFURV9PTkxZLnRlc3QocmF3KSkge1xyXG4gICAgY29uc3QgeWVhciA9IE51bWJlcihyYXcuc2xpY2UoMCwgNCkpO1xyXG4gICAgY29uc3QgbW9udGggPSBOdW1iZXIocmF3LnNsaWNlKDQsIDYpKSAtIDE7XHJcbiAgICBjb25zdCBkYXkgPSBOdW1iZXIocmF3LnNsaWNlKDYsIDgpKTtcclxuICAgIHJldHVybiB7IGRhdGU6IG5ldyBEYXRlKHllYXIsIG1vbnRoLCBkYXkpLCBhbGxEYXk6IHRydWUgfTtcclxuICB9XHJcblxyXG4gIGlmIChEQVRFX1RJTUUudGVzdChyYXcpKSB7XHJcbiAgICBjb25zdCB5ZWFyID0gTnVtYmVyKHJhdy5zbGljZSgwLCA0KSk7XHJcbiAgICBjb25zdCBtb250aCA9IE51bWJlcihyYXcuc2xpY2UoNCwgNikpIC0gMTtcclxuICAgIGNvbnN0IGRheSA9IE51bWJlcihyYXcuc2xpY2UoNiwgOCkpO1xyXG4gICAgY29uc3QgaG91ciA9IE51bWJlcihyYXcuc2xpY2UoOSwgMTEpKTtcclxuICAgIGNvbnN0IG1pbnV0ZSA9IE51bWJlcihyYXcuc2xpY2UoMTEsIDEzKSk7XHJcbiAgICBjb25zdCBzZWNvbmQgPSBOdW1iZXIocmF3LnNsaWNlKDEzLCAxNSkpO1xyXG4gICAgaWYgKHJhdy5lbmRzV2l0aChcIlpcIikpIHtcclxuICAgICAgcmV0dXJuIHsgZGF0ZTogbmV3IERhdGUoRGF0ZS5VVEMoeWVhciwgbW9udGgsIGRheSwgaG91ciwgbWludXRlLCBzZWNvbmQpKSwgYWxsRGF5OiBmYWxzZSB9O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHsgZGF0ZTogbmV3IERhdGUoeWVhciwgbW9udGgsIGRheSwgaG91ciwgbWludXRlLCBzZWNvbmQpLCBhbGxEYXk6IGZhbHNlIH07XHJcbiAgfVxyXG5cclxuICByZXR1cm4geyBkYXRlOiBuZXcgRGF0ZShyYXcpLCBhbGxEYXk6IGZhbHNlIH07XHJcbn07XHJcblxyXG5jb25zdCB1bmZvbGRMaW5lcyA9ICh0ZXh0OiBzdHJpbmcpOiBzdHJpbmdbXSA9PiB7XHJcbiAgY29uc3QgbGluZXMgPSB0ZXh0LnJlcGxhY2UoL1xcclxcbi9nLCBcIlxcblwiKS5zcGxpdChcIlxcblwiKTtcclxuICBjb25zdCB1bmZvbGRlZDogc3RyaW5nW10gPSBbXTtcclxuICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcclxuICAgIGlmIChsaW5lLnN0YXJ0c1dpdGgoXCIgXCIpIHx8IGxpbmUuc3RhcnRzV2l0aChcIlxcdFwiKSkge1xyXG4gICAgICBjb25zdCBsYXN0SW5kZXggPSB1bmZvbGRlZC5sZW5ndGggLSAxO1xyXG4gICAgICBpZiAobGFzdEluZGV4ID49IDApIHtcclxuICAgICAgICB1bmZvbGRlZFtsYXN0SW5kZXhdICs9IGxpbmUuc2xpY2UoMSk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSBpZiAobGluZS50cmltKCkubGVuZ3RoKSB7XHJcbiAgICAgIHVuZm9sZGVkLnB1c2gobGluZS50cmltKCkpO1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gdW5mb2xkZWQ7XHJcbn07XHJcblxyXG5leHBvcnQgY29uc3QgcGFyc2VJY2FsID0gKHRleHQ6IHN0cmluZyk6IFBhcnNlZEljYWxFdmVudFtdID0+IHtcclxuICBjb25zdCBldmVudHM6IFBhcnNlZEljYWxFdmVudFtdID0gW107XHJcbiAgY29uc3QgbGluZXMgPSB1bmZvbGRMaW5lcyh0ZXh0KTtcclxuICBsZXQgY3VycmVudDogUGFydGlhbDxQYXJzZWRJY2FsRXZlbnQ+ID0ge307XHJcblxyXG4gIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xyXG4gICAgaWYgKGxpbmUgPT09IFwiQkVHSU46VkVWRU5UXCIpIHtcclxuICAgICAgY3VycmVudCA9IHt9O1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuICAgIGlmIChsaW5lID09PSBcIkVORDpWRVZFTlRcIikge1xyXG4gICAgICBpZiAoY3VycmVudC5zdGFydCkge1xyXG4gICAgICAgIGlmICghY3VycmVudC5lbmQpIHtcclxuICAgICAgICAgIGN1cnJlbnQuZW5kID0gY3VycmVudC5zdGFydDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGN1cnJlbnQuYWxsRGF5ICYmIGN1cnJlbnQuZW5kLmdldFRpbWUoKSA+IGN1cnJlbnQuc3RhcnQuZ2V0VGltZSgpKSB7XHJcbiAgICAgICAgICBjdXJyZW50LmVuZCA9IGFkZERheXMoY3VycmVudC5lbmQsIC0xKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZXZlbnRzLnB1c2goe1xyXG4gICAgICAgICAgaWQ6IGN1cnJlbnQuaWQgPz8gY3J5cHRvLnJhbmRvbVVVSUQoKSxcclxuICAgICAgICAgIHN1bW1hcnk6IGN1cnJlbnQuc3VtbWFyeSA/PyBcIlVudGl0bGVkXCIsXHJcbiAgICAgICAgICBzdGFydDogY3VycmVudC5zdGFydCxcclxuICAgICAgICAgIGVuZDogY3VycmVudC5lbmQsXHJcbiAgICAgICAgICBhbGxEYXk6IGN1cnJlbnQuYWxsRGF5ID8/IGZhbHNlXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgICAgY3VycmVudCA9IHt9O1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBbcmF3S2V5LCByYXdWYWx1ZV0gPSBsaW5lLnNwbGl0KFwiOlwiLCAyKTtcclxuICAgIGlmICghcmF3S2V5IHx8IHJhd1ZhbHVlID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgY29udGludWU7XHJcbiAgICB9XHJcbiAgICBjb25zdCBrZXkgPSByYXdLZXkuc3BsaXQoXCI7XCIpWzBdO1xyXG5cclxuICAgIGlmIChrZXkgPT09IFwiVUlEXCIpIHtcclxuICAgICAgY3VycmVudC5pZCA9IHJhd1ZhbHVlLnRyaW0oKTtcclxuICAgIH1cclxuICAgIGlmIChrZXkgPT09IFwiU1VNTUFSWVwiKSB7XHJcbiAgICAgIGN1cnJlbnQuc3VtbWFyeSA9IHJhd1ZhbHVlLnRyaW0oKTtcclxuICAgIH1cclxuICAgIGlmIChrZXkgPT09IFwiRFRTVEFSVFwiKSB7XHJcbiAgICAgIGNvbnN0IHsgZGF0ZSwgYWxsRGF5IH0gPSBwYXJzZURhdGVWYWx1ZShyYXdWYWx1ZS50cmltKCkpO1xyXG4gICAgICBjdXJyZW50LnN0YXJ0ID0gZGF0ZTtcclxuICAgICAgY3VycmVudC5hbGxEYXkgPSBhbGxEYXk7XHJcbiAgICB9XHJcbiAgICBpZiAoa2V5ID09PSBcIkRURU5EXCIpIHtcclxuICAgICAgY29uc3QgeyBkYXRlLCBhbGxEYXkgfSA9IHBhcnNlRGF0ZVZhbHVlKHJhd1ZhbHVlLnRyaW0oKSk7XHJcbiAgICAgIGN1cnJlbnQuZW5kID0gZGF0ZTtcclxuICAgICAgY3VycmVudC5hbGxEYXkgPSBjdXJyZW50LmFsbERheSA/PyBhbGxEYXk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZXZlbnRzO1xyXG59O1xyXG4iLCAiaW1wb3J0IHsgcmVxdWVzdFVybCB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyBDYWxlbmRhckV2ZW50LCBDYWxlbmRhclNvdXJjZSwgUGFyc2VkSWNhbEV2ZW50IH0gZnJvbSBcIi4uL3R5cGVzXCI7XHJcblxyXG5leHBvcnQgdHlwZSBJY2FsUGFyc2VyID0gKHRleHQ6IHN0cmluZykgPT4gUGFyc2VkSWNhbEV2ZW50W107XHJcblxyXG50eXBlIENhY2hlRW50cnkgPSB7XHJcbiAgICBmZXRjaGVkQXQ6IG51bWJlcjtcclxuICAgIGV2ZW50czogQ2FsZW5kYXJFdmVudFtdO1xyXG4gICAgdXJsOiBzdHJpbmc7XHJcbn07XHJcblxyXG5leHBvcnQgY2xhc3MgSWNhbFNlcnZpY2Uge1xyXG4gICAgcHJpdmF0ZSBjYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBDYWNoZUVudHJ5PigpO1xyXG4gICAgcHJpdmF0ZSBwYXJzZXI6IEljYWxQYXJzZXI7XHJcblxyXG4gICAgY29uc3RydWN0b3IocGFyc2VyOiBJY2FsUGFyc2VyKSB7XHJcbiAgICAgICAgdGhpcy5wYXJzZXIgPSBwYXJzZXI7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZ2V0RXZlbnRzKFxyXG4gICAgICAgIHNvdXJjZXM6IENhbGVuZGFyU291cmNlW10sXHJcbiAgICAgICAgcmVmcmVzaEludGVydmFsTWludXRlczogbnVtYmVyLFxyXG4gICAgICAgIGZvcmNlUmVmcmVzaCA9IGZhbHNlXHJcbiAgICApOiBQcm9taXNlPENhbGVuZGFyRXZlbnRbXT4ge1xyXG4gICAgICAgIGNvbnN0IGVuYWJsZWRTb3VyY2VzID0gc291cmNlcy5maWx0ZXIoKHNvdXJjZSkgPT4gc291cmNlLmVuYWJsZWQgJiYgc291cmNlLnVybC50cmltKCkubGVuZ3RoID4gMCk7XHJcbiAgICAgICAgaWYgKGVuYWJsZWRTb3VyY2VzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xyXG4gICAgICAgIGNvbnN0IHJlZnJlc2hNcyA9IE1hdGgubWF4KHJlZnJlc2hJbnRlcnZhbE1pbnV0ZXMsIDEpICogNjAgKiAxMDAwO1xyXG5cclxuICAgICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoXHJcbiAgICAgICAgICAgIGVuYWJsZWRTb3VyY2VzLm1hcCgoc291cmNlKSA9PiB0aGlzLmdldFNvdXJjZUV2ZW50cyhzb3VyY2UsIG5vdywgcmVmcmVzaE1zLCBmb3JjZVJlZnJlc2gpKVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHJldHVybiByZXN1bHRzLmZsYXQoKS5zb3J0KChhLCBiKSA9PiBhLnN0YXJ0LmdldFRpbWUoKSAtIGIuc3RhcnQuZ2V0VGltZSgpKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldFNvdXJjZUV2ZW50cyhcclxuICAgICAgICBzb3VyY2U6IENhbGVuZGFyU291cmNlLFxyXG4gICAgICAgIG5vdzogbnVtYmVyLFxyXG4gICAgICAgIHJlZnJlc2hNczogbnVtYmVyLFxyXG4gICAgICAgIGZvcmNlUmVmcmVzaDogYm9vbGVhblxyXG4gICAgKTogUHJvbWlzZTxDYWxlbmRhckV2ZW50W10+IHtcclxuICAgICAgICBjb25zdCBjYWNoZWQgPSB0aGlzLmNhY2hlLmdldChzb3VyY2UuaWQpO1xyXG4gICAgICAgIGlmICghZm9yY2VSZWZyZXNoICYmIGNhY2hlZCAmJiBjYWNoZWQudXJsID09PSBzb3VyY2UudXJsICYmIG5vdyAtIGNhY2hlZC5mZXRjaGVkQXQgPCByZWZyZXNoTXMpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZC5ldmVudHM7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoeyB1cmw6IHNvdXJjZS51cmwgfSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHRoaXMucGFyc2VyKHJlc3BvbnNlLnRleHQpO1xyXG4gICAgICAgICAgICBjb25zdCBldmVudHMgPSBwYXJzZWQubWFwKChldmVudCkgPT4gKHtcclxuICAgICAgICAgICAgICAgIC4uLmV2ZW50LFxyXG4gICAgICAgICAgICAgICAgc291cmNlSWQ6IHNvdXJjZS5pZCxcclxuICAgICAgICAgICAgICAgIHNvdXJjZU5hbWU6IHNvdXJjZS5uYW1lIHx8IFwiQ2FsZW5kYXJcIlxyXG4gICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmNhY2hlLnNldChzb3VyY2UuaWQsIHsgZmV0Y2hlZEF0OiBub3csIGV2ZW50cywgdXJsOiBzb3VyY2UudXJsIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gZXZlbnRzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gZmV0Y2ggaUNhbCBzb3VyY2VcIiwgc291cmNlLm5hbWUsIGVycm9yKTtcclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZCA/IGNhY2hlZC5ldmVudHMgOiBbXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFBQUEsbUJBU087OztBQ1BQLElBQU0sWUFBWTtBQUNsQixJQUFNLFlBQVk7QUFFbEIsSUFBTSxVQUFVLENBQUMsTUFBWSxTQUMzQixJQUFJLEtBQUssS0FBSyxZQUFZLEdBQUcsS0FBSyxTQUFTLEdBQUcsS0FBSyxRQUFRLElBQUksSUFBSTtBQUVyRSxJQUFNLGlCQUFpQixDQUFDLFFBQWlEO0FBQ3ZFLE1BQUksVUFBVSxLQUFLLEdBQUcsR0FBRztBQUN2QixVQUFNLE9BQU8sT0FBTyxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUM7QUFDbkMsVUFBTSxRQUFRLE9BQU8sSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUk7QUFDeEMsVUFBTSxNQUFNLE9BQU8sSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDO0FBQ2xDLFdBQU8sRUFBRSxNQUFNLElBQUksS0FBSyxNQUFNLE9BQU8sR0FBRyxHQUFHLFFBQVEsS0FBSztBQUFBLEVBQzFEO0FBRUEsTUFBSSxVQUFVLEtBQUssR0FBRyxHQUFHO0FBQ3ZCLFVBQU0sT0FBTyxPQUFPLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztBQUNuQyxVQUFNLFFBQVEsT0FBTyxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSTtBQUN4QyxVQUFNLE1BQU0sT0FBTyxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUM7QUFDbEMsVUFBTSxPQUFPLE9BQU8sSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQ3BDLFVBQU0sU0FBUyxPQUFPLElBQUksTUFBTSxJQUFJLEVBQUUsQ0FBQztBQUN2QyxVQUFNLFNBQVMsT0FBTyxJ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QTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBMFF0QixZ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RUFDL0QsSUFBSSxDQUFDLFVBQVU7QUFBQSxNQUNkLE1BQU0sS0FBSztBQUFBLE1BQ1gsT0FBTyxLQUFLO0FBQUEsSUFDZCxFQUFFLEVBQ0QsS0FBSyxDQUFDLEdBQUcsTUFBTSxFQUFFLE1BQU0sY0FBYyxFQUFFLEtBQUssQ0FBQztBQUFBLEVBQ2xEO0FBQUEsRUFFUSxrQkFBa0IsTUFBaUM7QUFDekQsUUFBSSxDQUFDLFFBQVEsT0FBTyxTQUFTLFVBQVU7QUFDckMsYUFBTyxFQUFFLEdBQUcsaUJBQWlCO0FBQUEsSUFDL0I7QUFFQSxVQUFNLFNBQVM7QUFFZixVQUFNLFVBQTRCLE1BQU0sUUFBUSxPQUFPLE9BQU8sSUFDMUQsT0FBTyxRQUFRLElBQUksQ0FBQyxZQUFZO0FBQUEsTUFDaEMsSUFBSSxPQUFPLE1BQU0sZUFBZTtBQUFBLE1BQ2hDLE1BQU0sT0FBTyxRQUFRO0FBQUEsTUFDckIsU0FBUyxPQUFPLFdBQVc7QUFBQSxNQUMzQixLQUFLLE9BQU8sT0FBTztBQUFBLElBQ3JCLEVBQUUsSUFDQSxDQUFDO0FBRUwsUUFBSSxRQUFRLFdBQVcsS0FBSyxPQUFPLE9BQU8sWUFBWSxZQUFZLE9BQU8sUUFBUSxLQUFLLEVBQUUsU0FBUyxHQUFHO0FBQ2xHLGNBQVEsS0FBSztBQUFBLFFBQ1gsSUFBSSxlQUFlO0FBQUEsUUFDbkIsTUFBTTtBQUFBLFFBQ04sU0FBUztBQUFBLFFBQ1QsS0FBSyxPQUFPLFFBQVEsS0FBSztBQUFBLE1BQzNCLENBQUM7QUFBQSxJQUNIO0FBRUEsV0FBTztBQUFBLE1BQ0w7QUFBQSxNQUNBLFdBQVcsT0FBTyxhQUFhLGlCQUFpQjtBQUFBLE1BQ2hELFlBQVksT0FBTyxjQUFjLGlCQUFpQjtBQUFBLE1BQ2xELHdCQUF3QixPQUFPLDBCQUEwQixpQkFBaUI7QUFBQSxNQUMxRSxnQkFBZ0IsT0FBTyxrQkFBa0IsaUJBQWlCO0FBQUEsTUFDMUQsbUJBQW1CLE9BQU8scUJBQXFCLGlCQUFpQjtBQUFBLE1BQ2hFLGdCQUFnQixNQUFNLFFBQVEsT0FBTyxjQUFjLEtBQUssT0FBTyxlQUFlLFNBQVMsSUFDbkYsT0FBTyxpQkFDUCxpQkFBaUI7QUFBQSxNQUNyQixpQkFBaUIsT0FBTyxtQkFBbUIsaUJBQWlCO0FBQUEsTUFDNUQsa0JBQWtCLE9BQU8sT0FBTyxxQkFBcUIsV0FDakQsT0FBTyxtQkFDUCxpQkFBaUI7QUFBQSxNQUNyQixjQUFjLE9BQU8sT0FBTyxpQkFBaUIsV0FDekMsT0FBTyxlQUNQLGlCQUFpQjtBQUFBLElBQ3ZCO0FBQUEsRUFDRjtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiYWRkRGF5cyJdCn0K
