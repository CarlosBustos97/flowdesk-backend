export type SlaHolidayListParams = {
  id: string;
};

export type SlaHolidayCreateParams = {
  id: string;
};

export type SlaHolidayCreateBody = {
  date: string;
  name: string;
};

export type SlaHolidayDeleteParams = {
  id: string;
  holidayId: string;
};
