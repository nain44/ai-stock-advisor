export function resolveWatchlist({ watchlists, market, serverWatchlist }) {
  const localWatchlist = watchlists?.[market];
  // Once the user has customized their watchlist for this market (added/removed
  // a stock), that local list is authoritative so those changes actually stick.
  if (Array.isArray(localWatchlist)) {
    return localWatchlist;
  }
  if (Array.isArray(serverWatchlist) && serverWatchlist.length > 0) {
    return serverWatchlist;
  }
  return [];
}
