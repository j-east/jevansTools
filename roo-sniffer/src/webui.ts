import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { RequestLogEntry, SnifferConfig } from './types';

export class WebUI {
  private server: http.Server;
  private config: SnifferConfig;
  private requests: RequestLogEntry[] = [];
  private discoveredDomains: Set<string> = new Set();
  private clients: Set<http.ServerResponse> = new Set();
  private uiPort: number;
  private runningProcesses: Map<string, ChildProcess> = new Map();

  constructor(config: SnifferConfig, uiPort: number = 8081) {
    this.config = config;
    this.uiPort = uiPort;
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  public addRequest(entry: RequestLogEntry): void {
    this.requests.push(entry);
    // Keep last 1000 requests
    if (this.requests.length > 1000) {
      this.requests.shift();
    }
    
    // Track discovered domains
    this.discoveredDomains.add(entry.host);
    
    // Send to all SSE clients
    this.broadcast(entry);
  }

  private broadcast(entry: RequestLogEntry): void {
    const data = `data: ${JSON.stringify(entry)}\n\n`;
    for (const client of this.clients) {
      client.write(data);
    }
  }

  public updateConfig(newConfig: Partial<SnifferConfig>): void {
    Object.assign(this.config, newConfig);
  }

  public getConfig(): SnifferConfig {
    return this.config;
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || '/';
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url === '/') {
      this.serveHTML(res);
    } else if (url === '/api/events') {
      this.handleSSE(req, res);
    } else if (url === '/api/requests') {
      this.handleGetRequests(res);
    } else if (url === '/api/config' && req.method === 'GET') {
      this.handleGetConfig(res);
    } else if (url === '/api/config' && req.method === 'POST') {
      this.handleUpdateConfig(req, res);
    } else if (url === '/api/domains') {
      this.handleGetDomains(res);
    } else if (url === '/api/clear' && req.method === 'POST') {
      this.handleClear(res);
    } else if (url === '/api/launch' && req.method === 'POST') {
      this.handleLaunch(req, res);
    } else if (url === '/api/processes') {
      this.handleGetProcesses(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }

  private handleSSE(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    this.clients.add(res);

    req.on('close', () => {
      this.clients.delete(res);
    });
  }

  private handleGetRequests(res: http.ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.requests));
  }

