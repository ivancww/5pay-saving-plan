export const MARKET_DATA = Object.freeze({
  hsi: Object.freeze({
    key: 'hsi',
    label: '港股 · 恒生指數',
    shortLabel: '港股',
    symbol: '^HSI',
    convention: 'price_close',
    conventionLabel: '價格指數年末收市價，不含股息',
    source: 'Yahoo Finance Historical Data (^HSI); cross-checked against HKEX Fact Book / Hang Seng Indexes annual materials',
    sourceUrl: 'https://hk.finance.yahoo.com/quote/%5EHSI/history/',
    retrievedOn: '2026-10-13',
    points: Object.freeze([
      { year: 2016, value: 22000.56 },
      { year: 2017, value: 29919.15 },
      { year: 2018, value: 25845.70 },
      { year: 2019, value: 28189.75 },
      { year: 2020, value: 27231.13 },
      { year: 2021, value: 23397.67 },
      { year: 2022, value: 19781.41 },
      { year: 2023, value: 17047.39 },
      { year: 2024, value: 20059.95 },
      { year: 2025, value: 25630.54 }
    ])
  }),
  sp500: Object.freeze({
    key: 'sp500',
    label: '美股 · S&P 500',
    shortLabel: '美股',
    symbol: '^GSPC',
    convention: 'price_close',
    conventionLabel: '價格指數年末收市價，不含股息',
    source: 'Yahoo Finance Historical Data (^GSPC); cross-checked against FRED / NYU Stern annual close records',
    sourceUrl: 'https://finance.yahoo.com/quote/%5EGSPC/history/',
    retrievedOn: '2026-10-13',
    points: Object.freeze([
      { year: 2016, value: 2238.83 },
      { year: 2017, value: 2673.61 },
      { year: 2018, value: 2506.85 },
      { year: 2019, value: 3230.78 },
      { year: 2020, value: 3756.07 },
      { year: 2021, value: 4766.18 },
      { year: 2022, value: 3839.50 },
      { year: 2023, value: 4769.83 },
      { year: 2024, value: 5881.63 },
      { year: 2025, value: 6845.50 }
    ])
  })
});

export function getMarketData(benchmark = 'hsi') {
  return MARKET_DATA[benchmark] || MARKET_DATA.hsi;
}

export function simulateHistoricalInvestment({
  benchmark = 'hsi',
  initialInvestment = 0,
  regularInvestment = 0,
  durationYears = 0,
  exitYear
} = {}) {
  const dataset = getMarketData(benchmark);
  const initial = Math.max(0, Number(initialInvestment) || 0);
  const regular = Math.max(0, Number(regularInvestment) || 0);
  const duration = Math.max(0, Math.min(Math.floor(Number(durationYears) || 0), dataset.points.length - 1));
  const requestedExit = Number(exitYear);
  const exitIndex = Number.isFinite(requestedExit)
    ? Math.max(0, dataset.points.findIndex(point => point.year === requestedExit))
    : dataset.points.length - 1;
  const endIndex = exitIndex < 0 ? dataset.points.length - 1 : exitIndex;
  let value = initial;
  let totalInvested = initial;
  for (let index = 1; index <= endIndex; index += 1) {
    value *= dataset.points[index].value / dataset.points[index - 1].value;
    if (index <= duration) {
      value += regular;
      totalInvested += regular;
    }
  }
  const selected = dataset.points[endIndex];
  const gain = value - totalInvested;
  return {
    benchmark: dataset.key,
    startYear: dataset.points[0].year,
    exitYear: selected.year,
    durationYears: duration,
    totalInvested,
    finalValue: value,
    gain,
    gainPercent: totalInvested > 0 ? gain / totalInvested : null
  };
}
