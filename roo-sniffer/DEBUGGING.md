# Debugging Quick Reference

## Start Debugging (Easiest Way)

```bash
npm start
```

Then open http://localhost:8081 and use the **🚀 Launch Apps** section to launch any app!

- Click "📝 VSCode" to launch VSCode with proxy settings
- Click "🌐 Chrome" to launch Chrome with proxy settings
- Or enter any custom command - proxy env vars are set automatically

## Alternative: Automated Debug Script

```bash
npm run debug
```

This single command will:
1. ✅ Start the Roo Sniffer proxy on port 8080
2. ✅ Install and trust the CA certificate (requires sudo password)
3. ✅ Open the Web UI at http://localhost:8081
4. ✅ Launch VSCode with proxy configuration
5. ✅ Set all environment variables

## Stop Debugging

```bash
npm run debug:stop
```

## View Live Traffic

### Web UI (Recommended)
- URL: http://localhost:8081
- Real-time request/response display
- Filter by domain
- Search request bodies

### Terminal Logs
```bash
# Request log (JSON format)
tail -f roo_requests.log

# Proxy debug log
tail -f /tmp/roo-sniffer.log
```

## Troubleshooting

### Certificate Issues
If you see SSL/TLS errors:
```bash
# Reinstall certificate
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain .roo-sniffer-certs/roo-sniffer-ca.pem
```

### Port Already in Use
```bash
# Check what's using port 8080
lsof -i :8080

# Kill existing proxy
npm run debug:stop
```

### VSCode Not Proxying
1. Completely quit VSCode (Cmd+Q)
2. Run `npm run debug` again
3. The script will launch VSCode with correct proxy settings

### No Requests Showing Up
1. Make sure you're using the VSCode instance launched by the debug script
2. Check that the proxy is running: `lsof -i :8080`
3. Verify certificate is trusted in Keychain Access
4. Try the Roo Code extension to trigger some API calls

## What Gets Captured

By default, Roo Sniffer watches these domains:
- `anthropic` - Anthropic API (Claude)
- `openai` - OpenAI API
- `api.roo` - Roo Code backend
- `amazonaws` - AWS services
- `azure` - Microsoft Azure

To watch different domains:
```bash
node dist/cli.js -w "example.com,api.custom.io"
```

## Manual VSCode Launch

If you need more control:
```bash
# Start proxy first
npm start

# Then launch VSCode manually
code --proxy-server="http://127.0.0.1:8080" --ignore-certificate-errors
```

## Environment Variables Set by Debug Script

```bash
HTTP_PROXY=http://127.0.0.1:8080
HTTPS_PROXY=http://127.0.0.1:8080
http_proxy=http://127.0.0.1:8080
https_proxy=http://127.0.0.1:8080
NODE_TLS_REJECT_UNAUTHORIZED=0
```

## Process Management

The debug script tracks these processes:
- **Proxy**: Node.js process running the proxy server
- **VSCode**: Code editor with proxy configuration

All processes are automatically cleaned up by `npm run debug:stop`.
