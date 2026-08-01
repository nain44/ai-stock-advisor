"use client";

import { useEffect, useState } from "react";
import { STOCK_API_BASE } from "@/lib/config";

interface PromptData {
  portfolio_prompt: string;
  chat_prompt: string;
}

export default function AIControls() {
  const [prompts, setPrompts] = useState<PromptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    async function loadPrompts() {
      try {
        const res = await fetch(`${STOCK_API_BASE}/api/admin/prompt`);
        if (res.ok) {
          const data = await res.json();
          setPrompts(data);
        }
      } catch (err) {
        console.error("Error loading prompts:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPrompts();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompts) return;

    setSaving(true);
    setToast(null);

    try {
      const res = await fetch(`${STOCK_API_BASE}/api/admin/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompts)
      });
      if (res.ok) {
        setToast({ type: "success", message: "AI Prompt Templates saved successfully." });
      } else {
        const errData = await res.json();
        setToast({ type: "error", message: errData.detail || "Failed to save prompt templates." });
      }
    } catch (err) {
      setToast({ type: "error", message: "Failed to connect to the backend server." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading prompt templates...</p>
      </div>
    );
  }

  return (
    <div className="panel" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="panel-header">
        <h3 className="panel-title">AI System Prompt Templates</h3>
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

      <form onSubmit={handleSave}>
        <div className="form-group">
          <label className="form-label">Portfolio Analysis System Prompt Template</label>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
            Defines the role of the quantitative advisor when diagnosing the portfolio structure. Supports {"{exchange_name}"} placeholder.
          </span>
          <textarea
            className="form-textarea"
            value={prompts?.portfolio_prompt || ""}
            onChange={(e) => setPrompts(prev => prev ? { ...prev, portfolio_prompt: e.target.value } : null)}
            placeholder="Enter portfolio system prompt..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">General AI Chat Advisor System Prompt Template</label>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
            Instructs the advisor during live chat. Supports {"{market_name}"}, {"{context}"}, and {"{query}"} placeholders.
          </span>
          <textarea
            className="form-textarea"
            value={prompts?.chat_prompt || ""}
            onChange={(e) => setPrompts(prev => prev ? { ...prev, chat_prompt: e.target.value } : null)}
            placeholder="Enter chat advisor system prompt..."
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving Changes..." : "Save Prompt Templates"}
          </button>
        </div>
      </form>
    </div>
  );
}
