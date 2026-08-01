"use client";

import { useEffect, useState } from "react";
import { STOCK_API_BASE } from "@/lib/config";

interface Suggestion {
  label: string;
  query: string;
}

interface MarketConfig {
  name: string;
  flag: string;
  title: string;
  subtitle: string;
  currency: string;
  defaultTicker: string;
  watchlist: string[];
  welcome: string;
  suggestions: Suggestion[];
}

type MarketsData = Record<string, MarketConfig>;

export default function MarketFetchers() {
  const [markets, setMarkets] = useState<MarketsData | null>(null);
  const [selectedMarket, setSelectedMarket] = useState("PK");
  const [newTicker, setNewTicker] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form states for adding a new country
  const [showAddCountry, setShowAddCountry] = useState(false);
  const [addCode, setAddCode] = useState("");
  const [addName, setAddName] = useState("");
  const [addFlag, setAddFlag] = useState("");
  const [addCurrency, setAddCurrency] = useState("");
  const [addDefaultTicker, setAddDefaultTicker] = useState("");

  const loadConfig = async () => {
    try {
      const res = await fetch(`${STOCK_API_BASE}/api/admin/markets`);
      if (res.ok) {
        const data = await res.json();
        setMarkets(data);
        const keys = Object.keys(data);
        if (keys.length > 0 && !keys.includes(selectedMarket)) {
          setSelectedMarket(keys[0]);
        }
      }
    } catch (err) {
      console.error("Error loading config:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleTriggerFetch = async () => {
    setFetching(true);
    setToast(null);
    try {
      const res = await fetch(`${STOCK_API_BASE}/api/admin/fetcher/trigger?market=${selectedMarket}`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setToast({ type: "success", message: data.message || `Market data for ${selectedMarket} successfully refreshed!` });
      } else {
        const errData = await res.json();
        setToast({ type: "error", message: errData.detail || "Failed to trigger market fetcher." });
      }
    } catch (err) {
      setToast({ type: "error", message: "Failed to connect to the backend server." });
    } finally {
      setFetching(false);
    }
  };

  const handleSaveConfig = async (updatedConfig: MarketsData) => {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch(`${STOCK_API_BASE}/api/admin/markets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedConfig)
      });
      if (res.ok) {
        setToast({ type: "success", message: "Exchanges and watchlists configuration saved successfully!" });
        setMarkets(updatedConfig);
      } else {
        const errData = await res.json();
        setToast({ type: "error", message: errData.detail || "Failed to save configuration." });
      }
    } catch (err) {
      setToast({ type: "error", message: "Connection to backend failed." });
    } finally {
      setSaving(false);
    }
  };

  // Add ticker to active watchlist
  const handleAddTicker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!markets || !newTicker.trim()) return;

    const tickerUpper = newTicker.trim().toUpperCase();
    const currentMarket = markets[selectedMarket];
    
    if (currentMarket.watchlist.includes(tickerUpper)) {
      setNewTicker("");
      return;
    }

    const updated = {
      ...markets,
      [selectedMarket]: {
        ...currentMarket,
        watchlist: [...currentMarket.watchlist, tickerUpper]
      }
    };
    
    setNewTicker("");
    handleSaveConfig(updated);
  };

  // Remove ticker from active watchlist
  const handleRemoveTicker = (tickerToRemove: string) => {
    if (!markets) return;
    const currentMarket = markets[selectedMarket];
    const updatedWatchlist = currentMarket.watchlist.filter(t => t !== tickerToRemove);

    const updated = {
      ...markets,
      [selectedMarket]: {
        ...currentMarket,
        watchlist: updatedWatchlist
      }
    };
    handleSaveConfig(updated);
  };

  // Add new country configuration
  const handleAddCountry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!markets || !addCode.trim() || !addName.trim()) return;

    const codeUpper = addCode.trim().toUpperCase();
    if (markets[codeUpper]) {
      alert(`Country code ${codeUpper} already exists!`);
      return;
    }

    const newCountry: MarketConfig = {
      name: addName.trim(),
      flag: addFlag.trim() || "🌍",
      title: "MultiStocks AI",
      subtitle: `${addName.trim()} Stock Exchange`,
      currency: addCurrency.trim() || "$",
      defaultTicker: addDefaultTicker.trim().toUpperCase() || "TICKER",
      watchlist: addDefaultTicker.trim() ? [addDefaultTicker.trim().toUpperCase()] : [],
      welcome: `Hello! I am your ${addName.trim()} AI Advisor.`,
      suggestions: [
        { label: `Analyze ${addDefaultTicker.trim().toUpperCase() || "Market"}`, query: `Can you analyze ${addDefaultTicker.trim().toUpperCase() || "this market"}?` }
      ]
    };

    const updated = {
      ...markets,
      [codeUpper]: newCountry
    };

    setAddCode("");
    setAddName("");
    setAddFlag("");
    setAddCurrency("");
    setAddDefaultTicker("");
    setShowAddCountry(false);
    setSelectedMarket(codeUpper);
    handleSaveConfig(updated);
  };

  // Delete active country configuration
  const handleDeleteCountry = () => {
    if (!markets) return;
    if (Object.keys(markets).length <= 1) {
      alert("At least one country configuration must remain active.");
      return;
    }

    const confirmDel = confirm(`Are you sure you want to delete ${markets[selectedMarket].name} (${selectedMarket})? This will remove all tickers and screens from the mobile app.`);
    if (!confirmDel) return;

    const updated = { ...markets };
    delete updated[selectedMarket];

    const remainingKeys = Object.keys(updated);
    setSelectedMarket(remainingKeys[0]);
    handleSaveConfig(updated);
  };

  // Update text field configs for selected market
  const handleFieldChange = (field: keyof MarketConfig, value: string) => {
    if (!markets) return;
    const updated = {
      ...markets,
      [selectedMarket]: {
        ...markets[selectedMarket],
        [field]: value
      }
    };
    setMarkets(updated);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading exchanges configurations...</p>
      </div>
    );
  }

  const activeMarket = markets?.[selectedMarket];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      
      {toast && (
        <div style={{
          backgroundColor: toast.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
          color: toast.type === "success" ? "var(--success)" : "var(--error)",
          border: `1px solid ${toast.type === "success" ? "var(--success)" : "var(--error)"}`,
          borderRadius: "8px",
          padding: "12px 16px",
          fontSize: "14px",
          fontWeight: "500"
        }}>
          {toast.message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* Left Side: Segment Selector & Actions */}
        <div className="panel" style={{ flex: '1', minWidth: '320px' }}>
          <div className="panel-header">
            <h3 className="panel-title">Exchanges Control Board</h3>
          </div>

          <div className="form-group">
            <label className="form-label">Active Market Segment</label>
            <select
              className="form-select"
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
            >
              {markets &&
                Object.entries(markets).map(([code, m]) => (
                  <option key={code} value={code}>
                    {m.flag} {m.name} ({code})
                  </option>
                ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '32px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowAddCountry(!showAddCountry)}
              style={{ width: '100%' }}
            >
              ➕ Add New Country
            </button>
            
            <button
              className="btn btn-primary"
              onClick={handleTriggerFetch}
              disabled={fetching}
              style={{ width: '100%' }}
            >
              {fetching ? "Refreshing Quotes..." : "Force Refresh Market Quotes"}
            </button>

            <button
              className="btn btn-danger"
              onClick={handleDeleteCountry}
              style={{ width: '100%' }}
            >
              🗑️ Delete Active Country
            </button>
          </div>
        </div>

        {/* Right Side: Active Market Configuration Editor */}
        <div style={{ flex: '2', minWidth: '480px' }}>
          {activeMarket && (
            <div className="panel">
              <div className="panel-header">
                <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{activeMarket.flag}</span> Edit {activeMarket.name} Config ({selectedMarket})
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="form-group">
                <div>
                  <label className="form-label">Exchange Subtitle</label>
                  <input
                    type="text"
                    className="form-input"
                    value={activeMarket.subtitle}
                    onChange={(e) => handleFieldChange("subtitle", e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Currency Notation</label>
                  <input
                    type="text"
                    className="form-input"
                    value={activeMarket.currency}
                    onChange={(e) => handleFieldChange("currency", e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Default Stock Ticker</label>
                <input
                  type="text"
                  className="form-input"
                  value={activeMarket.defaultTicker}
                  onChange={(e) => handleFieldChange("defaultTicker", e.target.value.toUpperCase())}
                />
              </div>

              <div className="form-group">
                <label className="form-label">AI Welcome Message</label>
                <input
                  type="text"
                  className="form-input"
                  value={activeMarket.welcome}
                  onChange={(e) => handleFieldChange("welcome", e.target.value)}
                />
              </div>

              {/* Ticker Watchlist Tags */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', marginTop: '24px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '16px' }}>Manage Watchlist Tickers</h4>
                
                <form onSubmit={handleAddTicker} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter stock ticker (e.g. NVDA)"
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value)}
                    style={{ flexGrow: 1 }}
                  />
                  <button type="submit" className="btn btn-secondary">Add Ticker</button>
                </form>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {activeMarket.watchlist.map((ticker) => (
                    <span
                      key={ticker}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        padding: '6px 12px',
                        borderRadius: '20px'
                      }}
                    >
                      <strong>{ticker}</strong>
                      <span
                        onClick={() => handleRemoveTicker(ticker)}
                        style={{ color: 'var(--error)', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ×
                      </span>
                    </span>
                  ))}
                  {activeMarket.watchlist.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Watchlist is empty. Add a ticker above.</p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => markets && handleSaveConfig(markets)}
                  disabled={saving}
                >
                  {saving ? "Saving Changes..." : "Save Market Configuration"}
                </button>
              </div>

            </div>
          )}
        </div>

      </div>

      {/* Add New Country Modal/Drawer */}
      {showAddCountry && (
        <div className="panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="panel-header">
            <h3 className="panel-title">Add New Country Configuration</h3>
          </div>
          <form onSubmit={handleAddCountry}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }} className="form-group">
              <div>
                <label className="form-label">Country Code (e.g. EG)</label>
                <input
                  type="text"
                  className="form-input"
                  value={addCode}
                  onChange={(e) => setAddCode(e.target.value)}
                  maxLength={4}
                  required
                />
              </div>
              <div>
                <label className="form-label">Country Name (e.g. Egypt)</label>
                <input
                  type="text"
                  className="form-input"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }} className="form-group">
              <div>
                <label className="form-label">Flag Emoji (e.g. 🇪🇬)</label>
                <input
                  type="text"
                  className="form-input"
                  value={addFlag}
                  onChange={(e) => setAddFlag(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Currency Sign (e.g. E£)</label>
                <input
                  type="text"
                  className="form-input"
                  value={addCurrency}
                  onChange={(e) => setAddCurrency(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Initial Stock Ticker</label>
                <input
                  type="text"
                  className="form-input"
                  value={addDefaultTicker}
                  onChange={(e) => setAddDefaultTicker(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddCountry(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Add and Configure
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
