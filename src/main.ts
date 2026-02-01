import {
  App,
  ItemView,
  Plugin,
  PluginSettingTab,
  Setting,
  WorkspaceLeaf,
  requestUrl
} from "obsidian";
import { CalendarEvent, parseIcal } from "./ical";

const VIEW_TYPE_CALENDAR = "calendar-mvp-view";

type CalendarSettings = {
  icalUrl: string;
  weekStart: "sunday" | "monday";
  timeFormat: "12h" | "24h";
  theme: "auto" | "light" | "dark";
  showLunar: boolean;
  showHolidays: boolean;
};

const DEFAULT_SETTINGS: CalendarSettings = {
  icalUrl: "",
  weekStart: "sunday",
  timeFormat: "24h",
  theme: "auto",
  showLunar: false,
  showHolidays: false
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatTime = (date: Date, format: "12h" | "24h") => {
  if (format === "24h") {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
};

const clampDate = (date: Date, min: Date, max: Date) =>
  new Date(Math.min(Math.max(date.getTime(), min.getTime()), max.getTime()));

class CalendarView extends ItemView {
  private plugin: CalendarPlugin;
  private currentDate = new Date();
  private events: CalendarEvent[] = [];
  private calendarEl?: HTMLElement;
  private detailsEl?: HTMLElement;
  private headerTitle?: HTMLElement;
  private resizeObserver?: ResizeObserver;

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
    this.containerEl.addClass("calendar-mvp");
    this.buildLayout();
    this.plugin.applyThemeClass();
    await this.refresh();
    this.refreshLayout();
    this.observeResize();
  }

  async onClose() {
    await this.refresh();
    this.resizeObserver?.disconnect();
  }

  private observeResize() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        this.containerEl.toggleClass("calendar-mvp--compact", width < 420);
      }
    });
    this.resizeObserver.observe(this.containerEl);
  }

  private buildLayout() {
    const header = this.containerEl.createDiv({ cls: "calendar-mvp__header" });
    const navGroup = header.createDiv({ cls: "calendar-mvp__nav" });
    const prevBtn = navGroup.createEl("button", { text: "←" });
    const nextBtn = navGroup.createEl("button", { text: "→" });
    const todayBtn = navGroup.createEl("button", { text: "Today" });
    const refreshBtn = navGroup.createEl("button", { text: "Refresh" });

    this.headerTitle = header.createDiv({ cls: "calendar-mvp__title" });

    const content = this.containerEl.createDiv({ cls: "calendar-mvp__content" });
    this.calendarEl = content.createDiv({ cls: "calendar-mvp__calendar" });
    this.detailsEl = content.createDiv({ cls: "calendar-mvp__details" });

    prevBtn.addEventListener("click", () => {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
      this.refreshLayout();
    });
    nextBtn.addEventListener("click", () => {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
      this.refreshLayout();
    });
    todayBtn.addEventListener("click", () => {
      this.currentDate = new Date();
      this.refreshLayout();
    });
    refreshBtn.addEventListener("click", async () => {
      await this.refresh();
      this.refreshLayout();
    });
  }

  async refresh() {
    if (!this.plugin.settings.icalUrl) {
      this.events = [];
      return;
    }
    try {
      const response = await requestUrl({ url: this.plugin.settings.icalUrl });
      this.events = parseIcal(response.text);
    } catch (error) {
      console.error("Failed to fetch iCal", error);
      this.events = [];
    }
  }

  private refreshLayout() {
    if (!this.calendarEl || !this.detailsEl || !this.headerTitle) {
      return;
    }
    this.calendarEl.empty();
    this.detailsEl.empty();
    const monthStart = startOfMonth(this.currentDate);
    const monthEnd = endOfMonth(this.currentDate);
    const startWeekday = this.plugin.settings.weekStart === "monday" ? 1 : 0;
    const offset = (monthStart.getDay() - startWeekday + 7) % 7;
    const gridStart = addDays(monthStart, -offset);
    const gridEnd = addDays(monthEnd, (6 - ((monthEnd.getDay() - startWeekday + 7) % 7)));

    this.headerTitle.setText(
      monthStart.toLocaleDateString([], { year: "numeric", month: "long" })
    );

    const weekRow = this.calendarEl.createDiv({ cls: "calendar-mvp__weekdays" });
    const labels = this.plugin.settings.weekStart === "monday"
      ? [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]]
      : WEEKDAY_LABELS;
    for (const label of labels) {
      weekRow.createDiv({ cls: "calendar-mvp__weekday", text: label });
    }

    let cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      const week = this.calendarEl.createDiv({ cls: "calendar-mvp__week" });
      const weekStart = new Date(cursor);
      const weekEnd = addDays(weekStart, 6);
      const weekEvents = this.getEventsForRange(weekStart, weekEnd);
      const { bars, rowCount } = this.buildEventBars(week, weekEvents, weekStart, weekEnd);
      week.style.setProperty("--calendar-event-rows", String(Math.max(rowCount, 1)));
      week.style.setProperty("--calendar-day-row", String(Math.max(rowCount, 1) + 1));

      for (let i = 0; i < 7; i += 1) {
        const cellDate = addDays(weekStart, i);
        const cell = week.createDiv({ cls: "calendar-mvp__day" });
        if (cellDate.getMonth() !== this.currentDate.getMonth()) {
          cell.addClass("is-outside");
        }
        if (isSameDay(cellDate, new Date())) {
          cell.addClass("is-today");
        }
        cell.createDiv({ cls: "calendar-mvp__day-number", text: String(cellDate.getDate()) });
        const dayEvents = this.getEventsForDay(cellDate);
        const list = cell.createDiv({ cls: "calendar-mvp__event-list" });
        for (const event of dayEvents.slice(0, 2)) {
          const item = list.createDiv({ cls: "calendar-mvp__event" });
          item.setText(this.eventLabel(event));
          item.setAttr("data-tooltip", this.eventTooltip(event));
        }
        if (dayEvents.length > 2) {
          list.createDiv({ cls: "calendar-mvp__event-more", text: `+${dayEvents.length - 2} more` });
        }
        cell.addEventListener("click", () => {
          this.renderDetails(cellDate);
        });
      }

      for (const bar of bars) {
        week.appendChild(bar);
      }
      cursor = addDays(cursor, 7);
    }

    this.renderDetails(new Date());
  }

  private getEventsForRange(start: Date, end: Date) {
    return this.events.filter((event) => event.start <= end && event.end >= start);
  }

  private getEventsForDay(day: Date) {
    return this.events.filter((event) => {
      const eventStart = event.start;
      const eventEnd = event.end;
      return eventStart <= day && eventEnd >= day;
    });
  }

  private eventLabel(event: CalendarEvent) {
    if (event.allDay) {
      return `• ${event.summary}`;
    }
    return `${formatTime(event.start, this.plugin.settings.timeFormat)} ${event.summary}`;
  }

  private eventTooltip(event: CalendarEvent) {
    const start = event.allDay
      ? event.start.toDateString()
      : `${event.start.toLocaleDateString()} ${formatTime(event.start, this.plugin.settings.timeFormat)}`;
    const end = event.allDay
      ? event.end.toDateString()
      : `${event.end.toLocaleDateString()} ${formatTime(event.end, this.plugin.settings.timeFormat)}`;
    return `${event.summary}\n${start} - ${end}`;
  }

  private renderDetails(date: Date) {
    if (!this.detailsEl) {
      return;
    }
    this.detailsEl.empty();
    const title = this.detailsEl.createDiv({ cls: "calendar-mvp__details-title" });
    title.setText(date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }));
    const events = this.getEventsForDay(date);
    if (events.length === 0) {
      this.detailsEl.createDiv({ cls: "calendar-mvp__details-empty", text: "No events" });
      return;
    }
    for (const event of events) {
      const row = this.detailsEl.createDiv({ cls: "calendar-mvp__details-row" });
      row.createDiv({ cls: "calendar-mvp__details-time", text: event.allDay ? "All day" : formatTime(event.start, this.plugin.settings.timeFormat) });
      row.createDiv({ cls: "calendar-mvp__details-summary", text: event.summary });
    }
  }

  private buildEventBars(
    week: HTMLElement,
    events: CalendarEvent[],
    weekStart: Date,
    weekEnd: Date
  ) {
    const rows: CalendarEvent[][] = [];
    const bars: HTMLElement[] = [];
    const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());

    for (const event of sorted) {
      const start = clampDate(event.start, weekStart, weekEnd);
      const end = clampDate(event.end, weekStart, weekEnd);
      const startIndex = Math.max(0, Math.floor((start.getTime() - weekStart.getTime()) / 86400000));
      const endIndex = Math.min(6, Math.floor((end.getTime() - weekStart.getTime()) / 86400000));
      let rowIndex = rows.findIndex((row) => row.every((existing) => existing.end < start || existing.start > end));
      if (rowIndex === -1) {
        rowIndex = rows.length;
        rows.push([]);
      }
      rows[rowIndex].push(event);

      const bar = week.createDiv({ cls: "calendar-mvp__event-bar" });
      bar.style.gridColumn = `${startIndex + 1} / ${endIndex + 2}`;
      bar.style.gridRow = String(rowIndex + 1);
      bar.setText(event.summary);
      bar.setAttr("data-tooltip", this.eventTooltip(event));
      bars.push(bar);
    }
    return { bars, rowCount: rows.length };
  }
}

