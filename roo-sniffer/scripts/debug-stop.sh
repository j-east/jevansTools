#!/bin/bash

# Roo Sniffer Debug Stop Script
# Cleans up all processes started by debug-start.sh

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping Roo Sniffer Debug Environment${NC}"
echo "==========================================="

# Stop proxy
echo -e "\n${YELLOW}Stopping proxy...${NC}"
if pkill -f 'node.*cli.js' 2>/dev/null; then
    echo -e "${GREEN}✓ Proxy stopped${NC}"
else
    echo -e "${YELLOW}⚠ No proxy process found${NC}"
fi

# Stop VSCode instances with proxy settings
echo -e "\n${YELLOW}Stopping VSCode with proxy settings...${NC}"
if pkill -f 'code.*proxy-server' 2>/dev/null; then
    echo -e "${GREEN}✓ VSCode instances stopped${NC}"
else
    echo -e "${YELLOW}⚠ No VSCode proxy instances found${NC}"
fi

# Clean up log file
if [ -f "/tmp/roo-sniffer.log" ]; then
    echo -e "\n${YELLOW}Cleaning up logs...${NC}"
    rm /tmp/roo-sniffer.log
    echo -e "${GREEN}✓ Logs cleaned${NC}"
fi

echo -e "\n${GREEN}✓ Cleanup complete!${NC}"
