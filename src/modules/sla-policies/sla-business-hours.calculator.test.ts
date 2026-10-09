import { describe, expect, it } from "vitest";
import {
  addBusinessTime,
  calculateBusinessTime,
  calculateElapsedWorkTime,
  type SlaBusinessHourForCalculation,
  type SlaHolidayForCalculation,
  type TicketSlaPauseForCalculation,
} from "./sla-business-hours.calculator.js";
import { calculateSlaDueDates } from "./sla-policy.calculator.js";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const WEEKDAY_HOURS: SlaBusinessHourForCalculation[] = [1, 2, 3, 4, 5].map(
  (dayOfWeek) => ({
    dayOfWeek,
    startTime: "09:00",
    endTime: "17:00",
  }),
);

/** Fecha civil 2026-10-12, el mismo valor que Prisma devuelve para @db.Date. */
const NATIONAL_DAY: SlaHolidayForCalculation[] = [
  { date: new Date(Date.UTC(2026, 9, 12)) },
];

const NO_HOLIDAYS: SlaHolidayForCalculation[] = [];
const NO_PAUSES: TicketSlaPauseForCalculation[] = [];

function at(iso: string): Date {
  return new Date(iso);
}

describe("calculateBusinessTime", () => {
  it("devuelve cero cuando la fecha final es anterior o igual a la inicial", () => {
    const start = at("2026-10-05T10:00:00.000Z");

    expect(
      calculateBusinessTime(
        start,
        start,
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ),
    ).toBe(0);
    expect(
      calculateBusinessTime(
        start,
        at("2026-10-05T09:00:00.000Z"),
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ),
    ).toBe(0);
  });

  it("cuenta un intervalo dentro del horario laboral", () => {
    expect(
      calculateBusinessTime(
        at("2026-10-05T10:00:00.000Z"),
        at("2026-10-05T12:00:00.000Z"),
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ),
    ).toBe(2 * HOUR_MS);
  });

  it("no cuenta las horas anteriores a la apertura ni posteriores al cierre", () => {
    expect(
      calculateBusinessTime(
        at("2026-10-05T08:00:00.000Z"),
        at("2026-10-05T18:00:00.000Z"),
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ),
    ).toBe(8 * HOUR_MS);
  });

  it("no cuenta sábados ni domingos", () => {
    expect(
      calculateBusinessTime(
        at("2026-10-10T10:00:00.000Z"),
        at("2026-10-10T12:00:00.000Z"),
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ),
    ).toBe(0);
    expect(
      calculateBusinessTime(
        at("2026-10-11T10:00:00.000Z"),
        at("2026-10-11T12:00:00.000Z"),
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ),
    ).toBe(0);
    expect(
      calculateBusinessTime(
        at("2026-10-09T16:00:00.000Z"),
        at("2026-10-12T10:00:00.000Z"),
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ),
    ).toBe(2 * HOUR_MS);
  });

  it("no cuenta las horas de un festivo que cae en un día laborable", () => {
    expect(NATIONAL_DAY[0]?.date.toISOString()).toBe(
      "2026-10-12T00:00:00.000Z",
    );
    expect(
      calculateBusinessTime(
        at("2026-10-12T09:00:00.000Z"),
        at("2026-10-12T17:00:00.000Z"),
        WEEKDAY_HOURS,
        NATIONAL_DAY,
        "UTC",
      ),
    ).toBe(0);
  });

  it("excluye el festivo cuando el intervalo abarca varios días", () => {
    expect(
      calculateBusinessTime(
        at("2026-10-09T16:00:00.000Z"),
        at("2026-10-13T10:00:00.000Z"),
        WEEKDAY_HOURS,
        NATIONAL_DAY,
        "UTC",
      ),
    ).toBe(2 * HOUR_MS);
  });

  it("funciona cuando no hay festivos", () => {
    expect(
      calculateBusinessTime(
        at("2026-10-09T16:00:00.000Z"),
        at("2026-10-13T10:00:00.000Z"),
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ),
    ).toBe(10 * HOUR_MS);
  });

  it("cuenta 120 minutos de viernes 16:00 a martes 10:00 en Europe/Andorra con el lunes festivo", () => {
    expect(
      calculateBusinessTime(
        at("2026-10-09T14:00:00.000Z"),
        at("2026-10-13T08:00:00.000Z"),
        WEEKDAY_HOURS,
        NATIONAL_DAY,
        "Europe/Andorra",
      ),
    ).toBe(120 * MINUTE_MS);
  });

  it("interpreta el festivo como fecha civil aunque la medianoche UTC sea otro día local", () => {
    const earlyMonday: SlaBusinessHourForCalculation[] = [
      { dayOfWeek: 1, startTime: "00:00", endTime: "01:00" },
    ];

    expect(
      calculateBusinessTime(
        at("2026-10-11T21:00:00.000Z"),
        at("2026-10-11T23:30:00.000Z"),
        earlyMonday,
        NATIONAL_DAY,
        "Europe/Andorra",
      ),
    ).toBe(0);
    expect(
      calculateBusinessTime(
        at("2026-10-11T21:00:00.000Z"),
        at("2026-10-11T23:30:00.000Z"),
        earlyMonday,
        NO_HOLIDAYS,
        "Europe/Andorra",
      ),
    ).toBe(HOUR_MS);
  });

  it("excluye por completo el lunes 12 de octubre en Europe/Andorra", () => {
    expect(
      calculateBusinessTime(
        at("2026-10-12T07:00:00.000Z"),
        at("2026-10-12T15:00:00.000Z"),
        WEEKDAY_HOURS,
        NATIONAL_DAY,
        "Europe/Andorra",
      ),
    ).toBe(0);
  });
});

