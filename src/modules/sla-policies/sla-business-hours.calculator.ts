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

export function calculateBusinessTime(
  startAt: Date,
  endAt: Date,
  businessHours: SlaBusinessHourForCalculation[],
  holidays: SlaHolidayForCalculation[] = [],
): number {
  if (endAt <= startAt) return 0;

  let totalBusinessTimeMs = 0;
  const currentDate = new Date(startAt);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate < endAt) {
    const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay();

    if (isHoliday(currentDate, holidays)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    const businessHour = businessHours.find(
      (hour) => hour.dayOfWeek === dayOfWeek,
    );

    if (businessHour) {
      const [startHour, startMinute] = businessHour.startTime
        .split(":")
        .map(Number);

      const [endHour, endMinute] = businessHour.endTime.split(":").map(Number);

      if (
        startHour === undefined ||
        startMinute === undefined ||
        endHour === undefined ||
        endMinute === undefined
      )
        throw new Error(
          `Invalid business hour configuration for day ${businessHour.dayOfWeek}`,
        );

      const businessStart = new Date(currentDate);
      businessStart.setHours(startHour, startMinute, 0, 0);

      const businessEnd = new Date(currentDate);
      businessEnd.setHours(endHour, endMinute, 0, 0);

      const effectiveStart = startAt > businessStart ? startAt : businessStart;

      const effectiveEnd = endAt < businessEnd ? endAt : businessEnd;

      if (effectiveEnd > effectiveStart) {
        totalBusinessTimeMs +=
          effectiveEnd.getTime() - effectiveStart.getTime();
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return totalBusinessTimeMs;
}

export function addBusinessTime(
  startAt: Date,
  businessMinutes: number,
  businessHours: SlaBusinessHourForCalculation[],
  holidays: SlaHolidayForCalculation[] = [],
): Date {
  if (businessMinutes <= 0) {
    return new Date(startAt);
  }

  let remainingMs = businessMinutes * 60 * 1000;
  const currentDate = new Date(startAt);

  while (remainingMs > 0) {
    const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay();

    if (isHoliday(currentDate, holidays)) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
      continue;
    }

    const businessHour = businessHours.find(
      (hour) => hour.dayOfWeek === dayOfWeek,
    );

    if (!businessHour) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
      continue;
    }

    const [startHour, startMinute] = businessHour.startTime
      .split(":")
      .map(Number);

    const [endHour, endMinute] = businessHour.endTime.split(":").map(Number);

    if (
      startHour === undefined ||
      startMinute === undefined ||
      endHour === undefined ||
      endMinute === undefined
    ) {
      throw new Error(
        `Invalid business hour configuration for day ${businessHour.dayOfWeek}`,
      );
    }

    const businessStart = new Date(currentDate);
    businessStart.setHours(startHour, startMinute, 0, 0);

    const businessEnd = new Date(currentDate);
    businessEnd.setHours(endHour, endMinute, 0, 0);

    if (currentDate < businessStart) {
      currentDate.setTime(businessStart.getTime());
    }

    if (currentDate >= businessEnd) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
      continue;
    }

    const availableMs = businessEnd.getTime() - currentDate.getTime();

    if (remainingMs <= availableMs) {
      return new Date(currentDate.getTime() + remainingMs);
    }

    remainingMs -= availableMs;

    currentDate.setDate(currentDate.getDate() + 1);
    currentDate.setHours(0, 0, 0, 0);
  }

  return currentDate;
}

export function calculateElapsedWorkTime(
  openAt: Date,
  now: Date,
  TicketSlaPauseForCalculation: TicketSlaPauseForCalculation[],
  businessHours: SlaBusinessHourForCalculation[],
  holidays: SlaHolidayForCalculation[] = [],
): number {
  const workingTime = calculateBusinessTime(
    openAt,
    now,
    businessHours,
    holidays,
  );

  const workTimePause = TicketSlaPauseForCalculation.reduce(
    (totalPauseWorkTime, pause) => {
      const pauseEnd = pause.endedAt ?? now;
      const pausedTime = calculateBusinessTime(
        pause.startedAt,
        pauseEnd,
        businessHours,
        holidays,
      );
      return totalPauseWorkTime + pausedTime;
    },
    0,
  );

  const effectiveWorkTime = workingTime - workTimePause;

  return Math.max(0, effectiveWorkTime);
}

function isHoliday(date: Date, holidays: SlaHolidayForCalculation[]): boolean {
  return holidays.some(
    (holiday) =>
      holiday.date.getUTCFullYear() === date.getFullYear() &&
      holiday.date.getUTCMonth() === date.getMonth() &&
      holiday.date.getUTCDate() === date.getDate(),
  );
}
