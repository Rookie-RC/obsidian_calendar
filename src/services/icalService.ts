import { requestUrl } from "obsidian";
import { CalendarEvent, CalendarSource, ParsedIcalEvent } from "../types";

export type IcalParser = (text: string) => ParsedIcalEvent[];

type CacheEntry = {
    fetchedAt: number;
    events: CalendarEvent[];
    url: string;
};

export class IcalService {
    private cache = new Map<string, CacheEntry>();
    private parser: IcalParser;

    constructor(parser: IcalParser) {
        this.parser = parser;
    }

    async getEvents(
        sources: CalendarSource[],
        refreshIntervalMinutes: number,
        forceRefresh = false
    ): Promise<CalendarEvent[]> {
        const enabledSources = sources.filter((source) => source.enabled && source.url.trim().length > 0);
        if (enabledSources.length === 0) {
            return [];
        }

        const now = Date.now();
        const refreshMs = Math.max(refreshIntervalMinutes, 1) * 60 * 1000;

        const results = await Promise.all(
            enabledSources.map((source) => this.getSourceEvents(source, now, refreshMs, forceRefresh))
        );

        return results.flat().sort((a, b) => a.start.getTime() - b.start.getTime());
    }

    private async getSourceEvents(
        source: CalendarSource,
        now: number,
        refreshMs: number,
        forceRefresh: boolean
    ): Promise<CalendarEvent[]> {
        const cached = this.cache.get(source.id);
        if (!forceRefresh && cached && cached.url === source.url && now - cached.fetchedAt < refreshMs) {
            return cached.events;
        }

        try {
            const response = await requestUrl({ url: source.url });
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
}