class CalendarSettingTab extends PluginSettingTab {
  private plugin: CalendarPlugin;

  constructor(app: App, plugin: CalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Calendar MVP Settings" });

    new Setting(containerEl)
      .setName("iCal URL")
      .setDesc("Paste your private Google Calendar iCal URL.")
      .addText((text) =>
        text
          .setPlaceholder("https://calendar.google.com/calendar/ical/...")
          .setValue(this.plugin.settings.icalUrl)
          .onChange(async (value) => {
            this.plugin.settings.icalUrl = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Week starts on")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("sunday", "Sunday")
          .addOption("monday", "Monday")
          .setValue(this.plugin.settings.weekStart)
          .onChange(async (value: "sunday" | "monday") => {
            this.plugin.settings.weekStart = value;
            await this.plugin.saveSettings();
            this.plugin.refreshView();
          })
      );

    new Setting(containerEl)
      .setName("Time format")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("24h", "24-hour")
          .addOption("12h", "12-hour")
          .setValue(this.plugin.settings.timeFormat)
          .onChange(async (value: "12h" | "24h") => {
            this.plugin.settings.timeFormat = value;
            await this.plugin.saveSettings();
            this.plugin.refreshView();
          })
      );

    new Setting(containerEl)
      .setName("Theme")
      .setDesc("Aligns with baseline style while respecting Obsidian theme.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("auto", "Auto")
          .addOption("light", "Light")
          .addOption("dark", "Dark")
          .setValue(this.plugin.settings.theme)
          .onChange(async (value: "auto" | "light" | "dark") => {
            this.plugin.settings.theme = value;
            await this.plugin.saveSettings();
            this.plugin.refreshView();
          })
      );

    new Setting(containerEl)
      .setName("Show lunar calendar (placeholder)")
      .setDesc("Planned: lunar dates display.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showLunar).onChange(async (value) => {
          this.plugin.settings.showLunar = value;
          await this.plugin.saveSettings();
          this.plugin.refreshView();
        })
      );

