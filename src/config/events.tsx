// date format: d MMM yyyy, H:mm, time should be specifed based on UTC time

import { type JSX } from "react";

export type EventData = {
  id: string;
  title: string;
  isActive?: boolean;
  startDate?: string;
  endDate: string;
  bodyText: string | string[] | JSX.Element;
  chains?: number[];
  link?: {
    text: string;
    href: string;
    /**
     * @default false
     */
    newTab?: boolean;
  };
};

export const homeEventsData: EventData[] = [];

export const MKR_USD_DELISTING_EVENT_ID = "mkr-usd-delisting";

// TODO: Add 0xMarkets events as they occur
export const appEventsData: EventData[] = [];
