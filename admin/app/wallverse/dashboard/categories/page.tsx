'use client';
import { useEffect, useState, FormEvent } from 'react';
import { categoryApi } from '@/lib/wallverse-api';
import '../../wallverse.css';

interface Category {
  _id: string;
  name: string;
  slug: string;
  icon: string;
  wallpaperCount: number;
  isActive: boolean;
  order: number;
}

const DEFAULT_ICONS = ['🌿','🌌','🏙️','🚗','🎨','🔥','🌊','🏔️','🌸','🦋','🎭','🎵','☀️','🌙','❄️','🐾'];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', slug: '', icon: '🖼️', description: '', order: '0' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function load() {
    categoryApi.list().then(setCategories).catch(console.error).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      await categoryApi.create({ ...form, order: Number(form.order) });
      setMsg({ type: 'success', text: `Category "${form.name}" created!` });
      setForm({ name: '', slug: '', icon: '🖼️', description: '', order: '0' });
      load();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Deactivate category "${name}"?`)) return;
    try {
      await categoryApi.delete(id);
      load();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  return (
    <div className="wallverse-theme">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700 }}>Categories</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Organize your wallpapers into categories.</p>
      </div>

      {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', alignItems: 'start' }}>
        {/* Create Form */}
        <div className="card">
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>New Category</h2>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>Icon</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                {DEFAULT_ICONS.map(icon => (
                  <button type="button" key={icon}
                    onClick={() => setForm(f => ({ ...f, icon }))}
                    style={{
                      width: '36px', height: '36px', fontSize: '20px',
                      background: form.icon === icon ? 'var(--accent-glow)' : 'var(--surface2)',
                      border: `1px solid ${form.icon === icon ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: '8px', cursor: 'pointer',
                    }}
                  >{icon}</button>
                ))}
              </div>
              <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="Or type emoji" style={{ width: '80px' }} />
            </div>
            <div className="form-group">
              <label>Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: autoSlug(e.target.value) }))}
                placeholder="e.g. Nature"
                required
              />
            </div>
            <div className="form-group">
              <label>Slug</label>
              <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="auto-generated" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="form-group">
              <label>Order (lower = first)</label>
              <input type="number" value={form.order} onChange={e => setForm(f => ({ ...f, order: e.target.value }))} min="0" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ justifyContent: 'center' }}>
              {submitting ? <span className="spinner" /> : '+ Create Category'}
            </button>
          </form>
        </div>

        {/* Category List */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Wallpapers</th>
                <th>Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
              ) : categories.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No categories yet. Create one!</td></tr>
              ) : categories.map(cat => (
                <tr key={cat._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '22px' }}>{cat.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{cat.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/{cat.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{cat.wallpaperCount}</td>
                  <td style={{ fontFamily: 'monospace', color: '#a78bfa' }}>{cat.order}</td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cat._id, cat.name)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