describe("addBusinessTime", () => {
  it("devuelve la fecha inicial cuando los minutos son cero o negativos", () => {
    const start = at("2026-10-05T10:00:00.000Z");

    expect(
      addBusinessTime(start, 0, WEEKDAY_HOURS, NO_HOLIDAYS, "UTC").getTime(),
    ).toBe(start.getTime());
    expect(
      addBusinessTime(start, -30, WEEKDAY_HOURS, NO_HOLIDAYS, "UTC").getTime(),
    ).toBe(start.getTime());
  });

  it("añade minutos sin superar el horario laboral", () => {
    expect(
      addBusinessTime(
        at("2026-10-05T10:00:00.000Z"),
        30,
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ).toISOString(),
    ).toBe("2026-10-05T10:30:00.000Z");
  });

  it("continúa el siguiente día laborable cuando se agotan las horas del día", () => {
    expect(
      addBusinessTime(
        at("2026-10-05T16:00:00.000Z"),
        120,
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ).toISOString(),
    ).toBe("2026-10-06T10:00:00.000Z");
  });

  it("omite los fines de semana", () => {
    expect(
      addBusinessTime(
        at("2026-10-09T16:00:00.000Z"),
        120,
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ).toISOString(),
    ).toBe("2026-10-12T10:00:00.000Z");
  });

  it("omite el festivo y continúa en el siguiente periodo laborable", () => {
    expect(
      addBusinessTime(
        at("2026-10-09T16:00:00.000Z"),
        120,
        WEEKDAY_HOURS,
        NATIONAL_DAY,
        "UTC",
      ).toISOString(),
    ).toBe("2026-10-13T10:00:00.000Z");
  });

  it("empieza en la apertura cuando el instante es anterior", () => {
    expect(
      addBusinessTime(
        at("2026-10-05T08:00:00.000Z"),
        60,
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ).toISOString(),
    ).toBe("2026-10-05T10:00:00.000Z");
  });

  it("pasa al siguiente día laborable cuando el instante es posterior al cierre", () => {
    expect(
      addBusinessTime(
        at("2026-10-05T18:00:00.000Z"),
        60,
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ).toISOString(),
    ).toBe("2026-10-06T10:00:00.000Z");
  });

  it("al añadir 120 minutos al viernes 16:00 de Andorra llega al martes 10:00", () => {
    expect(
      addBusinessTime(
        at("2026-10-09T14:00:00.000Z"),
        120,
        WEEKDAY_HOURS,
        NATIONAL_DAY,
        "Europe/Andorra",
      ).toISOString(),
    ).toBe("2026-10-13T08:00:00.000Z");
  });
});

