export type SlaBusinessHourForCalculation = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type SlaHolidayForCalculation = {
  date: Date;
};

export type TicketSlaPauseForCalculation = {
  startedAt: Date;
  endedAt: Date | null;
};

const MAX_CIVIL_DAYS = 3660;

type CivilDate = {
  year: number;
  month: number;
  day: number;
};

type CivilDateTime = CivilDate & {
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

type ParsedBusinessHour = {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

const zonedFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function calculateBusinessTime(
  startAt: Date,
  endAt: Date,
  businessHours: SlaBusinessHourForCalculation[],
  holidays: SlaHolidayForCalculation[],
  timeZone: string,
): number {
  if (endAt.getTime() <= startAt.getTime()) return 0;

  let totalBusinessTimeMs = 0;
  let civilDate = civilDateOf(startAt, timeZone);

  for (let step = 0; step < MAX_CIVIL_DAYS; step++) {
    const dayStart = civilTimeToInstant(
      civilDate.year,
      civilDate.month,
      civilDate.day,
      0,
      0,
      0,
      0,
      timeZone,
    );

    if (dayStart.getTime() >= endAt.getTime()) return totalBusinessTimeMs;

    if (!isHoliday(civilDate, holidays)) {
      const businessHour = findBusinessHour(businessHours, civilDate);

      if (businessHour) {
        const businessStart = civilTimeToInstant(
          civilDate.year,
          civilDate.month,
          civilDate.day,
          businessHour.startHour,
          businessHour.startMinute,
          0,
          0,
          timeZone,
        );
        const businessEnd = civilTimeToInstant(
          civilDate.year,
          civilDate.month,
          civilDate.day,
          businessHour.endHour,
          businessHour.endMinute,
          0,
          0,
          timeZone,
        );

        const effectiveStartMs = Math.max(
          startAt.getTime(),
          businessStart.getTime(),
        );
        const effectiveEndMs = Math.min(endAt.getTime(), businessEnd.getTime());

        if (effectiveEndMs > effectiveStartMs) {
          totalBusinessTimeMs += effectiveEndMs - effectiveStartMs;
        }
      }
    }

    civilDate = nextCivilDate(civilDate);
  }

  throw new Error(
    "Business time span exceeds the supported calendar range",
  );
}

export function addBusinessTime(
  startAt: Date,
  businessMinutes: number,
  businessHours: SlaBusinessHourForCalculation[],
  holidays: SlaHolidayForCalculation[],
  timeZone: string,
): Date {
  if (businessMinutes <= 0) {
    return new Date(startAt);
  }

  let remainingMs = businessMinutes * 60 * 1000;
  let cursor = new Date(startAt);

  for (let step = 0; step < MAX_CIVIL_DAYS; step++) {
    const civilDate = civilDateOf(cursor, timeZone);

    if (isHoliday(civilDate, holidays)) {
      cursor = startOfNextCivilDay(civilDate, timeZone);
      continue;
    }

    const businessHour = findBusinessHour(businessHours, civilDate);

    if (!businessHour) {
      cursor = startOfNextCivilDay(civilDate, timeZone);
      continue;
    }

    const businessStart = civilTimeToInstant(
      civilDate.year,
      civilDate.month,
      civilDate.day,
      businessHour.startHour,
      businessHour.startMinute,
      0,
      0,
      timeZone,
    );
    const businessEnd = civilTimeToInstant(
      civilDate.year,
      civilDate.month,
      civilDate.day,
      businessHour.endHour,
      businessHour.endMinute,
      0,
      0,
      timeZone,
    );

    if (businessEnd.getTime() <= businessStart.getTime()) {
      cursor = startOfNextCivilDay(civilDate, timeZone);
      continue;
    }

    if (cursor.getTime() < businessStart.getTime()) {
      cursor = businessStart;
    }

    if (cursor.getTime() >= businessEnd.getTime()) {
      cursor = startOfNextCivilDay(civilDate, timeZone);
      continue;
    }

    const availableMs = businessEnd.getTime() - cursor.getTime();

    if (remainingMs <= availableMs) {
      return new Date(cursor.getTime() + remainingMs);
    }

    remainingMs -= availableMs;
    cursor = startOfNextCivilDay(civilDate, timeZone);
  }

  throw new Error(
    "Unable to schedule business time within the supported calendar range",
  );
}

export function calculateElapsedWorkTime(
  openAt: Date,
  now: Date,
  TicketSlaPauseForCalculation: TicketSlaPauseForCalculation[],
  businessHours: SlaBusinessHourForCalculation[],
  holidays: SlaHolidayForCalculation[],
  timeZone: string,
): number {
  const workingTime = calculateBusinessTime(
    openAt,
    now,
    businessHours,
    holidays,
    timeZone,
  );

  const workTimePause = TicketSlaPauseForCalculation.reduce(
    (totalPauseWorkTime, pause) => {
      const pauseEnd = pause.endedAt ?? now;
      const pausedTime = calculateBusinessTime(
        pause.startedAt,
        pauseEnd,
        businessHours,
        holidays,
        timeZone,
      );
      return totalPauseWorkTime + pausedTime;
    },
    0,
  );

  return Math.max(0, workingTime - workTimePause);
}

/**
 * Convierte una hora civil del calendario en un instante UTC.
 *
 * `Intl.DateTimeFormat` solo proyecta un instante ya existente a partes
 * civiles. No acepta año, mes, día y hora y devuelve el instante
 * correspondiente. El desfase se obtiene formateando instantes de prueba,
 * primero alrededor de la hora civil leída como UTC y después alrededor del
 * candidato ya corregido, hasta que las partes coinciden con la hora pedida.
 *
 * En un cambio de horario de verano la misma hora civil puede no existir o
 * existir dos veces. El criterio es el de Temporal `compatible` (RFC 5545):
 *
 * - Hora ambigua, cuando el reloj se atrasa y la hora ocurre dos veces: se
 *   elige el instante anterior, el de antes del cambio.
 * - Hora inexistente, cuando el reloj se adelanta y la hora se salta: se
 *   avanza hasta el primer instante cuya hora civil es posterior a la pedida.
 *
 * Un horario 09:00–17:00 no cae en el salto de las 02:00/03:00 de Europa.
 */
function civilTimeToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
): Date {
  const civilAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond,
  );
  const offsets = timeZoneOffsetsAround(civilAsUtc, timeZone);

  const matches: number[] = [];

  for (const offset of offsets) {
    const instant = civilAsUtc - offset;
    if (
      hasCivilTime(
        new Date(instant),
        year,
        month,
        day,
        hour,
        minute,
        second,
        millisecond,
        timeZone,
      )
    ) {
      matches.push(instant);
    }
  }

  const earliestMatch = matches.reduce<number | undefined>(
    (earliest, instant) =>
      earliest === undefined || instant < earliest ? instant : earliest,
    undefined,
  );

  if (earliestMatch !== undefined) return new Date(earliestMatch);

  let resolvedInstant: number | undefined;
  let resolvedCivil = Number.POSITIVE_INFINITY;

  for (const offset of offsets) {
    const instant = civilAsUtc - offset;
    const parts = getZonedParts(new Date(instant), timeZone);
    const civil = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond,
    );

    if (
      civil >= civilAsUtc &&
      (civil < resolvedCivil ||
        (civil === resolvedCivil &&
          (resolvedInstant === undefined || instant < resolvedInstant)))
    ) {
      resolvedCivil = civil;
      resolvedInstant = instant;
    }
  }

  if (resolvedInstant === undefined) {
    throw new Error(
      `Unable to resolve ${year}-${month}-${day} ${hour}:${minute} in time zone ${timeZone}`,
    );
  }

  return new Date(resolvedInstant);
}

