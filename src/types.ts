export interface CalendarSource {
    id: string;
    name: string;
    enabled: boolean;
    url: string;
    color: string;
}

export interface CalendarEvent {
    id: string;
    summary: string;
    start: Date;
    end: Date;
    allDay: boolean;
    sourceId: string;
    sourceName: string;
}

export interface ParsedIcalEvent {
    id: string;
    summary: string;
    start: Date;
    end: Date;
    allDay: boolean;
}

export interface CalendarSettings {
    sources: CalendarSource[];
    weekStart: "sunday" | "monday";
    timeFormat: "12h" | "24h";
    language: "en" | "zh";
    refreshIntervalMinutes: number;
    todayHighlight: string;
    selectedHighlight: string;
    noteDateFields: string[];
    allowCreateNote: boolean;
    noteTemplatePath: string;
    noteBarColor: string;
}
