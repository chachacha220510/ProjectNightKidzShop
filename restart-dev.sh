#!/bin/bash

# Safety check: This script is for local development only
if [ "$NODE_ENV" = "production" ]; then
  echo "⚠️ This script is intended for local development only and should not run in production."
  exit 1
fi

# Define colors
RESET="\033[0m"
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
CYAN="\033[36m"

echo -e "${BLUE}NightKidz Shop - Development Server Restart${RESET}"
echo -e "${CYAN}This script will restart development servers and fix common issues.${RESET}\n"

# Display help info
function show_help {
  echo -e "${YELLOW}Usage:${RESET}"
  echo -e "  ./restart-dev.sh [options]"
  echo -e "\n${YELLOW}Options:${RESET}"
  echo -e "  --fix-regions       Fix region issues in database"
  echo -e "  --fix-schema        Fix database schema issues"
  echo -e "  --migrate           Run database migrations"
  echo -e "  --help              Show this help message"
  echo -e "\n${YELLOW}Examples:${RESET}"
  echo -e "  ./restart-dev.sh             # Basic restart"
  echo -e "  ./restart-dev.sh --fix-regions # Fix region issues and restart"
}

# Set default options
FIX_REGIONS=false
FIX_SCHEMA=false
RUN_MIGRATIONS=false

# Parse command line arguments
for arg in "$@"; do
  case $arg in
    --fix-regions)
      FIX_REGIONS=true
      ;;
    --fix-schema)
      FIX_SCHEMA=true
      ;;
    --migrate)
      RUN_MIGRATIONS=true
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $arg${RESET}"
      show_help
      exit 1
      ;;
  esac
done

# Check if Docker is running
echo -e "${YELLOW}Checking Docker status...${RESET}"
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}✗ Docker is not running. Please start Docker and try again.${RESET}"
  exit 1
fi
echo -e "${GREEN}✓ Docker is running${RESET}"

# Kill any running development processes
echo -e "\n${YELLOW}Stopping any running development processes...${RESET}"
pkill -f "medusa develop" || true
pkill -f "next dev" || true
sleep 2
echo -e "${GREEN}✓ Development processes stopped${RESET}"

# Check Docker services
echo -e "\n${YELLOW}Ensuring Docker services are running...${RESET}"
docker compose up -d
echo -e "${GREEN}✓ Docker services are up${RESET}"

# Fix database schema issues if requested
if [ "$FIX_SCHEMA" = true ]; then
  echo -e "\n${YELLOW}Fixing database schema issues...${RESET}"
  
  echo -e "${CYAN}Checking for missing is_giftcard column...${RESET}"
  docker exec projectnightkidzshop-postgres-1 psql -U postgres -d medusa_local -c "ALTER TABLE \"item\" ADD COLUMN IF NOT EXISTS \"is_giftcard\" BOOLEAN DEFAULT FALSE;" || true
  
  echo -e "${GREEN}✓ Schema fixes applied${RESET}"
fi

# Run database migrations if requested
if [ "$RUN_MIGRATIONS" = true ]; then
  echo -e "\n${YELLOW}Running database migrations...${RESET}"
  
  echo -e "${CYAN}Applying Medusa migrations...${RESET}"
  cd backend && npx medusa db:migrate && cd ..
  
  echo -e "${GREEN}✓ Migrations completed${RESET}"
fi

# Fix region issues if requested
if [ "$FIX_REGIONS" = true ]; then
  echo -e "\n${YELLOW}Fixing region ID issues...${RESET}"
  
  if [ -f "./fix-regions.js" ]; then
    echo -e "${CYAN}Running region fix script...${RESET}"
    node fix-regions.js
  else
    echo -e "${CYAN}Generating and running fix...${RESET}"
    # Get available region IDs
    REGION_ID=$(docker exec projectnightkidzshop-postgres-1 psql -U postgres -d medusa_local -t -c "SELECT id FROM region WHERE deleted_at IS NULL LIMIT 1;" | xargs)
    
    if [ -z "$REGION_ID" ]; then
      echo -e "${RED}No available regions found in the database${RESET}"
    else
      echo -e "${CYAN}Found replacement region: $REGION_ID${RESET}"
      
      # Update problematic region references
      docker exec projectnightkidzshop-postgres-1 psql -U postgres -d medusa_local -c "UPDATE cart SET region_id = '$REGION_ID' WHERE region_id = 'reg_01JVK89Q8PEA1EMJS7FPBN12VF';" || true
      docker exec projectnightkidzshop-postgres-1 psql -U postgres -d medusa_local -c "UPDATE customer SET region_id = '$REGION_ID' WHERE region_id = 'reg_01JVK89Q8PEA1EMJS7FPBN12VF';" || true
      docker exec projectnightkidzshop-postgres-1 psql -U postgres -d medusa_local -c "UPDATE payment_session SET region_id = '$REGION_ID' WHERE region_id = 'reg_01JVK89Q8PEA1EMJS7FPBN12VF';" || true
      
      echo -e "${GREEN}✓ Region fixes applied${RESET}"
    fi
  fi
