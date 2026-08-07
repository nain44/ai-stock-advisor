const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveWatchlist } = require('../components/watchlistSync');

test('prefers the server watchlist when admin updates it', () => {
  const result = resolveWatchlist({
    watchlists: { PK: ['OLD', 'TICKER'] },
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
