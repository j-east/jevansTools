#!/usr/bin/env node

import { exec } from 'child_process';
import { ProxyServer } from './proxy';
import { DEFAULT_CONFIG, SnifferConfig } from './types';

interface CLIOptions extends Partial<SnifferConfig> {
  uiPort?: number;
  noOpen?: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const config: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '-p':
      case '--port':
        config.port = parseInt(args[++i], 10);
        break;
      case '-l':
      case '--log':
        config.logFile = args[++i];
        break;
      case '-w':
      case '--watch':
        config.watchDomains = args[++i].split(',').map(d => d.trim());
        break;
      case '-v':
      case '--verbose':
        config.verbose = true;
        break;
      case '-c':
      case '--cert-dir':
        config.certDir = args[++i];
        break;
      case '-u':
      case '--ui':
        config.uiPort = parseInt(args[++i], 10) || 8081;
        break;
      case '--no-open':
        config.noOpen = true;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          printHelp();
          process.exit(1);
        }
    }
  }

  // Default to enabling UI on port 8081
  if (config.uiPort === undefined) {
    config.uiPort = 8081;
  }

  return config;
}

function printHelp(): void {
  console.log(`
Roo Sniffer - HTTP/HTTPS Proxy for API Request Monitoring

Usage: roo-sniffer [options]

Options:
  -p, --port <port>       Proxy port to listen on (default: ${DEFAULT_CONFIG.port})
  -u, --ui <port>         Web UI port (default: 8081, use 0 to disable)
  --no-open               Don't auto-open browser
  -l, --log <file>        Log file path (default: ${DEFAULT_CONFIG.logFile})
  -w, --watch <domains>   Comma-separated list of domains to watch
                          (default: ${DEFAULT_CONFIG.watchDomains.join(',')})
  -v, --verbose           Enable verbose logging (headers, response bodies)
  -c, --cert-dir <dir>    Directory for CA certificates (default: ${DEFAULT_CONFIG.certDir})
  -h, --help              Show this help message

Examples:
  roo-sniffer                           # Start with defaults + web UI
  roo-sniffer -u 0                      # Disable web UI
  roo-sniffer -p 9090                   # Use port 9090 for proxy
  roo-sniffer -w "openai,anthropic"     # Watch specific domains
  roo-sniffer -v                        # Verbose mode

Setup:
  1. Start the proxy: roo-sniffer
  2. Set environment variables:
     export HTTP_PROXY=http://127.0.0.1:8080
     export HTTPS_PROXY=http://127.0.0.1:8080
  3. For HTTPS interception, install the CA certificate:
     open ~/.roo-sniffer-certs/roo-sniffer-ca.pem
     (Add to System Keychain and trust for SSL)
  4. Launch your application from the same terminal
`);
}

function printBanner(): void {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🔍 Roo Sniffer - HTTP/HTTPS Proxy Monitor               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
}

function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;
  
  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  
  exec(command, (err) => {
    if (err) {
      console.log(`Could not open browser automatically. Visit: ${url}`);
    }
  });
}

async function main(): Promise<void> {
  printBanner();
  
  const cliOptions = parseArgs();
  const { uiPort, noOpen, ...userConfig } = cliOptions;
  
  const config: SnifferConfig = {
    ...DEFAULT_CONFIG,
    ...userConfig,
  };

  const proxy = new ProxyServer(config, uiPort && uiPort > 0 ? uiPort : undefined);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down Roo Sniffer...');
    proxy.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    proxy.stop();
    process.exit(0);
  });

  try {
    await proxy.start();
    
    // Open browser after successful start
    if (uiPort && uiPort > 0 && !noOpen) {
      setTimeout(() => {
        openBrowser(`http://localhost:${uiPort}`);
      }, 500);
    }
  } catch (err) {
    // Error already logged by proxy
    process.exit(1);
  }
}

main();
