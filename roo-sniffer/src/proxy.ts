import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as tls from 'tls';
import { URL } from 'url';
import { CertificateManager } from './certs';
import { Logger } from './logger';
import { RequestLogEntry, SnifferConfig } from './types';
import { WebUI } from './webui';

export class ProxyServer {
  private config: SnifferConfig;
  private server: http.Server;
  private certManager: CertificateManager;
  private logger: Logger;
  private webUI: WebUI | null = null;
  private onRequest: ((entry: RequestLogEntry) => void) | null = null;

  constructor(config: SnifferConfig, uiPort?: number) {
    this.config = config;
    this.certManager = new CertificateManager(config.certDir);
    this.logger = new Logger(config);
    this.server = http.createServer(this.handleRequest.bind(this));
    this.server.on('connect', this.handleConnect.bind(this));
    
    if (uiPort) {
      this.webUI = new WebUI(config, uiPort);
      this.onRequest = (entry) => this.webUI?.addRequest(entry);
    }
  }

  private isWatchedDomain(host: string): boolean {
    return this.config.watchDomains.some(domain => host.includes(domain));
  }

  private async handleRequest(
    clientReq: http.IncomingMessage,
    clientRes: http.ServerResponse
  ): Promise<void> {
    const url = clientReq.url || '/';
    const host = clientReq.headers.host || 'unknown';
    const method = clientReq.method || 'GET';
    const isWatched = this.isWatchedDomain(host);

    // Collect request body
    const bodyChunks: Buffer[] = [];
    clientReq.on('data', (chunk: Buffer) => bodyChunks.push(chunk));

    clientReq.on('end', () => {
      const body = Buffer.concat(bodyChunks);
      
      // Log the request
      const entry: RequestLogEntry = {
        timestamp: new Date().toISOString(),
        method,
        host,
        path: url,
        watched: isWatched,
      };

      if (isWatched && ['POST', 'PUT', 'PATCH'].includes(method) && body.length > 0) {
        try {
          const bodyText = body.toString('utf8');
          entry.bodyPreview = bodyText.length > 500 
            ? bodyText.substring(0, 500) + '...' 
            : bodyText;
        } catch {
          entry.bodyPreview = '<binary>';
        }
      }

      if (this.config.verbose) {
        entry.headers = clientReq.headers as Record<string, string | string[] | undefined>;
      }

      this.logger.logRequest(entry);
      this.onRequest?.(entry);

      // Parse the target URL
      let targetUrl: URL;
      try {
        if (url.startsWith('http://') || url.startsWith('https://')) {
          targetUrl = new URL(url);
        } else {
          targetUrl = new URL(`http://${host}${url}`);
        }
      } catch (e) {
        clientRes.writeHead(400, { 'Content-Type': 'text/plain' });
        clientRes.end('Bad Request');
        return;
      }

      // Forward the request
      const options: http.RequestOptions = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || 80,
        path: targetUrl.pathname + targetUrl.search,
        method,
        headers: { ...clientReq.headers },
      };

      // Remove proxy-specific headers
      if (options.headers && typeof options.headers === 'object' && !Array.isArray(options.headers)) {
        delete (options.headers as Record<string, unknown>)['proxy-connection'];
      }

      const proxyReq = http.request(options, (proxyRes) => {
        // Collect response for logging
        const responseChunks: Buffer[] = [];
        
        proxyRes.on('data', (chunk: Buffer) => {
          responseChunks.push(chunk);
          clientRes.write(chunk);
        });

        proxyRes.on('end', () => {
          const responseBody = Buffer.concat(responseChunks);
          
          if (isWatched && this.config.verbose) {
            try {
              entry.responsePreview = responseBody.toString('utf8').substring(0, 500);
            } catch {
              entry.responsePreview = '<binary>';
            }
          }
          
          entry.statusCode = proxyRes.statusCode;
          this.logger.logResponse(entry);
          clientRes.end();
        });

        clientRes.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      });

      proxyReq.on('error', (err) => {
        this.logger.error(`Proxy request error: ${err.message}`);
        clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
        clientRes.end('Bad Gateway');
      });

      if (body.length > 0) {
        proxyReq.write(body);
      }
      proxyReq.end();
    });
  }

  private handleConnect(
    req: http.IncomingMessage,
    clientSocket: net.Socket,
    head: Buffer
  ): void {
    const [hostname, portStr] = (req.url || '').split(':');
    const port = parseInt(portStr, 10) || 443;
    const isWatched = this.isWatchedDomain(hostname);

    // Log CONNECT request
    const entry: RequestLogEntry = {
      timestamp: new Date().toISOString(),
      method: 'CONNECT',
      host: hostname,
      path: `:${port}`,
      watched: isWatched,
    };
    this.logger.logRequest(entry);
    this.onRequest?.(entry);

    if (isWatched) {
      // MITM: Intercept HTTPS traffic for watched domains
      this.interceptHttps(hostname, port, clientSocket, head);
    } else {
      // Tunnel: Just pass through for non-watched domains
      this.tunnelHttps(hostname, port, clientSocket, head);
    }
  }

  private tunnelHttps(
    hostname: string,
    port: number,
    clientSocket: net.Socket,
    head: Buffer
  ): void {
    const serverSocket = net.connect(port, hostname, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      serverSocket.write(head);
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });

    serverSocket.on('error', (err) => {
      this.logger.error(`Tunnel error to ${hostname}:${port}: ${err.message}`);
      clientSocket.end();
    });

    clientSocket.on('error', (err) => {
      this.logger.error(`Client socket error: ${err.message}`);
      serverSocket.end();
    });
  }

  private interceptHttps(
    hostname: string,
    port: number,
    clientSocket: net.Socket,
    head: Buffer
  ): void {
    // Get certificate for this host
    const certInfo = this.certManager.getCertificateForHost(hostname);

    // Tell client the connection is established
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

    // Upgrade client connection to TLS
    const tlsSocket = new tls.TLSSocket(clientSocket, {
      isServer: true,
      key: certInfo.key,
      cert: certInfo.cert,
    });

    // Create a connection to the actual server
    const serverConnection = tls.connect({
      host: hostname,
      port: port,
      servername: hostname,
      rejectUnauthorized: false, // Allow self-signed certs for interception
    }, () => {
      if (this.config.verbose) {
        this.logger.info(`TLS tunnel established to ${hostname}:${port}`);
      }
    });

    // Buffer for parsing HTTP requests from client
    let clientBuffer = Buffer.alloc(0);

    tlsSocket.on('data', (chunk: Buffer) => {
      clientBuffer = Buffer.concat([clientBuffer, chunk]);

      // Try to parse and log HTTP request
      const requestStr = clientBuffer.toString('utf8');
      const headerEnd = requestStr.indexOf('\r\n\r\n');

      if (headerEnd !== -1) {
        const headerPart = requestStr.substring(0, headerEnd);
        const lines = headerPart.split('\r\n');

        if (lines.length > 0) {
          const requestLine = lines[0].split(' ');
          const method = requestLine[0] || 'UNKNOWN';
          const path = requestLine[1] || '/';

          // Extract headers
          const headers: Record<string, string> = {};
          for (let i = 1; i < lines.length; i++) {
            const colonIdx = lines[i].indexOf(':');
            if (colonIdx !== -1) {
              const key = lines[i].substring(0, colonIdx).trim().toLowerCase();
              const value = lines[i].substring(colonIdx + 1).trim();
              headers[key] = value;
            }
          }

          // Calculate body length
          const contentLength = parseInt(headers['content-length'] || '0', 10);
          const bodyStart = headerEnd + 4;
          const currentBodyLength = clientBuffer.length - bodyStart;

          // Only process if we have the complete request (including body)
          if (currentBodyLength >= contentLength) {
            const body = clientBuffer.slice(bodyStart, bodyStart + contentLength);

            // Log the intercepted request
            const entry: RequestLogEntry = {
              timestamp: new Date().toISOString(),
              method,
              host: hostname,
              path,
              watched: true,
            };

            if (['POST', 'PUT', 'PATCH'].includes(method) && body.length > 0) {
              try {
                const bodyText = body.toString('utf8');
                entry.bodyPreview = bodyText.length > 500
                  ? bodyText.substring(0, 500) + '...'
                  : bodyText;
              } catch {
                entry.bodyPreview = '<binary>';
              }
            }

            if (this.config.verbose) {
              entry.headers = headers;
            }

            this.logger.logRequest(entry);
            this.onRequest?.(entry);

            // Remove processed request from buffer
            clientBuffer = clientBuffer.slice(bodyStart + contentLength);
          }
        }
      }

      // Forward all data to server regardless of parsing
      serverConnection.write(chunk);
    });

    // Forward server responses back to client
    let serverBuffer = Buffer.alloc(0);

    serverConnection.on('data', (chunk: Buffer) => {
      serverBuffer = Buffer.concat([serverBuffer, chunk]);

      // Try to parse HTTP response for logging
      const responseStr = serverBuffer.toString('utf8');
      const headerEnd = responseStr.indexOf('\r\n\r\n');

      if (headerEnd !== -1) {
        const headerPart = responseStr.substring(0, headerEnd);
        const lines = headerPart.split('\r\n');

        if (lines.length > 0 && this.config.verbose) {
          const statusLine = lines[0].split(' ');
          const statusCode = parseInt(statusLine[1], 10);

          if (!isNaN(statusCode)) {
            this.logger.info(`← ${statusCode} ${statusLine.slice(2).join(' ')}`);
          }
        }

        serverBuffer = Buffer.alloc(0); // Reset after logging
      }

      // Forward all data to client
      tlsSocket.write(chunk);
    });

    // Handle errors and cleanup
    tlsSocket.on('error', (err) => {
      if (this.config.verbose) {
        this.logger.error(`TLS client socket error: ${err.message}`);
      }
      serverConnection.end();
    });

    serverConnection.on('error', (err) => {
      if (this.config.verbose) {
        this.logger.error(`TLS server connection error to ${hostname}: ${err.message}`);
      }
      tlsSocket.end();
    });

    tlsSocket.on('end', () => {
      serverConnection.end();
    });

    serverConnection.on('end', () => {
      tlsSocket.end();
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          this.logger.error(`Port ${this.config.port} is already in use.`);
          this.logger.info(`Try: lsof -ti:${this.config.port} | xargs kill -9`);
          this.logger.info(`Or use a different port: roo-sniffer -p ${this.config.port + 1}`);
        } else {
          this.logger.error(`Server error: ${err.message}`);
        }
        reject(err);
      });

      this.server.listen(this.config.port, () => {
        this.logger.success(`Roo Sniffer proxy listening on port ${this.config.port}`);
        this.logger.info(`Watching domains: ${this.config.watchDomains.join(', ')}`);
        this.logger.info(`Log file: ${this.config.logFile}`);
        this.logger.info(`CA certificate: ${this.certManager.getCACertPath()}`);
        this.logger.info('');
        this.logger.info('To use this proxy, set these environment variables:');
        this.logger.info(`  export HTTP_PROXY=http://127.0.0.1:${this.config.port}`);
        this.logger.info(`  export HTTPS_PROXY=http://127.0.0.1:${this.config.port}`);
        this.logger.info('');
        this.logger.info('For HTTPS interception, install the CA certificate:');
        this.logger.info(`  open ${this.certManager.getCACertPath()}`);
        this.logger.info('');
        
        if (this.webUI) {
          this.webUI.start();
        }
        
        resolve();
      });
    });
  }

  public stop(): void {
    this.server.close();
    this.webUI?.stop();
    this.logger.close();
  }
}
