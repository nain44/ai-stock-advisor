// KSE AI Stock Advisor Frontend Logic

let activeTicker = "";
let chartInstance = null;
let simulatedPortfolio = [];

// API endpoints prefix
const API_URL = ""; 

document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupEventListeners();
});

// Initialize application state
async function initApp() {
    loadPortfolioFromLocalStorage();
    await loadStocksList();
    await loadSettingsStatus();
    
    // Select first stock by default if available
    const firstStock = document.querySelector(".stock-item");
    if (firstStock) {
        firstStock.click();
    }
}

// Load simulated portfolio from LocalStorage
function loadPortfolioFromLocalStorage() {
    const saved = localStorage.getItem("kse_sim_portfolio");
    if (saved) {
        try {
            simulatedPortfolio = jsonParse(saved) || [];
            renderPortfolio();
        } catch (e) {
            console.error("Error loading portfolio from storage:", e);
        }
    }
}

// Helper to parse JSON safely
function jsonParse(str) {
    try { return JSON.parse(str); } catch(e) { return null; }
}

// Save portfolio to LocalStorage
function savePortfolioToLocalStorage() {
    localStorage.setItem("kse_sim_portfolio", JSON.stringify(simulatedPortfolio));
}

// Set up event handlers
function setupEventListeners() {
    // Search filter
    const searchInput = document.getElementById("stock-search");
    searchInput.addEventListener("input", filterStocksList);
    
    // Add stock to portfolio button
    const addPortBtn = document.getElementById("add-to-portfolio-btn");
    addPortBtn.addEventListener("click", () => {
        if (!activeTicker) return;
        document.getElementById("modal-stock-ticker").textContent = activeTicker;
        document.getElementById("portfolio-modal").style.display = "flex";
    });
    
    // Close portfolio modal
    document.getElementById("close-portfolio-modal").addEventListener("click", () => {
        document.getElementById("portfolio-modal").style.display = "none";
    });
    
    // Submit simulated transaction
    document.getElementById("submit-portfolio-btn").addEventListener("click", () => {
        const sharesInput = document.getElementById("modal-stock-shares");
        const shares = parseInt(sharesInput.value) || 100;
        addToPortfolio(activeTicker, shares);
        document.getElementById("portfolio-modal").style.display = "none";
    });
    
    // Trigger portfolio analysis in chat
    document.getElementById("analyze-portfolio-chat-btn").addEventListener("click", () => {
        analyzePortfolioWithAI();
    });
    
    // Settings panel toggles
    document.getElementById("settings-trigger-btn").addEventListener("click", () => {
        document.getElementById("settings-modal").style.display = "flex";
    });
    document.getElementById("close-settings-modal").addEventListener("click", () => {
        document.getElementById("settings-modal").style.display = "none";
    });
    
    // Save settings (API Keys)
    document.getElementById("submit-settings-btn").addEventListener("click", saveSettingsKeys);
    
    // Chart timeframe buttons
    const periodButtons = document.querySelectorAll(".chart-period");
    periodButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            periodButtons.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            const days = parseInt(e.target.dataset.days) || 30;
            loadChartData(activeTicker, days);
        });
    });
    
    // Chat drawer collapse/expand
    const chatHeader = document.getElementById("chat-header-toggle");
    const chatDrawer = document.getElementById("chat-drawer");
    const chatCollapseBtn = document.getElementById("chat-collapse-btn");
    
    chatHeader.addEventListener("click", () => {
        chatDrawer.classList.toggle("collapsed");
        if (chatDrawer.classList.contains("collapsed")) {
            chatCollapseBtn.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
        } else {
            chatCollapseBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
            // Scroll to end when expanded
            scrollToChatBottom();
        }
    });
    
    // Chat send button
    document.getElementById("chat-send-btn").addEventListener("click", handleUserMessage);
    document.getElementById("chat-input").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            handleUserMessage();
        }
    });
    
    // Click on suggestion chips
    document.querySelectorAll(".chat-chip").forEach(chip => {
        chip.addEventListener("click", (e) => {
            const query = e.target.dataset.query;
            if (query) {
                sendChatQuery(query);
            }
        });
    });
}

