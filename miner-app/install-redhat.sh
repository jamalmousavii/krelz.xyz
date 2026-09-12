#!/bin/bash
# ============================================
#   Krelz Network Miner - RedHat/CentOS/Fedora Install
# ============================================
# Usage:
#   wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-redhat.sh && bash install-redhat.sh
# ============================================

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Krelz Network Miner Installer (RedHat/Fedora)${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check root
if [ "$EUID" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

# Detect package manager
if command -v dnf &> /dev/null; then
  PKG_MGR="dnf"
elif command -v yum &> /dev/null; then
  PKG_MGR="yum"
else
  echo -e "${RED}  ✗ No supported package manager found (need dnf or yum)${NC}"
  exit 1
fi

# Step 1: Install prerequisites
echo -e "${YELLOW}[1/6] Installing prerequisites...${NC}"
$SUDO $PKG_MGR install -y -q curl git gcc-c++ make > /dev/null 2>&1
echo -e "${GREEN}  ✓ Prerequisites installed${NC}"

# Step 2: Install Node.js (v20 LTS)
echo -e "${YELLOW}[2/6] Installing Node.js...${NC}"
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash - > /dev/null 2>&1
  $SUDO $PKG_MGR install -y -q nodejs > /dev/null 2>&1
fi
echo -e "${GREEN}  ✓ Node.js $(node -v) installed${NC}"

# Step 3: Install Ollama
echo -e "${YELLOW}[3/6] Installing Ollama...${NC}"
if ! command -v ollama &> /dev/null; then
  curl -fsSL https://ollama.com/install.sh | sh > /dev/null 2>&1
fi
echo -e "${GREEN}  ✓ Ollama installed${NC}"

# Step 4: Select models
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Select models to install${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "  ${GREEN}1${NC}) llama3.1:8b      (4.9 GB) - General chat"
echo -e "  ${GREEN}2${NC}) llama3.1:70b     (43 GB)  - Large model"
echo -e "  ${GREEN}3${NC}) qwen2.5:7b       (4.4 GB) - Multilingual"
echo -e "  ${GREEN}4${NC}) qwen3:8b         (5.0 GB) - Latest generation"
echo -e "  ${GREEN}5${NC}) gemma2:9b         (5.4 GB) - Google"
echo -e "  ${GREEN}6${NC}) mistral:7b        (4.4 GB) - Mistral AI"
echo -e "  ${GREEN}7${NC}) deepseek-r1:8b    (4.9 GB) - Reasoning"
echo -e "  ${GREEN}8${NC}) qwen2.5-coder:7b  (4.4 GB) - Code generation"
echo -e "  ${GREEN}9${NC}) All recommended (1+3+5+6)"
echo -e "  ${GREEN}0${NC}) Custom (enter model names manually)"
echo ""

DEFAULT_MODELS="llama3.1:8b"
SELECTED_MODELS=""

read -p "  Enter choice [1-9, 0] (default: 1): " choice
choice=${choice:-1}

case $choice in
  1) SELECTED_MODELS="llama3.1:8b" ;;
  2) SELECTED_MODELS="llama3.1:70b" ;;
  3) SELECTED_MODELS="qwen2.5:7b" ;;
  4) SELECTED_MODELS="qwen3:8b" ;;
  5) SELECTED_MODELS="gemma2:9b" ;;
  6) SELECTED_MODELS="mistral:7b" ;;
  7) SELECTED_MODELS="deepseek-r1:8b" ;;
  8) SELECTED_MODELS="qwen2.5-coder:7b" ;;
  9) SELECTED_MODELS="llama3.1:8b qwen2.5:7b gemma2:9b mistral:7b" ;;
  0)
    echo ""
    echo -e "  Enter model names separated by space (e.g.: llama3.1:8b qwen3:8b)"
    read -p "  Models: " SELECTED_MODELS
    SELECTED_MODELS=${SELECTED_MODELS:-$DEFAULT_MODELS}
    ;;
  *) SELECTED_MODELS="llama3.1:8b" ;;
esac

echo ""
echo -e "${CYAN}  Installing models: ${SELECTED_MODELS}${NC}"
echo ""

# Step 5: Pull selected models
echo -e "${YELLOW}[4/6] Downloading models (this may take a while)...${NC}"
for MODEL in $SELECTED_MODELS; do
  echo -e "  ${CYAN}Pulling $MODEL...${NC}"
  ollama pull "$MODEL" 2>/dev/null || echo -e "${YELLOW}  ⚠ $MODEL may already exist or download in progress${NC}"
done
echo -e "${GREEN}  ✓ Models ready${NC}"

# Step 6: Install Miner
echo -e "${YELLOW}[5/6] Installing Krelz Miner...${NC}"
INSTALL_DIR="$HOME/krelz-miner"
if [ -d "$INSTALL_DIR" ]; then
  cd "$INSTALL_DIR" && git pull > /dev/null 2>&1
else
  git clone https://github.com/jamalmousavii/krelz.xyz.git "$INSTALL_DIR" > /dev/null 2>&1
fi
cd "$INSTALL_DIR/miner-app" && npm install > /dev/null 2>&1
echo -e "${GREEN}  ✓ Miner installed at $INSTALL_DIR${NC}"

# Step 7: Save config
echo -e "${YELLOW}[6/6] Saving configuration...${NC}"
cat > "$INSTALL_DIR/miner-app/config.json" << EOF
{
  "models": "$(echo $SELECTED_MODELS | tr ' ' ',')",
  "default_model": "$(echo $SELECTED_MODELS | awk '{print $1}')"
}
EOF
echo -e "${GREEN}  ✓ Configuration saved${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Models installed:"
for MODEL in $SELECTED_MODELS; do
  echo -e "    ${GREEN}✓ $MODEL${NC}"
done
echo ""
echo -e "  To start mining, run:"
echo -e "  ${YELLOW}cd $INSTALL_DIR/miner-app && node src/main.js${NC}"
echo ""
echo -e "  Or to start Ollama service first:"
echo -e "  ${YELLOW}ollama serve &${NC}"
echo -e "  ${YELLOW}cd $INSTALL_DIR/miner-app && node src/main.js${NC}"
echo ""
