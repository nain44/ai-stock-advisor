'use client';
import { useEffect, useState } from 'react';
import { wallpaperApi } from '@/lib/wallverse-api';
import '../../wallverse.css';

interface Wallpaper {
  _id: string;
  title: string;
  thumbnailUrl: string;
  isPremium: boolean;
  downloadCount: number;
  resolution: string;
  source: string;
  category: { name: string };
  createdAt: string;
}

export default function WallpapersPage() {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function load(p = 1, q = '') {
    setLoading(true);
    try {
      const params: any = { page: p, limit: 15 };
      if (q) params.search = q;
      const data = await wallpaperApi.list(params);
      setWallpapers(data.wallpapers);
      setTotalPages(data.pagination.pages);
      setPage(p);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1, search); }, []);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await wallpaperApi.delete(id);
      setMsg({ type: 'success', text: 'Wallpaper deleted.' });
      load(page, search);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setDeleting(null);
    }
  }

  async function togglePremium(wp: Wallpaper) {
    try {
      await wallpaperApi.update(wp._id, { isPremium: !wp.isPremium });
      load(page, search);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  return (
    <div className="wallverse-theme">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700 }}>Wallpapers</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Manage your wallpaper collection.</p>
        </div>
        <a href="/wallverse/dashboard/upload" className="btn btn-primary">⬆️ Upload New</a>
      </div>

      {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

      {/* Search */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
        <input
          style={{ maxWidth: '320px' }}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search by title or tag..."
          onKeyDown={e => e.key === 'Enter' && load(1, search)}
        />
        <button className="btn btn-ghost btn-sm" onClick={() => load(1, search)}>Search</button>
        {search && <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); load(1, ''); }}>Clear</button>}
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Wallpaper</th>
              <th>Category</th>
              <th>Resolution</th>
              <th>Downloads</th>
              <th>Access</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
            ) : wallpapers.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No wallpapers found.</td></tr>
            ) : wallpapers.map(wp => (
              <tr key={wp._id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '48px', height: '64px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)', position: 'relative' }}>
                      <img src={wp.thumbnailUrl} alt={wp.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{wp.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{wp.source}</div>
                    </div>
                  </div>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{wp.category?.name || '—'}</td>
                <td><span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#a78bfa' }}>{wp.resolution}</span></td>
                <td style={{ fontSize: '13px' }}>{wp.downloadCount.toLocaleString()}</td>
                <td>
                  <button
                    onClick={() => togglePremium(wp)}
                    className={`badge badge-${wp.isPremium ? 'premium' : 'free'}`}
                    style={{ cursor: 'pointer', background: 'none' }}
                  >
                    {wp.isPremium ? '⭐ Premium' : '🆓 Free'}
                  </button>
                </td>
                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {new Date(wp.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={deleting === wp._id}
                    onClick={() => handleDelete(wp._id, wp.title)}
                  >
                    {deleting === wp._id ? <span className="spinner" /> : '🗑️'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => load(page - 1, search)}>← Prev</button>
          <span style={{ padding: '6px 14px', fontSize: '13px', color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => load(page + 1, search)}>Next →</button>
        </div>
      )}
    </div>
  );
}