// Fetch list of cover stocks
async function loadStocksList() {
    try {
        const response = await fetch(`${API_URL}/api/stocks`);
        const stocks = await response.json();
        
        const listContainer = document.getElementById("stock-list-elements");
        listContainer.innerHTML = "";
        
        for (const stock of stocks) {
            // Get live quotation for prices in list
            const quoteResponse = await fetch(`${API_URL}/api/quote/${stock.ticker}`);
            const quote = await quoteResponse.json();
            
            const item = document.createElement("div");
            item.className = "stock-item";
            item.dataset.ticker = stock.ticker;
            item.dataset.name = stock.name.toLowerCase();
            item.dataset.sector = stock.sector.toLowerCase();
            
            const isUpClass = quote.is_up ? "up" : "down";
            const trendIcon = quote.is_up ? "+" : "";
            
            item.innerHTML = `
                <div class="stock-info">
                    <strong>${stock.ticker}</strong>
                    <span>${stock.sector}</span>
                </div>
                <div class="stock-price-info">
                    <span class="price">PKR ${quote.price}</span>
                    <span class="change ${isUpClass}">${trendIcon}${quote.pct_change}</span>
                </div>
            `;
            
            item.addEventListener("click", () => {
                document.querySelectorAll(".stock-item").forEach(i => i.classList.remove("active"));
                item.classList.add("active");
                selectStock(stock.ticker);
            });
            
            listContainer.appendChild(item);
        }
    } catch (e) {
        console.error("Failed to load stocks list:", e);
    }
}

// Filter stocks coverage list
function filterStocksList() {
    const query = document.getElementById("stock-search").value.toLowerCase().strip;
    const items = document.querySelectorAll(".stock-item");
    
    items.forEach(item => {
        const ticker = item.dataset.ticker.toLowerCase();
        const name = item.dataset.name;
        const sector = item.dataset.sector;
        
        if (ticker.includes(query) || name.includes(query) || sector.includes(query)) {
            item.style.display = "flex";
        } else {
            item.style.display = "none";
        }
    });
}

// Load specific stock details into dashboard
async function selectStock(ticker) {
    activeTicker = ticker;
    
    // Update chip for active stock query
    const stockQueryChip = document.getElementById("chip-stock-query");
    stockQueryChip.style.display = "inline-block";
    stockQueryChip.textContent = `Should I buy ${ticker}?`;
    stockQueryChip.dataset.query = `Should I buy ${ticker}?`;
    
    // Load main quote details
    await refreshStockQuote(ticker);
    
    // Load analysis reports
    await loadAnalysisReport(ticker);
    
    // Load active chart
    const activePeriodDays = parseInt(document.querySelector(".chart-period.active").dataset.days) || 30;
    await loadChartData(ticker, activePeriodDays);
}

// Refresh quote details in header
async function refreshStockQuote(ticker) {
    try {
        const response = await fetch(`${API_URL}/api/quote/${ticker}`);
        const quote = await response.json();
        
        document.getElementById("active-ticker").textContent = quote.ticker;
        document.getElementById("active-name").textContent = quote.name;
        
        const sectorElement = document.getElementById("active-sector");
        // Get sector from item metadata in list
        const listItem = document.querySelector(`.stock-item[data-ticker="${ticker}"]`);
        if (listItem) {
            sectorElement.textContent = listItem.querySelector(".stock-info span").textContent;
        }
        
        document.getElementById("active-price").textContent = `PKR ${quote.price.toLocaleString()}`;
        
        const changeBadge = document.getElementById("active-change");
        changeBadge.className = "change-badge";
        const trend = quote.change >= 0 ? "+" : "";
        changeBadge.classList.add(quote.is_up ? "up" : "down");
        changeBadge.textContent = `${trend}${quote.change} (${trend}${quote.pct_change})`;
        
        document.getElementById("active-timestamp").innerHTML = `<i class="fa-regular fa-clock"></i> Live quote: ${quote.timestamp}`;
    } catch (e) {
        console.error("Quote refresh failure:", e);
    }
}

