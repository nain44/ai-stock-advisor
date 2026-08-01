'use client';
import { useEffect, useState } from 'react';
import { wallpaperApi, categoryApi } from '@/lib/wallverse-api';
import '../wallverse.css';

interface Stats {
  total: number;
  free: number;
  premium: number;
  totalDownloads: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [categoryCount, setCategoryCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([wallpaperApi.stats(), categoryApi.list()])
      .then(([s, cats]) => {
        setStats(s);
        setCategoryCount(cats.length);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Total Wallpapers', value: stats?.total ?? 0, icon: '🖼️', color: '#7c3aed' },
    { label: 'Free Wallpapers', value: stats?.free ?? 0, icon: '🆓', color: '#10b981' },
    { label: 'Premium', value: stats?.premium ?? 0, icon: '⭐', color: '#f59e0b' },
    { label: 'Total Downloads', value: stats?.totalDownloads ?? 0, icon: '📥', color: '#3b82f6' },
    { label: 'Categories', value: categoryCount, icon: '📁', color: '#ec4899' },
  ];

  return (
    <div className="wallverse-theme">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Welcome back! Here's your WallVerse overview.</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="spinner" style={{ width: '40px', height: '40px' }} />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '40px',
          }}>
            {statCards.map((card) => (
              <div key={card.label} className="card" style={{ borderColor: `${card.color}30` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '24px' }}>{card.icon}</span>
                  <div style={{
                    width: '8px', height: '8px',
                    borderRadius: '50%',
                    background: card.color,
                    boxShadow: `0 0 8px ${card.color}`,
                  }} />
                </div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: card.color }}>
                  {card.value.toLocaleString()}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Quick Actions</h2>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a href="/wallverse/dashboard/upload" className="btn btn-primary">⬆️ Upload Wallpaper</a>
              <a href="/wallverse/dashboard/wallpapers" className="btn btn-ghost">🖼️ Manage Wallpapers</a>
              <a href="/wallverse/dashboard/categories" className="btn btn-ghost">📁 Manage Categories</a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
