import {
  App,
  ItemView,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  WorkspaceLeaf,
  normalizePath
} from "obsidian";
import { parseIcal } from "./ical";
import { IcalService } from "./services/icalService";
import { CalendarEvent, CalendarSettings, CalendarSource } from "./types";

const VIEW_TYPE_CALENDAR = "obsidian-calendar-view";

const DEFAULT_SETTINGS: CalendarSettings = {
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

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const resolveHighlightValue = (value: string, fallbackVar: string) => {
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

const normalizePathSlashes = (value: string) => value.replace(/\\/g, "/");

type LinkedNote = {
  file: TFile;
  title: string;
  excerpt: string;
};

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseFrontmatterDate = (value: unknown): Date | null => {
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

const extractFrontmatterDates = (value: unknown): Date[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => parseFrontmatterDate(item))
      .filter((item): item is Date => item !== null);
  }
  const single = parseFrontmatterDate(value);
  return single ? [single] : [];
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatTime = (date: Date, format: CalendarSettings["timeFormat"]) => {
  if (format === "24h") {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
};

const clampToDayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const clampToDayEnd = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const createSourceId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `src-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

class CalendarView extends ItemView {
  private plugin: CalendarPlugin;
  private selectedDate = new Date();
  private visibleMonth = new Date();
  private events: CalendarEvent[] = [];
  private headerTitle?: HTMLElement;
  private gridEl?: HTMLElement;
  private detailsEl?: HTMLElement;
  private notesByDate = new Map<string, LinkedNote[]>();
  private noteExcerptCache = new Map<string, string>();
  private maxNotesForGrid = 1;
  private hoverPreviewEl?: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: CalendarPlugin) {
    super(leaf);
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
    this.hoverPreviewEl = undefined;
    return;
  }

  setEvents(events: CalendarEvent[]) {
    this.events = events;
    this.render();
  }

  jumpToToday() {
    const today = new Date();
    this.selectedDate = today;
    this.visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    this.render();
  }

  private buildLayout() {
    const header = this.containerEl.createDiv({ cls: "obsidian-calendar__header" });
    const nav = header.createDiv({ cls: "obsidian-calendar__nav" });

    const prevBtn = nav.createEl("button", { text: "←" });
    const nextBtn = nav.createEl("button", { text: "→" });
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

  private render() {
    if (!this.gridEl || !this.detailsEl || !this.headerTitle) {
      return;
    }

    this.gridEl.empty();
    this.detailsEl.empty();

    const monthStart = startOfMonth(this.visibleMonth);
    const monthEnd = endOfMonth(this.visibleMonth);
    const startWeekday = this.plugin.settings.weekStart === "monday" ? 1 : 0;
    const offset = (monthStart.getDay() - startWeekday + 7) % 7;
    const gridStart = addDays(monthStart, -offset);
    const gridEnd = addDays(monthEnd, (6 - ((monthEnd.getDay() - startWeekday + 7) % 7)));

    this.notesByDate = this.buildNotesIndex(gridStart, gridEnd);
    this.maxNotesForGrid = this.getMaxNotesCount();

    this.headerTitle.setText(
      monthStart.toLocaleDateString([], { year: "numeric", month: "long" })
    );

    const weekdayRow = this.gridEl.createDiv({ cls: "obsidian-calendar__weekdays" });
    const labels = this.plugin.settings.weekStart === "monday"
      ? [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]]
      : WEEKDAY_LABELS;

    for (const label of labels) {
      weekdayRow.createDiv({ cls: "obsidian-calendar__weekday", text: label });
    }

    const daysGrid = this.gridEl.createDiv({ cls: "obsidian-calendar__days" });
    let cursor = new Date(gridStart);
    const today = new Date();

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

      cursor = addDays(cursor, 1);
    }

    this.renderDetails();
  }

  private renderDetails() {
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

  private getEventsForDay(day: Date) {
    const start = clampToDayStart(day);
    const end = clampToDayEnd(day);
    return this.events
      .filter((event) => event.start <= end && event.end >= start)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  private buildNotesIndex(start: Date, end: Date) {
    const index = new Map<string, LinkedNote[]>();
    const startDay = clampToDayStart(start);
    const endDay = clampToDayEnd(end);
    const fields = this.plugin.settings.noteDateFields
      .map((field) => field.trim())
      .filter((field) => field.length > 0);

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

  private getNotesForDay(day: Date) {
    return this.notesByDate.get(formatDateKey(day)) ?? [];
  }

  private getMaxNotesCount() {
    let maxCount = 1;
    for (const list of this.notesByDate.values()) {
      if (list.length > maxCount) {
        maxCount = list.length;
      }
    }
    return maxCount;
  }

  private ensureHoverPreview() {
    if (this.hoverPreviewEl) {
      return;
    }
    this.hoverPreviewEl = document.body.createDiv({ cls: "obsidian-calendar__note-preview" });
  }

  private showHoverPreview(anchor: HTMLElement, notes: LinkedNote[]) {
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

  private hideHoverPreview() {
    if (this.hoverPreviewEl) {
      this.hoverPreviewEl.style.display = "none";
    }
  }

  private ensureExcerpt(file: TFile, targetEl: HTMLElement) {
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

  private async openNote(file: TFile) {
    const leaf = this.plugin.app.workspace.getLeaf(false);
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    const line = cache?.frontmatterPosition?.end?.line ?? 0;
    await leaf.openFile(file, { state: { line }, active: true });
  }
}

class CalendarSettingTab extends PluginSettingTab {
  private plugin: CalendarPlugin;
  private selectedTemplateFolder = "";

  constructor(app: App, plugin: CalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Calendar" });

    new Setting(containerEl)
      .setName("Refresh interval (minutes)")
      .setDesc("How often calendar sources are refreshed.")
      .addText((text) =>
        text
          .setPlaceholder("30")
          .setValue(String(this.plugin.settings.refreshIntervalMinutes))
          .onChange(async (value) => {
            const parsed = Number(value);
            this.plugin.settings.refreshIntervalMinutes = Number.isFinite(parsed) && parsed > 0
              ? parsed
              : DEFAULT_SETTINGS.refreshIntervalMinutes;
            await this.plugin.saveSettings();
            this.plugin.refreshEvents(true);
            this.plugin.restartAutoRefresh();
          })
      );

    new Setting(containerEl)
      .setName("Week starts on")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("sunday", "Sunday")
          .addOption("monday", "Monday")
          .setValue(this.plugin.settings.weekStart)
          .onChange(async (value: CalendarSettings["weekStart"]) => {
            this.plugin.settings.weekStart = value;
            await this.plugin.saveSettings();
            this.plugin.renderViews();
          })
      );

    new Setting(containerEl)
      .setName("Time format")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("24h", "24-hour")
          .addOption("12h", "12-hour")
          .setValue(this.plugin.settings.timeFormat)
          .onChange(async (value: CalendarSettings["timeFormat"]) => {
            this.plugin.settings.timeFormat = value;
            await this.plugin.saveSettings();
            this.plugin.renderViews();
          })
      );

    new Setting(containerEl)
      .setName("Today highlight")
      .setDesc("Highlight color for today.")
      .addColorPicker((picker) =>
        picker
          .setValue(resolveHighlightValue(this.plugin.settings.todayHighlight, "--interactive-accent"))
          .onChange(async (value) => {
            this.plugin.settings.todayHighlight = value;
            await this.plugin.saveSettings();
            this.plugin.applyHighlightVariables();
          })
      );

    new Setting(containerEl)
      .setName("Selected date highlight")
      .setDesc("Highlight color for the selected date.")
      .addColorPicker((picker) =>
        picker
          .setValue(resolveHighlightValue(this.plugin.settings.selectedHighlight, "--text-accent"))
          .onChange(async (value) => {
            this.plugin.settings.selectedHighlight = value;
            await this.plugin.saveSettings();
            this.plugin.applyHighlightVariables();
          })
      );

    new Setting(containerEl)
      .setName("Note date fields")
      .setDesc("Comma-separated frontmatter fields used to link notes to dates.")
      .addText((text) =>
        text
          .setPlaceholder("date, start, end")
          .setValue(this.plugin.settings.noteDateFields.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.noteDateFields = value
              .split(",")
              .map((field) => field.trim())
              .filter((field) => field.length > 0);
            await this.plugin.saveSettings();
            this.plugin.renderViews();
          })
      );

    new Setting(containerEl)
      .setName("Allow create note")
      .setDesc("Show a quick action to create a note for the selected date.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.allowCreateNote).onChange(async (value) => {
          this.plugin.settings.allowCreateNote = value;
          await this.plugin.saveSettings();
          this.plugin.renderViews();
        })
      );

    new Setting(containerEl)
      .setName("Note density bar color")
      .setDesc("Color for the note density indicator bar.")
      .addColorPicker((picker) =>
        picker
          .setValue(resolveHighlightValue(this.plugin.settings.noteBarColor, "--text-accent"))
          .onChange(async (value) => {
            this.plugin.settings.noteBarColor = value;
            await this.plugin.saveSettings();
            this.plugin.applyHighlightVariables();
          })
      );

    const templateSetting = new Setting(containerEl)
      .setName("Note template")
      .setDesc("Choose a vault template file.");

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
      const sourceSetting = new Setting(containerEl)
        .setName(source.name || "Unnamed")
        .setDesc("Enabled sources are fetched and merged.");

      sourceSetting.addToggle((toggle) =>
        toggle
          .setValue(source.enabled)
          .onChange(async (value) => {
            source.enabled = value;
            await this.plugin.saveSettings();
            this.plugin.refreshEvents(true);
          })
      );

      sourceSetting.addButton((button) =>
        button
          .setButtonText("Remove")
          .setCta()
          .onClick(async () => {
            this.plugin.settings.sources = this.plugin.settings.sources.filter((item) => item.id !== source.id);
            await this.plugin.saveSettings();
            this.plugin.refreshEvents(true);
            this.display();
          })
      );

      new Setting(containerEl)
        .setName("Name")
        .addText((text) =>
          text
            .setValue(source.name)
            .onChange(async (value) => {
              source.name = value;
              sourceSetting.setName(source.name.trim() || "Unnamed");
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName("iCal URL")
        .addText((text) =>
          text
            .setPlaceholder("https://calendar.google.com/calendar/ical/...")
            .setValue(source.url)
            .onChange(async (value) => {
              source.url = value.trim();
              await this.plugin.saveSettings();
              this.plugin.refreshEvents(true);
            })
        );
    }

    new Setting(containerEl)
      .setName("Add calendar source")
      .setDesc("Add another iCal (ICS) source.")
      .addButton((button) =>
        button
          .setButtonText("Add")
          .onClick(async () => {
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
}

export default class CalendarPlugin extends Plugin {
  settings: CalendarSettings = DEFAULT_SETTINGS;
  private service = new IcalService(parseIcal);
  private events: CalendarEvent[] = [];
  private refreshHandle?: number;

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

  private startAutoRefresh() {
    const intervalMs = Math.max(this.settings.refreshIntervalMinutes, 1) * 60 * 1000;
    this.refreshHandle = window.setInterval(() => {
      this.refreshEvents();
    }, intervalMs);
  }

  private registerCommands() {
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

  private registerStyles() {
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

  async createNoteForDate(date: Date) {
    const field = this.settings.noteDateFields[0] || "date";
    const title = formatDateKey(date);
    const basePath = normalizePath(`${title}.md`);
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

  getTemplateFile(path: string) {
    const trimmed = path.trim();
    if (!trimmed) {
      return null;
    }

    const normalizedInput = this.normalizeTemplatePath(trimmed).path;
    const normalized = normalizePath(normalizePathSlashes(normalizedInput).replace(/^\//, ""));
    const file = this.app.vault.getAbstractFileByPath(normalized);
    if (file instanceof TFile) {
      return file;
    }
    if (!normalized.toLowerCase().endsWith(".md")) {
      const withExtension = this.app.vault.getAbstractFileByPath(`${normalized}.md`);
      if (withExtension instanceof TFile) {
        return withExtension;
      }
    }
    return null;
  }

  private async loadTemplateContent() {
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

  private buildNoteContent(field: string, value: string, template: string) {
    if (!template.trim()) {
      return `---\n${field}: ${value}\n---\n\n`;
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

    return `---\n${field}: ${value}\n---\n\n${template}`;
  }

  private async getAvailablePath(path: string) {
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

  normalizeTemplatePath(rawPath: string) {
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
        return { path: normalizePath(normalized), warning: "" };
      }
      return { path: "", warning: "Template path must be inside this vault." };
    }

    return { path: normalizePath(normalized), warning: "" };
  }

  getTemplateFolderOptions() {
    const folders = new Set<string>();
    for (const file of this.app.vault.getMarkdownFiles()) {
      const parent = file.parent?.path ?? "";
      folders.add(parent);
    }
    return Array.from(folders).sort((a, b) => a.localeCompare(b));
  }

  getTemplateOptions(folder: string) {
    return this.app.vault.getMarkdownFiles()
      .filter((file) => (folder ? file.parent?.path === folder : true))
      .map((file) => ({
        path: file.path,
        label: file.name
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private normalizeSettings(data: unknown): CalendarSettings {
    if (!data || typeof data !== "object") {
      return { ...DEFAULT_SETTINGS };
    }

    const record = data as Partial<CalendarSettings> & { icalUrl?: string };

    const sources: CalendarSource[] = Array.isArray(record.sources)
      ? record.sources.map((source) => ({
        id: source.id || createSourceId(),
        name: source.name ?? "",
        enabled: source.enabled ?? true,
        url: source.url ?? ""
      }))
      : [];

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
      noteDateFields: Array.isArray(record.noteDateFields) && record.noteDateFields.length > 0
        ? record.noteDateFields
        : DEFAULT_SETTINGS.noteDateFields,
      allowCreateNote: record.allowCreateNote ?? DEFAULT_SETTINGS.allowCreateNote,
      noteTemplatePath: typeof record.noteTemplatePath === "string"
        ? record.noteTemplatePath
        : DEFAULT_SETTINGS.noteTemplatePath,
      noteBarColor: typeof record.noteBarColor === "string"
        ? record.noteBarColor
        : DEFAULT_SETTINGS.noteBarColor
    };
  }
}