// Fetch and load complete technical / fundamental analysis reports
async function loadAnalysisReport(ticker) {
    try {
        const response = await fetch(`${API_URL}/api/analysis/${ticker}`);
        const analysis = await response.json();
        
        // Render Recommendation card
        const rec = analysis.recommendation;
        const recBadge = document.getElementById("rec-badge");
        recBadge.textContent = rec.recommendation;
        recBadge.className = `recommendation-badge ${rec.recommendation}`;
        
        document.getElementById("rec-confidence").textContent = rec.confidence;
        document.getElementById("rec-confidence-fill").style.width = rec.confidence;
        document.getElementById("rec-risk").textContent = rec.risk_level;
        
        // Add color styles based on risk level
        const riskColor = rec.risk_level === "High" ? "var(--color-sell)" : rec.risk_level === "Medium" ? "var(--color-hold)" : "var(--color-buy)";
        document.getElementById("rec-risk").style.color = riskColor;
        
        document.getElementById("target-entry").textContent = `PKR ${rec.entry}`;
        document.getElementById("target-1").textContent = `PKR ${rec.target1}`;
        document.getElementById("target-2").textContent = `PKR ${rec.target2}`;
        document.getElementById("target-stop").textContent = `PKR ${rec.stop_loss}`;
        
        // Model badge
        const modelBadge = document.getElementById("advisor-type");
        if (rec.is_simulated) {
            modelBadge.textContent = "Simulator Mode";
            modelBadge.style.borderColor = "var(--border-color)";
            modelBadge.style.color = "var(--text-muted)";
            modelBadge.style.background = "rgba(255,255,255,0.03)";
        } else {
            modelBadge.textContent = "AI Live Analysis";
            modelBadge.style.borderColor = "var(--primary)";
            modelBadge.style.color = "var(--primary)";
            modelBadge.style.background = "rgba(0, 242, 254, 0.08)";
        }
        
        // Rationale list
        const reasonsList = document.getElementById("rec-reasons-list");
        reasonsList.innerHTML = "";
        rec.reasons.forEach(reason => {
            const li = document.createElement("li");
            li.textContent = reason;
            reasonsList.appendChild(li);
        });
        
        // Gauges & Indicators section
        const tech = analysis.technical_analysis;
        
        // RSI
        document.getElementById("rsi-val").textContent = tech.rsi.value;
        document.getElementById("rsi-status").textContent = tech.rsi.status;
        const rsiMarker = document.getElementById("rsi-marker");
        // RSI is standard 0 to 100, set marker left percentage
        rsiMarker.style.left = `${Math.min(Math.max(tech.rsi.value, 2), 98)}%`;
        
        // MACD
        document.getElementById("macd-val").textContent = tech.macd.line;
        document.getElementById("macd-crossover").textContent = tech.macd.crossover;
        if (tech.macd.crossover === "Bullish Crossover") {
            document.getElementById("macd-crossover").style.color = "var(--color-buy)";
        } else if (tech.macd.crossover === "Bearish Crossover") {
            document.getElementById("macd-crossover").style.color = "var(--color-sell)";
        } else {
            document.getElementById("macd-crossover").style.color = "var(--text-muted)";
        }
        
        // Visual indicator bar for MACD histogram
        const macdBar = document.getElementById("macd-bar-indicator");
        const histVal = tech.macd.histogram;
        const maxExpectedHist = 5.0; // scale limit for visual
        const percentage = Math.min(Math.abs(histVal) / maxExpectedHist, 1.0) * 100;
        macdBar.style.width = `${percentage}%`;
        macdBar.style.backgroundColor = histVal >= 0 ? "var(--color-buy)" : "var(--color-sell)";
        macdBar.style.marginLeft = histVal >= 0 ? "50%" : `${50 - percentage}%`;
        
        // Bollinger Bands
        document.getElementById("bb-mid-val").textContent = `PKR ${tech.bollinger_bands.middle}`;
        document.getElementById("bb-status").textContent = tech.bollinger_bands.status;
        document.getElementById("bb-low-val").textContent = tech.bollinger_bands.lower;
        document.getElementById("bb-high-val").textContent = tech.bollinger_bands.upper;
        
        // Fundamentals Grid
        const prof = analysis.profile;
        document.getElementById("fund-pe").textContent = `${prof.pe_ratio}x`;
        document.getElementById("fund-roe").textContent = `${prof.roe}%`;
        document.getElementById("fund-div").textContent = `${prof.div_yield}%`;
        document.getElementById("fund-eps").textContent = `PKR ${prof.eps}`;
        document.getElementById("fund-debt").textContent = `${prof.debt_equity}%`;
        document.getElementById("fund-pb").textContent = `${prof.pb_ratio}x`;
        
        // News sentiment items
        const newsContainer = document.getElementById("active-news-list");
        newsContainer.innerHTML = "";
        prof.recent_news.forEach(news => {
            const div = document.createElement("div");
            div.className = "news-item";
            div.innerHTML = `
                <div class="news-content">
                    <h5>${news.title}</h5>
                    <span>Source: ${news.source}</span>
                </div>
                <span class="news-sentiment-badge ${news.sentiment}">${news.sentiment}</span>
            `;
            newsContainer.appendChild(div);
        });
    } catch (e) {
        console.error("Failed to load analysis report:", e);
    }
}