describe("calculateElapsedWorkTime", () => {
  it("calcula el tiempo laborable transcurrido", () => {
    expect(
      calculateElapsedWorkTime(
        at("2026-10-05T10:00:00.000Z"),
        at("2026-10-05T12:00:00.000Z"),
        NO_PAUSES,
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ),
    ).toBe(2 * HOUR_MS);
  });

  it("descuenta la pausa solo durante las horas laborables", () => {
    expect(
      calculateElapsedWorkTime(
        at("2026-10-05T09:00:00.000Z"),
        at("2026-10-05T17:00:00.000Z"),
        [
          {
            startedAt: at("2026-10-05T08:00:00.000Z"),
            endedAt: at("2026-10-05T10:00:00.000Z"),
          },
        ],
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ),
    ).toBe(7 * HOUR_MS);
  });

  it("no descuenta dos veces un festivo incluido en la pausa", () => {
    // Viernes 8 h + martes 8 h = 16 h. La pausa laborable es 2 h
    // (viernes 16:00–17:00 y martes 09:00–10:00). El lunes festivo vale 0
    // tanto en el total como en la pausa.
    expect(
      calculateElapsedWorkTime(
        at("2026-10-09T09:00:00.000Z"),
        at("2026-10-13T17:00:00.000Z"),
        [
          {
            startedAt: at("2026-10-09T16:00:00.000Z"),
            endedAt: at("2026-10-13T10:00:00.000Z"),
          },
        ],
        WEEKDAY_HOURS,
        NATIONAL_DAY,
        "UTC",
      ),
    ).toBe(14 * HOUR_MS);
  });

  it("cierra una pausa abierta con now", () => {
    expect(
      calculateElapsedWorkTime(
        at("2026-10-05T09:00:00.000Z"),
        at("2026-10-05T14:00:00.000Z"),
        [
          {
            startedAt: at("2026-10-05T12:00:00.000Z"),
            endedAt: null,
          },
        ],
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ),
    ).toBe(3 * HOUR_MS);
  });

  it("nunca devuelve un valor negativo", () => {
    expect(
      calculateElapsedWorkTime(
        at("2026-10-05T10:00:00.000Z"),
        at("2026-10-05T12:00:00.000Z"),
        [
          {
            startedAt: at("2026-10-05T09:00:00.000Z"),
            endedAt: at("2026-10-05T17:00:00.000Z"),
          },
        ],
        WEEKDAY_HOURS,
        NO_HOLIDAYS,
        "UTC",
      ),
    ).toBe(0);
  });

  it("no cuenta festivos ni fines de semana en el tiempo transcurrido", () => {
    expect(
      calculateElapsedWorkTime(
        at("2026-10-09T14:00:00.000Z"),
        at("2026-10-13T08:00:00.000Z"),
        NO_PAUSES,
        WEEKDAY_HOURS,
        NATIONAL_DAY,
        "Europe/Andorra",
      ),
    ).toBe(120 * MINUTE_MS);
  });
});

describe("zona horaria del calendario", () => {
  const start = at("2026-10-09T14:00:00.000Z");
  const end = at("2026-10-13T08:00:00.000Z");

  it("los mismos instantes valen 120 minutos en Europe/Andorra y 180 en UTC", () => {
    expect(
      calculateBusinessTime(start, end, WEEKDAY_HOURS, NATIONAL_DAY, "UTC"),
    ).toBe(180 * MINUTE_MS);
    expect(
      calculateBusinessTime(
        start,
        end,
        WEEKDAY_HOURS,
        NATIONAL_DAY,
        "Europe/Andorra",
      ),
    ).toBe(120 * MINUTE_MS);
  });

  it("adelanta una hora inexistente hasta el primer instante válido", () => {
    const springForwardHours: SlaBusinessHourForCalculation[] = [
      { dayOfWeek: 7, startTime: "02:00", endTime: "04:00" },
    ];

    expect(
      calculateBusinessTime(
        at("2026-03-29T00:00:00.000Z"),
        at("2026-03-29T04:00:00.000Z"),
        springForwardHours,
        NO_HOLIDAYS,
        "Europe/Andorra",
      ),
    ).toBe(HOUR_MS);
  });

  it("en una hora ambigua usa el instante anterior al cambio", () => {
    const fallBackHours: SlaBusinessHourForCalculation[] = [
      { dayOfWeek: 7, startTime: "02:00", endTime: "03:00" },
    ];

    expect(
      calculateBusinessTime(
        at("2026-10-24T22:00:00.000Z"),
        at("2026-10-25T04:00:00.000Z"),
        fallBackHours,
        NO_HOLIDAYS,
        "Europe/Andorra",
      ),
    ).toBe(2 * HOUR_MS);
  });
});

describe("calculateSlaDueDates", () => {
  it("aplica el horario, los festivos y la zona del calendario de la política", () => {
    const due = calculateSlaDueDates(
      {
        id: "policy-andorra",
        priority: "MEDIUM",
        firstResponseMinutes: 120,
        resolutionMinutes: 120,
      },
      at("2026-10-09T14:00:00.000Z"),
      WEEKDAY_HOURS,
      NATIONAL_DAY,
      "Europe/Andorra",
    );

    expect(due.firstResponseDueAt.toISOString()).toBe(
      "2026-10-13T08:00:00.000Z",
    );
    expect(due.resolutionDueAt.toISOString()).toBe("2026-10-13T08:00:00.000Z");
  });

  it("suma minutos continuos cuando la política no tiene horario laboral", () => {
    const due = calculateSlaDueDates(
      {
        id: "policy-24-7",
        priority: "LOW",
        firstResponseMinutes: 120,
        resolutionMinutes: 240,
      },
      at("2026-10-09T14:00:00.000Z"),
      [],
      NATIONAL_DAY,
      "Europe/Andorra",
    );

    expect(due.firstResponseDueAt.toISOString()).toBe(
      "2026-10-09T16:00:00.000Z",
    );
    expect(due.resolutionDueAt.toISOString()).toBe("2026-10-09T18:00:00.000Z");
  });
});
