export type CalendarEvent = {
  id: string;
  summary: string;
  start: Date;
  end: Date;
  allDay: boolean;
};

const DATE_ONLY = /^\d{8}$/;
const DATE_TIME = /^\d{8}T\d{6}Z?$/;

const parseDateValue = (raw: string): { date: Date; allDay: boolean } => {
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

const unfoldLines = (text: string): string[] => {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const unfolded: string[] = [];
  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
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

export const parseIcal = (text: string): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  const lines = unfoldLines(text);
  let current: Partial<CalendarEvent> = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current.start && current.end) {
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
    if (!rawKey || rawValue === undefined) {
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
