export function resolveWatchlist({ watchlists, market, serverWatchlist }) {
  const localWatchlist = watchlists?.[market] || [];
  if (Array.isArray(serverWatchlist) && serverWatchlist.length > 0) {
    return serverWatchlist;
  }
  return localWatchlist;
}
