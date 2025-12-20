# Roo Sniffer

A TypeScript-based HTTP/HTTPS proxy for monitoring and logging API requests. Similar to mitmproxy but written in TypeScript for easy customization.

## Features

- 🔍 **HTTP/HTTPS Interception** - Captures both HTTP and HTTPS traffic
- 🎯 **Domain Watching** - Highlights requests to specific domains (Anthropic, OpenAI, AWS, Azure, etc.)
- 📝 **Request Logging** - Logs all requests to a JSON file for later analysis
- 🔐 **Dynamic Certificate Generation** - Generates certificates on-the-fly for HTTPS interception
- 🎨 **Colorized Output** - Easy-to-read console output with method and status coloring
- 🌐 **Web UI** - Beautiful web interface with real-time request monitoring
- 🚀 **App Launcher** - Launch applications with proxy settings from the web UI

## Installation

```bash
cd roo-sniffer
npm install
npm run build
```

## Usage

### Quick Start - Debug Mode (Recommended for VSCode/Roo Code)

The easiest way to debug VSCode extensions like Roo Code:

```bash
npm run debug
```

This automatically:
- ✅ Starts the proxy server
- ✅ Installs and trusts the CA certificate
- ✅ Launches the Web UI in your browser (http://localhost:8081)
- ✅ Opens VSCode with proxy configuration
- ✅ Sets all necessary environment variables

To stop everything:
```bash
npm run debug:stop
```

### Manual Setup

#### Start the proxy

```bash
# Using npm
npm start

# Or directly
node dist/cli.js

# With options
node dist/cli.js -p 9090 -v
```

#### Configure your environment

Set these environment variables to route traffic through the proxy:

```bash
export HTTP_PROXY=http://127.0.0.1:8080
export HTTPS_PROXY=http://127.0.0.1:8080
```

Then launch your application from the same terminal.

#### Install CA Certificate (for HTTPS)

To intercept HTTPS traffic, you need to install the CA certificate:

1. Start the proxy once to generate the certificate
2. Open the certificate:
   ```bash
   open .roo-sniffer-certs/roo-sniffer-ca.pem
   ```
3. Add it to your System Keychain
4. Double-click the certificate in Keychain Access
5. Expand "Trust" and set "When using this certificate" to "Always Trust"

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port <port>` | Port to listen on | 8080 |
| `-l, --log <file>` | Log file path | roo_requests.log |
| `-w, --watch <domains>` | Comma-separated domains to watch | anthropic,openai,api.roo,amazonaws,azure |
| `-v, --verbose` | Enable verbose logging | false |
| `-c, --cert-dir <dir>` | Directory for certificates | .roo-sniffer-certs |
| `-h, --help` | Show help | - |

## Examples

```bash
# Watch only OpenAI and Anthropic
node dist/cli.js -w "openai,anthropic"

# Use a different port with verbose logging
node dist/cli.js -p 9090 -v

# Custom log file
node dist/cli.js -l my_requests.log
```

## Log Format

Requests are logged as JSON lines in the log file:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "method": "POST",
  "host": "api.anthropic.com",
  "path": "/v1/messages",
  "watched": true,
  "bodyPreview": "{\"model\":\"claude-3\"...}"
}
```

## Debugging VSCode Extensions

Roo Sniffer is perfect for debugging VSCode extensions like Roo Code that make API calls.

### **Easy Mode: Web UI Launcher** (Recommended)

1. **Start the proxy:**
   ```bash
   npm start
   ```

2. **Open the Web UI:** http://localhost:8081

3. **Launch apps from the UI:**
   - Use the "🚀 Launch Apps" section in the sidebar
   - Click pre-configured buttons (VSCode, Chrome, Cursor)
   - Or enter custom commands - they run with proxy env vars automatically!

4. **Watch the requests flow in!**

### **Alternative: Debug Script Mode**

1. **Run debug mode:**
   ```bash
   npm run debug
   ```

2. **Use the extension** - All API calls will be captured

3. **View requests in real-time:**
   - Web UI: http://localhost:8081
   - Terminal: `tail -f roo_requests.log`
   - Proxy logs: `tail -f /tmp/roo-sniffer.log`

4. **When done:**
   ```bash
   npm run debug:stop
   ```

**Note:** Both methods launch fresh instances with proxy settings. Your existing windows won't be affected.

## How It Works

1. **HTTP Requests**: Directly proxied and logged
2. **HTTPS Requests**:
   - Client sends CONNECT request
   - For watched domains: MITM interception with dynamic certificate
   - For other domains: Simple TCP tunnel (no interception)

## Development

```bash
# Run in development mode
npm run dev

# Build
npm run build

# Clean build artifacts
npm run clean
```

## License

MIT
