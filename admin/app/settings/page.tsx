"use client";

import { useEffect, useState, useRef } from "react";
import { STOCK_API_BASE } from "@/lib/config";

interface SettingsData {
  has_gemini: boolean;
  has_openai: boolean;
  gemini_key_mask: string;
  openai_key_mask: string;
  use_test_ads: boolean;
}

interface LogEvent {
  timestamp: string;
  message: string;
}

export default function SystemSettings() {
  const [useTestAds, setUseTestAdsState] = useState(true);
  const [savingMobile, setSavingMobile] = useState(false);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [settingsRes, logsRes] = await Promise.all([
          fetch(`${STOCK_API_BASE}/api/settings`),
          fetch(`${STOCK_API_BASE}/api/admin/logs`)
        ]);
        if (settingsRes.ok && logsRes.ok) {
          const settingsData = await settingsRes.json();
          const logsData = await logsRes.json();
          setSettings(settingsData);
          setLogs(logsData);
          setUseTestAdsState(settingsData.use_test_ads);
        }
      } catch (err) {
        console.error("Error loading settings/logs:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Set up polling for logs every 4 seconds
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${STOCK_API_BASE}/api/admin/logs`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data);
        }
      } catch (err) {
        console.error("Polling logs failed:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll logs terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setToast(null);

    try {
      const res = await fetch(`${STOCK_API_BASE}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gemini_key: geminiKey || undefined,
          openai_key: openaiKey || undefined
        })
      });
      if (res.ok) {
        setToast({ type: "success", message: "API Keys updated successfully." });
        setGeminiKey("");
        setOpenaiKey("");
        // Reload settings
        const settingsRes = await fetch(`${STOCK_API_BASE}/api/settings`);
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setSettings(settingsData);
        }
      } else {
        const errData = await res.json();
        setToast({ type: "error", message: errData.detail || "Failed to update keys." });
      }
    } catch (err) {
      setToast({ type: "error", message: "Failed to connect to the backend server." });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMobileSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMobile(true);
    setToast(null);

    try {
      const res = await fetch(`${STOCK_API_BASE}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          use_test_ads: useTestAds
        })
      });
      if (res.ok) {
        setToast({ type: "success", message: "Mobile application settings updated successfully." });
        const settingsRes = await fetch(`${STOCK_API_BASE}/api/settings`);
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setSettings(settingsData);
          setUseTestAdsState(settingsData.use_test_ads);
        }
      } else {
        const errData = await res.json();
        setToast({ type: "error", message: errData.detail || "Failed to update mobile settings." });
      }
    } catch (err) {
      setToast({ type: "error", message: "Failed to connect to the backend server." });
    } finally {
      setSavingMobile(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading system configurations...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* API Key Vault */}
      <div className="panel" style={{ maxWidth: '800px' }}>
        <div className="panel-header">
          <h3 className="panel-title">LLM Credentials Vault</h3>
        </div>

        {toast && (
          <div style={{
            backgroundColor: toast.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
            color: toast.type === "success" ? "var(--success)" : "var(--error)",
            border: `1px solid ${toast.type === "success" ? "var(--success)" : "var(--error)"}`,
            borderRadius: "8px",
            padding: "12px 16px",
            fontSize: "14px",
            fontWeight: "500",
            marginBottom: "24px"
          }}>
            {toast.message}
          </div>
        )}

        <form onSubmit={handleSaveKeys}>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Google Gemini API Key</span>
              <span style={{ fontSize: '11px', fontWeight: 'normal', color: settings?.has_gemini ? 'var(--success)' : 'var(--text-muted)' }}>
                {settings?.has_gemini ? "✅ CONFIGURED (Masked)" : "❌ NOT CONFIGURED"}
              </span>
            </label>
            <input
              type="password"
              className="form-input"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder={settings?.has_gemini ? "•••••••••••••••••••••••• (Enter new key to update)" : "AIzaSy..."}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>OpenAI API Key (Fallback Engine)</span>
              <span style={{ fontSize: '11px', fontWeight: 'normal', color: settings?.has_openai ? 'var(--success)' : 'var(--text-muted)' }}>
                {settings?.has_openai ? "✅ CONFIGURED (Masked)" : "❌ NOT CONFIGURED"}
              </span>
            </label>
            <input
              type="password"
              className="form-input"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder={settings?.has_openai ? "•••••••••••••••••••••••• (Enter new key to update)" : "sk-proj-..."}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || (!geminiKey && !openaiKey)}
            >
              {saving ? "Updating Keys..." : "Update Secrets Vault"}
            </button>
          </div>
        </form>
      </div>

      {/* Mobile Application Settings */}
      <div className="panel" style={{ maxWidth: '800px' }}>
        <div className="panel-header">
          <h3 className="panel-title">Mobile Application Settings</h3>
        </div>

        <form onSubmit={handleSaveMobileSettings}>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>AdMob Monetization Mode</span>
              <span style={{ fontSize: '11px', fontWeight: 'normal', color: settings?.use_test_ads ? 'var(--text-muted)' : 'var(--success)' }}>
                {settings?.use_test_ads ? "⚠️ TEST MODE" : "🔥 PRODUCTION ACTIVE"}
              </span>
            </label>
            <select
              className="form-input"
              value={useTestAds ? "test" : "production"}
              onChange={(e) => setUseTestAdsState(e.target.value === "test")}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '10px 12px',
                width: '100%',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="test">Test Ads Mode (Use standard Google demo unit IDs)</option>
              <option value="production">Production Ads Mode (Use production AdMob unit IDs)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingMobile}
            >
              {savingMobile ? "Saving Settings..." : "Save Mobile Settings"}
            </button>
          </div>
        </form>
      </div>

      {/* System Logs Console */}
      <div className="panel" style={{ maxWidth: '800px' }}>
        <div className="panel-header">
          <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="status-dot active" style={{ width: '10px', height: '10px' }}></span>
            Real-Time System Log Feed
          </h3>
        </div>

        <div className="terminal" ref={terminalRef}>
          {logs.length === 0 ? (
            <div className="terminal-line" style={{ color: 'var(--text-muted)' }}>
              <span>[SYSTEM LOGS STATE: NO EVENTS DETECTED]</span>
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="terminal-line">
                <span className="terminal-time">[{log.timestamp}]</span>
                <span className="terminal-msg">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
