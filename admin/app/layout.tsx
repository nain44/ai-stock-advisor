"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/wallverse/login";
  const isWallverse = pathname.startsWith("/wallverse");

  if (isLoginPage) {
    return (
      <html lang="en">
        <body style={{ backgroundColor: "#0a0a0f", margin: 0 }}>
          {children}
        </body>
      </html>
    );
  }

  const stockNavItems = [
    {
      name: "Dashboard",
      path: "/",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      )
    },
    {
      name: "AI Prompt Controls",
      path: "/ai-controls",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )
    },
    {
      name: "Market Fetchers",
      path: "/fetchers",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      )
    },
    {
      name: "Keys & System Logs",
      path: "/settings",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    }
  ];

  const wallverseNavItems = [
    {
      name: "Dashboard",
      path: "/wallverse/dashboard",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      )
    },
    {
      name: "Upload Wallpaper",
      path: "/wallverse/dashboard/upload",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      )
    },
    {
      name: "Manage Wallpapers",
      path: "/wallverse/dashboard/wallpapers",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      )
    },
    {
      name: "Categories",
      path: "/wallverse/dashboard/categories",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      )
    }
  ];

  const handleLogout = () => {
    localStorage.removeItem("wv_token");
    router.push("/wallverse/login");
  };

  const navItems = isWallverse ? wallverseNavItems : stockNavItems;

  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <aside className="sidebar">
            <div className="brand-section">
              <div className="brand-icon">{isWallverse ? "W" : "M"}</div>
              <div>
                <h1 className="brand-name">{isWallverse ? "WallVerse" : "MultiStocks"}</h1>
                <span className="brand-badge">ADMIN v1.0</span>
              </div>
            </div>

            {/* Project Switcher Selector */}
            <div style={{ marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid var(--border-color)" }}>
              <label style={{ fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "8px", fontWeight: "bold", letterSpacing: "0.5px" }}>
                Select Context
              </label>
              <select
                value={isWallverse ? "wallverse" : "multistocks"}
                onChange={(e) => {
                  if (e.target.value === "wallverse") {
                    router.push("/wallverse/dashboard");
                  } else {
                    router.push("/");
                  }
                }}
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  fontSize: "13px",
                  width: "100%",
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                <option value="multistocks">📈 MultiStocks AI</option>
                <option value="wallverse">🖼️ WallVerse Admin</option>
              </select>
            </div>
            
            <nav className="nav-links">
              {navItems.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    className={`nav-link ${isActive ? "active" : ""}`}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {isWallverse && (
              <button
                onClick={handleLogout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  marginTop: "auto",
                  fontSize: "14px",
                  color: "var(--text-muted)",
                  background: "transparent",
                  border: "1px solid var(--border-color)",
                  cursor: "pointer",
                  width: "100%",
                  transition: "all 0.2s"
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </button>
            )}
            
            <div className="sidebar-footer" style={{ marginTop: isWallverse ? "16px" : "auto" }}>
              <p>© 2026 Paynovate</p>
              <p>{isWallverse ? "WallVerse Media Hub" : "MultiStocks AI Control Center"}</p>
            </div>
          </aside>

          <main className="main-content">
            <header className="top-bar">
              <h2 className="page-title">
                {pathname === "/" && "Dashboard Overview"}
                {pathname === "/ai-controls" && "AI Advisor Prompt Controls"}
                {pathname === "/fetchers" && "Market Index Fetchers"}
                {pathname === "/settings" && "API Keys & System Logs"}
                {pathname === "/wallverse/dashboard" && "WallVerse Overview"}
                {pathname === "/wallverse/dashboard/upload" && "Upload Wallpaper"}
                {pathname === "/wallverse/dashboard/wallpapers" && "Manage Wallpapers"}
                {pathname === "/wallverse/dashboard/categories" && "Manage Categories"}
              </h2>
              <div className="top-bar-actions">
                <div className="api-status-badge">
                  <span className="status-dot active"></span>
                  {isWallverse ? "WallVerse API Connected" : "FastAPI Server Connected"}
                </div>
              </div>
            </header>
            
            <div className="scrollable-body">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