fi

# Clean frontend caches
echo -e "\n${YELLOW}Cleaning frontend caches...${RESET}"
CACHE_PATHS=(
  "storefront/.next/cache"
  "storefront/node_modules/.cache"
  "storefront/.next/server/.next-server"
  "storefront/.next/trace"
)

for path in "${CACHE_PATHS[@]}"; do
  if [ -d "$path" ]; then
    rm -rf "$path"
    echo -e "${GREEN}✓ Cleaned cache: $path${RESET}"
  fi
done

# Create redux-persist fix if it doesn't exist
REDUX_FIX_FILE="storefront/src/lib/reset-store.js"
if [ ! -f "$REDUX_FIX_FILE" ]; then
  echo -e "\n${YELLOW}Creating Redux store reset utility...${RESET}"
  mkdir -p "storefront/src/lib"
  cat > "$REDUX_FIX_FILE" << 'EOF'
/**
 * Utility to reset persisted redux store when region issues occur
 */
export const resetPersistedStore = () => {
  if (typeof window === 'undefined') return;
  
  try {
    // Clear localStorage items used by redux-persist
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('persist:') || key.includes('region'))) {
        keysToRemove.push(key);
      }
    }
    
    // Remove the keys
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log('Redux store reset completed');
    return true;
  } catch (error) {
    console.error('Failed to reset redux store:', error);
    return false;
  }
};
EOF
  echo -e "${GREEN}✓ Created Redux store reset utility${RESET}"
fi

# Display browser cache instructions
echo -e "\n${YELLOW}Don't forget to clear your browser caches:${RESET}"
echo -e "1. Open browser developer tools (F12)"
echo -e "2. Go to Application > Storage"
echo -e "3. Clear localStorage and sessionStorage for localhost domains"
echo -e "4. If region issues persist, use the Admin Panel to verify region settings"

# Start development servers
echo -e "\n${YELLOW}Starting development servers...${RESET}"

# Use different approach based on OS
if command -v osascript > /dev/null; then
  # macOS approach
  echo -e "${CYAN}Opening new terminal windows for development servers...${RESET}"
  
  osascript <<EOF
  tell application "Terminal"
    do script "cd '$(pwd)/backend' && npm run dev"
    do script "cd '$(pwd)/storefront' && npm run dev"
  end tell
EOF

elif command -v gnome-terminal > /dev/null; then
  # Linux with GNOME approach
  echo -e "${CYAN}Opening new terminal windows for development servers...${RESET}"
  
  gnome-terminal -- bash -c "cd '$(pwd)/backend' && npm run dev; exec bash"
  gnome-terminal -- bash -c "cd '$(pwd)/storefront' && npm run dev; exec bash"

else
  # Generic approach - provide instructions
  echo -e "${CYAN}Please start the development servers manually in separate terminals:${RESET}"
  echo -e "${BLUE}Terminal 1:${RESET} cd backend && npm run dev"
  echo -e "${BLUE}Terminal 2:${RESET} cd storefront && npm run dev"
fi

echo -e "\n${GREEN}Development environment is ready!${RESET}"
echo -e "${CYAN}Access the shop at: http://localhost:8000${RESET}"
echo -e "${CYAN}Access the admin panel at: http://localhost:9000/app${RESET}"
echo -e "\n${YELLOW}If you encounter 'Region not found' errors:${RESET}"
echo -e "1. Run './restart-dev.sh --fix-regions' to fix region references"
echo -e "2. If errors persist, check the Admin Panel to ensure regions are properly configured" 