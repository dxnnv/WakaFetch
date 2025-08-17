import { formatBundlePretty, formatMapPretty } from "./format.js";
import { type ApiTimeframe } from "../types.js";

export interface Formatters<Bundle, MapOut> {
  formatBundle: (b: any) => Bundle;
  formatMap: (m: Record<ApiTimeframe, any | null>) => MapOut;
  pick: (bundle: Bundle, stat?: string) => unknown;
}

export const RawFormatters: Formatters<any, Record<ApiTimeframe, any | null>> = {
  formatBundle: (b) => b,
  formatMap: (m) => m,
  pick: (bundle, stat) => {
    if (!stat) return bundle;
    return { timeframe: bundle.timeframe, fetchedAt: bundle.fetchedAt, [stat]: bundle[stat] };
  },
};

export const PrettyFormatters: Formatters<any, Record<ApiTimeframe, any | null>> = {
  formatBundle: (b) => formatBundlePretty(b),
  formatMap: (m) => formatMapPretty(m),
  pick: (bundle, stat) => {
    if (!stat) return bundle;
    return { timeframe: (bundle as any).timeframe, [stat]: (bundle as any)[stat] };
  },
};