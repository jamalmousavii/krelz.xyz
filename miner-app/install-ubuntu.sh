#!/bin/bash
# ============================================
#   Krelz Network Miner - Ubuntu/Debian Install
# ============================================
# Usage:
#   wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-ubuntu.sh && bash install-ubuntu.sh
# ============================================

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Krelz Network Miner Installer (Ubuntu/Debian)${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check root
if [ "$EUID" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

# Step 1: Install prerequisites
echo -e "${YELLOW}[1/5] Installing prerequisites...${NC}"
$SUDO apt-get update -qq
$SUDO apt-get install -y -qq curl git build-essential > /dev/null 2>&1
echo -e "${GREEN}  ✓ Prerequisites installed${NC}"

# Step 2: Install Node.js (v20 LTS)
echo -e "${YELLOW}[2/5] Installing Node.js...${NC}"
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash - > /dev/null 2>&1
  $SUDO apt-get install -y -qq nodejs > /dev/null 2>&1
fi
echo -e "${GREEN}  ✓ Node.js $(node -v) installed${NC}"

# Step 3: Install Ollama
echo -e "${YELLOW}[3/5] Installing Ollama...${NC}"
if ! command -v ollama &> /dev/null; then
  curl -fsSL https://ollama.com/install.sh | sh > /dev/null 2>&1
fi
echo -e "${GREEN}  ✓ Ollama installed${NC}"

# Step 4: Download LLM model
echo -e "${YELLOW}[4/5] Downloading llama3:8b model (this may take a while)...${NC}"
ollama pull llama3:8b 2>/dev/null || echo -e "${YELLOW}  ⚠ Model may already exist or download in progress${NC}"
echo -e "${GREEN}  ✓ Model ready${NC}"

# Step 5: Install Miner
echo -e "${YELLOW}[5/5] Installing Krelz Miner...${NC}"
INSTALL_DIR="$HOME/krelz-miner"
if [ -d "$INSTALL_DIR" ]; then
  cd "$INSTALL_DIR" && git pull > /dev/null 2>&1
else
  git clone https://github.com/jamalmousavii/krelz.xyz.git "$INSTALL_DIR" > /dev/null 2>&1
fi
cd "$INSTALL_DIR/miner-app" && npm install > /dev/null 2>&1
echo -e "${GREEN}  ✓ Miner installed at $INSTALL_DIR${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  To start mining, run:"
echo -e "  ${YELLOW}cd $INSTALL_DIR/miner-app && node src/main.js${NC}"
echo ""
echo -e "  Or to start Ollama service first:"
echo -e "  ${YELLOW}ollama serve &${NC}"
echo -e "  ${YELLOW}cd $INSTALL_DIR/miner-app && node src/main.js${NC}"
echo ""
