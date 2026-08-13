const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveWatchlist } = require('../components/watchlistSync');

test('uses the local watchlist once the user has customized it, even if the server watchlist changes', () => {
  const result = resolveWatchlist({
    watchlists: { PK: ['OLD', 'TICKER'] },
    market: 'PK',
    serverWatchlist: ['NEW', 'TICKERS']
  });

  assert.deepEqual(result, ['OLD', 'TICKER']);
});

test('uses the server watchlist as the default when the user has not customized it yet', () => {
  const result = resolveWatchlist({
    watchlists: {},
    market: 'PK',
    serverWatchlist: ['NEW', 'TICKERS']
  });

  assert.deepEqual(result, ['NEW', 'TICKERS']);
});

test('falls back to the local watchlist when no server watchlist exists', () => {
  const result = resolveWatchlist({
    watchlists: { PK: ['LOCAL', 'TICKER'] },
    market: 'PK',
    serverWatchlist: []
  });

  assert.deepEqual(result, ['LOCAL', 'TICKER']);
});
