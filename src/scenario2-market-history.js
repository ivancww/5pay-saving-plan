// Static, reviewed Scenario 2 reference data. Customer runtime has no finance API dependency.
// All series use annual year-end price observations normalized to the first point = 100.
// They are educational references, not investable recommendations or forecasts.
export const SCENARIO2_MARKET_HISTORY = Object.freeze({
  hsi: Object.freeze({
    id: 'hsi',
    label: '香港 · 恒生指數',
    shortLabel: '恒生指數',
    kind: 'index',
    market: 'Hong Kong',
    basis: 'price index level; dividends excluded',
    sourceName: 'Hang Seng Indexes Company; annual closes cross-checked with DataCedar',
    sourceUrl: 'https://www.hsi.com.hk/eng/indexes/all-indexes/hs',
    secondarySourceUrl: 'https://datacedar.com/markets/hkex/hsi',
    asOfDate: '2026-10-13',
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
    basis: 'price index level; dividends excluded',
    sourceName: 'S&P Dow Jones Indices via FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/SP500',
    secondarySourceUrl: 'https://www.spglobal.com/spdji/en/indices/equity/sp-500/',
    asOfDate: '2026-10-13',
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
    basis: 'price return; distributions excluded',
    sourceName: 'Tracker Fund of Hong Kong; annual price returns cross-checked with POEMS',
    sourceUrl: 'https://www.trahk.com.hk/en-hk/trahk-fund/fund-information/',
    secondarySourceUrl: 'https://www.poems.com.sg/etf-screener/HKEX-2800/',
    asOfDate: '2026-10-13',
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
    basis: 'unadjusted closing price; distributions excluded',
    sourceName: 'State Street SPDR; annual closes cross-checked with Macrotrends',
    sourceUrl: 'https://www.ssga.com/us/en/intermediary/etfs/spdr-sp-500-etf-trust-spy',
    secondarySourceUrl: 'https://www.macrotrends.net/stocks/charts/SPY/state-street-spdr-s-p-500-etf-trust/stock-price-history',
    asOfDate: '2026-10-13',
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
