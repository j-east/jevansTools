#!/bin/bash

# Roo Sniffer Debug Startup Script
# This script sets up everything needed to debug the Roo Code extension

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROXY_PORT=8080
UI_PORT=8081
FRONTEND_URL="http://localhost:${UI_PORT}"
CERT_DIR=".roo-sniffer-certs"
VSCODE_WORKSPACE="${VSCODE_WORKSPACE:-$HOME}"

echo -e "${BLUE}🔧 Roo Sniffer Debug Startup${NC}"
echo "================================"

# Step 1: Check if proxy is already running
echo -e "\n${YELLOW}[1/6]${NC} Checking if proxy is already running..."
if lsof -Pi :${PROXY_PORT} -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${RED}✗ Proxy already running on port ${PROXY_PORT}${NC}"
    echo "Please stop the existing proxy first with: pkill -f 'node.*cli.js'"
    exit 1
else
    echo -e "${GREEN}✓ Port ${PROXY_PORT} is available${NC}"
fi

# Step 2: Trust the CA certificate
echo -e "\n${YELLOW}[2/6]${NC} Setting up certificates..."
if [ -f "${CERT_DIR}/roo-sniffer-ca.pem" ]; then
    echo "Installing CA certificate to system keychain..."
    if sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${CERT_DIR}/roo-sniffer-ca.pem" 2>/dev/null; then
        echo -e "${GREEN}✓ Certificate installed${NC}"
    else
        echo -e "${YELLOW}⚠ Certificate may already be installed${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Certificate not found. It will be generated when proxy starts.${NC}"
fi

# Step 3: Set environment variables for this shell
echo -e "\n${YELLOW}[3/6]${NC} Setting proxy environment variables..."
export HTTP_PROXY="http://127.0.0.1:${PROXY_PORT}"
export HTTPS_PROXY="http://127.0.0.1:${PROXY_PORT}"
export http_proxy="http://127.0.0.1:${PROXY_PORT}"
export https_proxy="http://127.0.0.1:${PROXY_PORT}"
export NODE_TLS_REJECT_UNAUTHORIZED=0

echo -e "${GREEN}✓ Environment configured:${NC}"
echo "  HTTP_PROXY=${HTTP_PROXY}"
echo "  HTTPS_PROXY=${HTTPS_PROXY}"

# Step 4: Start the proxy in the background
echo -e "\n${YELLOW}[4/6]${NC} Starting Roo Sniffer proxy..."
node dist/cli.js -p ${PROXY_PORT} -v > /tmp/roo-sniffer.log 2>&1 &
PROXY_PID=$!

# Wait for proxy to start
sleep 2

if ps -p $PROXY_PID > /dev/null; then
    echo -e "${GREEN}✓ Proxy started (PID: ${PROXY_PID})${NC}"
    echo "  Logs: tail -f /tmp/roo-sniffer.log"
    echo "  Web UI: ${FRONTEND_URL}"
else
    echo -e "${RED}✗ Failed to start proxy${NC}"
    cat /tmp/roo-sniffer.log
    exit 1
fi

# Step 5: Launch Chrome with the Web UI
echo -e "\n${YELLOW}[5/6]${NC} Launching Chrome with Web UI..."
sleep 1  # Give web UI time to start

if command -v open >/dev/null 2>&1; then
    # macOS - use default browser
    open "${FRONTEND_URL}" 2>/dev/null || echo -e "${YELLOW}⚠ Could not open browser. Please visit ${FRONTEND_URL} manually${NC}"
elif command -v google-chrome >/dev/null 2>&1; then
    google-chrome "${FRONTEND_URL}" 2>/dev/null &
elif command -v chromium >/dev/null 2>&1; then
    chromium "${FRONTEND_URL}" 2>/dev/null &
else
    echo -e "${YELLOW}⚠ Chrome not found. Please open ${FRONTEND_URL} manually${NC}"
fi

echo -e "${GREEN}✓ Browser launched${NC}"

# Step 6: Launch VSCode with proxy settings
echo -e "\n${YELLOW}[6/6]${NC} Launching VSCode with proxy configuration..."

if ! command -v code >/dev/null 2>&1; then
    echo -e "${RED}✗ 'code' command not found${NC}"
    echo "Please install VSCode command line tools:"
    echo "  1. Open VSCode"
    echo "  2. Press Cmd+Shift+P"
    echo "  3. Type 'shell command'"
    echo "  4. Select 'Install code command in PATH'"
    exit 1
fi

# Launch VSCode with proxy settings
code \
    --new-window \
    --proxy-server="http://127.0.0.1:${PROXY_PORT}" \
    --proxy-bypass-list="" \
    --ignore-certificate-errors \
    "${VSCODE_WORKSPACE}" 2>/dev/null &

VSCODE_PID=$!

echo -e "${GREEN}✓ VSCode launched (PID: ${VSCODE_PID})${NC}"

# Summary
echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}✓ Debug environment ready!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "📊 Web UI: ${FRONTEND_URL}"
echo "📝 Request Log: $(pwd)/roo_requests.log"
echo "🔍 Proxy Log: /tmp/roo-sniffer.log"
echo ""
echo "Process IDs:"
echo "  Proxy: ${PROXY_PID}"
echo "  VSCode: ${VSCODE_PID}"
echo ""
echo "To view live requests:"
echo "  tail -f roo_requests.log"
echo "  tail -f /tmp/roo-sniffer.log"
echo ""
echo "To stop everything:"
echo "  pkill -f 'node.*cli.js'"
echo "  pkill -f 'code.*proxy-server'"
echo ""
echo -e "${BLUE}Happy debugging! 🚀${NC}"
