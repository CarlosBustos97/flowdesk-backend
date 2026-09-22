export type SlaBusinessHourInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type SlaBusinessHoursUpdateBody = {
  businessHours: SlaBusinessHourInput[];
};

export type SlaBusinessHoursParams = {
  id: string;
};