    new Setting(containerEl)
      .setName("Show holidays (placeholder)")
      .setDesc("Planned: holiday indicators.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showHolidays).onChange(async (value) => {
          this.plugin.settings.showHolidays = value;
          await this.plugin.saveSettings();
          this.plugin.refreshView();
        })
      );
  }
}

export default class CalendarPlugin extends Plugin {
  settings: CalendarSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new CalendarSettingTab(this.app, this));

    this.registerView(VIEW_TYPE_CALENDAR, (leaf) => new CalendarView(leaf, this));
    this.registerCommands();
    this.addRibbonIcon("calendar", "Open calendar", () => {
      this.activateView();
    });
    this.registerStyles();
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CALENDAR);
  }

  async activateView() {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.setViewState({ type: VIEW_TYPE_CALENDAR, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  refreshView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof CalendarView) {
        view.refresh();
        view["refreshLayout"]?.();
      }
    }
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
            view["currentDate"] = new Date();
            view["refreshLayout"]();
          }
        }
      }
    });
    this.addCommand({
      id: "calendar-refresh",
      name: "Refresh calendar",
      callback: () => this.refreshView()
    });
  }

  private registerStyles() {
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      .calendar-mvp {
        --calendar-bg: var(--background-primary);
        --calendar-text: var(--text-normal);
        --calendar-muted: var(--text-muted);
        --calendar-border: var(--background-modifier-border);
        --calendar-accent: #8ea5ff;
        --calendar-accent-strong: #5f79ff;
        --calendar-event-bg: rgba(95, 121, 255, 0.12);
        --calendar-event-text: #4452b8;
        background: var(--calendar-bg);
        color: var(--calendar-text);
        height: 100%;
      }
      .calendar-mvp.theme-light {
        --calendar-accent: #7183ff;
        --calendar-accent-strong: #4d65ff;
      }
      .calendar-mvp__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--calendar-border);
        gap: 16px;
      }
      .calendar-mvp__nav {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .calendar-mvp__nav button {
        background: transparent;
        border: 1px solid var(--calendar-border);
        border-radius: 999px;
        padding: 6px 12px;
        color: var(--calendar-text);
        cursor: pointer;
      }
      .calendar-mvp__nav button:hover {
        border-color: var(--calendar-accent-strong);
        color: var(--calendar-accent-strong);
      }
      .calendar-mvp__title {
        font-size: 18px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .calendar-mvp__content {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
        gap: 16px;
        padding: 16px 20px;
        height: calc(100% - 70px);
        box-sizing: border-box;
      }
      .calendar-mvp--compact .calendar-mvp__content {
        grid-template-columns: 1fr;
      }
      .calendar-mvp__calendar {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .calendar-mvp__weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        font-size: 12px;
        text-transform: uppercase;
        color: var(--calendar-muted);
        letter-spacing: 0.08em;
      }
      .calendar-mvp__weekday {
        padding: 4px 6px;
      }
      .calendar-mvp__week {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        grid-template-rows: repeat(var(--calendar-event-rows), 22px) minmax(80px, auto);
        gap: 6px;
        position: relative;
        padding-bottom: 4px;
      }
      .calendar-mvp__day {
        border: 1px solid var(--calendar-border);
        border-radius: 12px;
        padding: 8px;
        background: rgba(255, 255, 255, 0.02);
        display: flex;
        flex-direction: column;
        gap: 6px;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        grid-row: var(--calendar-day-row);
      }
      .calendar-mvp__day.is-outside {
        opacity: 0.5;
      }
      .calendar-mvp__day.is-today {
        border-color: var(--calendar-accent-strong);
        box-shadow: 0 0 0 1px var(--calendar-accent-strong) inset;
      }
      .calendar-mvp__day-number {
        font-weight: 600;
        font-size: 14px;
      }
      .calendar-mvp__event-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 11px;
      }
      .calendar-mvp__event,
      .calendar-mvp__event-bar {
        background: var(--calendar-event-bg);
        color: var(--calendar-event-text);
        padding: 2px 6px;
        border-radius: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        position: relative;
      }
      .calendar-mvp__event-bar {
        height: 20px;
        align-self: center;
        z-index: 2;
      }
      .calendar-mvp__event-more {
        font-size: 10px;
        color: var(--calendar-muted);
      }
      .calendar-mvp__details {
        border-left: 1px solid var(--calendar-border);
        padding-left: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .calendar-mvp--compact .calendar-mvp__details {
        border-left: none;
        border-top: 1px solid var(--calendar-border);
        padding-top: 12px;
        padding-left: 0;
      }
      .calendar-mvp__details-title {
        font-weight: 600;
        font-size: 16px;
      }
      .calendar-mvp__details-row {
        display: grid;
        grid-template-columns: 80px 1fr;
        gap: 12px;
        align-items: center;
      }
      .calendar-mvp__details-time {
        font-size: 12px;
        color: var(--calendar-muted);
      }
      .calendar-mvp__details-empty {
        color: var(--calendar-muted);
        font-size: 12px;
      }
      .calendar-mvp [data-tooltip]:hover::after {
        content: attr(data-tooltip);
        position: absolute;
        left: 12px;
        top: 100%;
        margin-top: 8px;
        background: var(--calendar-bg);
        color: var(--calendar-text);
        border: 1px solid var(--calendar-border);
        padding: 6px 8px;
        border-radius: 8px;
        font-size: 11px;
        white-space: pre-line;
        z-index: 10;
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
      }
    `;
    styleEl.dataset.calendarMvp = "true";
    document.head.appendChild(styleEl);
    this.register(() => styleEl.remove());
    this.applyThemeClass();
  }

  applyThemeClass() {
    const themeClass =
      this.settings.theme === "auto"
        ? this.app.getTheme() === "dark"
          ? "theme-dark"
          : "theme-light"
        : `theme-${this.settings.theme}`;
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
    for (const leaf of leaves) {
      leaf.view.containerEl.toggleClass("theme-light", themeClass === "theme-light");
      leaf.view.containerEl.toggleClass("theme-dark", themeClass === "theme-dark");
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.applyThemeClass();
  }
}
