/** @file Google Calendar data fetching for the Calendar tab. */

import type { AllProviders } from "$lib/providers/types";
import { getProvider } from "$lib/providers";
import type { CalendarData, CalendarEvent } from "$lib/types";

export async function getCalendar(
  providers?: AllProviders,
): Promise<CalendarData> {
  const p = providers ?? getProvider();

  try {
    const raw = await p.tool.gogCommand("calendar events list --days 7 --json");
    const parsed = JSON.parse(raw) as
      { events?: CalendarEvent[] } | CalendarEvent[];
    const events: CalendarEvent[] = Array.isArray(parsed)
      ? parsed
      : (parsed.events ?? []).map((e) => ({
          title: e.title ?? "Untitled",
          start: e.start ?? "",
          end: e.end ?? "",
          calendar: e.calendar,
        }));

    const now = Date.now();
    const upcoming = events.filter((e) => {
      const start = Date.parse(e.start);
      return !Number.isNaN(start) && start >= now;
    }).length;

    return {
      events: events.slice(0, 20),
      upcoming,
      updatedAt: Date.now(),
    };
  } catch (err) {
    return {
      events: [],
      upcoming: 0,
      updatedAt: Date.now(),
      error: String(err),
    };
  }
}
