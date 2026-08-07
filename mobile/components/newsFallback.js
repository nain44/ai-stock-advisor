const FALLBACK_NEWS_BY_MARKET = {
  PK: [
    {
      title: 'Pakistan markets are watching policy, earnings, and liquidity signals closely.',
      link: '#',
      pub_date: 'Today',
      source: 'Market Pulse',
      sentiment: 'neutral',
    },
    {
      title: 'PSX buyers remain focused on sector rotation and dividend-led defensive names.',
      link: '#',
      pub_date: 'Today',
      source: 'Market Pulse',
      sentiment: 'bullish',
    },
  ],
  US: [
    {
      title: 'US equities are tracking earnings, rate expectations, and macro data.',
      link: '#',
      pub_date: 'Today',
      source: 'Market Pulse',
      sentiment: 'neutral',
    },
    {
      title: 'Momentum remains constructive as traders monitor key earnings and inflation signals.',
      link: '#',
      pub_date: 'Today',
      source: 'Market Pulse',
      sentiment: 'bullish',
    },
  ],
  IN: [
    {
      title: 'Indian markets remain attentive to global cues and domestic earnings momentum.',
      link: '#',
      pub_date: 'Today',
      source: 'Market Pulse',
      sentiment: 'neutral',
    },
    {
      title: 'NSE-led buying interest remains supported by strong sector participation.',
      link: '#',
      pub_date: 'Today',
      source: 'Market Pulse',
      sentiment: 'bullish',
    },
  ],
  UK: [
    {
      title: 'UK markets are assessing earnings, rates, and global sentiment.',
      link: '#',
      pub_date: 'Today',
      source: 'Market Pulse',
      sentiment: 'neutral',
    },
  ],
  CA: [
    {
      title: 'Canadian equities are monitoring commodity and bank earnings trends.',
      link: '#',
      pub_date: 'Today',
      source: 'Market Pulse',
      sentiment: 'neutral',
    },
  ],
};

export function getFallbackNews(market = 'PK') {
  const key = (market || 'PK').toUpperCase();
  return FALLBACK_NEWS_BY_MARKET[key] || FALLBACK_NEWS_BY_MARKET.PK;
}

export function resolveNewsItems(data, market = 'PK') {
  if (Array.isArray(data) && data.length > 0) {
    return data;
  }

  if (data && typeof data === 'object') {
    if (Array.isArray(data.news) && data.news.length > 0) {
      return data.news;
    }
    if (Array.isArray(data.items) && data.items.length > 0) {
      return data.items;
    }
  }

  return getFallbackNews(market);
}
