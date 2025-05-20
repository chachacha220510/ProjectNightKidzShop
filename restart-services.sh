#!/bin/bash

# Define colors
RESET="\033[0m"
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
CYAN="\033[36m"

echo -e "${BLUE}NightKidz Shop - Service Restart${RESET}"
echo -e "${CYAN}This script will restart all services and clear caches.${RESET}\n"

# Check if Docker is running
echo -e "${YELLOW}Checking Docker status...${RESET}"
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}✗ Docker is not running. Please start Docker and try again.${RESET}"
  exit 1
fi
echo -e "${GREEN}✓ Docker is running${RESET}"

# Check and stop existing processes
echo -e "\n${YELLOW}Checking for existing processes...${RESET}"

# Find and kill Node.js processes related to Medusa/Next.js
if pgrep -f "medusa develop" > /dev/null || pgrep -f "next dev" > /dev/null; then
  echo -e "${YELLOW}Stopping existing Medusa/Next.js processes...${RESET}"
  
  pkill -f "medusa develop" > /dev/null 2>&1
  pkill -f "next dev" > /dev/null 2>&1
  
  # Give processes time to shut down
  sleep 2
  echo -e "${GREEN}✓ Processes stopped${RESET}"
else
  echo -e "${GREEN}✓ No existing processes found${RESET}"
fi

# Ensure Docker services are running
echo -e "\n${YELLOW}Ensuring Docker services are running...${RESET}"
docker compose up -d
echo -e "${GREEN}✓ Docker services are running${RESET}"

# Clean frontend caches
echo -e "\n${YELLOW}Cleaning frontend caches...${RESET}"
if [ -d "storefront/.next/cache" ]; then
  rm -rf storefront/.next/cache
  echo -e "${GREEN}✓ Frontend build cache cleaned${RESET}"
fi

if [ -d "storefront/node_modules/.cache" ]; then
  rm -rf storefront/node_modules/.cache
  echo -e "${GREEN}✓ Frontend module cache cleaned${RESET}"
fi

echo -e "\n${YELLOW}Remember to clear your browser caches:${RESET}"
echo -e "1. Open browser developer tools (F12 or right-click > Inspect)"
echo -e "2. Go to Application > Storage"
echo -e "3. Clear localStorage and sessionStorage for localhost domains"

echo -e "\n${CYAN}Starting services in separate terminals...${RESET}"

# Check which terminal is available
if command -v osascript > /dev/null; then
  echo -e "${YELLOW}Using Terminal on macOS...${RESET}"
  
  # For macOS
  osascript <<EOF
  tell application "Terminal"
    do script "cd '$(pwd)/backend' && npm run dev"
    do script "cd '$(pwd)/storefront' && npm run dev"
  end tell
EOF

elif command -v gnome-terminal > /dev/null; then
  echo -e "${YELLOW}Using GNOME Terminal...${RESET}"
  
  # For GNOME Terminal (Linux)
  gnome-terminal -- bash -c "cd '$(pwd)/backend' && npm run dev; exec bash"
  gnome-terminal -- bash -c "cd '$(pwd)/storefront' && npm run dev; exec bash"

else
  echo -e "${YELLOW}Please start services manually in separate terminals:${RESET}"
  echo -e "${BLUE}Terminal 1:${RESET} cd backend && npm run dev"
  echo -e "${BLUE}Terminal 2:${RESET} cd storefront && npm run dev"
fi

echo -e "\n${GREEN}Restart process completed!${RESET}"
echo -e "${CYAN}Please wait for both services to fully start.${RESET}"
echo -e "${CYAN}Access the shop at: http://localhost:8000${RESET}"
echo -e "${CYAN}Access the admin panel at: http://localhost:9000/app${RESET}" 