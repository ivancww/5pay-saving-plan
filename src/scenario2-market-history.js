import { normalizeMoneyValue } from './money.js';

// Static, reviewed Scenario 2 reference data. Customer runtime has no finance API dependency.
// Each series is a reviewed annual reference snapshot normalized to its first point = 100.
// 2800.HK is explicitly derived from published annual price-return percentages.
// They are educational references, not investable recommendations or forecasts.
export const SCENARIO2_MARKET_HISTORY = Object.freeze({
  hsi: Object.freeze({
    id: 'hsi',
    label: '香港 · 恒生指數',
    shortLabel: '恒生指數',
    kind: 'index',
    market: 'Hong Kong',
    rawDataType: 'annual index closing level',
    displayBasis: 'price index; dividends excluded',
    basis: 'price index; dividends excluded',
    primarySource: { name: 'Hang Seng Indexes Company', url: 'https://www.hsi.com.hk/eng/indexes/all-indexes/hs' },
    secondarySource: { name: 'DataCedar annual close table', url: 'https://datacedar.com/markets/hkex/hsi' },
    sourceName: 'Hang Seng Indexes Company',
    sourceUrl: 'https://www.hsi.com.hk/eng/indexes/all-indexes/hs',
    dataThroughDate: '2025-12-31',
    verifiedAt: '2026-10-13',
    observations: [
      ['2016', 22000.56], ['2017', 29919.15], ['2018', 25845.70],
      ['2019', 28189.75], ['2020', 27231.13], ['2021', 23397.67],
      ['2022', 19781.41], ['2023', 17047.40], ['2024', 20059.96],
      ['2025', 25630.55]
    ]
  }),
  sp500: Object.freeze({
    id: 'sp500',
    label: '美國 · S&P 500',
    shortLabel: 'S&P 500',
    kind: 'index',
    market: 'United States',
    rawDataType: 'annual index closing level',
    displayBasis: 'price index; dividends excluded',
    basis: 'price index; dividends excluded',
    primarySource: { name: 'FRED SP500 series sourced from S&P data', url: 'https://fred.stlouisfed.org/series/SP500' },
    secondarySource: { name: 'S&P Dow Jones Indices', url: 'https://www.spglobal.com/spdji/en/indices/equity/sp-500/' },
    sourceName: 'FRED SP500 series sourced from S&P data',
    sourceUrl: 'https://fred.stlouisfed.org/series/SP500',
    dataThroughDate: '2025-12-31',
    verifiedAt: '2026-10-13',
    observations: [
      ['2016', 2238.83], ['2017', 2673.61], ['2018', 2506.85],
      ['2019', 3230.78], ['2020', 3756.07], ['2021', 4766.18],
      ['2022', 3839.50], ['2023', 4769.83], ['2024', 5881.63],
      ['2025', 6845.50]
    ]
  }),
  tracker2800: Object.freeze({
    id: 'tracker2800',
    label: '香港代表例子 · 2800.HK',
    shortLabel: '2800.HK',
    kind: 'etf',
    market: 'Hong Kong',
    rawDataType: 'derived normalized cumulative series from annual price-return percentages',
    displayBasis: 'price return; distributions excluded',
    basis: 'normalized cumulative price-return series; 2016 baseline = 100; distributions excluded',
    primarySource: { name: 'POEMS annual price-return table for 2800', url: 'https://www.poems.com.sg/etf-screener/HKEX-2800/' },
    secondarySource: { name: 'Tracker Fund of Hong Kong fund information', url: 'https://www.trahk.com.hk/en-hk/trahk-fund/fund-information/' },
    sourceName: 'POEMS annual price-return table for 2800',
    sourceUrl: 'https://www.poems.com.sg/etf-screener/HKEX-2800/',
    dataThroughDate: '2025-12-31',
    verifiedAt: '2026-10-13',
    observations: [
      ['2016', 100], ['2017', 140.5234], ['2018', 125.8990],
      ['2019', 141.9186], ['2020', 141.2483], ['2021', 124.4261],
      ['2022', 109.6317], ['2023', 98.1942], ['2024', 119.8279],
      ['2025', 158.0168]
    ]
  }),
  spy: Object.freeze({
    id: 'spy',
    label: '美國代表例子 · SPY',
    shortLabel: 'SPY',
    kind: 'etf',
    market: 'United States',
    rawDataType: 'annual OHLC close field',
    displayBasis: 'unadjusted market close; distributions excluded',
    basis: 'unadjusted market close; distributions excluded',
    primarySource: { name: 'Kabutan US annual OHLC history for SPY', url: 'https://us.kabutan.jp/stocks/SPY/historical_prices/yearly' },
    secondarySource: { name: 'TradersUnion SPY annual price history', url: 'https://tradersunion.com/etfs/spy/price-history/' },
    sourceName: 'Kabutan US annual OHLC history for SPY',
    sourceUrl: 'https://us.kabutan.jp/stocks/SPY/historical_prices/yearly',
    instrumentSource: { name: 'State Street SPDR', url: 'https://www.ssga.com/us/en/intermediary/etfs/spdr-sp-500-etf-trust-spy' },
    dataThroughDate: '2025-12-31',
    verifiedAt: '2026-10-13',
    observations: [
      ['2016', 223.53], ['2017', 266.86], ['2018', 249.92],
      ['2019', 321.86], ['2020', 373.88], ['2021', 476.16],
      ['2022', 382.43], ['2023', 475.31], ['2024', 586.10],
      ['2025', 678.316]
    ]
  })
});

export function marketHistoryKeys({ stocks = false, etfs = false } = {}) {
  return [
    ...(stocks ? ['hsi', 'sp500'] : []),
    ...(etfs ? ['tracker2800', 'spy'] : [])
  ];
}

export function normalizedMarketSeries(key) {
  const series = SCENARIO2_MARKET_HISTORY[key];
  if (!series) return null;
  const first = Number(series.observations[0]?.[1]);
  if (!Number.isFinite(first) || first <= 0) return null;
  const observations = series.observations
    .map(([year, value]) => ({ year, value: Number(value), normalized: Number(value) / first * 100 }))
    .filter(item => Number.isFinite(item.value) && Number.isFinite(item.normalized));
  return observations.length === series.observations.length ? { ...series, observations } : null;
}


export function simulateMarketHistory({ seriesKey, principal, startYear, endYear } = {}) {
  const amount = normalizeMoneyValue(principal);
  const series = normalizedMarketSeries(seriesKey);
  const start = series?.observations.find(item => item.year === String(startYear));
  const end = series?.observations.find(item => item.year === String(endYear));
  if (amount == null || amount <= 0) return { available: false, reason: 'principal' };
  if (!start || !end || Number(end.year) <= Number(start.year)) return { available: false, reason: 'years' };
  const historicalChange = end.normalized / start.normalized;
  if (!Number.isFinite(historicalChange)) return { available: false, reason: 'data' };
  const simulatedValue = amount * historicalChange;
  return {
    available: true,
    seriesKey,
    startYear: start.year,
    endYear: end.year,
    principal: amount,
    startValue: start.value,
    endValue: end.value,
    historicalChange,
    simulatedValue,
    profitLoss: simulatedValue - amount,
    returnPercent: (historicalChange - 1) * 100,
    displayBasis: series.displayBasis,
    dataThroughDate: series.dataThroughDate,
    verifiedAt: series.verifiedAt
  };
}
