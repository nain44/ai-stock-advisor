'use client';
import { useState, useEffect, FormEvent, useRef } from 'react';
import { wallpaperApi, categoryApi } from '@/lib/wallverse-api';
import '../../wallverse.css';

interface Category { _id: string; name: string; }

export default function UploadPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    title: '', description: '', category: '', tags: '',
    isPremium: 'false', resolution: 'FHD', source: 'own',
    photographer: '', photographerUrl: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    categoryApi.list().then(setCategories).catch(console.error);
  }, []);

  function handleFile(f: File) {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
  }

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return setMsg({ type: 'error', text: 'Please select an image file.' });
    if (!form.category) return setMsg({ type: 'error', text: 'Please select a category.' });
    setLoading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      await wallpaperApi.upload(fd);
      setMsg({ type: 'success', text: '✅ Wallpaper uploaded successfully!' });
      setFile(null);
      setPreview(null);
      setForm({ title: '', description: '', category: '', tags: '', isPremium: 'false', resolution: 'FHD', source: 'own', photographer: '', photographerUrl: '' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Upload failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wallverse-theme">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700 }}>Upload Wallpaper</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Add a new wallpaper to your collection.</p>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', alignItems: 'start' }}>
        {/* Image Area */}
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              background: dragging ? 'var(--accent-glow)' : 'var(--surface2)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              overflow: 'hidden',
              minHeight: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {preview ? (
              <img src={preview} alt="Preview" style={{ width: '100%', objectFit: 'contain', maxHeight: '500px' }} />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🖼️</div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>Drag & drop or click to upload</div>
                <div style={{ fontSize: '13px', marginTop: '6px' }}>JPG, PNG, WebP — max 30 MB</div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {file && (
            <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
              📎 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
        </div>

        {/* Metadata Form */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="form-group">
            <label>Title *</label>
            <input value={form.title} onChange={e => setField('title', e.target.value)} placeholder="e.g. Purple Galaxy 4K" required />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Optional short description..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Category *</label>
              <select value={form.category} onChange={e => setField('category', e.target.value)} required>
                <option value="">Select category</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Resolution</label>
              <select value={form.resolution} onChange={e => setField('resolution', e.target.value)}>
                {['SD','HD','FHD','4K','8K'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Tags (comma-separated)</label>
            <input value={form.tags} onChange={e => setField('tags', e.target.value)} placeholder="nature, mountain, dark, aesthetic" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Source</label>
              <select value={form.source} onChange={e => setField('source', e.target.value)}>
                <option value="own">Own Upload</option>
                <option value="pexels">Pexels</option>
                <option value="unsplash">Unsplash</option>
              </select>
            </div>
            <div className="form-group">
              <label>Access</label>
              <select value={form.isPremium} onChange={e => setField('isPremium', e.target.value)}>
                <option value="false">Free</option>
                <option value="true">Premium</option>
              </select>
            </div>
          </div>
          {form.source !== 'own' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Photographer Name</label>
                <input value={form.photographer} onChange={e => setField('photographer', e.target.value)} placeholder="John Doe" />
              </div>
              <div className="form-group">
                <label>Photographer URL</label>
                <input value={form.photographerUrl} onChange={e => setField('photographerUrl', e.target.value)} placeholder="https://pexels.com/@johndoe" />
              </div>
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: 'center', padding: '13px', marginTop: '4px' }}>
            {loading ? <><span className="spinner" /> Uploading...</> : '⬆️ Upload Wallpaper'}
          </button>
        </div>
      </form>
    </div>
  );
}