function timeZoneOffsetsAround(civilAsUtc: number, timeZone: string): number[] {
  const offsets = new Set<number>();
  const pending = [civilAsUtc];

  while (pending.length > 0 && offsets.size < 4) {
    const base = pending.shift();
    if (base === undefined) break;

    for (const deltaHours of [-2, -1, 0, 1, 2]) {
      const offset = timeZoneOffsetMs(
        new Date(base + deltaHours * 3_600_000),
        timeZone,
      );
      if (offsets.has(offset)) continue;

      offsets.add(offset);
      pending.push(civilAsUtc - offset);
    }
  }

  return [...offsets];
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = getZonedParts(instant, timeZone);
  const civilAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );

  return civilAsUtc - instant.getTime();
}

function getZonedParts(instant: Date, timeZone: string): CivilDateTime {
  const parts = formatterFor(timeZone).formatToParts(instant);
  let hour = readPart(parts, "hour");
  let year = readPart(parts, "year");
  let month = readPart(parts, "month");
  let day = readPart(parts, "day");

  // Algunas implementaciones representan la medianoche como hora 24 del día
  // que termina. Esa hora es las 00:00 del día civil siguiente.
  if (hour === 24) {
    hour = 0;
    const nextDay = nextCivilDate({ year, month, day });
    year = nextDay.year;
    month = nextDay.month;
    day = nextDay.day;
  }

  return {
    year,
    month,
    day,
    hour,
    minute: readPart(parts, "minute"),
    second: readPart(parts, "second"),
    millisecond: instant.getUTCMilliseconds(),
  };
}

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = zonedFormatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  zonedFormatterCache.set(timeZone, formatter);
  return formatter;
}

function readPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const value = parts.find((part) => part.type === type)?.value;
  if (value === undefined) {
    throw new Error(`Missing ${type} while reading calendar time`);
  }

  return Number(value);
}

function hasCivilTime(
  instant: Date,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
): boolean {
  const parts = getZonedParts(instant, timeZone);

  return (
    parts.year === year &&
    parts.month === month &&
    parts.day === day &&
    parts.hour === hour &&
    parts.minute === minute &&
    parts.second === second &&
    parts.millisecond === millisecond
  );
}

function civilDateOf(instant: Date, timeZone: string): CivilDate {
  const parts = getZonedParts(instant, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

function nextCivilDate(date: CivilDate): CivilDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function startOfNextCivilDay(date: CivilDate, timeZone: string): Date {
  const next = nextCivilDate(date);
  return civilTimeToInstant(next.year, next.month, next.day, 0, 0, 0, 0, timeZone);
}

function isoWeekday(date: CivilDate): number {
  const sundayBased = new Date(
    Date.UTC(date.year, date.month - 1, date.day),
  ).getUTCDay();
  return sundayBased === 0 ? 7 : sundayBased;
}

/**
 * `SlaHoliday.date` es una fecha civil guardada a medianoche UTC
 * (`DateTime @db.Date`). Se compara con el año, mes y día del calendario,
 * no con la zona horaria del proceso.
 */
function isHoliday(
  date: CivilDate,
  holidays: SlaHolidayForCalculation[],
): boolean {
  return holidays.some(
    (holiday) =>
      holiday.date.getUTCFullYear() === date.year &&
      holiday.date.getUTCMonth() + 1 === date.month &&
      holiday.date.getUTCDate() === date.day,
  );
}

function findBusinessHour(
  businessHours: SlaBusinessHourForCalculation[],
  date: CivilDate,
): ParsedBusinessHour | undefined {
  const weekday = isoWeekday(date);
  const businessHour = businessHours.find((hour) => hour.dayOfWeek === weekday);
  if (!businessHour) return undefined;
  return parseBusinessHour(businessHour);
}

function parseBusinessHour(
  businessHour: SlaBusinessHourForCalculation,
): ParsedBusinessHour {
  const [startHour, startMinute] = businessHour.startTime.split(":").map(Number);
  const [endHour, endMinute] = businessHour.endTime.split(":").map(Number);

  if (
    startHour === undefined ||
    startMinute === undefined ||
    endHour === undefined ||
    endMinute === undefined ||
    Number.isNaN(startHour) ||
    Number.isNaN(startMinute) ||
    Number.isNaN(endHour) ||
    Number.isNaN(endMinute)
  ) {
    throw new Error(
      `Invalid business hour configuration for day ${businessHour.dayOfWeek}`,
    );
  }

  return { startHour, startMinute, endHour, endMinute };
}