  private handleGetConfig(res: http.ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.config));
  }

  private handleUpdateConfig(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const newConfig = JSON.parse(body);
        this.updateConfig(newConfig);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, config: this.config }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }

  private handleGetDomains(res: http.ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      watched: this.config.watchDomains,
      discovered: Array.from(this.discoveredDomains).sort(),
    }));
  }

  private handleClear(res: http.ServerResponse): void {
    this.requests = [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  private handleLaunch(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { command } = JSON.parse(body);

        // Set proxy environment variables
        const env = {
          ...process.env,
          HTTP_PROXY: `http://127.0.0.1:${this.config.port}`,
          HTTPS_PROXY: `http://127.0.0.1:${this.config.port}`,
          http_proxy: `http://127.0.0.1:${this.config.port}`,
          https_proxy: `http://127.0.0.1:${this.config.port}`,
          NODE_TLS_REJECT_UNAUTHORIZED: '0'
        };

        // Parse command
        const parts = command.trim().split(/\s+/);
        const cmd = parts[0];
        const args = parts.slice(1);

        // Spawn process
        const child = spawn(cmd, args, {
          env,
          detached: true,
          stdio: 'ignore'
        });

        child.unref(); // Allow parent to exit independently

        const processId = Date.now().toString();
        this.runningProcesses.set(processId, child);

        child.on('exit', () => {
          this.runningProcesses.delete(processId);
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: `Launched: ${command}`,
          processId
        }));
      } catch (e: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  }

  private handleGetProcesses(res: http.ServerResponse): void {
    const processes = Array.from(this.runningProcesses.entries()).map(([id, proc]) => ({
      id,
      pid: proc.pid,
      running: !proc.killed
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(processes));
  }

  private serveHTML(res: http.ServerResponse): void {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Roo Sniffer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e; 
      color: #eee;
      min-height: 100vh;
    }
    .container { display: flex; height: 100vh; }
    
    /* Sidebar */
    .sidebar {
      width: 300px;
      background: #16213e;
      padding: 20px;
      overflow-y: auto;
      border-right: 1px solid #0f3460;
    }
    .sidebar h2 { 
      color: #e94560; 
      margin-bottom: 20px;
      font-size: 1.5rem;
    }
    .sidebar h3 {
      color: #aaa;
      font-size: 0.9rem;
      margin: 20px 0 10px;
      text-transform: uppercase;
    }
    
    /* Form elements */
    .form-group { margin-bottom: 15px; }
    .form-group label {
      display: block;
      margin-bottom: 5px;
      color: #888;
      font-size: 0.85rem;
    }
    .form-group input, .form-group select {
      width: 100%;
      padding: 8px 12px;
      background: #0f3460;
      border: 1px solid #1a1a2e;
      border-radius: 4px;
      color: #fff;
      font-size: 0.9rem;
    }
    .form-group input:focus, .form-group select:focus {
      outline: none;
      border-color: #e94560;
    }
    
    /* Domain tags */
    .domain-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 10px;
    }
    .domain-tag {
      background: #0f3460;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .domain-tag:hover { background: #e94560; }
    .domain-tag.active { background: #e94560; }
    .domain-tag .remove {
      margin-left: 5px;
      opacity: 0.7;
    }
    .domain-tag .remove:hover { opacity: 1; }
    
    /* Buttons */
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }
    .btn-primary { background: #e94560; color: white; }
    .btn-primary:hover { background: #ff6b6b; }
    .btn-secondary { background: #0f3460; color: white; }
    .btn-secondary:hover { background: #16213e; }
    .btn-group { display: flex; gap: 10px; margin-top: 20px; }
    
    /* Main content */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    /* Header */
    .header {
      padding: 15px 20px;
      background: #16213e;
      border-bottom: 1px solid #0f3460;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 { font-size: 1.2rem; }
    .stats {
      display: flex;
      gap: 20px;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      font-size: 1.5rem;
      font-weight: bold;
      color: #e94560;
    }
    .stat-label {
      font-size: 0.75rem;
      color: #888;
    }
    
    /* Filters */
    .filters {
      padding: 10px 20px;
      background: #1a1a2e;
      border-bottom: 1px solid #0f3460;
      display: flex;
      gap: 15px;
      align-items: center;
    }
    .filters input, .filters select {
      padding: 6px 12px;
      background: #0f3460;
      border: 1px solid #16213e;
      border-radius: 4px;
      color: #fff;
      font-size: 0.85rem;
    }
    .filters input { width: 200px; }
    
    /* Request list */
    .request-list {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
    }
    .request-item {
      display: flex;
      align-items: center;
      padding: 10px 15px;
      background: #16213e;
      border-radius: 6px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .request-item:hover { background: #1f2b4a; }
    .request-item.watched { border-left: 3px solid #e94560; }
    
    .method {
      width: 70px;
      font-weight: bold;
      font-size: 0.85rem;
    }
    .method.GET { color: #4ade80; }
    .method.POST { color: #60a5fa; }
    .method.PUT { color: #fbbf24; }
    .method.DELETE { color: #f87171; }
    .method.CONNECT { color: #a78bfa; }
    
    .host {
      width: 200px;
      color: #888;
      font-size: 0.85rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .request-item.watched .host { color: #e94560; }
    
    .path {
      flex: 1;
      color: #aaa;
      font-size: 0.85rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .time {
      width: 80px;
      text-align: right;
      color: #666;
      font-size: 0.75rem;
    }
    
    .status {
      width: 50px;
      text-align: center;
      font-size: 0.85rem;
      font-weight: bold;
    }
    .status.s2xx { color: #4ade80; }
    .status.s3xx { color: #fbbf24; }
    .status.s4xx { color: #f87171; }
    .status.s5xx { color: #ef4444; background: #450a0a; padding: 2px 6px; border-radius: 3px; }
    
    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }
    .empty-state h3 { margin-bottom: 10px; color: #888; }
    
    /* Detail panel */
    .detail-panel {
      position: fixed;
      right: -600px;
      top: 0;
      width: 600px;
      height: 100vh;
      background: #16213e;
      border-left: 1px solid #0f3460;
      transition: right 0.3s;
      overflow-y: auto;
      padding: 20px;
    }
    .detail-panel.open { right: 0; }
    .detail-section {
      margin-bottom: 25px;
    }
    .detail-section h3 {
      color: #e94560;
      font-size: 1rem;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #0f3460;
    }
    .detail-section h4 {
      color: #aaa;
      font-size: 0.85rem;
      margin: 10px 0 5px;
    }
    .detail-info {
      display: grid;
      grid-template-columns: 100px 1fr;
      gap: 8px;
      margin-bottom: 10px;
      font-size: 0.85rem;
    }
    .detail-label {
      color: #888;
      font-weight: 600;
    }
    .detail-value {
      color: #eee;
      word-break: break-all;
    }
    .detail-panel pre {
      background: #0f3460;
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 0.75rem;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 400px;
      line-height: 1.5;
    }
    .header-list {
      background: #0f3460;
      padding: 10px;
      border-radius: 6px;
      font-size: 0.8rem;
      max-height: 300px;
      overflow-y: auto;
    }
    .header-item {
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 10px;
      padding: 5px 0;
      border-bottom: 1px solid #1a1a2e;
    }
    .header-item:last-child {
      border-bottom: none;
    }
    .header-key {
      color: #60a5fa;
      font-weight: 600;
    }
    .header-value {
      color: #ddd;
      word-break: break-all;
    }
    .copy-btn {
      background: #0f3460;
      border: 1px solid #1a1a2e;
      color: #aaa;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 0.75rem;
      cursor: pointer;
      margin-left: 10px;
      transition: all 0.2s;
    }
    .copy-btn:hover {
      background: #e94560;
      color: white;
      border-color: #e94560;
    }
    .close-btn {
      position: absolute;
      top: 15px;
      right: 15px;
      background: none;
      border: none;
      color: #888;
      font-size: 1.5rem;
      cursor: pointer;
      z-index: 10;
    }
    .close-btn:hover { color: #fff; }
  </style>
</head>
<body>
  <div class="container">
    <aside class="sidebar">
      <h2>🔍 Roo Sniffer</h2>
      
      <h3>Proxy Settings</h3>
      <div class="form-group">
        <label>Proxy Port</label>
        <input type="number" id="port" value="8080" disabled>
      </div>
      <div class="form-group">
        <label>Log File</label>
        <input type="text" id="logFile" value="roo_requests.log">
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="verbose"> Verbose Logging
        </label>
      </div>
      
      <h3>Watched Domains</h3>
      <div class="form-group">
        <input type="text" id="newDomain" placeholder="Add domain to watch...">
      </div>
      <div class="domain-tags" id="watchedDomains"></div>
      
      <h3>Discovered Domains</h3>
      <div class="domain-tags" id="discoveredDomains"></div>
      
      <div class="btn-group">
        <button class="btn btn-primary" onclick="saveConfig()">Save Settings</button>
        <button class="btn btn-secondary" onclick="clearRequests()">Clear Log</button>
      </div>

      <h3>🚀 Launch Apps</h3>
      <div style="margin-bottom: 20px;">
        <div class="form-group">
          <input type="text" id="customCommand" placeholder="Enter command..." style="margin-bottom: 10px;">
          <button class="btn btn-primary" style="width: 100%;" onclick="launchCustomCommand()">Launch Command</button>
        </div>
        <div style="font-size: 0.8rem; color: #888; margin-top: 5px;">
          Commands run with proxy env vars automatically set
        </div>

        <h3 style="font-size: 0.85rem; margin: 15px 0 10px; color: #aaa;">Quick Launch</h3>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button class="btn btn-secondary" style="width: 100%;" onclick="launchApp('code --new-window --proxy-server=http://127.0.0.1:8080 --ignore-certificate-errors')">📝 VSCode (New Window)</button>
          <button class="btn btn-secondary" style="width: 100%;" onclick="launchApp('open -a \\'Google Chrome\\' --args --proxy-server=http://127.0.0.1:8080')">🌐 Chrome</button>
          <button class="btn btn-secondary" style="width: 100%;" onclick="launchApp('cursor --new-window --proxy-server=http://127.0.0.1:8080 --ignore-certificate-errors')">⚡ Cursor (New Window)</button>
        </div>
        <div id="launchStatus" style="margin-top: 10px; padding: 8px; border-radius: 4px; font-size: 0.8rem; display: none;"></div>
      </div>

      <h3>Setup Instructions</h3>
      <div style="font-size: 0.8rem; color: #888; line-height: 1.6;">
        <p>1. Set environment variables:</p>
        <pre style="background: #0f3460; padding: 10px; border-radius: 4px; margin: 10px 0; font-size: 0.75rem;">export HTTP_PROXY=http://127.0.0.1:8080
export HTTPS_PROXY=http://127.0.0.1:8080</pre>
        <p>2. Launch VS Code from that terminal</p>
        <p>3. Install CA cert for HTTPS</p>
      </div>
    </aside>
    
    <main class="main">
      <header class="header">
        <h1>Request Monitor</h1>
        <div class="stats">
          <div class="stat">
            <div class="stat-value" id="totalCount">0</div>
            <div class="stat-label">Total</div>
          </div>
          <div class="stat">
            <div class="stat-value" id="watchedCount">0</div>
            <div class="stat-label">Watched</div>
          </div>
        </div>
      </header>
      
      <div class="filters">
        <input type="text" id="searchFilter" placeholder="Filter by host or path...">
        <select id="methodFilter">
          <option value="">All Methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="CONNECT">CONNECT</option>
        </select>
        <select id="watchedFilter">
          <option value="">All Requests</option>
          <option value="watched">Watched Only</option>
          <option value="other">Other Only</option>
        </select>
        <label style="margin-left: auto;">
          <input type="checkbox" id="autoScroll" checked> Auto-scroll
        </label>
      </div>
      
      <div class="request-list" id="requestList">
        <div class="empty-state">
          <h3>No requests captured yet</h3>
          <p>Configure your application to use the proxy and start making requests.</p>
        </div>
      </div>
    </main>
    
    <div class="detail-panel" id="detailPanel">
      <button class="close-btn" onclick="closeDetail()">&times;</button>
      <div id="detailContent"></div>
    </div>
  </div>

  <script>
    let requests = [];
    let config = {};
    
    // Load initial data
    async function init() {
      const [reqRes, configRes, domainsRes] = await Promise.all([
        fetch('/api/requests'),
        fetch('/api/config'),
        fetch('/api/domains')
      ]);
      
      requests = await reqRes.json();
      config = await configRes.json();
      const domains = await domainsRes.json();
      
      document.getElementById('port').value = config.port;
      document.getElementById('logFile').value = config.logFile;
      document.getElementById('verbose').checked = config.verbose;
      
      renderWatchedDomains(config.watchDomains);
      renderDiscoveredDomains(domains.discovered);
      renderRequests();
      
      // Start SSE
      const eventSource = new EventSource('/api/events');
      eventSource.onmessage = (event) => {
        const entry = JSON.parse(event.data);
        requests.push(entry);
        if (requests.length > 1000) requests.shift();
        renderRequests();
        updateDomains(entry.host);
      };
    }
    
    function renderWatchedDomains(domains) {
      const container = document.getElementById('watchedDomains');
      container.innerHTML = domains.map(d => 
        \`<span class="domain-tag active">\${d}<span class="remove" onclick="removeDomain('\${d}')">&times;</span></span>\`
      ).join('');
    }
    
    function renderDiscoveredDomains(domains) {
      const container = document.getElementById('discoveredDomains');
      const watched = config.watchDomains || [];
      container.innerHTML = domains
        .filter(d => !watched.some(w => d.includes(w)))
        .slice(0, 20)
        .map(d => \`<span class="domain-tag" onclick="addDomain('\${d}')">\${d}</span>\`)
        .join('');
    }
    
    function updateDomains(host) {
      const container = document.getElementById('discoveredDomains');
      const watched = config.watchDomains || [];
      if (!watched.some(w => host.includes(w))) {
        const existing = container.querySelector(\`[data-domain="\${host}"]\`);
        if (!existing) {
          const tag = document.createElement('span');
          tag.className = 'domain-tag';
          tag.dataset.domain = host;
          tag.textContent = host;
          tag.onclick = () => addDomain(host);
          container.insertBefore(tag, container.firstChild);
        }
      }
    }
    
    function addDomain(domain) {
      if (!config.watchDomains.includes(domain)) {
        config.watchDomains.push(domain);
        renderWatchedDomains(config.watchDomains);
      }
    }
    
    function removeDomain(domain) {
      config.watchDomains = config.watchDomains.filter(d => d !== domain);
      renderWatchedDomains(config.watchDomains);
    }
    
    document.getElementById('newDomain').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        addDomain(e.target.value.trim());
        e.target.value = '';
      }
    });
    
    async function saveConfig() {
      config.logFile = document.getElementById('logFile').value;
      config.verbose = document.getElementById('verbose').checked;
      
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      alert('Settings saved!');
    }
    
    async function clearRequests() {
      await fetch('/api/clear', { method: 'POST' });
      requests = [];
      renderRequests();
    }
    
    function renderRequests() {
      const container = document.getElementById('requestList');
      const search = document.getElementById('searchFilter').value.toLowerCase();
      const method = document.getElementById('methodFilter').value;
      const watched = document.getElementById('watchedFilter').value;
      
      let filtered = requests.filter(r => {
        if (search && !r.host.toLowerCase().includes(search) && !r.path.toLowerCase().includes(search)) return false;
        if (method && r.method !== method) return false;
        if (watched === 'watched' && !r.watched) return false;
        if (watched === 'other' && r.watched) return false;
        return true;
      });
      
      // Update stats
      document.getElementById('totalCount').textContent = requests.length;
      document.getElementById('watchedCount').textContent = requests.filter(r => r.watched).length;
      
      if (filtered.length === 0) {
        container.innerHTML = \`
          <div class="empty-state">
            <h3>No requests captured yet</h3>
            <p>Configure your application to use the proxy and start making requests.</p>
          </div>
        \`;
        return;
      }
      
      container.innerHTML = filtered.slice(-100).reverse().map((r, i) => {
        const statusClass = r.statusCode ? 's' + Math.floor(r.statusCode / 100) + 'xx' : '';
        const time = new Date(r.timestamp).toLocaleTimeString();
        return \`
          <div class="request-item \${r.watched ? 'watched' : ''}" onclick="showDetail(\${filtered.length - 1 - i})">
            <span class="method \${r.method}">\${r.method}</span>
            <span class="host">\${r.host}</span>
            <span class="path">\${r.path}</span>
            <span class="status \${statusClass}">\${r.statusCode || ''}</span>
            <span class="time">\${time}</span>
          </div>
        \`;
      }).join('');
      
      if (document.getElementById('autoScroll').checked) {
        container.scrollTop = 0;
      }
    }
    
    function showDetail(index) {
      const r = requests[index];
      const time = new Date(r.timestamp).toLocaleString();

      let html = \`
        <div class="detail-section">
          <h3>Request Overview</h3>
          <div class="detail-info">
            <span class="detail-label">Method:</span>
            <span class="detail-value" style="color: \${getMethodColor(r.method)}; font-weight: bold;">\${r.method}</span>
          </div>
          <div class="detail-info">
            <span class="detail-label">Host:</span>
            <span class="detail-value">\${r.host}</span>
          </div>
          <div class="detail-info">
            <span class="detail-label">Path:</span>
            <span class="detail-value">\${r.path}</span>
          </div>
          <div class="detail-info">
            <span class="detail-label">Timestamp:</span>
            <span class="detail-value">\${time}</span>
          </div>
          \${r.statusCode ? \`
          <div class="detail-info">
            <span class="detail-label">Status:</span>
            <span class="detail-value" style="color: \${getStatusColor(r.statusCode)}; font-weight: bold;">\${r.statusCode}</span>
          </div>
          \` : ''}
          <div class="detail-info">
            <span class="detail-label">Watched:</span>
            <span class="detail-value" style="color: \${r.watched ? '#4ade80' : '#888'};">\${r.watched ? '✓ Yes' : '✗ No'}</span>
          </div>
        </div>
      \`;

      // Headers section
      if (r.headers && Object.keys(r.headers).length > 0) {
        html += \`
          <div class="detail-section">
            <h3>Request Headers</h3>
            <div class="header-list">
              \${Object.entries(r.headers).map(([key, value]) => \`
                <div class="header-item">
                  <span class="header-key">\${key}</span>
                  <span class="header-value">\${Array.isArray(value) ? value.join(', ') : value}</span>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
      }

      // Request Body section
      if (r.bodyPreview) {
        const canParse = r.bodyPreview !== '<binary>';
        let formattedBody = r.bodyPreview;

        if (canParse) {
          try {
            const parsed = JSON.parse(r.bodyPreview);
            formattedBody = JSON.stringify(parsed, null, 2);
          } catch {
            // Not JSON, use as-is
          }
        }

        html += \`
          <div class="detail-section">
            <h3>Request Body
              \${canParse ? '<button class="copy-btn" onclick="copyRequestBody(' + index + ')">Copy</button>' : ''}
            </h3>
            <pre>\${escapeHtml(formattedBody)}</pre>
          </div>
        \`;
      }

      // Response section
      if (r.responsePreview) {
        const canParse = r.responsePreview !== '<binary>';
        let formattedResponse = r.responsePreview;

        if (canParse) {
          try {
            const parsed = JSON.parse(r.responsePreview);
            formattedResponse = JSON.stringify(parsed, null, 2);
          } catch {
            // Not JSON, use as-is
          }
        }

        html += \`
          <div class="detail-section">
            <h3>Response Body
              \${canParse ? '<button class="copy-btn" onclick="copyResponseBody(' + index + ')">Copy</button>' : ''}
            </h3>
            <pre>\${escapeHtml(formattedResponse)}</pre>
          </div>
        \`;
      }

      // Raw JSON section
      html += \`
        <div class="detail-section">
          <h3>Raw JSON
            <button class="copy-btn" onclick="copyRawJson(' + index + ')">Copy</button>
          </h3>
          <pre>\${escapeHtml(JSON.stringify(r, null, 2))}</pre>
        </div>
      \`;

      document.getElementById('detailContent').innerHTML = html;
      document.getElementById('detailPanel').classList.add('open');
    }

    function getMethodColor(method) {
      const colors = {
        'GET': '#4ade80',
        'POST': '#60a5fa',
        'PUT': '#fbbf24',
        'DELETE': '#f87171',
        'CONNECT': '#a78bfa'
      };
      return colors[method] || '#888';
    }

    function getStatusColor(status) {
      if (status >= 200 && status < 300) return '#4ade80';
      if (status >= 300 && status < 400) return '#fbbf24';
      if (status >= 400 && status < 500) return '#f87171';
      if (status >= 500) return '#ef4444';
      return '#888';
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
        // Show brief success indicator
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.background = '#1a4d2e';
        btn.style.color = '#4ade80';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.style.color = '';
        }, 1500);
      });
    }

    function copyRequestBody(index) {
      const r = requests[index];
      if (r.bodyPreview) {
        copyToClipboard(r.bodyPreview);
      }
    }

    function copyResponseBody(index) {
      const r = requests[index];
      if (r.responsePreview) {
        copyToClipboard(r.responsePreview);
      }
    }

    function copyRawJson(index) {
      const r = requests[index];
      copyToClipboard(JSON.stringify(r, null, 2));
    }
    
    function closeDetail() {
      document.getElementById('detailPanel').classList.remove('open');
    }
    
    // Filter listeners
    ['searchFilter', 'methodFilter', 'watchedFilter'].forEach(id => {
      document.getElementById(id).addEventListener('input', renderRequests);
      document.getElementById(id).addEventListener('change', renderRequests);
    });

    // Launch app functions
    async function launchApp(command) {
      const statusEl = document.getElementById('launchStatus');
      statusEl.style.display = 'block';
      statusEl.style.background = '#0f3460';
      statusEl.style.color = '#aaa';
      statusEl.textContent = 'Launching...';

      try {
        const response = await fetch('/api/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command })
        });

        const result = await response.json();

        if (result.success) {
          statusEl.style.background = '#1a4d2e';
          statusEl.style.color = '#4ade80';
          statusEl.textContent = '✓ ' + result.message;
        } else {
          statusEl.style.background = '#4d1a1a';
          statusEl.style.color = '#f87171';
          statusEl.textContent = '✗ ' + (result.error || 'Launch failed');
        }
      } catch (e) {
        statusEl.style.background = '#4d1a1a';
        statusEl.style.color = '#f87171';
        statusEl.textContent = '✗ Error: ' + e.message;
      }

      setTimeout(() => {
        statusEl.style.display = 'none';
      }, 5000);
    }

    function launchCustomCommand() {
      const input = document.getElementById('customCommand');
      const command = input.value.trim();

      if (!command) {
        const statusEl = document.getElementById('launchStatus');
        statusEl.style.display = 'block';
        statusEl.style.background = '#4d1a1a';
        statusEl.style.color = '#f87171';
        statusEl.textContent = '✗ Please enter a command';
        setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
        return;
      }

      launchApp(command);
      input.value = '';
    }

    // Enter key for custom command
    document.getElementById('customCommand').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        launchCustomCommand();
      }
    });

    init();
  </script>
</body>
</html>`;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  public start(): void {
    this.server.listen(this.uiPort, () => {
      console.log(`🌐 Web UI available at http://localhost:${this.uiPort}`);
    });
  }

  public stop(): void {
    this.server.close();
  }
}
