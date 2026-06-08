export interface ParsedOpenTime {
  isAlwaysOpen: boolean;
  startDay: number | null;
  endDay: number | null;
  startTime: string | null;
  endTime: string | null;
}

const DAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const DAY_RANGE_RE = /^([A-Za-z]+)\s*(?:to|-|–|—)\s*([A-Za-z]+)$/;
const TIME_RANGE_RE = /^(\d{1,2}):(\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}):(\d{2})$/;
const ALWAYS_OPEN_RE = /^(always\s*open|24\s*\/?\s*7|open\s*24)$/i;

/**
 * Parses brief-style open-time fields into structured fields.
 * dayRange examples: "Mon to Fri", "Mon-Sun", "Always open"
 * timeRange examples: "09:00-18:00", "09:00 to 18:00" (ignored if dayRange is Always open)
 */
export function parseOpenTime(dayRange: string, timeRange?: string): ParsedOpenTime {
  const normalized = dayRange.trim();
  if (ALWAYS_OPEN_RE.test(normalized)) {
    return { isAlwaysOpen: true, startDay: null, endDay: null, startTime: null, endTime: null };
  }

  const dayMatch = DAY_RANGE_RE.exec(normalized);
  if (!dayMatch) {
    const single = DAY_MAP[normalized.toLowerCase()];
    if (single === undefined) {
      throw new Error(`Unrecognised day range: "${dayRange}"`);
    }
    const { startTime, endTime } = parseTimeRange(timeRange);
    return { isAlwaysOpen: false, startDay: single, endDay: single, startTime, endTime };
  }

  const startDay = DAY_MAP[dayMatch[1].toLowerCase()];
  const endDay = DAY_MAP[dayMatch[2].toLowerCase()];
  if (startDay === undefined || endDay === undefined) {
    throw new Error(`Unrecognised day in range: "${dayRange}"`);
  }

  const { startTime, endTime } = parseTimeRange(timeRange);
  return { isAlwaysOpen: false, startDay, endDay, startTime, endTime };
}

function parseTimeRange(input?: string): { startTime: string; endTime: string } {
  if (!input) {
    throw new Error('Time range required when day range is not "Always open"');
  }
  const match = TIME_RANGE_RE.exec(input.trim());
  if (!match) {
    throw new Error(`Unrecognised time range: "${input}"`);
  }
  const [, sh, sm, eh, em] = match;
  return { startTime: pad(sh) + ':' + sm, endTime: pad(eh) + ':' + em };
}

function pad(hour: string): string {
  return hour.length === 1 ? '0' + hour : hour;
}
