"use client";

import { useEffect, useState } from "react";
import { STOCK_API_BASE } from "@/lib/config";

interface MarketConfig {
  name: string;
  flag: string;
  title: string;
  subtitle: string;
  currency: string;
  defaultTicker: string;
  watchlist: string[];
}

interface ConfigResponse {
  markets: Record<string, MarketConfig>;
}

interface SettingsResponse {
  has_gemini: boolean;
  has_openai: boolean;
}

export default function DashboardOverview() {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [configRes, settingsRes] = await Promise.all([
          fetch(`${STOCK_API_BASE}/api/config`),
          fetch(`${STOCK_API_BASE}/api/settings`)
        ]);
        if (configRes.ok && settingsRes.ok) {
          const configData = await configRes.json();
          const settingsData = await settingsRes.json();
          setConfig(configData);
          setSettings(settingsData);
        }
      } catch (err) {
        console.error("Error fetching overview data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading Dashboard Overview...</p>
      </div>
    );
  }

  const totalMarkets = config ? Object.keys(config.markets).length : 0;
  const totalTickers = config
    ? Object.values(config.markets).reduce((acc, m) => acc + m.watchlist.length, 0)
    : 0;

  return (
    <div>
      <div className="grid-stats">
        <div className="card-stat">
          <div className="stat-label">Gemini API Status</div>
          <div className="stat-value" style={{ color: settings?.has_gemini ? 'var(--success)' : 'var(--error)', fontSize: '28px' }}>
            {settings?.has_gemini ? "ACTIVE" : "MISSING"}
          </div>
          <div className="stat-desc">
            <span className={`status-dot ${settings?.has_gemini ? 'active' : 'inactive'}`}></span>
            Advisor LLM Engine integration status
          </div>
        </div>

        <div className="card-stat">
          <div className="stat-label">OpenAI API Status</div>
          <div className="stat-value" style={{ color: settings?.has_openai ? 'var(--success)' : 'var(--text-muted)', fontSize: '28px' }}>
            {settings?.has_openai ? "ACTIVE" : "INACTIVE"}
          </div>
          <div className="stat-desc">
            <span className={`status-dot ${settings?.has_openai ? 'active' : ''}`}></span>
            Fallback OpenAI GPT Engine status
          </div>
        </div>

        <div className="card-stat">
          <div className="stat-label">Monitored Markets</div>
          <div className="stat-value">{totalMarkets}</div>
          <div className="stat-desc">
            🌍 Global Exchanges active
          </div>
        </div>

        <div className="card-stat">
          <div className="stat-label">Watchlist Tickers</div>
          <div className="stat-value">{totalTickers}</div>
          <div className="stat-desc">
            📈 Auto-fetch tickers tracking
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Active Market Configurations</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {config &&
              Object.entries(config.markets).map(([code, m]) => (
                <div key={code} className="item-row" style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '8px', padding: '12px 16px', marginBottom: '8px' }}>
                  <div className="item-info">
                    <span className="item-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>{m.flag}</span>
                      {m.name} ({code})
                    </span>
                    <span className="item-desc">
                      {m.subtitle} • Currency: {m.currency} • Default Ticker: {m.defaultTicker}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '300px' }}>
                    {m.watchlist.map((ticker) => (
                      <span key={ticker} style={{ fontSize: '11px', backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                        {ticker}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Advisor Specifications</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>LLM Model Provider</span>
              <span style={{ fontSize: '14px' }}>Google Gemini 1.5 Flash</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Server Host Address</span>
              <span style={{ fontSize: '14px' }}>http://localhost:8000</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Supported Financial Feeds</span>
              <span style={{ fontSize: '14px', color: 'var(--accent-cyan)' }}>
                Yahoo Finance API, Borsa Istanbul, Pakistan Stock Exchange
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