// Chart loading using Chart.js
async function loadChartData(ticker, days) {
    try {
        const response = await fetch(`${API_URL}/api/historical/${ticker}?days=${days}`);
        const data = await response.json();
        
        const labels = data.map(item => item.Date);
        const prices = data.map(item => item.Close);
        
        if (chartInstance) {
            chartInstance.destroy();
        }
        
        const ctx = document.getElementById("stockChart").getContext("2d");
        
        // Gradient background fill
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, "rgba(0, 242, 254, 0.25)");
        gradient.addColorStop(1, "rgba(0, 242, 254, 0.0)");
        
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `${ticker} Close Price`,
                    data: prices,
                    borderColor: '#00f2fe',
                    borderWidth: 2,
                    pointBackgroundColor: '#00f2fe',
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    fill: true,
                    backgroundColor: gradient,
                    tension: 0.15
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        ticks: { color: '#6f8099', font: { family: 'Outfit', size: 10 } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        ticks: { color: '#6f8099', font: { family: 'Outfit', size: 10 } }
                    }
                }
            }
        });
    } catch (e) {
        console.error("Failed to render chart:", e);
    }
}

// Load dynamic statuses of settings keys
async function loadSettingsStatus() {
    try {
        const response = await fetch(`${API_URL}/api/settings`);
        const settings = await response.json();
        
        const geminiBadge = document.getElementById("gemini-status-badge");
        const openaiBadge = document.getElementById("openai-status-badge");
        const connectionText = document.querySelector(".status-text");
        const statusDot = document.querySelector(".connection-status .dot");
        
        if (settings.has_gemini) {
            geminiBadge.textContent = "Live AI Enabled";
            geminiBadge.className = "status-badge live";
            document.getElementById("settings-gemini-key").placeholder = settings.gemini_key_mask;
        } else {
            geminiBadge.textContent = "Simulator Mode";
            geminiBadge.className = "status-badge";
        }
        
        if (settings.has_openai) {
            openaiBadge.textContent = "Live AI Enabled";
            openaiBadge.className = "status-badge live";
            document.getElementById("settings-openai-key").placeholder = settings.openai_key_mask;
        } else {
            openaiBadge.textContent = "Simulator Mode";
            openaiBadge.className = "status-badge";
        }
        
        // Update connections stats panel
        if (settings.has_gemini || settings.has_openai) {
            connectionText.textContent = "Live AI Mode";
            statusDot.classList.add("active");
        } else {
            connectionText.textContent = "Simulated Engine";
            statusDot.classList.remove("active");
        }
    } catch (e) {
        console.error("Failed to load settings details:", e);
    }
}

