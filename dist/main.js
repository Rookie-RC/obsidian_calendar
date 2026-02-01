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
    if (this.plugin.settings.allowCreateNote) {
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
        gap: 8px;
        flex-wrap: wrap;
      }
      .obsidian-calendar__nav button {
        background: transparent;
        border: 1px solid var(--background-modifier-border);
        padding: 5px 12px;
        border-radius: 4px;
        color: var(--text-normal);
        cursor: pointer;
        font-size: 13px;
      }
      .obsidian-calendar__nav button:hover {
        background: var(--background-modifier-hover);
      }
      .obsidian-calendar__title {
        font-size: 17px;
        font-weight: 600;
        letter-spacing: -0.01em;
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
        gap: 8px;
      }
      .obsidian-calendar__day {
        border: none;
        background: transparent;
        border-radius: 4px;
        padding: 12px 4px 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        gap: 3px;
        min-height: 72px;
        cursor: pointer;
        position: relative;
      }
      .obsidian-calendar__day.is-outside {
        opacity: 0.4;
      }
      .obsidian-calendar__day.is-weekend {
        opacity: 0.65;
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
      .obsidian-calendar__day-subtitle {
        font-size: 10px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
        text-align: center;
        min-height: 12px;
        font-weight: 400;
        opacity: 0.8;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL21haW4udHMiLCAiLi4vc3JjL2ljYWwudHMiLCAiLi4vc3JjL3NlcnZpY2VzL2ljYWxTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQge1xyXG4gIEFwcCxcclxuICBJdGVtVmlldyxcclxuICBQbHVnaW4sXHJcbiAgUGx1Z2luU2V0dGluZ1RhYixcclxuICBTZXR0aW5nLFxyXG4gIFRGaWxlLFxyXG4gIFdvcmtzcGFjZUxlYWYsXHJcbiAgbm9ybWFsaXplUGF0aFxyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyBwYXJzZUljYWwgfSBmcm9tIFwiLi9pY2FsXCI7XHJcbmltcG9ydCB7IEljYWxTZXJ2aWNlIH0gZnJvbSBcIi4vc2VydmljZXMvaWNhbFNlcnZpY2VcIjtcclxuaW1wb3J0IHsgQ2FsZW5kYXJFdmVudCwgQ2FsZW5kYXJTZXR0aW5ncywgQ2FsZW5kYXJTb3VyY2UgfSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuY29uc3QgVklFV19UWVBFX0NBTEVOREFSID0gXCJvYnNpZGlhbi1jYWxlbmRhci12aWV3XCI7XHJcblxyXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBDYWxlbmRhclNldHRpbmdzID0ge1xyXG4gIHNvdXJjZXM6IFtdLFxyXG4gIHdlZWtTdGFydDogXCJzdW5kYXlcIixcclxuICB0aW1lRm9ybWF0OiBcIjI0aFwiLFxyXG4gIHJlZnJlc2hJbnRlcnZhbE1pbnV0ZXM6IDMwLFxyXG4gIHRvZGF5SGlnaGxpZ2h0OiBcIi0taW50ZXJhY3RpdmUtYWNjZW50XCIsXHJcbiAgc2VsZWN0ZWRIaWdobGlnaHQ6IFwiLS10ZXh0LWFjY2VudFwiLFxyXG4gIG5vdGVEYXRlRmllbGRzOiBbXCJkYXRlXCJdLFxyXG4gIGFsbG93Q3JlYXRlTm90ZTogdHJ1ZSxcclxuICBub3RlVGVtcGxhdGVQYXRoOiBcIlwiLFxyXG4gIG5vdGVCYXJDb2xvcjogXCItLXRleHQtYWNjZW50XCJcclxufTtcclxuXHJcbmNvbnN0IFdFRUtEQVlfTEFCRUxTID0gW1wiU3VuXCIsIFwiTW9uXCIsIFwiVHVlXCIsIFwiV2VkXCIsIFwiVGh1XCIsIFwiRnJpXCIsIFwiU2F0XCJdO1xyXG5cclxuY29uc3QgcmVzb2x2ZUhpZ2hsaWdodFZhbHVlID0gKHZhbHVlOiBzdHJpbmcsIGZhbGxiYWNrVmFyOiBzdHJpbmcpID0+IHtcclxuICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xyXG4gIGlmICghdHJpbW1lZCkge1xyXG4gICAgcmV0dXJuIGdldENvbXB1dGVkU3R5bGUoZG9jdW1lbnQuYm9keSkuZ2V0UHJvcGVydHlWYWx1ZShmYWxsYmFja1ZhcikudHJpbSgpO1xyXG4gIH1cclxuICBpZiAodHJpbW1lZC5zdGFydHNXaXRoKFwiLS1cIikpIHtcclxuICAgIGNvbnN0IHJlc29sdmVkID0gZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5KS5nZXRQcm9wZXJ0eVZhbHVlKHRyaW1tZWQpLnRyaW0oKTtcclxuICAgIHJldHVybiByZXNvbHZlZCB8fCB0cmltbWVkO1xyXG4gIH1cclxuICByZXR1cm4gdHJpbW1lZDtcclxufTtcclxuXHJcbmNvbnN0IG5vcm1hbGl6ZVBhdGhTbGFzaGVzID0gKHZhbHVlOiBzdHJpbmcpID0+IHZhbHVlLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpO1xyXG5cclxudHlwZSBMaW5rZWROb3RlID0ge1xyXG4gIGZpbGU6IFRGaWxlO1xyXG4gIHRpdGxlOiBzdHJpbmc7XHJcbiAgZXhjZXJwdDogc3RyaW5nO1xyXG59O1xyXG5cclxuY29uc3QgZm9ybWF0RGF0ZUtleSA9IChkYXRlOiBEYXRlKSA9PiB7XHJcbiAgY29uc3QgeWVhciA9IGRhdGUuZ2V0RnVsbFllYXIoKTtcclxuICBjb25zdCBtb250aCA9IFN0cmluZyhkYXRlLmdldE1vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCBcIjBcIik7XHJcbiAgY29uc3QgZGF5ID0gU3RyaW5nKGRhdGUuZ2V0RGF0ZSgpKS5wYWRTdGFydCgyLCBcIjBcIik7XHJcbiAgcmV0dXJuIGAke3llYXJ9LSR7bW9udGh9LSR7ZGF5fWA7XHJcbn07XHJcblxyXG5jb25zdCBwYXJzZUZyb250bWF0dGVyRGF0ZSA9ICh2YWx1ZTogdW5rbm93bik6IERhdGUgfCBudWxsID0+IHtcclxuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBEYXRlICYmICFOdW1iZXIuaXNOYU4odmFsdWUuZ2V0VGltZSgpKSkge1xyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG4gIH1cclxuICBpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSB7XHJcbiAgICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xyXG4gICAgaWYgKCF0cmltbWVkKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gICAgY29uc3QgcGFyc2VkID0gbmV3IERhdGUodHJpbW1lZCk7XHJcbiAgICBpZiAoIU51bWJlci5pc05hTihwYXJzZWQuZ2V0VGltZSgpKSkge1xyXG4gICAgICByZXR1cm4gcGFyc2VkO1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gbnVsbDtcclxufTtcclxuXHJcbmNvbnN0IGV4dHJhY3RGcm9udG1hdHRlckRhdGVzID0gKHZhbHVlOiB1bmtub3duKTogRGF0ZVtdID0+IHtcclxuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcclxuICAgIHJldHVybiB2YWx1ZVxyXG4gICAgICAubWFwKChpdGVtKSA9PiBwYXJzZUZyb250bWF0dGVyRGF0ZShpdGVtKSlcclxuICAgICAgLmZpbHRlcigoaXRlbSk6IGl0ZW0gaXMgRGF0ZSA9PiBpdGVtICE9PSBudWxsKTtcclxuICB9XHJcbiAgY29uc3Qgc2luZ2xlID0gcGFyc2VGcm9udG1hdHRlckRhdGUodmFsdWUpO1xyXG4gIHJldHVybiBzaW5nbGUgPyBbc2luZ2xlXSA6IFtdO1xyXG59O1xyXG5cclxuY29uc3Qgc3RhcnRPZk1vbnRoID0gKGRhdGU6IERhdGUpID0+IG5ldyBEYXRlKGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpLCAxKTtcclxuY29uc3QgZW5kT2ZNb250aCA9IChkYXRlOiBEYXRlKSA9PiBuZXcgRGF0ZShkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSArIDEsIDApO1xyXG5cclxuY29uc3QgYWRkRGF5cyA9IChkYXRlOiBEYXRlLCBkYXlzOiBudW1iZXIpID0+XHJcbiAgbmV3IERhdGUoZGF0ZS5nZXRGdWxsWWVhcigpLCBkYXRlLmdldE1vbnRoKCksIGRhdGUuZ2V0RGF0ZSgpICsgZGF5cyk7XHJcblxyXG5jb25zdCBpc1NhbWVEYXkgPSAoYTogRGF0ZSwgYjogRGF0ZSkgPT5cclxuICBhLmdldEZ1bGxZZWFyKCkgPT09IGIuZ2V0RnVsbFllYXIoKSAmJlxyXG4gIGEuZ2V0TW9udGgoKSA9PT0gYi5nZXRNb250aCgpICYmXHJcbiAgYS5nZXREYXRlKCkgPT09IGIuZ2V0RGF0ZSgpO1xyXG5cclxuY29uc3QgZm9ybWF0VGltZSA9IChkYXRlOiBEYXRlLCBmb3JtYXQ6IENhbGVuZGFyU2V0dGluZ3NbXCJ0aW1lRm9ybWF0XCJdKSA9PiB7XHJcbiAgaWYgKGZvcm1hdCA9PT0gXCIyNGhcIikge1xyXG4gICAgcmV0dXJuIGRhdGUudG9Mb2NhbGVUaW1lU3RyaW5nKFtdLCB7IGhvdXI6IFwiMi1kaWdpdFwiLCBtaW51dGU6IFwiMi1kaWdpdFwiLCBob3VyMTI6IGZhbHNlIH0pO1xyXG4gIH1cclxuICByZXR1cm4gZGF0ZS50b0xvY2FsZVRpbWVTdHJpbmcoW10sIHsgaG91cjogXCJudW1lcmljXCIsIG1pbnV0ZTogXCIyLWRpZ2l0XCIsIGhvdXIxMjogdHJ1ZSB9KTtcclxufTtcclxuXHJcbmNvbnN0IGNsYW1wVG9EYXlTdGFydCA9IChkYXRlOiBEYXRlKSA9PiBuZXcgRGF0ZShkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCkpO1xyXG5cclxuY29uc3QgY2xhbXBUb0RheUVuZCA9IChkYXRlOiBEYXRlKSA9PlxyXG4gIG5ldyBEYXRlKGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpLCBkYXRlLmdldERhdGUoKSwgMjMsIDU5LCA1OSwgOTk5KTtcclxuXHJcbmNvbnN0IGNyZWF0ZVNvdXJjZUlkID0gKCkgPT4ge1xyXG4gIGlmICh0eXBlb2YgY3J5cHRvICE9PSBcInVuZGVmaW5lZFwiICYmIFwicmFuZG9tVVVJRFwiIGluIGNyeXB0bykge1xyXG4gICAgcmV0dXJuIGNyeXB0by5yYW5kb21VVUlEKCk7XHJcbiAgfVxyXG4gIHJldHVybiBgc3JjLSR7RGF0ZS5ub3coKX0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDE2KS5zbGljZSgyKX1gO1xyXG59O1xyXG5cclxuY2xhc3MgQ2FsZW5kYXJWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xyXG4gIHByaXZhdGUgcGx1Z2luOiBDYWxlbmRhclBsdWdpbjtcclxuICBwcml2YXRlIHNlbGVjdGVkRGF0ZSA9IG5ldyBEYXRlKCk7XHJcbiAgcHJpdmF0ZSB2aXNpYmxlTW9udGggPSBuZXcgRGF0ZSgpO1xyXG4gIHByaXZhdGUgZXZlbnRzOiBDYWxlbmRhckV2ZW50W10gPSBbXTtcclxuICBwcml2YXRlIGhlYWRlclRpdGxlPzogSFRNTEVsZW1lbnQ7XHJcbiAgcHJpdmF0ZSBncmlkRWw/OiBIVE1MRWxlbWVudDtcclxuICBwcml2YXRlIGRldGFpbHNFbD86IEhUTUxFbGVtZW50O1xyXG4gIHByaXZhdGUgbm90ZXNCeURhdGUgPSBuZXcgTWFwPHN0cmluZywgTGlua2VkTm90ZVtdPigpO1xyXG4gIHByaXZhdGUgbm90ZUV4Y2VycHRDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XHJcbiAgcHJpdmF0ZSBtYXhOb3Rlc0ZvckdyaWQgPSAxO1xyXG4gIHByaXZhdGUgaG92ZXJQcmV2aWV3RWw/OiBIVE1MRWxlbWVudDtcclxuXHJcbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZiwgcGx1Z2luOiBDYWxlbmRhclBsdWdpbikge1xyXG4gICAgc3VwZXIobGVhZik7XHJcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICB9XHJcblxyXG4gIGdldFZpZXdUeXBlKCkge1xyXG4gICAgcmV0dXJuIFZJRVdfVFlQRV9DQUxFTkRBUjtcclxuICB9XHJcblxyXG4gIGdldERpc3BsYXlUZXh0KCkge1xyXG4gICAgcmV0dXJuIFwiQ2FsZW5kYXJcIjtcclxuICB9XHJcblxyXG4gIGdldEljb24oKSB7XHJcbiAgICByZXR1cm4gXCJjYWxlbmRhclwiO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgb25PcGVuKCkge1xyXG4gICAgdGhpcy5jb250YWluZXJFbC5lbXB0eSgpO1xyXG4gICAgdGhpcy5jb250YWluZXJFbC5hZGRDbGFzcyhcIm9ic2lkaWFuLWNhbGVuZGFyXCIpO1xyXG4gICAgdGhpcy5idWlsZExheW91dCgpO1xyXG4gICAgdGhpcy5lbnN1cmVIb3ZlclByZXZpZXcoKTtcclxuICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBvbkNsb3NlKCkge1xyXG4gICAgdGhpcy5ob3ZlclByZXZpZXdFbD8ucmVtb3ZlKCk7XHJcbiAgICB0aGlzLmhvdmVyUHJldmlld0VsID0gdW5kZWZpbmVkO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgc2V0RXZlbnRzKGV2ZW50czogQ2FsZW5kYXJFdmVudFtdKSB7XHJcbiAgICB0aGlzLmV2ZW50cyA9IGV2ZW50cztcclxuICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgfVxyXG5cclxuICBqdW1wVG9Ub2RheSgpIHtcclxuICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcclxuICAgIHRoaXMuc2VsZWN0ZWREYXRlID0gdG9kYXk7XHJcbiAgICB0aGlzLnZpc2libGVNb250aCA9IG5ldyBEYXRlKHRvZGF5LmdldEZ1bGxZZWFyKCksIHRvZGF5LmdldE1vbnRoKCksIDEpO1xyXG4gICAgdGhpcy5yZW5kZXIoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGRMYXlvdXQoKSB7XHJcbiAgICBjb25zdCBoZWFkZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9faGVhZGVyXCIgfSk7XHJcbiAgICBjb25zdCBuYXYgPSBoZWFkZXIuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19uYXZcIiB9KTtcclxuXHJcbiAgICBjb25zdCBwcmV2QnRuID0gbmF2LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdTIxOTBcIiB9KTtcclxuICAgIGNvbnN0IG5leHRCdG4gPSBuYXYuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlx1MjE5MlwiIH0pO1xyXG4gICAgY29uc3QgdG9kYXlCdG4gPSBuYXYuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlRvZGF5XCIgfSk7XHJcbiAgICBjb25zdCByZWZyZXNoQnRuID0gbmF2LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJSZWZyZXNoXCIgfSk7XHJcblxyXG4gICAgdGhpcy5oZWFkZXJUaXRsZSA9IGhlYWRlci5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX3RpdGxlXCIgfSk7XHJcblxyXG4gICAgY29uc3QgYm9keSA9IHRoaXMuY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ib2R5XCIgfSk7XHJcbiAgICB0aGlzLmdyaWRFbCA9IGJvZHkuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ncmlkXCIgfSk7XHJcbiAgICB0aGlzLmRldGFpbHNFbCA9IGJvZHkuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzXCIgfSk7XHJcblxyXG4gICAgcHJldkJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICB0aGlzLnZpc2libGVNb250aCA9IG5ldyBEYXRlKHRoaXMudmlzaWJsZU1vbnRoLmdldEZ1bGxZZWFyKCksIHRoaXMudmlzaWJsZU1vbnRoLmdldE1vbnRoKCkgLSAxLCAxKTtcclxuICAgICAgdGhpcy5yZW5kZXIoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIG5leHRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgdGhpcy52aXNpYmxlTW9udGggPSBuZXcgRGF0ZSh0aGlzLnZpc2libGVNb250aC5nZXRGdWxsWWVhcigpLCB0aGlzLnZpc2libGVNb250aC5nZXRNb250aCgpICsgMSwgMSk7XHJcbiAgICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0b2RheUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICB0aGlzLmp1bXBUb1RvZGF5KCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICByZWZyZXNoQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgIHRoaXMucGx1Z2luLnJlZnJlc2hFdmVudHModHJ1ZSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVuZGVyKCkge1xyXG4gICAgaWYgKCF0aGlzLmdyaWRFbCB8fCAhdGhpcy5kZXRhaWxzRWwgfHwgIXRoaXMuaGVhZGVyVGl0bGUpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuZ3JpZEVsLmVtcHR5KCk7XHJcbiAgICB0aGlzLmRldGFpbHNFbC5lbXB0eSgpO1xyXG5cclxuICAgIGNvbnN0IG1vbnRoU3RhcnQgPSBzdGFydE9mTW9udGgodGhpcy52aXNpYmxlTW9udGgpO1xyXG4gICAgY29uc3QgbW9udGhFbmQgPSBlbmRPZk1vbnRoKHRoaXMudmlzaWJsZU1vbnRoKTtcclxuICAgIGNvbnN0IHN0YXJ0V2Vla2RheSA9IHRoaXMucGx1Z2luLnNldHRpbmdzLndlZWtTdGFydCA9PT0gXCJtb25kYXlcIiA/IDEgOiAwO1xyXG4gICAgY29uc3Qgb2Zmc2V0ID0gKG1vbnRoU3RhcnQuZ2V0RGF5KCkgLSBzdGFydFdlZWtkYXkgKyA3KSAlIDc7XHJcbiAgICBjb25zdCBncmlkU3RhcnQgPSBhZGREYXlzKG1vbnRoU3RhcnQsIC1vZmZzZXQpO1xyXG4gICAgY29uc3QgZ3JpZEVuZCA9IGFkZERheXMobW9udGhFbmQsICg2IC0gKChtb250aEVuZC5nZXREYXkoKSAtIHN0YXJ0V2Vla2RheSArIDcpICUgNykpKTtcclxuXHJcbiAgICB0aGlzLm5vdGVzQnlEYXRlID0gdGhpcy5idWlsZE5vdGVzSW5kZXgoZ3JpZFN0YXJ0LCBncmlkRW5kKTtcclxuICAgIHRoaXMubWF4Tm90ZXNGb3JHcmlkID0gdGhpcy5nZXRNYXhOb3Rlc0NvdW50KCk7XHJcblxyXG4gICAgdGhpcy5oZWFkZXJUaXRsZS5zZXRUZXh0KFxyXG4gICAgICBtb250aFN0YXJ0LnRvTG9jYWxlRGF0ZVN0cmluZyhbXSwgeyB5ZWFyOiBcIm51bWVyaWNcIiwgbW9udGg6IFwibG9uZ1wiIH0pXHJcbiAgICApO1xyXG5cclxuICAgIGNvbnN0IHdlZWtkYXlSb3cgPSB0aGlzLmdyaWRFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX3dlZWtkYXlzXCIgfSk7XHJcbiAgICBjb25zdCBsYWJlbHMgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy53ZWVrU3RhcnQgPT09IFwibW9uZGF5XCJcclxuICAgICAgPyBbLi4uV0VFS0RBWV9MQUJFTFMuc2xpY2UoMSksIFdFRUtEQVlfTEFCRUxTWzBdXVxyXG4gICAgICA6IFdFRUtEQVlfTEFCRUxTO1xyXG5cclxuICAgIGZvciAoY29uc3QgbGFiZWwgb2YgbGFiZWxzKSB7XHJcbiAgICAgIHdlZWtkYXlSb3cuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX193ZWVrZGF5XCIsIHRleHQ6IGxhYmVsIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGRheXNHcmlkID0gdGhpcy5ncmlkRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19kYXlzXCIgfSk7XHJcbiAgICBsZXQgY3Vyc29yID0gbmV3IERhdGUoZ3JpZFN0YXJ0KTtcclxuICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcclxuXHJcbiAgICB3aGlsZSAoY3Vyc29yIDw9IGdyaWRFbmQpIHtcclxuICAgICAgY29uc3QgY2VsbERhdGUgPSBuZXcgRGF0ZShjdXJzb3IpO1xyXG4gICAgICBjb25zdCBjZWxsID0gZGF5c0dyaWQuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2RheVwiIH0pO1xyXG4gICAgICBjZWxsLnNldEF0dHIoXCJ0eXBlXCIsIFwiYnV0dG9uXCIpO1xyXG5cclxuICAgICAgaWYgKGNlbGxEYXRlLmdldE1vbnRoKCkgIT09IHRoaXMudmlzaWJsZU1vbnRoLmdldE1vbnRoKCkpIHtcclxuICAgICAgICBjZWxsLmFkZENsYXNzKFwiaXMtb3V0c2lkZVwiKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAoY2VsbERhdGUuZ2V0RGF5KCkgPT09IDAgfHwgY2VsbERhdGUuZ2V0RGF5KCkgPT09IDYpIHtcclxuICAgICAgICBjZWxsLmFkZENsYXNzKFwiaXMtd2Vla2VuZFwiKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAoaXNTYW1lRGF5KGNlbGxEYXRlLCB0b2RheSkpIHtcclxuICAgICAgICBjZWxsLmFkZENsYXNzKFwiaXMtdG9kYXlcIik7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGlzU2FtZURheShjZWxsRGF0ZSwgdGhpcy5zZWxlY3RlZERhdGUpKSB7XHJcbiAgICAgICAgY2VsbC5hZGRDbGFzcyhcImlzLXNlbGVjdGVkXCIpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBudW1iZXJFbCA9IGNlbGwuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19kYXktbnVtYmVyXCIgfSk7XHJcbiAgICAgIG51bWJlckVsLnNldFRleHQoU3RyaW5nKGNlbGxEYXRlLmdldERhdGUoKSkpO1xyXG5cclxuICAgICAgY29uc3Qgc3VidGl0bGUgPSBjZWxsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZGF5LXN1YnRpdGxlXCIgfSk7XHJcbiAgICAgIGNvbnN0IG5vdGVzRm9yRGF5ID0gdGhpcy5nZXROb3Rlc0ZvckRheShjZWxsRGF0ZSk7XHJcbiAgICAgIGlmIChub3Rlc0ZvckRheS5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgc3VidGl0bGUuc2V0VGV4dChub3Rlc0ZvckRheVswXS50aXRsZSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc3QgZGF5RXZlbnRzID0gdGhpcy5nZXRFdmVudHNGb3JEYXkoY2VsbERhdGUpO1xyXG4gICAgICAgIGlmIChkYXlFdmVudHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgc3VidGl0bGUuc2V0VGV4dChkYXlFdmVudHNbMF0uc3VtbWFyeSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBpbmRpY2F0b3IgPSBjZWxsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZGF5LWluZGljYXRvclwiIH0pO1xyXG4gICAgICBpZiAobm90ZXNGb3JEYXkubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IHJhdGlvID0gTWF0aC5taW4obm90ZXNGb3JEYXkubGVuZ3RoIC8gdGhpcy5tYXhOb3Rlc0ZvckdyaWQsIDEpO1xyXG4gICAgICAgIGNvbnN0IHdpZHRoID0gTWF0aC5tYXgoMC4yNSwgcmF0aW8pICogMTAwO1xyXG4gICAgICAgIGNvbnN0IGJhciA9IGluZGljYXRvci5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2RheS1iYXJcIiB9KTtcclxuICAgICAgICBiYXIuc3R5bGUud2lkdGggPSBgJHt3aWR0aH0lYDtcclxuICAgICAgfVxyXG5cclxuICAgICAgY2VsbC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VlbnRlclwiLCAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5zaG93SG92ZXJQcmV2aWV3KGNlbGwsIG5vdGVzRm9yRGF5KTtcclxuICAgICAgfSk7XHJcbiAgICAgIGNlbGwuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbGVhdmVcIiwgKCkgPT4ge1xyXG4gICAgICAgIHRoaXMuaGlkZUhvdmVyUHJldmlldygpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGNlbGwuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgICB0aGlzLnNlbGVjdGVkRGF0ZSA9IGNlbGxEYXRlO1xyXG4gICAgICAgIGlmIChjZWxsRGF0ZS5nZXRNb250aCgpICE9PSB0aGlzLnZpc2libGVNb250aC5nZXRNb250aCgpKSB7XHJcbiAgICAgICAgICB0aGlzLnZpc2libGVNb250aCA9IG5ldyBEYXRlKGNlbGxEYXRlLmdldEZ1bGxZZWFyKCksIGNlbGxEYXRlLmdldE1vbnRoKCksIDEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnJlbmRlcigpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGN1cnNvciA9IGFkZERheXMoY3Vyc29yLCAxKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnJlbmRlckRldGFpbHMoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVuZGVyRGV0YWlscygpIHtcclxuICAgIGlmICghdGhpcy5kZXRhaWxzRWwpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5kZXRhaWxzRWwuZW1wdHkoKTtcclxuXHJcbiAgICBjb25zdCB0aXRsZSA9IHRoaXMuZGV0YWlsc0VsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlscy10aXRsZVwiIH0pO1xyXG4gICAgdGl0bGUuc2V0VGV4dChcclxuICAgICAgdGhpcy5zZWxlY3RlZERhdGUudG9Mb2NhbGVEYXRlU3RyaW5nKFtdLCB7IG1vbnRoOiBcImxvbmdcIiwgZGF5OiBcIm51bWVyaWNcIiwgeWVhcjogXCJudW1lcmljXCIgfSlcclxuICAgICk7XHJcblxyXG4gICAgY29uc3Qgbm90ZXMgPSB0aGlzLmdldE5vdGVzRm9yRGF5KHRoaXMuc2VsZWN0ZWREYXRlKTtcclxuICAgIGNvbnN0IGV2ZW50cyA9IHRoaXMuZ2V0RXZlbnRzRm9yRGF5KHRoaXMuc2VsZWN0ZWREYXRlKTtcclxuXHJcbiAgICBpZiAoZXZlbnRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgY29uc3QgZXZlbnRzU2VjdGlvbiA9IHRoaXMuZGV0YWlsc0VsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fc2VjdGlvblwiIH0pO1xyXG4gICAgICBldmVudHNTZWN0aW9uLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fc2VjdGlvbi10aXRsZVwiLCB0ZXh0OiBcIkV2ZW50c1wiIH0pO1xyXG4gICAgICBjb25zdCBldmVudHNMaXN0ID0gZXZlbnRzU2VjdGlvbi5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2V2ZW50LWxpc3RcIiB9KTtcclxuICAgICAgZm9yIChjb25zdCBldmVudCBvZiBldmVudHMpIHtcclxuICAgICAgICBjb25zdCByb3cgPSBldmVudHNMaXN0LmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZXZlbnQtcm93XCIgfSk7XHJcbiAgICAgICAgcm93LmNyZWF0ZURpdih7XHJcbiAgICAgICAgICBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2V2ZW50LXRpbWVcIixcclxuICAgICAgICAgIHRleHQ6IGV2ZW50LmFsbERheSA/IFwiQWxsIGRheVwiIDogZm9ybWF0VGltZShldmVudC5zdGFydCwgdGhpcy5wbHVnaW4uc2V0dGluZ3MudGltZUZvcm1hdClcclxuICAgICAgICB9KTtcclxuICAgICAgICByb3cuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ldmVudC1zdW1tYXJ5XCIsIHRleHQ6IGV2ZW50LnN1bW1hcnkgfSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAobm90ZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICBjb25zdCBub3Rlc1NlY3Rpb24gPSB0aGlzLmRldGFpbHNFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX3NlY3Rpb25cIiB9KTtcclxuICAgICAgbm90ZXNTZWN0aW9uLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fc2VjdGlvbi10aXRsZVwiLCB0ZXh0OiBcIk5vdGVzXCIgfSk7XHJcbiAgICAgIGNvbnN0IG5vdGVzTGlzdCA9IG5vdGVzU2VjdGlvbi5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX25vdGVzLWxpc3RcIiB9KTtcclxuICAgICAgZm9yIChjb25zdCBub3RlIG9mIG5vdGVzKSB7XHJcbiAgICAgICAgY29uc3Qgcm93ID0gbm90ZXNMaXN0LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXJvd1wiIH0pO1xyXG4gICAgICAgIHJvdy5zZXRBdHRyKFwidHlwZVwiLCBcImJ1dHRvblwiKTtcclxuICAgICAgICByb3cuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXRpdGxlXCIsIHRleHQ6IG5vdGUudGl0bGUgfSk7XHJcbiAgICAgICAgY29uc3QgZXhjZXJwdEVsID0gcm93LmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1leGNlcnB0XCIsIHRleHQ6IG5vdGUuZXhjZXJwdCB9KTtcclxuICAgICAgICB0aGlzLmVuc3VyZUV4Y2VycHQobm90ZS5maWxlLCBleGNlcnB0RWwpO1xyXG4gICAgICAgIHJvdy5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5vcGVuTm90ZShub3RlLmZpbGUpKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChub3Rlcy5sZW5ndGggPT09IDAgJiYgZXZlbnRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICB0aGlzLmRldGFpbHNFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX2RldGFpbHMtZW1wdHlcIiwgdGV4dDogXCJObyBub3RlcyBvciBldmVudHNcIiB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MuYWxsb3dDcmVhdGVOb3RlKSB7XHJcbiAgICAgIGNvbnN0IGFjdGlvbiA9IHRoaXMuZGV0YWlsc0VsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlscy1hY3Rpb25cIiB9KTtcclxuICAgICAgY29uc3QgYnV0dG9uID0gYWN0aW9uLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJDcmVhdGUgbm90ZVwiIH0pO1xyXG4gICAgICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jICgpID0+IHtcclxuICAgICAgICBjb25zdCBmaWxlID0gYXdhaXQgdGhpcy5wbHVnaW4uY3JlYXRlTm90ZUZvckRhdGUodGhpcy5zZWxlY3RlZERhdGUpO1xyXG4gICAgICAgIGlmIChmaWxlKSB7XHJcbiAgICAgICAgICB0aGlzLm9wZW5Ob3RlKGZpbGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldEV2ZW50c0ZvckRheShkYXk6IERhdGUpIHtcclxuICAgIGNvbnN0IHN0YXJ0ID0gY2xhbXBUb0RheVN0YXJ0KGRheSk7XHJcbiAgICBjb25zdCBlbmQgPSBjbGFtcFRvRGF5RW5kKGRheSk7XHJcbiAgICByZXR1cm4gdGhpcy5ldmVudHNcclxuICAgICAgLmZpbHRlcigoZXZlbnQpID0+IGV2ZW50LnN0YXJ0IDw9IGVuZCAmJiBldmVudC5lbmQgPj0gc3RhcnQpXHJcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBhLnN0YXJ0LmdldFRpbWUoKSAtIGIuc3RhcnQuZ2V0VGltZSgpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGROb3Rlc0luZGV4KHN0YXJ0OiBEYXRlLCBlbmQ6IERhdGUpIHtcclxuICAgIGNvbnN0IGluZGV4ID0gbmV3IE1hcDxzdHJpbmcsIExpbmtlZE5vdGVbXT4oKTtcclxuICAgIGNvbnN0IHN0YXJ0RGF5ID0gY2xhbXBUb0RheVN0YXJ0KHN0YXJ0KTtcclxuICAgIGNvbnN0IGVuZERheSA9IGNsYW1wVG9EYXlFbmQoZW5kKTtcclxuICAgIGNvbnN0IGZpZWxkcyA9IHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVEYXRlRmllbGRzXHJcbiAgICAgIC5tYXAoKGZpZWxkKSA9PiBmaWVsZC50cmltKCkpXHJcbiAgICAgIC5maWx0ZXIoKGZpZWxkKSA9PiBmaWVsZC5sZW5ndGggPiAwKTtcclxuXHJcbiAgICBpZiAoZmllbGRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICByZXR1cm4gaW5kZXg7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZmlsZXMgPSB0aGlzLnBsdWdpbi5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xyXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XHJcbiAgICAgIGNvbnN0IGNhY2hlID0gdGhpcy5wbHVnaW4uYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xyXG4gICAgICBpZiAoIWNhY2hlPy5mcm9udG1hdHRlcikge1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBmb3IgKGNvbnN0IGZpZWxkIG9mIGZpZWxkcykge1xyXG4gICAgICAgIGNvbnN0IHJhd1ZhbHVlID0gY2FjaGUuZnJvbnRtYXR0ZXJbZmllbGRdO1xyXG4gICAgICAgIGlmICghcmF3VmFsdWUpIHtcclxuICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBkYXRlcyA9IGV4dHJhY3RGcm9udG1hdHRlckRhdGVzKHJhd1ZhbHVlKTtcclxuICAgICAgICBmb3IgKGNvbnN0IGRhdGUgb2YgZGF0ZXMpIHtcclxuICAgICAgICAgIGlmIChkYXRlIDwgc3RhcnREYXkgfHwgZGF0ZSA+IGVuZERheSkge1xyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGNvbnN0IGtleSA9IGZvcm1hdERhdGVLZXkoZGF0ZSk7XHJcbiAgICAgICAgICBjb25zdCBsaXN0ID0gaW5kZXguZ2V0KGtleSkgPz8gW107XHJcbiAgICAgICAgICBpZiAoIWxpc3Quc29tZSgobm90ZSkgPT4gbm90ZS5maWxlLnBhdGggPT09IGZpbGUucGF0aCkpIHtcclxuICAgICAgICAgICAgY29uc3QgdGl0bGUgPSBmaWxlLmJhc2VuYW1lO1xyXG4gICAgICAgICAgICBsaXN0LnB1c2goe1xyXG4gICAgICAgICAgICAgIGZpbGUsXHJcbiAgICAgICAgICAgICAgdGl0bGUsXHJcbiAgICAgICAgICAgICAgZXhjZXJwdDogdGhpcy5ub3RlRXhjZXJwdENhY2hlLmdldChmaWxlLnBhdGgpID8/IFwiXCJcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGluZGV4LnNldChrZXksIGxpc3QpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZvciAoY29uc3QgW2tleSwgbGlzdF0gb2YgaW5kZXguZW50cmllcygpKSB7XHJcbiAgICAgIGxpc3Quc29ydCgoYSwgYikgPT4gYS50aXRsZS5sb2NhbGVDb21wYXJlKGIudGl0bGUpKTtcclxuICAgICAgaW5kZXguc2V0KGtleSwgbGlzdCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGluZGV4O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXROb3Rlc0ZvckRheShkYXk6IERhdGUpIHtcclxuICAgIHJldHVybiB0aGlzLm5vdGVzQnlEYXRlLmdldChmb3JtYXREYXRlS2V5KGRheSkpID8/IFtdO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRNYXhOb3Rlc0NvdW50KCkge1xyXG4gICAgbGV0IG1heENvdW50ID0gMTtcclxuICAgIGZvciAoY29uc3QgbGlzdCBvZiB0aGlzLm5vdGVzQnlEYXRlLnZhbHVlcygpKSB7XHJcbiAgICAgIGlmIChsaXN0Lmxlbmd0aCA+IG1heENvdW50KSB7XHJcbiAgICAgICAgbWF4Q291bnQgPSBsaXN0Lmxlbmd0aDtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG1heENvdW50O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBlbnN1cmVIb3ZlclByZXZpZXcoKSB7XHJcbiAgICBpZiAodGhpcy5ob3ZlclByZXZpZXdFbCkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLmhvdmVyUHJldmlld0VsID0gZG9jdW1lbnQuYm9keS5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtcHJldmlld1wiIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzaG93SG92ZXJQcmV2aWV3KGFuY2hvcjogSFRNTEVsZW1lbnQsIG5vdGVzOiBMaW5rZWROb3RlW10pIHtcclxuICAgIGlmICghdGhpcy5ob3ZlclByZXZpZXdFbCB8fCBub3Rlcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuaG92ZXJQcmV2aWV3RWwuZW1wdHkoKTtcclxuICAgIGZvciAoY29uc3Qgbm90ZSBvZiBub3Rlcy5zbGljZSgwLCAzKSkge1xyXG4gICAgICBjb25zdCByb3cgPSB0aGlzLmhvdmVyUHJldmlld0VsLmNyZWF0ZURpdih7IGNsczogXCJvYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1wcmV2aWV3LXJvd1wiIH0pO1xyXG4gICAgICByb3cuY3JlYXRlRGl2KHsgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXByZXZpZXctdGl0bGVcIiwgdGV4dDogbm90ZS50aXRsZSB9KTtcclxuICAgICAgY29uc3QgZXhjZXJwdEVsID0gcm93LmNyZWF0ZURpdih7XHJcbiAgICAgICAgY2xzOiBcIm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXByZXZpZXctZXhjZXJwdFwiLFxyXG4gICAgICAgIHRleHQ6IG5vdGUuZXhjZXJwdFxyXG4gICAgICB9KTtcclxuICAgICAgdGhpcy5lbnN1cmVFeGNlcnB0KG5vdGUuZmlsZSwgZXhjZXJwdEVsKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmhvdmVyUHJldmlld0VsLnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XHJcblxyXG4gICAgY29uc3QgcmVjdCA9IGFuY2hvci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgIGNvbnN0IHByZXZpZXdXaWR0aCA9IDIyMDtcclxuICAgIGNvbnN0IHByZXZpZXdIZWlnaHQgPSB0aGlzLmhvdmVyUHJldmlld0VsLm9mZnNldEhlaWdodCB8fCA4MDtcclxuICAgIGNvbnN0IHBhZGRpbmcgPSA4O1xyXG4gICAgY29uc3Qgdmlld3BvcnRXaWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xyXG4gICAgY29uc3Qgdmlld3BvcnRIZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XHJcblxyXG4gICAgbGV0IGxlZnQgPSByZWN0LmxlZnQgKyByZWN0LndpZHRoIC8gMiAtIHByZXZpZXdXaWR0aCAvIDI7XHJcbiAgICBsZWZ0ID0gTWF0aC5tYXgocGFkZGluZywgTWF0aC5taW4obGVmdCwgdmlld3BvcnRXaWR0aCAtIHByZXZpZXdXaWR0aCAtIHBhZGRpbmcpKTtcclxuXHJcbiAgICBsZXQgdG9wID0gcmVjdC5ib3R0b20gKyA2O1xyXG4gICAgaWYgKHRvcCArIHByZXZpZXdIZWlnaHQgPiB2aWV3cG9ydEhlaWdodCAtIHBhZGRpbmcpIHtcclxuICAgICAgdG9wID0gcmVjdC50b3AgLSBwcmV2aWV3SGVpZ2h0IC0gNjtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmhvdmVyUHJldmlld0VsLnN0eWxlLndpZHRoID0gYCR7cHJldmlld1dpZHRofXB4YDtcclxuICAgIHRoaXMuaG92ZXJQcmV2aWV3RWwuc3R5bGUubGVmdCA9IGAke2xlZnR9cHhgO1xyXG4gICAgdGhpcy5ob3ZlclByZXZpZXdFbC5zdHlsZS50b3AgPSBgJHtNYXRoLm1heChwYWRkaW5nLCB0b3ApfXB4YDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGlkZUhvdmVyUHJldmlldygpIHtcclxuICAgIGlmICh0aGlzLmhvdmVyUHJldmlld0VsKSB7XHJcbiAgICAgIHRoaXMuaG92ZXJQcmV2aWV3RWwuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBlbnN1cmVFeGNlcnB0KGZpbGU6IFRGaWxlLCB0YXJnZXRFbDogSFRNTEVsZW1lbnQpIHtcclxuICAgIGlmICh0aGlzLm5vdGVFeGNlcnB0Q2FjaGUuaGFzKGZpbGUucGF0aCkpIHtcclxuICAgICAgdGFyZ2V0RWwuc2V0VGV4dCh0aGlzLm5vdGVFeGNlcnB0Q2FjaGUuZ2V0KGZpbGUucGF0aCkgPz8gXCJcIik7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHRoaXMucGx1Z2luLmFwcC52YXVsdC5jYWNoZWRSZWFkKGZpbGUpLnRoZW4oKGNvbnRlbnQpID0+IHtcclxuICAgICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KFwiXFxuXCIpO1xyXG4gICAgICBsZXQgc3RhcnRJbmRleCA9IDA7XHJcbiAgICAgIGlmIChsaW5lc1swXT8udHJpbSgpID09PSBcIi0tLVwiKSB7XHJcbiAgICAgICAgY29uc3QgZW5kSW5kZXggPSBsaW5lcy5zbGljZSgxKS5maW5kSW5kZXgoKGxpbmUpID0+IGxpbmUudHJpbSgpID09PSBcIi0tLVwiKTtcclxuICAgICAgICBpZiAoZW5kSW5kZXggPj0gMCkge1xyXG4gICAgICAgICAgc3RhcnRJbmRleCA9IGVuZEluZGV4ICsgMjtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgZmlyc3RMaW5lID0gbGluZXMuc2xpY2Uoc3RhcnRJbmRleCkuZmluZCgobGluZSkgPT4gbGluZS50cmltKCkubGVuZ3RoID4gMCkgPz8gXCJcIjtcclxuICAgICAgY29uc3QgZXhjZXJwdCA9IGZpcnN0TGluZS5yZXBsYWNlKC9eI1xccysvLCBcIlwiKS50cmltKCk7XHJcbiAgICAgIHRoaXMubm90ZUV4Y2VycHRDYWNoZS5zZXQoZmlsZS5wYXRoLCBleGNlcnB0KTtcclxuICAgICAgdGFyZ2V0RWwuc2V0VGV4dChleGNlcnB0KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBvcGVuTm90ZShmaWxlOiBURmlsZSkge1xyXG4gICAgY29uc3QgbGVhZiA9IHRoaXMucGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZihmYWxzZSk7XHJcbiAgICBjb25zdCBjYWNoZSA9IHRoaXMucGx1Z2luLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShmaWxlKTtcclxuICAgIGNvbnN0IGxpbmUgPSBjYWNoZT8uZnJvbnRtYXR0ZXJQb3NpdGlvbj8uZW5kPy5saW5lID8/IDA7XHJcbiAgICBhd2FpdCBsZWFmLm9wZW5GaWxlKGZpbGUsIHsgc3RhdGU6IHsgbGluZSB9LCBhY3RpdmU6IHRydWUgfSk7XHJcbiAgfVxyXG59XHJcblxyXG5jbGFzcyBDYWxlbmRhclNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcclxuICBwcml2YXRlIHBsdWdpbjogQ2FsZW5kYXJQbHVnaW47XHJcbiAgcHJpdmF0ZSBzZWxlY3RlZFRlbXBsYXRlRm9sZGVyID0gXCJcIjtcclxuXHJcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogQ2FsZW5kYXJQbHVnaW4pIHtcclxuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcclxuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xyXG4gIH1cclxuXHJcbiAgZGlzcGxheSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XHJcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xyXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiQ2FsZW5kYXJcIiB9KTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJSZWZyZXNoIGludGVydmFsIChtaW51dGVzKVwiKVxyXG4gICAgICAuc2V0RGVzYyhcIkhvdyBvZnRlbiBjYWxlbmRhciBzb3VyY2VzIGFyZSByZWZyZXNoZWQuXCIpXHJcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgIHRleHRcclxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcIjMwXCIpXHJcbiAgICAgICAgICAuc2V0VmFsdWUoU3RyaW5nKHRoaXMucGx1Z2luLnNldHRpbmdzLnJlZnJlc2hJbnRlcnZhbE1pbnV0ZXMpKVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBOdW1iZXIodmFsdWUpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5yZWZyZXNoSW50ZXJ2YWxNaW51dGVzID0gTnVtYmVyLmlzRmluaXRlKHBhcnNlZCkgJiYgcGFyc2VkID4gMFxyXG4gICAgICAgICAgICAgID8gcGFyc2VkXHJcbiAgICAgICAgICAgICAgOiBERUZBVUxUX1NFVFRJTkdTLnJlZnJlc2hJbnRlcnZhbE1pbnV0ZXM7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5yZWZyZXNoRXZlbnRzKHRydWUpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5yZXN0YXJ0QXV0b1JlZnJlc2goKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiV2VlayBzdGFydHMgb25cIilcclxuICAgICAgLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT5cclxuICAgICAgICBkcm9wZG93blxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcInN1bmRheVwiLCBcIlN1bmRheVwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcIm1vbmRheVwiLCBcIk1vbmRheVwiKVxyXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLndlZWtTdGFydClcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWU6IENhbGVuZGFyU2V0dGluZ3NbXCJ3ZWVrU3RhcnRcIl0pID0+IHtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mud2Vla1N0YXJ0ID0gdmFsdWU7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5yZW5kZXJWaWV3cygpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJUaW1lIGZvcm1hdFwiKVxyXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PlxyXG4gICAgICAgIGRyb3Bkb3duXHJcbiAgICAgICAgICAuYWRkT3B0aW9uKFwiMjRoXCIsIFwiMjQtaG91clwiKVxyXG4gICAgICAgICAgLmFkZE9wdGlvbihcIjEyaFwiLCBcIjEyLWhvdXJcIilcclxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy50aW1lRm9ybWF0KVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZTogQ2FsZW5kYXJTZXR0aW5nc1tcInRpbWVGb3JtYXRcIl0pID0+IHtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MudGltZUZvcm1hdCA9IHZhbHVlO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVuZGVyVmlld3MoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiVG9kYXkgaGlnaGxpZ2h0XCIpXHJcbiAgICAgIC5zZXREZXNjKFwiSGlnaGxpZ2h0IGNvbG9yIGZvciB0b2RheS5cIilcclxuICAgICAgLmFkZENvbG9yUGlja2VyKChwaWNrZXIpID0+XHJcbiAgICAgICAgcGlja2VyXHJcbiAgICAgICAgICAuc2V0VmFsdWUocmVzb2x2ZUhpZ2hsaWdodFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnRvZGF5SGlnaGxpZ2h0LCBcIi0taW50ZXJhY3RpdmUtYWNjZW50XCIpKVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy50b2RheUhpZ2hsaWdodCA9IHZhbHVlO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uYXBwbHlIaWdobGlnaHRWYXJpYWJsZXMoKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICk7XHJcblxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKFwiU2VsZWN0ZWQgZGF0ZSBoaWdobGlnaHRcIilcclxuICAgICAgLnNldERlc2MoXCJIaWdobGlnaHQgY29sb3IgZm9yIHRoZSBzZWxlY3RlZCBkYXRlLlwiKVxyXG4gICAgICAuYWRkQ29sb3JQaWNrZXIoKHBpY2tlcikgPT5cclxuICAgICAgICBwaWNrZXJcclxuICAgICAgICAgIC5zZXRWYWx1ZShyZXNvbHZlSGlnaGxpZ2h0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VsZWN0ZWRIaWdobGlnaHQsIFwiLS10ZXh0LWFjY2VudFwiKSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VsZWN0ZWRIaWdobGlnaHQgPSB2YWx1ZTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmFwcGx5SGlnaGxpZ2h0VmFyaWFibGVzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIk5vdGUgZGF0ZSBmaWVsZHNcIilcclxuICAgICAgLnNldERlc2MoXCJDb21tYS1zZXBhcmF0ZWQgZnJvbnRtYXR0ZXIgZmllbGRzIHVzZWQgdG8gbGluayBub3RlcyB0byBkYXRlcy5cIilcclxuICAgICAgLmFkZFRleHQoKHRleHQpID0+XHJcbiAgICAgICAgdGV4dFxyXG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiZGF0ZSwgc3RhcnQsIGVuZFwiKVxyXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVEYXRlRmllbGRzLmpvaW4oXCIsIFwiKSlcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZURhdGVGaWVsZHMgPSB2YWx1ZVxyXG4gICAgICAgICAgICAgIC5zcGxpdChcIixcIilcclxuICAgICAgICAgICAgICAubWFwKChmaWVsZCkgPT4gZmllbGQudHJpbSgpKVxyXG4gICAgICAgICAgICAgIC5maWx0ZXIoKGZpZWxkKSA9PiBmaWVsZC5sZW5ndGggPiAwKTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnJlbmRlclZpZXdzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIkFsbG93IGNyZWF0ZSBub3RlXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiU2hvdyBhIHF1aWNrIGFjdGlvbiB0byBjcmVhdGUgYSBub3RlIGZvciB0aGUgc2VsZWN0ZWQgZGF0ZS5cIilcclxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxyXG4gICAgICAgIHRvZ2dsZS5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hbGxvd0NyZWF0ZU5vdGUpLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuYWxsb3dDcmVhdGVOb3RlID0gdmFsdWU7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgIHRoaXMucGx1Z2luLnJlbmRlclZpZXdzKCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoXCJOb3RlIGRlbnNpdHkgYmFyIGNvbG9yXCIpXHJcbiAgICAgIC5zZXREZXNjKFwiQ29sb3IgZm9yIHRoZSBub3RlIGRlbnNpdHkgaW5kaWNhdG9yIGJhci5cIilcclxuICAgICAgLmFkZENvbG9yUGlja2VyKChwaWNrZXIpID0+XHJcbiAgICAgICAgcGlja2VyXHJcbiAgICAgICAgICAuc2V0VmFsdWUocmVzb2x2ZUhpZ2hsaWdodFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm5vdGVCYXJDb2xvciwgXCItLXRleHQtYWNjZW50XCIpKVxyXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5ub3RlQmFyQ29sb3IgPSB2YWx1ZTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmFwcGx5SGlnaGxpZ2h0VmFyaWFibGVzKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG5cclxuICAgIGNvbnN0IHRlbXBsYXRlU2V0dGluZyA9IG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIk5vdGUgdGVtcGxhdGVcIilcclxuICAgICAgLnNldERlc2MoXCJDaG9vc2UgYSB2YXVsdCB0ZW1wbGF0ZSBmaWxlLlwiKTtcclxuXHJcbiAgICBjb25zdCB0ZW1wbGF0ZUhpbnQgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwib2JzaWRpYW4tY2FsZW5kYXJfX3NldHRpbmctaGludFwiIH0pO1xyXG5cclxuICAgIGNvbnN0IHVwZGF0ZVRlbXBsYXRlSGludCA9ICh3YXJuaW5nID0gXCJcIikgPT4ge1xyXG4gICAgICBpZiAod2FybmluZykge1xyXG4gICAgICAgIHRlbXBsYXRlSGludC5zZXRUZXh0KHdhcm5pbmcpO1xyXG4gICAgICAgIHRlbXBsYXRlSGludC5hZGRDbGFzcyhcImlzLWVycm9yXCIpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCBwYXRoID0gdGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZVRlbXBsYXRlUGF0aC50cmltKCk7XHJcbiAgICAgIGlmICghcGF0aCkge1xyXG4gICAgICAgIHRlbXBsYXRlSGludC5zZXRUZXh0KFwiTm8gdGVtcGxhdGUgc2VsZWN0ZWQuXCIpO1xyXG4gICAgICAgIHRlbXBsYXRlSGludC5yZW1vdmVDbGFzcyhcImlzLWVycm9yXCIpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCBmaWxlID0gdGhpcy5wbHVnaW4uZ2V0VGVtcGxhdGVGaWxlKHBhdGgpO1xyXG4gICAgICBpZiAoZmlsZSkge1xyXG4gICAgICAgIHRlbXBsYXRlSGludC5zZXRUZXh0KGBUZW1wbGF0ZTogJHtmaWxlLnBhdGh9YCk7XHJcbiAgICAgICAgdGVtcGxhdGVIaW50LnJlbW92ZUNsYXNzKFwiaXMtZXJyb3JcIik7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIHRlbXBsYXRlSGludC5zZXRUZXh0KFwiVGVtcGxhdGUgbm90IGZvdW5kIGluIHRoaXMgdmF1bHQuXCIpO1xyXG4gICAgICB0ZW1wbGF0ZUhpbnQuYWRkQ2xhc3MoXCJpcy1lcnJvclwiKTtcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgY3VycmVudFBhdGggPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5ub3RlVGVtcGxhdGVQYXRoO1xyXG4gICAgY29uc3QgY3VycmVudEZvbGRlciA9IGN1cnJlbnRQYXRoID8gY3VycmVudFBhdGguc3BsaXQoXCIvXCIpLnNsaWNlKDAsIC0xKS5qb2luKFwiL1wiKSA6IFwiXCI7XHJcbiAgICBpZiAoIXRoaXMuc2VsZWN0ZWRUZW1wbGF0ZUZvbGRlcikge1xyXG4gICAgICB0aGlzLnNlbGVjdGVkVGVtcGxhdGVGb2xkZXIgPSBjdXJyZW50Rm9sZGVyO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZvbGRlck9wdGlvbnMgPSB0aGlzLnBsdWdpbi5nZXRUZW1wbGF0ZUZvbGRlck9wdGlvbnMoKTtcclxuICAgIHRlbXBsYXRlU2V0dGluZy5hZGREcm9wZG93bigoZHJvcGRvd24pID0+IHtcclxuICAgICAgZHJvcGRvd24uYWRkT3B0aW9uKFwiXCIsIFwiQWxsIGZvbGRlcnNcIik7XHJcbiAgICAgIGZvciAoY29uc3QgZm9sZGVyIG9mIGZvbGRlck9wdGlvbnMpIHtcclxuICAgICAgICBkcm9wZG93bi5hZGRPcHRpb24oZm9sZGVyLCBmb2xkZXIgfHwgXCIocm9vdClcIik7XHJcbiAgICAgIH1cclxuICAgICAgZHJvcGRvd24uc2V0VmFsdWUodGhpcy5zZWxlY3RlZFRlbXBsYXRlRm9sZGVyKTtcclxuICAgICAgZHJvcGRvd24ub25DaGFuZ2UoKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgdGhpcy5zZWxlY3RlZFRlbXBsYXRlRm9sZGVyID0gdmFsdWU7XHJcbiAgICAgICAgdGhpcy5kaXNwbGF5KCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgdGVtcGxhdGVPcHRpb25zID0gdGhpcy5wbHVnaW4uZ2V0VGVtcGxhdGVPcHRpb25zKHRoaXMuc2VsZWN0ZWRUZW1wbGF0ZUZvbGRlcik7XHJcbiAgICB0ZW1wbGF0ZVNldHRpbmcuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XHJcbiAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihcIlwiLCBcIk5vbmVcIik7XHJcbiAgICAgIGZvciAoY29uc3Qgb3B0aW9uIG9mIHRlbXBsYXRlT3B0aW9ucykge1xyXG4gICAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihvcHRpb24ucGF0aCwgb3B0aW9uLmxhYmVsKTtcclxuICAgICAgfVxyXG4gICAgICBkcm9wZG93bi5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5ub3RlVGVtcGxhdGVQYXRoKTtcclxuICAgICAgZHJvcGRvd24ub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZVRlbXBsYXRlUGF0aCA9IHZhbHVlO1xyXG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIHVwZGF0ZVRlbXBsYXRlSGludCgpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHVwZGF0ZVRlbXBsYXRlSGludCgpO1xyXG5cclxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBcIkNhbGVuZGFyIHNvdXJjZXNcIiB9KTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zb3VyY2VzKSB7XHJcbiAgICAgIGNvbnN0IHNvdXJjZVNldHRpbmcgPSBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShzb3VyY2UubmFtZSB8fCBcIlVubmFtZWRcIilcclxuICAgICAgICAuc2V0RGVzYyhcIkVuYWJsZWQgc291cmNlcyBhcmUgZmV0Y2hlZCBhbmQgbWVyZ2VkLlwiKTtcclxuXHJcbiAgICAgIHNvdXJjZVNldHRpbmcuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XHJcbiAgICAgICAgdG9nZ2xlXHJcbiAgICAgICAgICAuc2V0VmFsdWUoc291cmNlLmVuYWJsZWQpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgIHNvdXJjZS5lbmFibGVkID0gdmFsdWU7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5yZWZyZXNoRXZlbnRzKHRydWUpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICAgIHNvdXJjZVNldHRpbmcuYWRkQnV0dG9uKChidXR0b24pID0+XHJcbiAgICAgICAgYnV0dG9uXHJcbiAgICAgICAgICAuc2V0QnV0dG9uVGV4dChcIlJlbW92ZVwiKVxyXG4gICAgICAgICAgLnNldEN0YSgpXHJcbiAgICAgICAgICAub25DbGljayhhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnNvdXJjZXMgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zb3VyY2VzLmZpbHRlcigoaXRlbSkgPT4gaXRlbS5pZCAhPT0gc291cmNlLmlkKTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnJlZnJlc2hFdmVudHModHJ1ZSk7XHJcbiAgICAgICAgICAgIHRoaXMuZGlzcGxheSgpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgIC5zZXROYW1lKFwiTmFtZVwiKVxyXG4gICAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxyXG4gICAgICAgICAgdGV4dFxyXG4gICAgICAgICAgICAuc2V0VmFsdWUoc291cmNlLm5hbWUpXHJcbiAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICBzb3VyY2UubmFtZSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgIHNvdXJjZVNldHRpbmcuc2V0TmFtZShzb3VyY2UubmFtZS50cmltKCkgfHwgXCJVbm5hbWVkXCIpO1xyXG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZShcImlDYWwgVVJMXCIpXHJcbiAgICAgICAgLmFkZFRleHQoKHRleHQpID0+XHJcbiAgICAgICAgICB0ZXh0XHJcbiAgICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcImh0dHBzOi8vY2FsZW5kYXIuZ29vZ2xlLmNvbS9jYWxlbmRhci9pY2FsLy4uLlwiKVxyXG4gICAgICAgICAgICAuc2V0VmFsdWUoc291cmNlLnVybClcclxuICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgIHNvdXJjZS51cmwgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4ucmVmcmVzaEV2ZW50cyh0cnVlKTtcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZShcIkFkZCBjYWxlbmRhciBzb3VyY2VcIilcclxuICAgICAgLnNldERlc2MoXCJBZGQgYW5vdGhlciBpQ2FsIChJQ1MpIHNvdXJjZS5cIilcclxuICAgICAgLmFkZEJ1dHRvbigoYnV0dG9uKSA9PlxyXG4gICAgICAgIGJ1dHRvblxyXG4gICAgICAgICAgLnNldEJ1dHRvblRleHQoXCJBZGRcIilcclxuICAgICAgICAgIC5vbkNsaWNrKGFzeW5jICgpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc291cmNlcy5wdXNoKHtcclxuICAgICAgICAgICAgICBpZDogY3JlYXRlU291cmNlSWQoKSxcclxuICAgICAgICAgICAgICBuYW1lOiBcIlwiLFxyXG4gICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgdXJsOiBcIlwiXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgdGhpcy5kaXNwbGF5KCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ2FsZW5kYXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xyXG4gIHNldHRpbmdzOiBDYWxlbmRhclNldHRpbmdzID0gREVGQVVMVF9TRVRUSU5HUztcclxuICBwcml2YXRlIHNlcnZpY2UgPSBuZXcgSWNhbFNlcnZpY2UocGFyc2VJY2FsKTtcclxuICBwcml2YXRlIGV2ZW50czogQ2FsZW5kYXJFdmVudFtdID0gW107XHJcbiAgcHJpdmF0ZSByZWZyZXNoSGFuZGxlPzogbnVtYmVyO1xyXG5cclxuICBhc3luYyBvbmxvYWQoKSB7XHJcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBDYWxlbmRhclNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcclxuXHJcbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhWSUVXX1RZUEVfQ0FMRU5EQVIsIChsZWFmKSA9PiBuZXcgQ2FsZW5kYXJWaWV3KGxlYWYsIHRoaXMpKTtcclxuICAgIHRoaXMucmVnaXN0ZXJDb21tYW5kcygpO1xyXG4gICAgdGhpcy5yZWdpc3RlclN0eWxlcygpO1xyXG4gICAgdGhpcy5hcHBseUhpZ2hsaWdodFZhcmlhYmxlcygpO1xyXG5cclxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcclxuICAgICAgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMucmVmcmVzaEV2ZW50cygpO1xyXG4gICAgdGhpcy5zdGFydEF1dG9SZWZyZXNoKCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBvbnVubG9hZCgpIHtcclxuICAgIGlmICh0aGlzLnJlZnJlc2hIYW5kbGUpIHtcclxuICAgICAgd2luZG93LmNsZWFySW50ZXJ2YWwodGhpcy5yZWZyZXNoSGFuZGxlKTtcclxuICAgIH1cclxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoVklFV19UWVBFX0NBTEVOREFSKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGFjdGl2YXRlVmlldygpIHtcclxuICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKSA/PyB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZihmYWxzZSk7XHJcbiAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7IHR5cGU6IFZJRVdfVFlQRV9DQUxFTkRBUiwgYWN0aXZlOiB0cnVlIH0pO1xyXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYobGVhZik7XHJcbiAgICB0aGlzLmFwcGx5SGlnaGxpZ2h0VmFyaWFibGVzKCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyByZWZyZXNoRXZlbnRzKGZvcmNlUmVmcmVzaCA9IGZhbHNlKSB7XHJcbiAgICB0aGlzLmV2ZW50cyA9IGF3YWl0IHRoaXMuc2VydmljZS5nZXRFdmVudHMoXHJcbiAgICAgIHRoaXMuc2V0dGluZ3Muc291cmNlcyxcclxuICAgICAgdGhpcy5zZXR0aW5ncy5yZWZyZXNoSW50ZXJ2YWxNaW51dGVzLFxyXG4gICAgICBmb3JjZVJlZnJlc2hcclxuICAgICk7XHJcbiAgICB0aGlzLnJlbmRlclZpZXdzKCk7XHJcbiAgfVxyXG5cclxuICByZW5kZXJWaWV3cygpIHtcclxuICAgIGNvbnN0IGxlYXZlcyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFX0NBTEVOREFSKTtcclxuICAgIGZvciAoY29uc3QgbGVhZiBvZiBsZWF2ZXMpIHtcclxuICAgICAgY29uc3QgdmlldyA9IGxlYWYudmlldztcclxuICAgICAgaWYgKHZpZXcgaW5zdGFuY2VvZiBDYWxlbmRhclZpZXcpIHtcclxuICAgICAgICB2aWV3LnNldEV2ZW50cyh0aGlzLmV2ZW50cyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJlc3RhcnRBdXRvUmVmcmVzaCgpIHtcclxuICAgIGlmICh0aGlzLnJlZnJlc2hIYW5kbGUpIHtcclxuICAgICAgd2luZG93LmNsZWFySW50ZXJ2YWwodGhpcy5yZWZyZXNoSGFuZGxlKTtcclxuICAgIH1cclxuICAgIHRoaXMuc3RhcnRBdXRvUmVmcmVzaCgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdGFydEF1dG9SZWZyZXNoKCkge1xyXG4gICAgY29uc3QgaW50ZXJ2YWxNcyA9IE1hdGgubWF4KHRoaXMuc2V0dGluZ3MucmVmcmVzaEludGVydmFsTWludXRlcywgMSkgKiA2MCAqIDEwMDA7XHJcbiAgICB0aGlzLnJlZnJlc2hIYW5kbGUgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xyXG4gICAgICB0aGlzLnJlZnJlc2hFdmVudHMoKTtcclxuICAgIH0sIGludGVydmFsTXMpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWdpc3RlckNvbW1hbmRzKCkge1xyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwiY2FsZW5kYXItb3BlblwiLFxyXG4gICAgICBuYW1lOiBcIk9wZW4gY2FsZW5kYXJcIixcclxuICAgICAgY2FsbGJhY2s6ICgpID0+IHRoaXMuYWN0aXZhdGVWaWV3KClcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImNhbGVuZGFyLXRvZGF5XCIsXHJcbiAgICAgIG5hbWU6IFwiSnVtcCB0byB0b2RheVwiLFxyXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGxlYXZlcyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFX0NBTEVOREFSKTtcclxuICAgICAgICBmb3IgKGNvbnN0IGxlYWYgb2YgbGVhdmVzKSB7XHJcbiAgICAgICAgICBjb25zdCB2aWV3ID0gbGVhZi52aWV3O1xyXG4gICAgICAgICAgaWYgKHZpZXcgaW5zdGFuY2VvZiBDYWxlbmRhclZpZXcpIHtcclxuICAgICAgICAgICAgdmlldy5qdW1wVG9Ub2RheSgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgaWQ6IFwiY2FsZW5kYXItcmVmcmVzaFwiLFxyXG4gICAgICBuYW1lOiBcIlJlZnJlc2ggY2FsZW5kYXJcIixcclxuICAgICAgY2FsbGJhY2s6ICgpID0+IHRoaXMucmVmcmVzaEV2ZW50cyh0cnVlKVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlZ2lzdGVyU3R5bGVzKCkge1xyXG4gICAgY29uc3Qgc3R5bGVFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcclxuICAgIHN0eWxlRWwudGV4dENvbnRlbnQgPSBgXHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhciB7XHJcbiAgICAgICAgaGVpZ2h0OiAxMDAlO1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1ub3JtYWwpO1xyXG4gICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJhY2tncm91bmQtcHJpbWFyeSk7XHJcbiAgICAgICAgLS1jYWxlbmRhci10b2RheS1hY2NlbnQ6IHZhcigtLWludGVyYWN0aXZlLWFjY2VudCk7XHJcbiAgICAgICAgLS1jYWxlbmRhci1zZWxlY3RlZC1hY2NlbnQ6IHZhcigtLWludGVyYWN0aXZlLWFjY2VudCk7XHJcbiAgICAgICAgLS1jYWxlbmRhci1ub3RlLWJhci1jb2xvcjogIzVlYjhkNTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2hlYWRlciB7XHJcbiAgICAgICAgcGFkZGluZzogMTZweCAyMHB4O1xyXG4gICAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlcik7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGdhcDogMTBweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25hdiB7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBnYXA6IDhweDtcclxuICAgICAgICBmbGV4LXdyYXA6IHdyYXA7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19uYXYgYnV0dG9uIHtcclxuICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlcik7XHJcbiAgICAgICAgcGFkZGluZzogNXB4IDEycHg7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW5vcm1hbCk7XHJcbiAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25hdiBidXR0b246aG92ZXIge1xyXG4gICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItaG92ZXIpO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fdGl0bGUge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTdweDtcclxuICAgICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICAgIGxldHRlci1zcGFjaW5nOiAtMC4wMWVtO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fYm9keSB7XHJcbiAgICAgICAgcGFkZGluZzogMjBweCAyNHB4IDI0cHg7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGdhcDogMjRweDtcclxuICAgICAgICBvdmVyZmxvdzogYXV0bztcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2dyaWQge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgICBnYXA6IDEycHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX193ZWVrZGF5cyB7XHJcbiAgICAgICAgZGlzcGxheTogZ3JpZDtcclxuICAgICAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IHJlcGVhdCg3LCBtaW5tYXgoMCwgMWZyKSk7XHJcbiAgICAgICAgZ2FwOiA0cHg7XHJcbiAgICAgICAgZm9udC1zaXplOiAxMHB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxuICAgICAgICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlO1xyXG4gICAgICAgIGxldHRlci1zcGFjaW5nOiAwLjA1ZW07XHJcbiAgICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcclxuICAgICAgICBvcGFjaXR5OiAwLjg7XHJcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMnB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fd2Vla2RheSB7XHJcbiAgICAgICAgcGFkZGluZzogNHB4O1xyXG4gICAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RheXMge1xyXG4gICAgICAgIGRpc3BsYXk6IGdyaWQ7XHJcbiAgICAgICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiByZXBlYXQoNywgbWlubWF4KDAsIDFmcikpO1xyXG4gICAgICAgIGdhcDogOHB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5IHtcclxuICAgICAgICBib3JkZXI6IG5vbmU7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xyXG4gICAgICAgIHBhZGRpbmc6IDEycHggNHB4IDhweDtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XHJcbiAgICAgICAgZ2FwOiAzcHg7XHJcbiAgICAgICAgbWluLWhlaWdodDogNzJweDtcclxuICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgICAgcG9zaXRpb246IHJlbGF0aXZlO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LmlzLW91dHNpZGUge1xyXG4gICAgICAgIG9wYWNpdHk6IDAuNDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RheS5pcy13ZWVrZW5kIHtcclxuICAgICAgICBvcGFjaXR5OiAwLjY1O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LmlzLXRvZGF5IC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LW51bWJlcjo6YWZ0ZXIge1xyXG4gICAgICAgIGNvbnRlbnQ6ICcnO1xyXG4gICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgICBib3R0b206IC0ycHg7XHJcbiAgICAgICAgbGVmdDogNTAlO1xyXG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcclxuICAgICAgICB3aWR0aDogMjJweDtcclxuICAgICAgICBoZWlnaHQ6IDNweDtcclxuICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1jYWxlbmRhci10b2RheS1hY2NlbnQpO1xyXG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDJweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RheS5pcy1zZWxlY3RlZCAub2JzaWRpYW4tY2FsZW5kYXJfX2RheS1udW1iZXI6OmFmdGVyIHtcclxuICAgICAgICBjb250ZW50OiAnJztcclxuICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XHJcbiAgICAgICAgYm90dG9tOiAtMnB4O1xyXG4gICAgICAgIGxlZnQ6IDUwJTtcclxuICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XHJcbiAgICAgICAgd2lkdGg6IDIycHg7XHJcbiAgICAgICAgaGVpZ2h0OiAzcHg7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tY2FsZW5kYXItc2VsZWN0ZWQtYWNjZW50KTtcclxuICAgICAgICBib3JkZXItcmFkaXVzOiAycHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXkuaXMtdG9kYXkuaXMtc2VsZWN0ZWQgLm9ic2lkaWFuLWNhbGVuZGFyX19kYXktbnVtYmVyOjphZnRlciB7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tY2FsZW5kYXItdG9kYXktYWNjZW50KTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RheS1udW1iZXIge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTdweDtcclxuICAgICAgICBmb250LXdlaWdodDogNTAwO1xyXG4gICAgICAgIGxpbmUtaGVpZ2h0OiAxO1xyXG4gICAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcclxuICAgICAgICBwYWRkaW5nLWJvdHRvbTogNHB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LXN1YnRpdGxlIHtcclxuICAgICAgICBmb250LXNpemU6IDEwcHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG4gICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcclxuICAgICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XHJcbiAgICAgICAgbWluLWhlaWdodDogMTJweDtcclxuICAgICAgICBmb250LXdlaWdodDogNDAwO1xyXG4gICAgICAgIG9wYWNpdHk6IDAuODtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RheS1pbmRpY2F0b3Ige1xyXG4gICAgICAgIG1pbi1oZWlnaHQ6IDZweDtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XHJcbiAgICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgICAgbWFyZ2luLXRvcDogMnB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGF5LWJhciB7XHJcbiAgICAgICAgaGVpZ2h0OiAycHg7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogMXB4O1xyXG4gICAgICAgIGJhY2tncm91bmQ6IHZhcigtLWNhbGVuZGFyLW5vdGUtYmFyLWNvbG9yKTtcclxuICAgICAgICBvcGFjaXR5OiAwLjU7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXByZXZpZXcge1xyXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcclxuICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iYWNrZ3JvdW5kLXByaW1hcnkpO1xyXG4gICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItYm9yZGVyKTtcclxuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XHJcbiAgICAgICAgcGFkZGluZzogMTBweCAxMnB4O1xyXG4gICAgICAgIGJveC1zaGFkb3c6IDAgNHB4IDEycHggcmdiYSgwLCAwLCAwLCAwLjA4KTtcclxuICAgICAgICBkaXNwbGF5OiBub25lO1xyXG4gICAgICAgIHotaW5kZXg6IDk5OTk7XHJcbiAgICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXByZXZpZXctcm93IHtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgICAgZ2FwOiAzcHg7XHJcbiAgICAgICAgcGFkZGluZzogNXB4IDA7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ub3RlLXByZXZpZXctdGl0bGUge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgICBmb250LXdlaWdodDogNTAwO1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW5vcm1hbCk7XHJcbiAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1wcmV2aWV3LWV4Y2VycHQge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7XHJcbiAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xyXG4gICAgICAgIG9wYWNpdHk6IDAuOTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RldGFpbHMtdGl0bGUge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTVweDtcclxuICAgICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgICAgIGxldHRlci1zcGFjaW5nOiAtMC4wMWVtO1xyXG4gICAgICAgIG1hcmdpbi1ib3R0b206IDRweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RldGFpbHMge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgICBnYXA6IDE2cHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19zZWN0aW9uIHtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICAgICAgZ2FwOiA4cHg7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ub3Rlcy1saXN0LFxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2V2ZW50LWxpc3Qge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgICAgICBnYXA6IDRweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX3NlY3Rpb24tdGl0bGUge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTFweDtcclxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7XHJcbiAgICAgICAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTtcclxuICAgICAgICBsZXR0ZXItc3BhY2luZzogMC4wNmVtO1xyXG4gICAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XHJcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMnB4O1xyXG4gICAgICAgIG9wYWNpdHk6IDAuODtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtcm93IHtcclxuICAgICAgICBib3JkZXI6IG5vbmU7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7XHJcbiAgICAgICAgdGV4dC1hbGlnbjogbGVmdDtcclxuICAgICAgICBwYWRkaW5nOiAxMHB4IDhweDtcclxuICAgICAgICBkaXNwbGF5OiBibG9jaztcclxuICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcclxuICAgICAgICBtaW4taGVpZ2h0OiA1MnB4O1xyXG4gICAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1yb3c6aG92ZXIge1xyXG4gICAgICAgIG9wYWNpdHk6IDAuODtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX25vdGUtdGl0bGUge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1ub3JtYWwpO1xyXG4gICAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XHJcbiAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xyXG4gICAgICAgIGxpbmUtaGVpZ2h0OiAxLjM7XHJcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMnB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fbm90ZS1leGNlcnB0IHtcclxuICAgICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG4gICAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XHJcbiAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICAgICAgICB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcclxuICAgICAgICBsaW5lLWhlaWdodDogMS4zO1xyXG4gICAgICAgIG9wYWNpdHk6IDAuODU7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19ldmVudC1yb3cge1xyXG4gICAgICAgIGRpc3BsYXk6IGdyaWQ7XHJcbiAgICAgICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiA2OHB4IDFmcjtcclxuICAgICAgICBnYXA6IDE0cHg7XHJcbiAgICAgICAgcGFkZGluZzogNnB4IDA7XHJcbiAgICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2V2ZW50LXRpbWUge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7XHJcbiAgICAgICAgZm9udC13ZWlnaHQ6IDQwMDtcclxuICAgICAgICBvcGFjaXR5OiAwLjg1O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZXZlbnQtc3VtbWFyeSB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICAgIGZvbnQtd2VpZ2h0OiA0MDA7XHJcbiAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gICAgICAgIHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzO1xyXG4gICAgICAgIGxpbmUtaGVpZ2h0OiAxLjM7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzLWFjdGlvbiB7XHJcbiAgICAgICAgbWFyZ2luLXRvcDogNHB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlscy1hY3Rpb24gYnV0dG9uIHtcclxuICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlcik7XHJcbiAgICAgICAgcGFkZGluZzogNnB4IDE0cHg7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW5vcm1hbCk7XHJcbiAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTNweDtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RldGFpbHMtYWN0aW9uIGJ1dHRvbjpob3ZlciB7XHJcbiAgICAgICAgYmFja2dyb3VuZDogdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ob3Zlcik7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19zZXR0aW5nLWhpbnQge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7XHJcbiAgICAgICAgbWFyZ2luOiA0cHggMCAxMnB4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fc2V0dGluZy1oaW50LmlzLWVycm9yIHtcclxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1hY2NlbnQpO1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlscy1yb3cge1xyXG4gICAgICAgIGRpc3BsYXk6IGdyaWQ7XHJcbiAgICAgICAgZ3JpZC10ZW1wbGF0ZS1jb2x1bW5zOiA2OHB4IDFmcjtcclxuICAgICAgICBnYXA6IDE0cHg7XHJcbiAgICAgICAgcGFkZGluZzogNnB4IDA7XHJcbiAgICAgIH1cclxuICAgICAgLm9ic2lkaWFuLWNhbGVuZGFyX19kZXRhaWxzLXRpbWUge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMTJweDtcclxuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7XHJcbiAgICAgICAgb3BhY2l0eTogMC44NTtcclxuICAgICAgfVxyXG4gICAgICAub2JzaWRpYW4tY2FsZW5kYXJfX2RldGFpbHMtc3VtbWFyeSB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxM3B4O1xyXG4gICAgICB9XHJcbiAgICAgIC5vYnNpZGlhbi1jYWxlbmRhcl9fZGV0YWlscy1lbXB0eSB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxuICAgICAgICBvcGFjaXR5OiAwLjc1O1xyXG4gICAgICB9XHJcbiAgICBgO1xyXG4gICAgc3R5bGVFbC5kYXRhc2V0LmNhbGVuZGFyVmlldyA9IFwidHJ1ZVwiO1xyXG4gICAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzdHlsZUVsKTtcclxuICAgIHRoaXMucmVnaXN0ZXIoKCkgPT4gc3R5bGVFbC5yZW1vdmUoKSk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5sb2FkRGF0YSgpO1xyXG4gICAgdGhpcy5zZXR0aW5ncyA9IHRoaXMubm9ybWFsaXplU2V0dGluZ3MoZGF0YSk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBzYXZlU2V0dGluZ3MoKSB7XHJcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xyXG4gICAgdGhpcy5hcHBseUhpZ2hsaWdodFZhcmlhYmxlcygpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgY3JlYXRlTm90ZUZvckRhdGUoZGF0ZTogRGF0ZSkge1xyXG4gICAgY29uc3QgZmllbGQgPSB0aGlzLnNldHRpbmdzLm5vdGVEYXRlRmllbGRzWzBdIHx8IFwiZGF0ZVwiO1xyXG4gICAgY29uc3QgdGl0bGUgPSBmb3JtYXREYXRlS2V5KGRhdGUpO1xyXG4gICAgY29uc3QgYmFzZVBhdGggPSBub3JtYWxpemVQYXRoKGAke3RpdGxlfS5tZGApO1xyXG4gICAgY29uc3QgZmlsZVBhdGggPSBhd2FpdCB0aGlzLmdldEF2YWlsYWJsZVBhdGgoYmFzZVBhdGgpO1xyXG4gICAgY29uc3QgdGVtcGxhdGVDb250ZW50ID0gYXdhaXQgdGhpcy5sb2FkVGVtcGxhdGVDb250ZW50KCk7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdGhpcy5idWlsZE5vdGVDb250ZW50KGZpZWxkLCB0aXRsZSwgdGVtcGxhdGVDb250ZW50KTtcclxuICAgIHRyeSB7XHJcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUoZmlsZVBhdGgsIGNvbnRlbnQpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihcIkZhaWxlZCB0byBjcmVhdGUgbm90ZVwiLCBlcnJvcik7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZ2V0VGVtcGxhdGVGaWxlKHBhdGg6IHN0cmluZykge1xyXG4gICAgY29uc3QgdHJpbW1lZCA9IHBhdGgudHJpbSgpO1xyXG4gICAgaWYgKCF0cmltbWVkKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG5vcm1hbGl6ZWRJbnB1dCA9IHRoaXMubm9ybWFsaXplVGVtcGxhdGVQYXRoKHRyaW1tZWQpLnBhdGg7XHJcbiAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplUGF0aChub3JtYWxpemVQYXRoU2xhc2hlcyhub3JtYWxpemVkSW5wdXQpLnJlcGxhY2UoL15cXC8vLCBcIlwiKSk7XHJcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKG5vcm1hbGl6ZWQpO1xyXG4gICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xyXG4gICAgICByZXR1cm4gZmlsZTtcclxuICAgIH1cclxuICAgIGlmICghbm9ybWFsaXplZC50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKFwiLm1kXCIpKSB7XHJcbiAgICAgIGNvbnN0IHdpdGhFeHRlbnNpb24gPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoYCR7bm9ybWFsaXplZH0ubWRgKTtcclxuICAgICAgaWYgKHdpdGhFeHRlbnNpb24gaW5zdGFuY2VvZiBURmlsZSkge1xyXG4gICAgICAgIHJldHVybiB3aXRoRXh0ZW5zaW9uO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgbG9hZFRlbXBsYXRlQ29udGVudCgpIHtcclxuICAgIGNvbnN0IHBhdGggPSB0aGlzLnNldHRpbmdzLm5vdGVUZW1wbGF0ZVBhdGgudHJpbSgpO1xyXG4gICAgaWYgKCFwYXRoKSB7XHJcbiAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgfVxyXG4gICAgY29uc3QgZmlsZSA9IHRoaXMuZ2V0VGVtcGxhdGVGaWxlKHBhdGgpO1xyXG4gICAgaWYgKCFmaWxlKSB7XHJcbiAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgfVxyXG4gICAgdHJ5IHtcclxuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoZmlsZSk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKFwiRmFpbGVkIHRvIHJlYWQgdGVtcGxhdGVcIiwgZXJyb3IpO1xyXG4gICAgICByZXR1cm4gXCJcIjtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGROb3RlQ29udGVudChmaWVsZDogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCB0ZW1wbGF0ZTogc3RyaW5nKSB7XHJcbiAgICBpZiAoIXRlbXBsYXRlLnRyaW0oKSkge1xyXG4gICAgICByZXR1cm4gYC0tLVxcbiR7ZmllbGR9OiAke3ZhbHVlfVxcbi0tLVxcblxcbmA7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgbGluZXMgPSB0ZW1wbGF0ZS5zcGxpdChcIlxcblwiKTtcclxuICAgIGlmIChsaW5lc1swXT8udHJpbSgpID09PSBcIi0tLVwiKSB7XHJcbiAgICAgIGNvbnN0IGVuZEluZGV4ID0gbGluZXMuc2xpY2UoMSkuZmluZEluZGV4KChsaW5lKSA9PiBsaW5lLnRyaW0oKSA9PT0gXCItLS1cIik7XHJcbiAgICAgIGlmIChlbmRJbmRleCA+PSAwKSB7XHJcbiAgICAgICAgY29uc3QgZnJvbnRtYXR0ZXJFbmQgPSBlbmRJbmRleCArIDE7XHJcbiAgICAgICAgY29uc3QgaGFzRmllbGQgPSBsaW5lcy5zbGljZSgxLCBmcm9udG1hdHRlckVuZCkuc29tZSgobGluZSkgPT4gbGluZS50cmltKCkuc3RhcnRzV2l0aChgJHtmaWVsZH06YCkpO1xyXG4gICAgICAgIGlmICghaGFzRmllbGQpIHtcclxuICAgICAgICAgIGxpbmVzLnNwbGljZShmcm9udG1hdHRlckVuZCwgMCwgYCR7ZmllbGR9OiAke3ZhbHVlfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBgLS0tXFxuJHtmaWVsZH06ICR7dmFsdWV9XFxuLS0tXFxuXFxuJHt0ZW1wbGF0ZX1gO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBnZXRBdmFpbGFibGVQYXRoKHBhdGg6IHN0cmluZykge1xyXG4gICAgaWYgKCF0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCkpIHtcclxuICAgICAgcmV0dXJuIHBhdGg7XHJcbiAgICB9XHJcbiAgICBjb25zdCBiYXNlID0gcGF0aC5yZXBsYWNlKC9cXC5tZCQvaSwgXCJcIik7XHJcbiAgICBsZXQgaW5kZXggPSAxO1xyXG4gICAgbGV0IGNhbmRpZGF0ZSA9IGAke2Jhc2V9LSR7aW5kZXh9Lm1kYDtcclxuICAgIHdoaWxlICh0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY2FuZGlkYXRlKSkge1xyXG4gICAgICBpbmRleCArPSAxO1xyXG4gICAgICBjYW5kaWRhdGUgPSBgJHtiYXNlfS0ke2luZGV4fS5tZGA7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gY2FuZGlkYXRlO1xyXG4gIH1cclxuXHJcbiAgYXBwbHlIaWdobGlnaHRWYXJpYWJsZXMoKSB7XHJcbiAgICBjb25zdCBsZWF2ZXMgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9DQUxFTkRBUik7XHJcbiAgICBmb3IgKGNvbnN0IGxlYWYgb2YgbGVhdmVzKSB7XHJcbiAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGxlYWYudmlldy5jb250YWluZXJFbDtcclxuICAgICAgY29uc3QgdG9kYXlDb2xvciA9IHJlc29sdmVIaWdobGlnaHRWYWx1ZSh0aGlzLnNldHRpbmdzLnRvZGF5SGlnaGxpZ2h0LCBcIi0taW50ZXJhY3RpdmUtYWNjZW50XCIpO1xyXG4gICAgICBjb25zdCBzZWxlY3RlZENvbG9yID0gcmVzb2x2ZUhpZ2hsaWdodFZhbHVlKHRoaXMuc2V0dGluZ3Muc2VsZWN0ZWRIaWdobGlnaHQsIFwiLS10ZXh0LWFjY2VudFwiKTtcclxuICAgICAgY29uc3QgYmFyQ29sb3IgPSByZXNvbHZlSGlnaGxpZ2h0VmFsdWUodGhpcy5zZXR0aW5ncy5ub3RlQmFyQ29sb3IsIFwiLS10ZXh0LWFjY2VudFwiKTtcclxuICAgICAgY29udGFpbmVyLnN0eWxlLnNldFByb3BlcnR5KFxyXG4gICAgICAgIFwiLS1jYWxlbmRhci10b2RheS1hY2NlbnRcIixcclxuICAgICAgICB0b2RheUNvbG9yXHJcbiAgICAgICk7XHJcbiAgICAgIGNvbnRhaW5lci5zdHlsZS5zZXRQcm9wZXJ0eShcclxuICAgICAgICBcIi0tY2FsZW5kYXItc2VsZWN0ZWQtYWNjZW50XCIsXHJcbiAgICAgICAgc2VsZWN0ZWRDb2xvclxyXG4gICAgICApO1xyXG4gICAgICBjb250YWluZXIuc3R5bGUuc2V0UHJvcGVydHkoXHJcbiAgICAgICAgXCItLWNhbGVuZGFyLW5vdGUtYmFyLWNvbG9yXCIsXHJcbiAgICAgICAgYmFyQ29sb3JcclxuICAgICAgKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIG5vcm1hbGl6ZVRlbXBsYXRlUGF0aChyYXdQYXRoOiBzdHJpbmcpIHtcclxuICAgIGNvbnN0IHRyaW1tZWQgPSByYXdQYXRoLnRyaW0oKTtcclxuICAgIGlmICghdHJpbW1lZCkge1xyXG4gICAgICByZXR1cm4geyBwYXRoOiBcIlwiLCB3YXJuaW5nOiBcIlwiIH07XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVQYXRoU2xhc2hlcyh0cmltbWVkKS5yZXBsYWNlKC9eXFwvLywgXCJcIik7XHJcbiAgICBpZiAoL15bYS16QS1aXTpcXC8vLnRlc3Qobm9ybWFsaXplZCkgfHwgbm9ybWFsaXplZC5zdGFydHNXaXRoKFwiLy9cIikpIHtcclxuICAgICAgY29uc3QgdmF1bHRSb290ID0gbm9ybWFsaXplUGF0aFNsYXNoZXModGhpcy5hcHAudmF1bHQuYWRhcHRlci5nZXRGdWxsUGF0aChcIlwiKSk7XHJcbiAgICAgIGNvbnN0IHJvb3RXaXRoU2xhc2ggPSB2YXVsdFJvb3QuZW5kc1dpdGgoXCIvXCIpID8gdmF1bHRSb290IDogYCR7dmF1bHRSb290fS9gO1xyXG4gICAgICBpZiAobm9ybWFsaXplZC5zdGFydHNXaXRoKHJvb3RXaXRoU2xhc2gpKSB7XHJcbiAgICAgICAgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZWQuc2xpY2Uocm9vdFdpdGhTbGFzaC5sZW5ndGgpO1xyXG4gICAgICAgIHJldHVybiB7IHBhdGg6IG5vcm1hbGl6ZVBhdGgobm9ybWFsaXplZCksIHdhcm5pbmc6IFwiXCIgfTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4geyBwYXRoOiBcIlwiLCB3YXJuaW5nOiBcIlRlbXBsYXRlIHBhdGggbXVzdCBiZSBpbnNpZGUgdGhpcyB2YXVsdC5cIiB9O1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7IHBhdGg6IG5vcm1hbGl6ZVBhdGgobm9ybWFsaXplZCksIHdhcm5pbmc6IFwiXCIgfTtcclxuICB9XHJcblxyXG4gIGdldFRlbXBsYXRlRm9sZGVyT3B0aW9ucygpIHtcclxuICAgIGNvbnN0IGZvbGRlcnMgPSBuZXcgU2V0PHN0cmluZz4oKTtcclxuICAgIGZvciAoY29uc3QgZmlsZSBvZiB0aGlzLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCkpIHtcclxuICAgICAgY29uc3QgcGFyZW50ID0gZmlsZS5wYXJlbnQ/LnBhdGggPz8gXCJcIjtcclxuICAgICAgZm9sZGVycy5hZGQocGFyZW50KTtcclxuICAgIH1cclxuICAgIHJldHVybiBBcnJheS5mcm9tKGZvbGRlcnMpLnNvcnQoKGEsIGIpID0+IGEubG9jYWxlQ29tcGFyZShiKSk7XHJcbiAgfVxyXG5cclxuICBnZXRUZW1wbGF0ZU9wdGlvbnMoZm9sZGVyOiBzdHJpbmcpIHtcclxuICAgIHJldHVybiB0aGlzLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKClcclxuICAgICAgLmZpbHRlcigoZmlsZSkgPT4gKGZvbGRlciA/IGZpbGUucGFyZW50Py5wYXRoID09PSBmb2xkZXIgOiB0cnVlKSlcclxuICAgICAgLm1hcCgoZmlsZSkgPT4gKHtcclxuICAgICAgICBwYXRoOiBmaWxlLnBhdGgsXHJcbiAgICAgICAgbGFiZWw6IGZpbGUubmFtZVxyXG4gICAgICB9KSlcclxuICAgICAgLnNvcnQoKGEsIGIpID0+IGEubGFiZWwubG9jYWxlQ29tcGFyZShiLmxhYmVsKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG5vcm1hbGl6ZVNldHRpbmdzKGRhdGE6IHVua25vd24pOiBDYWxlbmRhclNldHRpbmdzIHtcclxuICAgIGlmICghZGF0YSB8fCB0eXBlb2YgZGF0YSAhPT0gXCJvYmplY3RcIikge1xyXG4gICAgICByZXR1cm4geyAuLi5ERUZBVUxUX1NFVFRJTkdTIH07XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcmVjb3JkID0gZGF0YSBhcyBQYXJ0aWFsPENhbGVuZGFyU2V0dGluZ3M+ICYgeyBpY2FsVXJsPzogc3RyaW5nIH07XHJcblxyXG4gICAgY29uc3Qgc291cmNlczogQ2FsZW5kYXJTb3VyY2VbXSA9IEFycmF5LmlzQXJyYXkocmVjb3JkLnNvdXJjZXMpXHJcbiAgICAgID8gcmVjb3JkLnNvdXJjZXMubWFwKChzb3VyY2UpID0+ICh7XHJcbiAgICAgICAgaWQ6IHNvdXJjZS5pZCB8fCBjcmVhdGVTb3VyY2VJZCgpLFxyXG4gICAgICAgIG5hbWU6IHNvdXJjZS5uYW1lID8/IFwiXCIsXHJcbiAgICAgICAgZW5hYmxlZDogc291cmNlLmVuYWJsZWQgPz8gdHJ1ZSxcclxuICAgICAgICB1cmw6IHNvdXJjZS51cmwgPz8gXCJcIlxyXG4gICAgICB9KSlcclxuICAgICAgOiBbXTtcclxuXHJcbiAgICBpZiAoc291cmNlcy5sZW5ndGggPT09IDAgJiYgdHlwZW9mIHJlY29yZC5pY2FsVXJsID09PSBcInN0cmluZ1wiICYmIHJlY29yZC5pY2FsVXJsLnRyaW0oKS5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHNvdXJjZXMucHVzaCh7XHJcbiAgICAgICAgaWQ6IGNyZWF0ZVNvdXJjZUlkKCksXHJcbiAgICAgICAgbmFtZTogXCJQcmltYXJ5XCIsXHJcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICB1cmw6IHJlY29yZC5pY2FsVXJsLnRyaW0oKVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBzb3VyY2VzLFxyXG4gICAgICB3ZWVrU3RhcnQ6IHJlY29yZC53ZWVrU3RhcnQgPz8gREVGQVVMVF9TRVRUSU5HUy53ZWVrU3RhcnQsXHJcbiAgICAgIHRpbWVGb3JtYXQ6IHJlY29yZC50aW1lRm9ybWF0ID8/IERFRkFVTFRfU0VUVElOR1MudGltZUZvcm1hdCxcclxuICAgICAgcmVmcmVzaEludGVydmFsTWludXRlczogcmVjb3JkLnJlZnJlc2hJbnRlcnZhbE1pbnV0ZXMgPz8gREVGQVVMVF9TRVRUSU5HUy5yZWZyZXNoSW50ZXJ2YWxNaW51dGVzLFxyXG4gICAgICB0b2RheUhpZ2hsaWdodDogcmVjb3JkLnRvZGF5SGlnaGxpZ2h0ID8/IERFRkFVTFRfU0VUVElOR1MudG9kYXlIaWdobGlnaHQsXHJcbiAgICAgIHNlbGVjdGVkSGlnaGxpZ2h0OiByZWNvcmQuc2VsZWN0ZWRIaWdobGlnaHQgPz8gREVGQVVMVF9TRVRUSU5HUy5zZWxlY3RlZEhpZ2hsaWdodCxcclxuICAgICAgbm90ZURhdGVGaWVsZHM6IEFycmF5LmlzQXJyYXkocmVjb3JkLm5vdGVEYXRlRmllbGRzKSAmJiByZWNvcmQubm90ZURhdGVGaWVsZHMubGVuZ3RoID4gMFxyXG4gICAgICAgID8gcmVjb3JkLm5vdGVEYXRlRmllbGRzXHJcbiAgICAgICAgOiBERUZBVUxUX1NFVFRJTkdTLm5vdGVEYXRlRmllbGRzLFxyXG4gICAgICBhbGxvd0NyZWF0ZU5vdGU6IHJlY29yZC5hbGxvd0NyZWF0ZU5vdGUgPz8gREVGQVVMVF9TRVRUSU5HUy5hbGxvd0NyZWF0ZU5vdGUsXHJcbiAgICAgIG5vdGVUZW1wbGF0ZVBhdGg6IHR5cGVvZiByZWNvcmQubm90ZVRlbXBsYXRlUGF0aCA9PT0gXCJzdHJpbmdcIlxyXG4gICAgICAgID8gcmVjb3JkLm5vdGVUZW1wbGF0ZVBhdGhcclxuICAgICAgICA6IERFRkFVTFRfU0VUVElOR1Mubm90ZVRlbXBsYXRlUGF0aCxcclxuICAgICAgbm90ZUJhckNvbG9yOiB0eXBlb2YgcmVjb3JkLm5vdGVCYXJDb2xvciA9PT0gXCJzdHJpbmdcIlxyXG4gICAgICAgID8gcmVjb3JkLm5vdGVCYXJDb2xvclxyXG4gICAgICAgIDogREVGQVVMVF9TRVRUSU5HUy5ub3RlQmFyQ29sb3JcclxuICAgIH07XHJcbiAgfVxyXG59XHJcbiIsICJpbXBvcnQgeyBQYXJzZWRJY2FsRXZlbnQgfSBmcm9tIFwiLi90eXBlc1wiO1xyXG5cclxuY29uc3QgREFURV9PTkxZID0gL15cXGR7OH0kLztcclxuY29uc3QgREFURV9USU1FID0gL15cXGR7OH1UXFxkezZ9Wj8kLztcclxuXHJcbmNvbnN0IGFkZERheXMgPSAoZGF0ZTogRGF0ZSwgZGF5czogbnVtYmVyKSA9PlxyXG4gIG5ldyBEYXRlKGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpLCBkYXRlLmdldERhdGUoKSArIGRheXMpO1xyXG5cclxuY29uc3QgcGFyc2VEYXRlVmFsdWUgPSAocmF3OiBzdHJpbmcpOiB7IGRhdGU6IERhdGU7IGFsbERheTogYm9vbGVhbiB9ID0+IHtcclxuICBpZiAoREFURV9PTkxZLnRlc3QocmF3KSkge1xyXG4gICAgY29uc3QgeWVhciA9IE51bWJlcihyYXcuc2xpY2UoMCwgNCkpO1xyXG4gICAgY29uc3QgbW9udGggPSBOdW1iZXIocmF3LnNsaWNlKDQsIDYpKSAtIDE7XHJcbiAgICBjb25zdCBkYXkgPSBOdW1iZXIocmF3LnNsaWNlKDYsIDgpKTtcclxuICAgIHJldHVybiB7IGRhdGU6IG5ldyBEYXRlKHllYXIsIG1vbnRoLCBkYXkpLCBhbGxEYXk6IHRydWUgfTtcclxuICB9XHJcblxyXG4gIGlmIChEQVRFX1RJTUUudGVzdChyYXcpKSB7XHJcbiAgICBjb25zdCB5ZWFyID0gTnVtYmVyKHJhdy5zbGljZSgwLCA0KSk7XHJcbiAgICBjb25zdCBtb250aCA9IE51bWJlcihyYXcuc2xpY2UoNCwgNikpIC0gMTtcclxuICAgIGNvbnN0IGRheSA9IE51bWJlcihyYXcuc2xpY2UoNiwgOCkpO1xyXG4gICAgY29uc3QgaG91ciA9IE51bWJlcihyYXcuc2xpY2UoOSwgMTEpKTtcclxuICAgIGNvbnN0IG1pbnV0ZSA9IE51bWJlcihyYXcuc2xpY2UoMTEsIDEzKSk7XHJcbiAgICBjb25zdCBzZWNvbmQgPSBOdW1iZXIocmF3LnNsaWNlKDEzLCAxNSkpO1xyXG4gICAgaWYgKHJhdy5lbmRzV2l0aChcIlpcIikpIHtcclxuICAgICAgcmV0dXJuIHsgZGF0ZTogbmV3IERhdGUoRGF0ZS5VVEMoeWVhciwgbW9udGgsIGRheSwgaG91ciwgbWludXRlLCBzZWNvbmQpKSwgYWxsRGF5OiBmYWxzZSB9O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHsgZGF0ZTogbmV3IERhdGUoeWVhciwgbW9udGgsIGRheSwgaG91ciwgbWludXRlLCBzZWNvbmQpLCBhbGxEYXk6IGZhbHNlIH07XHJcbiAgfVxyXG5cclxuICByZXR1cm4geyBkYXRlOiBuZXcgRGF0ZShyYXcpLCBhbGxEYXk6IGZhbHNlIH07XHJcbn07XHJcblxyXG5jb25zdCB1bmZvbGRMaW5lcyA9ICh0ZXh0OiBzdHJpbmcpOiBzdHJpbmdbXSA9PiB7XHJcbiAgY29uc3QgbGluZXMgPSB0ZXh0LnJlcGxhY2UoL1xcclxcbi9nLCBcIlxcblwiKS5zcGxpdChcIlxcblwiKTtcclxuICBjb25zdCB1bmZvbGRlZDogc3RyaW5nW10gPSBbXTtcclxuICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcclxuICAgIGlmIChsaW5lLnN0YXJ0c1dpdGgoXCIgXCIpIHx8IGxpbmUuc3RhcnRzV2l0aChcIlxcdFwiKSkge1xyXG4gICAgICBjb25zdCBsYXN0SW5kZXggPSB1bmZvbGRlZC5sZW5ndGggLSAxO1xyXG4gICAgICBpZiAobGFzdEluZGV4ID49IDApIHtcclxuICAgICAgICB1bmZvbGRlZFtsYXN0SW5kZXhdICs9IGxpbmUuc2xpY2UoMSk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSBpZiAobGluZS50cmltKCkubGVuZ3RoKSB7XHJcbiAgICAgIHVuZm9sZGVkLnB1c2gobGluZS50cmltKCkpO1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gdW5mb2xkZWQ7XHJcbn07XHJcblxyXG5leHBvcnQgY29uc3QgcGFyc2VJY2FsID0gKHRleHQ6IHN0cmluZyk6IFBhcnNlZEljYWxFdmVudFtdID0+IHtcclxuICBjb25zdCBldmVudHM6IFBhcnNlZEljYWxFdmVudFtdID0gW107XHJcbiAgY29uc3QgbGluZXMgPSB1bmZvbGRMaW5lcyh0ZXh0KTtcclxuICBsZXQgY3VycmVudDogUGFydGlhbDxQYXJzZWRJY2FsRXZlbnQ+ID0ge307XHJcblxyXG4gIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xyXG4gICAgaWYgKGxpbmUgPT09IFwiQkVHSU46VkVWRU5UXCIpIHtcclxuICAgICAgY3VycmVudCA9IHt9O1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuICAgIGlmIChsaW5lID09PSBcIkVORDpWRVZFTlRcIikge1xyXG4gICAgICBpZiAoY3VycmVudC5zdGFydCkge1xyXG4gICAgICAgIGlmICghY3VycmVudC5lbmQpIHtcclxuICAgICAgICAgIGN1cnJlbnQuZW5kID0gY3VycmVudC5zdGFydDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGN1cnJlbnQuYWxsRGF5ICYmIGN1cnJlbnQuZW5kLmdldFRpbWUoKSA+IGN1cnJlbnQuc3RhcnQuZ2V0VGltZSgpKSB7XHJcbiAgICAgICAgICBjdXJyZW50LmVuZCA9IGFkZERheXMoY3VycmVudC5lbmQsIC0xKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZXZlbnRzLnB1c2goe1xyXG4gICAgICAgICAgaWQ6IGN1cnJlbnQuaWQgPz8gY3J5cHRvLnJhbmRvbVVVSUQoKSxcclxuICAgICAgICAgIHN1bW1hcnk6IGN1cnJlbnQuc3VtbWFyeSA/PyBcIlVudGl0bGVkXCIsXHJcbiAgICAgICAgICBzdGFydDogY3VycmVudC5zdGFydCxcclxuICAgICAgICAgIGVuZDogY3VycmVudC5lbmQsXHJcbiAgICAgICAgICBhbGxEYXk6IGN1cnJlbnQuYWxsRGF5ID8/IGZhbHNlXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgICAgY3VycmVudCA9IHt9O1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBbcmF3S2V5LCByYXdWYWx1ZV0gPSBsaW5lLnNwbGl0KFwiOlwiLCAyKTtcclxuICAgIGlmICghcmF3S2V5IHx8IHJhd1ZhbHVlID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgY29udGludWU7XHJcbiAgICB9XHJcbiAgICBjb25zdCBrZXkgPSByYXdLZXkuc3BsaXQoXCI7XCIpWzBdO1xyXG5cclxuICAgIGlmIChrZXkgPT09IFwiVUlEXCIpIHtcclxuICAgICAgY3VycmVudC5pZCA9IHJhd1ZhbHVlLnRyaW0oKTtcclxuICAgIH1cclxuICAgIGlmIChrZXkgPT09IFwiU1VNTUFSWVwiKSB7XHJcbiAgICAgIGN1cnJlbnQuc3VtbWFyeSA9IHJhd1ZhbHVlLnRyaW0oKTtcclxuICAgIH1cclxuICAgIGlmIChrZXkgPT09IFwiRFRTVEFSVFwiKSB7XHJcbiAgICAgIGNvbnN0IHsgZGF0ZSwgYWxsRGF5IH0gPSBwYXJzZURhdGVWYWx1ZShyYXdWYWx1ZS50cmltKCkpO1xyXG4gICAgICBjdXJyZW50LnN0YXJ0ID0gZGF0ZTtcclxuICAgICAgY3VycmVudC5hbGxEYXkgPSBhbGxEYXk7XHJcbiAgICB9XHJcbiAgICBpZiAoa2V5ID09PSBcIkRURU5EXCIpIHtcclxuICAgICAgY29uc3QgeyBkYXRlLCBhbGxEYXkgfSA9IHBhcnNlRGF0ZVZhbHVlKHJhd1ZhbHVlLnRyaW0oKSk7XHJcbiAgICAgIGN1cnJlbnQuZW5kID0gZGF0ZTtcclxuICAgICAgY3VycmVudC5hbGxEYXkgPSBjdXJyZW50LmFsbERheSA/PyBhbGxEYXk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZXZlbnRzO1xyXG59O1xyXG4iLCAiaW1wb3J0IHsgcmVxdWVzdFVybCB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyBDYWxlbmRhckV2ZW50LCBDYWxlbmRhclNvdXJjZSwgUGFyc2VkSWNhbEV2ZW50IH0gZnJvbSBcIi4uL3R5cGVzXCI7XHJcblxyXG5leHBvcnQgdHlwZSBJY2FsUGFyc2VyID0gKHRleHQ6IHN0cmluZykgPT4gUGFyc2VkSWNhbEV2ZW50W107XHJcblxyXG50eXBlIENhY2hlRW50cnkgPSB7XHJcbiAgICBmZXRjaGVkQXQ6IG51bWJlcjtcclxuICAgIGV2ZW50czogQ2FsZW5kYXJFdmVudFtdO1xyXG4gICAgdXJsOiBzdHJpbmc7XHJcbn07XHJcblxyXG5leHBvcnQgY2xhc3MgSWNhbFNlcnZpY2Uge1xyXG4gICAgcHJpdmF0ZSBjYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBDYWNoZUVudHJ5PigpO1xyXG4gICAgcHJpdmF0ZSBwYXJzZXI6IEljYWxQYXJzZXI7XHJcblxyXG4gICAgY29uc3RydWN0b3IocGFyc2VyOiBJY2FsUGFyc2VyKSB7XHJcbiAgICAgICAgdGhpcy5wYXJzZXIgPSBwYXJzZXI7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZ2V0RXZlbnRzKFxyXG4gICAgICAgIHNvdXJjZXM6IENhbGVuZGFyU291cmNlW10sXHJcbiAgICAgICAgcmVmcmVzaEludGVydmFsTWludXRlczogbnVtYmVyLFxyXG4gICAgICAgIGZvcmNlUmVmcmVzaCA9IGZhbHNlXHJcbiAgICApOiBQcm9taXNlPENhbGVuZGFyRXZlbnRbXT4ge1xyXG4gICAgICAgIGNvbnN0IGVuYWJsZWRTb3VyY2VzID0gc291cmNlcy5maWx0ZXIoKHNvdXJjZSkgPT4gc291cmNlLmVuYWJsZWQgJiYgc291cmNlLnVybC50cmltKCkubGVuZ3RoID4gMCk7XHJcbiAgICAgICAgaWYgKGVuYWJsZWRTb3VyY2VzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xyXG4gICAgICAgIGNvbnN0IHJlZnJlc2hNcyA9IE1hdGgubWF4KHJlZnJlc2hJbnRlcnZhbE1pbnV0ZXMsIDEpICogNjAgKiAxMDAwO1xyXG5cclxuICAgICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoXHJcbiAgICAgICAgICAgIGVuYWJsZWRTb3VyY2VzLm1hcCgoc291cmNlKSA9PiB0aGlzLmdldFNvdXJjZUV2ZW50cyhzb3VyY2UsIG5vdywgcmVmcmVzaE1zLCBmb3JjZVJlZnJlc2gpKVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHJldHVybiByZXN1bHRzLmZsYXQoKS5zb3J0KChhLCBiKSA9PiBhLnN0YXJ0LmdldFRpbWUoKSAtIGIuc3RhcnQuZ2V0VGltZSgpKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldFNvdXJjZUV2ZW50cyhcclxuICAgICAgICBzb3VyY2U6IENhbGVuZGFyU291cmNlLFxyXG4gICAgICAgIG5vdzogbnVtYmVyLFxyXG4gICAgICAgIHJlZnJlc2hNczogbnVtYmVyLFxyXG4gICAgICAgIGZvcmNlUmVmcmVzaDogYm9vbGVhblxyXG4gICAgKTogUHJvbWlzZTxDYWxlbmRhckV2ZW50W10+IHtcclxuICAgICAgICBjb25zdCBjYWNoZWQgPSB0aGlzLmNhY2hlLmdldChzb3VyY2UuaWQpO1xyXG4gICAgICAgIGlmICghZm9yY2VSZWZyZXNoICYmIGNhY2hlZCAmJiBjYWNoZWQudXJsID09PSBzb3VyY2UudXJsICYmIG5vdyAtIGNhY2hlZC5mZXRjaGVkQXQgPCByZWZyZXNoTXMpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZC5ldmVudHM7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoeyB1cmw6IHNvdXJjZS51cmwgfSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHRoaXMucGFyc2VyKHJlc3BvbnNlLnRleHQpO1xyXG4gICAgICAgICAgICBjb25zdCBldmVudHMgPSBwYXJzZWQubWFwKChldmVudCkgPT4gKHtcclxuICAgICAgICAgICAgICAgIC4uLmV2ZW50LFxyXG4gICAgICAgICAgICAgICAgc291cmNlSWQ6IHNvdXJjZS5pZCxcclxuICAgICAgICAgICAgICAgIHNvdXJjZU5hbWU6IHNvdXJjZS5uYW1lIHx8IFwiQ2FsZW5kYXJcIlxyXG4gICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmNhY2hlLnNldChzb3VyY2UuaWQsIHsgZmV0Y2hlZEF0OiBub3csIGV2ZW50cywgdXJsOiBzb3VyY2UudXJsIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gZXZlbnRzO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gZmV0Y2ggaUNhbCBzb3VyY2VcIiwgc291cmNlLm5hbWUsIGVycm9yKTtcclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZCA/IGNhY2hlZC5ldmVudHMgOiBbXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFBQUEsbUJBU087OztBQ1BQLElBQU0sWUFBWTtBQUNsQixJQUFNLFlBQVk7QUFFbEIsSUFBTSxVQUFVLENBQUMsTUFBWSxTQUMzQixJQUFJLEtBQUssS0FBSyxZQUFZLEdBQUcs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O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBMlR0QixZQUFRLFFBQVEsZUFBZTtBQUMvQixhQUFTLEtBQUssWUFBWSxPQUFPO0FBQ2pDLFNBQUssU0FBUyxNQUFNLFFBQVEsT0FBTyxDQUFDO0FBQUEsRUFDdEM7QUFBQSxFQUVBLE1BQU0sZUFBZTtBQUNuQixVQUFNLE9BQU8sTUFBTSxLQUFLLFNBQVM7QUFDakMsU0FBSyxXQUFXLEtBQUssa0JBQWtCLElBQUk7QUFBQSxFQUM3QztBQUFBLEVBRUEsTUFBTSxlQUFlO0FBQ25CLFVBQU0sS0FBSyxTQUFTLEtBQUssUUFBUTtBQUNqQyxTQUFLLHdCQUF3QjtBQUFBLEVBQy9CO0FBQUEsRUFFQSxNQUFNLGtCQUFrQixNQUFZO0FBQ2xDLFVBQU0sUUFBUSxLQUFLLFNBQVMsZUFBZSxDQUFDLEtBQUs7QUFDakQsVUFBTSxRQUFRLGNBQWMsSUFBSTtBQUNoQyxVQUFNLGVBQVcsZ0NBQWMsR0FBRyxLQUFLLEtBQUs7QUFDNUMsVUFBTSxXQUFXLE1BQU0sS0FBSyxpQkFBaUIsUUFBUTtBQUNyRCxVQUFNLGtCQUFrQixNQUFNLEtBQUssb0JBQW9CO0FBQ3ZELFVBQU0sVUFBVSxLQUFLLGlCQUFpQixPQUFPLE9BQU8sZUFBZTtBQUNuRSxRQUFJO0FBQ0YsYUFBTyxNQUFNLEtBQUssSUFBSSxNQUFNLE9BQU8sVUFBVSxPQUFPO0FBQUEsSUFDdEQsU0FBUyxPQUFPO0FBQ2QsY0FBUSxNQUFNLHlCQUF5QixLQUFLO0FBQzVDLGFBQU87QUFBQSxJQUNUO0FBQUEsRUFDRjtBQUFBLEVBRUEsZ0JBQWdCLE1BQWM7QUFDNUIsVUFBTSxVQUFVLEtBQUssS0FBSztBQUMxQixRQUFJLENBQUMsU0FBUztBQUNaLGFBQU87QUFBQSxJQUNUO0FBRUEsVUFBTSxrQkFBa0IsS0FBSyxzQkFBc0IsT0FBTyxFQUFFO0FBQzVELFVBQU0saUJBQWEsZ0NBQWMscUJBQXFCLGVBQWUsRUFBRSxRQUFRLE9BQU8sRUFBRSxDQUFDO0FBQ3pGLFVBQU0sT0FBTyxLQUFLLElBQUksTUFBTSxzQkFBc0IsVUFBVTtBQUM1RCxRQUFJLGdCQUFnQix3QkFBTztBQUN6QixhQUFPO0FBQUEsSUFDVDtBQUNBLFFBQUksQ0FBQyxXQUFXLFlBQVksRUFBRSxTQUFTLEtBQUssR0FBRztBQUM3QyxZQUFNLGdCQUFnQixLQUFLLElBQUksTUFBTSxzQkFBc0IsR0FBRyxVQUFVLEtBQUs7QUFDN0UsVUFBSSx5QkFBeUIsd0JBQU87QUFDbEMsZUFBTztBQUFBLE1BQ1Q7QUFBQSxJQUNGO0FBQ0EsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUVBLE1BQWMsc0JBQXNCO0FBQ2xDLFVBQU0sT0FBTyxLQUFLLFNBQVMsaUJBQWlCLEtBQUs7QUFDakQsUUFBSSxDQUFDLE1BQU07QUFDVCxhQUFPO0FBQUEsSUFDVDtBQUNBLFVBQU0sT0FBTyxLQUFLLGdCQUFnQixJQUFJO0FBQ3RDLFFBQUksQ0FBQyxNQUFNO0FBQ1QsYUFBTztBQUFBLElBQ1Q7QUFDQSxRQUFJO0FBQ0YsYUFBTyxNQUFNLEtBQUssSUFBSSxNQUFNLFdBQVcsSUFBSTtBQUFBLElBQzdDLFNBQVMsT0FBTztBQUNkLGNBQVEsTUFBTSwyQkFBMkIsS0FBSztBQUM5QyxhQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Y7QUFBQSxFQUVRLGlCQUFpQixPQUFlLE9BQWUsVUFBa0I7QUFDdkUsUUFBSSxDQUFDLFNBQVMsS0FBSyxHQUFHO0FBQ3BCLGFBQU87QUFBQSxFQUFRLEtBQUssS0FBSyxLQUFLO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFDaEM7QUFFQSxVQUFNLFFBQVEsU0FBUyxNQUFNLElBQUk7QUFDakMsUUFBSSxNQUFNLENBQUMsR0FBRyxLQUFLLE1BQU0sT0FBTztBQUM5QixZQUFNLFdBQVcsTUFBTSxNQUFNLENBQUMsRUFBRSxVQUFVLENBQUMsU0FBUyxLQUFLLEtBQUssTUFBTSxLQUFLO0FBQ3pFLFVBQUksWUFBWSxHQUFHO0FBQ2pCLGNBQU0saUJBQWlCLFdBQVc7QUFDbEMsY0FBTSxXQUFXLE1BQU0sTUFBTSxHQUFHLGNBQWMsRUFBRSxLQUFLLENBQUMsU0FBUyxLQUFLLEtBQUssRUFBRSxXQUFXLEdBQUcsS0FBSyxHQUFHLENBQUM7QUFDbEcsWUFBSSxDQUFDLFVBQVU7QUFDYixnQkFBTSxPQUFPLGdCQUFnQixHQUFHLEdBQUcsS0FBSyxLQUFLLEtBQUssRUFBRTtBQUFBLFFBQ3REO0FBQ0EsZUFBTyxNQUFNLEtBQUssSUFBSTtBQUFBLE1BQ3hCO0FBQUEsSUFDRjtBQUVBLFdBQU87QUFBQSxFQUFRLEtBQUssS0FBSyxLQUFLO0FBQUE7QUFBQTtBQUFBLEVBQVksUUFBUTtBQUFBLEVBQ3BEO0FBQUEsRUFFQSxNQUFjLGlCQUFpQixNQUFjO0FBQzNDLFFBQUksQ0FBQyxLQUFLLElBQUksTUFBTSxzQkFBc0IsSUFBSSxHQUFHO0FBQy9DLGFBQU87QUFBQSxJQUNUO0FBQ0EsVUFBTSxPQUFPLEtBQUssUUFBUSxVQUFVLEVBQUU7QUFDdEMsUUFBSSxRQUFRO0FBQ1osUUFBSSxZQUFZLEdBQUcsSUFBSSxJQUFJLEtBQUs7QUFDaEMsV0FBTyxLQUFLLElBQUksTUFBTSxzQkFBc0IsU0FBUyxHQUFHO0FBQ3RELGVBQVM7QUFDVCxrQkFBWSxHQUFHLElBQUksSUFBSSxLQUFLO0FBQUEsSUFDOUI7QUFDQSxXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsMEJBQTBCO0FBQ3hCLFVBQU0sU0FBUyxLQUFLLElBQUksVUFBVSxnQkFBZ0Isa0JBQWtCO0FBQ3BFLGVBQVcsUUFBUSxRQUFRO0FBQ3pCLFlBQU0sWUFBWSxLQUFLLEtBQUs7QUFDNUIsWUFBTSxhQUFhLHNCQUFzQixLQUFLLFNBQVMsZ0JBQWdCLHNCQUFzQjtBQUM3RixZQUFNLGdCQUFnQixzQkFBc0IsS0FBSyxTQUFTLG1CQUFtQixlQUFlO0FBQzVGLFlBQU0sV0FBVyxzQkFBc0IsS0FBSyxTQUFTLGNBQWMsZUFBZTtBQUNsRixnQkFBVSxNQUFNO0FBQUEsUUFDZDtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQ0EsZ0JBQVUsTUFBTTtBQUFBLFFBQ2Q7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUNBLGdCQUFVLE1BQU07QUFBQSxRQUNkO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBRUEsc0JBQXNCLFNBQWlCO0FBQ3JDLFVBQU0sVUFBVSxRQUFRLEtBQUs7QUFDN0IsUUFBSSxDQUFDLFNBQVM7QUFDWixhQUFPLEVBQUUsTUFBTSxJQUFJLFNBQVMsR0FBRztBQUFBLElBQ2pDO0FBRUEsUUFBSSxhQUFhLHFCQUFxQixPQUFPLEVBQUUsUUFBUSxPQUFPLEVBQUU7QUFDaEUsUUFBSSxlQUFlLEtBQUssVUFBVSxLQUFLLFdBQVcsV0FBVyxJQUFJLEdBQUc7QUFDbEUsWUFBTSxZQUFZLHFCQUFxQixLQUFLLElBQUksTUFBTSxRQUFRLFlBQVksRUFBRSxDQUFDO0FBQzdFLFlBQU0sZ0JBQWdCLFVBQVUsU0FBUyxHQUFHLElBQUksWUFBWSxHQUFHLFNBQVM7QUFDeEUsVUFBSSxXQUFXLFdBQVcsYUFBYSxHQUFHO0FBQ3hDLHFCQUFhLFdBQVcsTUFBTSxjQUFjLE1BQU07QUFDbEQsZUFBTyxFQUFFLFVBQU0sZ0NBQWMsVUFBVSxHQUFHLFNBQVMsR0FBRztBQUFBLE1BQ3hEO0FBQ0EsYUFBTyxFQUFFLE1BQU0sSUFBSSxTQUFTLDJDQUEyQztBQUFBLElBQ3pFO0FBRUEsV0FBTyxFQUFFLFVBQU0sZ0NBQWMsVUFBVSxHQUFHLFNBQVMsR0FBRztBQUFBLEVBQ3hEO0FBQUEsRUFFQSwyQkFBMkI7QUFDekIsVUFBTSxVQUFVLG9CQUFJLElBQVk7QUFDaEMsZUFBVyxRQUFRLEtBQUssSUFBSSxNQUFNLGlCQUFpQixHQUFHO0FBQ3BELFlBQU0sU0FBUyxLQUFLLFFBQVEsUUFBUTtBQUNwQyxjQUFRLElBQUksTUFBTTtBQUFBLElBQ3BCO0FBQ0EsV0FBTyxNQUFNLEtBQUssT0FBTyxFQUFFLEtBQUssQ0FBQyxHQUFHLE1BQU0sRUFBRSxjQUFjLENBQUMsQ0FBQztBQUFBLEVBQzlEO0FBQUEsRUFFQSxtQkFBbUIsUUFBZ0I7QUFDakMsV0FBTyxLQUFLLElBQUksTUFBTSxpQkFBaUIsRUFDcEMsT0FBTyxDQUFDLFNBQVUsU0FBUyxLQUFLLFFBQVEsU0FBUyxTQUFTLElBQUssRUFDL0QsSUFBSSxDQUFDLFVBQVU7QUFBQSxNQUNkLE1BQU0sS0FBSztBQUFBLE1BQ1gsT0FBTyxLQUFLO0FBQUEsSUFDZCxFQUFFLEVBQ0QsS0FBSyxDQUFDLEdBQUcsTUFBTSxFQUFFLE1BQU0sY0FBYyxFQUFFLEtBQUssQ0FBQztBQUFBLEVBQ2xEO0FBQUEsRUFFUSxrQkFBa0IsTUFBaUM7QUFDekQsUUFBSSxDQUFDLFFBQVEsT0FBTyxTQUFTLFVBQVU7QUFDckMsYUFBTyxFQUFFLEdBQUcsaUJBQWlCO0FBQUEsSUFDL0I7QUFFQSxVQUFNLFNBQVM7QUFFZixVQUFNLFVBQTRCLE1BQU0sUUFBUSxPQUFPLE9BQU8sSUFDMUQsT0FBTyxRQUFRLElBQUksQ0FBQyxZQUFZO0FBQUEsTUFDaEMsSUFBSSxPQUFPLE1BQU0sZUFBZTtBQUFBLE1BQ2hDLE1BQU0sT0FBTyxRQUFRO0FBQUEsTUFDckIsU0FBUyxPQUFPLFdBQVc7QUFBQSxNQUMzQixLQUFLLE9BQU8sT0FBTztBQUFBLElBQ3JCLEVBQUUsSUFDQSxDQUFDO0FBRUwsUUFBSSxRQUFRLFdBQVcsS0FBSyxPQUFPLE9BQU8sWUFBWSxZQUFZLE9BQU8sUUFBUSxLQUFLLEVBQUUsU0FBUyxHQUFHO0FBQ2xHLGNBQVEsS0FBSztBQUFBLFFBQ1gsSUFBSSxlQUFlO0FBQUEsUUFDbkIsTUFBTTtBQUFBLFFBQ04sU0FBUztBQUFBLFFBQ1QsS0FBSyxPQUFPLFFBQVEsS0FBSztBQUFBLE1BQzNCLENBQUM7QUFBQSxJQUNIO0FBRUEsV0FBTztBQUFBLE1BQ0w7QUFBQSxNQUNBLFdBQVcsT0FBTyxhQUFhLGlCQUFpQjtBQUFBLE1BQ2hELFlBQVksT0FBTyxjQUFjLGlCQUFpQjtBQUFBLE1BQ2xELHdCQUF3QixPQUFPLDBCQUEwQixpQkFBaUI7QUFBQSxNQUMxRSxnQkFBZ0IsT0FBTyxrQkFBa0IsaUJBQWlCO0FBQUEsTUFDMUQsbUJBQW1CLE9BQU8scUJBQXFCLGlCQUFpQjtBQUFBLE1BQ2hFLGdCQUFnQixNQUFNLFFBQVEsT0FBTyxjQUFjLEtBQUssT0FBTyxlQUFlLFNBQVMsSUFDbkYsT0FBTyxpQkFDUCxpQkFBaUI7QUFBQSxNQUNyQixpQkFBaUIsT0FBTyxtQkFBbUIsaUJBQWlCO0FBQUEsTUFDNUQsa0JBQWtCLE9BQU8sT0FBTyxxQkFBcUIsV0FDakQsT0FBTyxtQkFDUCxpQkFBaUI7QUFBQSxNQUNyQixjQUFjLE9BQU8sT0FBTyxpQkFBaUIsV0FDekMsT0FBTyxlQUNQLGlCQUFpQjtBQUFBLElBQ3ZCO0FBQUEsRUFDRjtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiYWRkRGF5cyJdCn0K
