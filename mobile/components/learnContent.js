// Plain-language explanations shown by <LearnTooltip>. Keep each body short
// enough to read in a small popover — a sentence or two, not a lesson.
export const LEARN_CONTENT = {
  RSI: {
    title: 'RSI (Relative Strength Index)',
    body: 'Measures how fast and how much a price has moved recently, on a scale of 0-100. Above 70 is often considered "overbought" (may be due for a pullback); below 30 is "oversold" (may be due for a bounce).',
  },
  MACD: {
    title: 'MACD',
    body: 'Compares two moving averages of the price to spot momentum shifts. When the MACD line crosses above its signal line, that\'s often read as a bullish signal; crossing below is often read as bearish.',
  },
  BOLLINGER: {
    title: 'Bollinger Bands',
    body: 'A band drawn around the average price, based on how much the price has recently swung. Prices near the upper band are relatively high versus recent history; near the lower band, relatively low.',
  },
  PE_RATIO: {
    title: 'P/E Ratio (Price-to-Earnings)',
    body: 'Share price divided by earnings per share. Roughly: how many years of current profit it would take to "pay back" the stock price. A higher P/E means investors are paying more per dollar of profit — often because they expect faster growth.',
  },
  PB_RATIO: {
    title: 'P/B Ratio (Price-to-Book)',
    body: 'Share price divided by the company\'s book value (assets minus liabilities) per share. A ratio near or below 1 can mean the stock is priced close to the company\'s net worth; higher ratios mean the market values it well above that.',
  },
  ROE: {
    title: 'ROE (Return on Equity)',
    body: 'How much profit a company generates per dollar of shareholders\' equity, as a percentage. Higher ROE generally means the company is using investors\' money more efficiently to produce profit.',
  },
  DIV_YIELD: {
    title: 'Dividend Yield',
    body: 'Annual dividend payments divided by the current share price, as a percentage. It\'s the cash return you\'d get from dividends alone, before any change in the stock price.',
  },
  DEBT_EQUITY: {
    title: 'Debt/Equity Ratio',
    body: 'Total debt divided by shareholders\' equity. A higher ratio means the company relies more on borrowed money relative to its own capital, which can mean higher risk but also faster growth.',
  },
  AVG_VOLUME: {
    title: 'Average Volume',
    body: 'The typical number of shares traded per day. Higher volume usually means it\'s easier to buy or sell without moving the price much.',
  },
};