// Save API Keys settings config
async function saveSettingsKeys() {
    const geminiKey = document.getElementById("settings-gemini-key").value;
    const openaiKey = document.getElementById("settings-openai-key").value;
    
    const body = {};
    if (geminiKey.trim()) body.gemini_key = geminiKey;
    if (openaiKey.trim()) body.openai_key = openaiKey;
    
    try {
        const response = await fetch(`${API_URL}/api/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const result = await response.json();
        if (result.status === "success") {
            alert("Model configurations updated successfully!");
            document.getElementById("settings-modal").style.display = "none";
            
            // Clear passwords input fields
            document.getElementById("settings-gemini-key").value = "";
            document.getElementById("settings-openai-key").value = "";
            
            await loadSettingsStatus();
            if (activeTicker) {
                await selectStock(activeTicker);
            }
        }
    } catch (e) {
        alert("Failed to save settings: " + e.message);
    }
}

// SIMULATED PORTFOLIO OPERATIONS
function addToPortfolio(ticker, shares) {
    const existingIndex = simulatedPortfolio.findIndex(item => item.ticker === ticker);
    if (existingIndex >= 0) {
        simulatedPortfolio[existingIndex].shares += shares;
    } else {
        simulatedPortfolio.push({ ticker, shares });
    }
    savePortfolioToLocalStorage();
    renderPortfolio();
}

function removeFromPortfolio(ticker) {
    simulatedPortfolio = simulatedPortfolio.filter(item => item.ticker !== ticker);
    savePortfolioToLocalStorage();
    renderPortfolio();
}

async function renderPortfolio() {
    const container = document.getElementById("portfolio-items");
    const summaryBar = document.getElementById("portfolio-summary-bar");
    const totalValEl = document.getElementById("portfolio-total");
    
    if (simulatedPortfolio.length === 0) {
        container.innerHTML = `<p class="empty-msg">No simulated stocks added. Select a stock and click 'Add' to track holdings.</p>`;
        summaryBar.style.display = "none";
        return;
    }
    
    container.innerHTML = "";
    summaryBar.style.display = "flex";
    let totalPortfolioVal = 0;
    
    for (const item of simulatedPortfolio) {
        // Fetch current live quote
        try {
            const response = await fetch(`${API_URL}/api/quote/${item.ticker}`);
            const quote = await response.json();
            const val = item.shares * quote.price;
            totalPortfolioVal += val;
            
            const div = document.createElement("div");
            div.className = "portfolio-item";
            div.innerHTML = `
                <div>
                    <span class="ticker">${item.ticker}</span>
                    <span class="shares">${item.shares} sh</span>
                </div>
                <div>
                    <span class="value">PKR ${val.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                    <i class="fa-regular fa-trash-can remove-p-item" onclick="removeFromPortfolio('${item.ticker}')"></i>
                </div>
            `;
            container.appendChild(div);
        } catch (e) {
            console.error(`Error loading portfolio ticker quote ${item.ticker}:`, e);
        }
    }
    
    totalValEl.textContent = `PKR ${totalPortfolioVal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

// AI CHAT PROCESSORS
function handleUserMessage() {
    const input = document.getElementById("chat-input");
    const query = input.value.trim();
    if (!query) return;
    
    input.value = "";
    sendChatQuery(query);
}

async function sendChatQuery(query) {
    // Render user message bubble
    appendMessage(query, "user");
    
    // Render typing placeholder
    const typingId = appendTypingIndicator();
    
    // Auto expand chat if collapsed
    const chatDrawer = document.getElementById("chat-drawer");
    if (chatDrawer.classList.contains("collapsed")) {
        chatDrawer.classList.remove("collapsed");
        document.getElementById("chat-collapse-btn").innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
    }
    
    try {
        const body = {
            query: query,
            portfolio: simulatedPortfolio
        };
        if (activeTicker) {
            body.ticker = activeTicker;
        }
        
        const response = await fetch(`${API_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const result = await response.json();
        
        // Remove typing indicator
        removeTypingIndicator(typingId);
        
        // Render system/bot bubble
        appendMessage(result.response, "system");
    } catch (e) {
        removeTypingIndicator(typingId);
        appendMessage("Sorry, I encountered an error coordinating with the backend server. Make sure FastAPI server is running.", "system");
    }
}

// Format markdown in responses (very basic converter for simple headings, bullets, tables)
function formatMarkdown(text) {
    let html = text;
    
    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Bullet lists
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    // Wrap groups of <li> in <ul>. Simple regex approach
    html = html.replace(/(<li>.*<\/li>)/sim, '<ul>$1</ul>');
    
    // Tables
    // Capture rows containing pipes
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '<table>';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|') && line.endsWith('|')) {
            // Check if divider row
            if (line.includes('---') || line.includes(':---')) {
                continue; 
            }
            
            const cols = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
            const tag = !inTable ? 'th' : 'td';
            
            if (!inTable) {
                inTable = true;
                tableHtml += '<thead><tr>';
                cols.forEach(col => { tableHtml += `<th>${col}</th>`; });
                tableHtml += '</tr></thead><tbody>';
            } else {
                tableHtml += '<tr>';
                cols.forEach(col => { tableHtml += `<td>${col}</td>`; });
                tableHtml += '</tr>';
            }
            lines[i] = ''; // clear line
        } else {
            if (inTable) {
                inTable = false;
                tableHtml += '</tbody></table>';
                // Find where the table started and replace with HTML
                html = html.replace(/\|[\s\S]*?\|[\s\S]*?\|/m, tableHtml);
                tableHtml = '<table>';
            }
        }
    }
    if (inTable) {
        tableHtml += '</tbody></table>';
        html = html.replace(/\|[\s\S]*?\|[\s\S]*?\|/m, tableHtml);
    }
    
    // Newlines to breaks (for non-list/non-table segments)
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

function appendMessage(text, sender) {
    const chatBody = document.getElementById("chat-body");
    const chatEnd = document.getElementById("chat-end");
    
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}`;
    
    const icon = sender === "system" ? "robot" : "user";
    
    messageDiv.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-${icon}"></i></div>
        <div class="msg-bubble">
            ${sender === "system" ? formatMarkdown(text) : `<p>${text}</p>`}
        </div>
    `;
    
    chatBody.insertBefore(messageDiv, chatEnd);
    scrollToChatBottom();
}

function appendTypingIndicator() {
    const chatBody = document.getElementById("chat-body");
    const chatEnd = document.getElementById("chat-end");
    const id = "typing-" + Date.now();
    
    const div = document.createElement("div");
    div.className = "message system";
    div.id = id;
    div.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="msg-bubble" style="display: flex; gap: 4px; padding: 12px;">
            <div class="pulse-indicator" style="animation-delay: 0s;"></div>
            <div class="pulse-indicator" style="animation-delay: 0.2s;"></div>
            <div class="pulse-indicator" style="animation-delay: 0.4s;"></div>
        </div>
    `;
    
    chatBody.insertBefore(div, chatEnd);
    scrollToChatBottom();
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function scrollToChatBottom() {
    const chatBody = document.getElementById("chat-body");
    chatBody.scrollTop = chatBody.scrollHeight;
}

function analyzePortfolioWithAI() {
    if (simulatedPortfolio.length === 0) return;
    
    let holdingsText = "Holdings:\n";
    simulatedPortfolio.forEach(item => {
        holdingsText += `- ${item.ticker}: ${item.shares} shares\n`;
    });
    
    const query = `Please analyze my portfolio risk, sector exposures, and dividend projection. Here are my current simulated holdings:\n${holdingsText}`;
    sendChatQuery("Analyze my portfolio allocation.");
}
