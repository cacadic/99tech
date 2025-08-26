import type { JSX } from "react";

export type PriceData = {
  currency: string;
  date: string;
  price: number;
  icon?: JSX.Element;
};

export type PricesResponse = PriceData[];
