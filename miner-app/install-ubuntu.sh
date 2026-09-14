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
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Krelz Network Miner Installer (Ubuntu/Debian)${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

if [ "$EUID" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

echo -e "${YELLOW}[1/6] Installing prerequisites...${NC}"
$SUDO apt-get update -qq
$SUDO apt-get install -y -qq curl git build-essential > /dev/null 2>&1
echo -e "${GREEN}  ✓ Prerequisites installed${NC}"

echo -e "${YELLOW}[2/6] Installing Node.js...${NC}"
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash - > /dev/null 2>&1
  $SUDO apt-get install -y -qq nodejs > /dev/null 2>&1
fi
echo -e "${GREEN}  ✓ Node.js $(node -v) installed${NC}"

echo -e "${YELLOW}[3/6] Installing Ollama...${NC}"
if ! command -v ollama &> /dev/null; then
  curl -fsSL https://ollama.com/install.sh | sh > /dev/null 2>&1
fi
echo -e "${GREEN}  ✓ Ollama installed${NC}"

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Select models to install${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "  ${CYAN}--- Chat ---${NC}"
echo -e "  ${GREEN}1${NC}) qwen3.6:27b        (17 GB)  - Best overall single-GPU"
echo -e "  ${GREEN}2${NC}) llama3.3:70b       (43 GB)  - Best large model"
echo -e "  ${GREEN}3${NC}) deepseek-r1:70b    (43 GB)  - Best reasoning"
echo -e "  ${GREEN}4${NC}) llama3.1:8b        (5 GB)   - Best budget all-rounder"
echo ""
echo -e "  ${CYAN}--- Code ---${NC}"
echo -e "  ${GREEN}5${NC}) qwen3-coder:30b    (18 GB)  - Best coding model"
echo -e "  ${GREEN}6${NC}) qwen2.5-coder:32b  (20 GB)  - Best dense coder"
echo ""
echo -e "  ${CYAN}--- Vision ---${NC}"
echo -e "  ${GREEN}7${NC}) qwen3-vl:8b        (8 GB)   - Best vision model"
echo -e "  ${GREEN}8${NC}) gemma4:12b         (7 GB)   - Multimodal + tools"
echo ""
echo -e "  ${CYAN}--- Embedding ---${NC}"
echo -e "  ${GREEN}9${NC}) embeddinggemma      (0.5 GB) - Newest embeddings"
echo -e "  ${GREEN}a${NC}) nomic-embed-text   (0.3 GB) - Classic default"
echo -e "  ${GREEN}b${NC}) bge-m3             (1.2 GB) - Multilingual RAG"
echo ""
echo -e "  ${YELLOW}--- Presets ---${NC}"
echo -e "  ${GREEN}c${NC}) All Chat (1+2+3+4)"
echo -e "  ${GREEN}d${NC}) All Code (5+6)"
echo -e "  ${GREEN}e${NC}) All Vision (7+8)"
echo -e "  ${GREEN}f${NC}) All recommended (1+5+7+9)"
echo -e "  ${GREEN}g${NC}) Everything (all 11)"
echo -e "  ${GREEN}0${NC}) Custom (enter model names manually)"
echo ""

SELECTED_MODELS=""

read -p "  Enter choice [1-9, a-g, 0] (default: 1): " choice
choice=${choice:-1}

case $choice in
  1) SELECTED_MODELS="qwen3.6:27b" ;;
  2) SELECTED_MODELS="llama3.3:70b" ;;
  3) SELECTED_MODELS="deepseek-r1:70b" ;;
  4) SELECTED_MODELS="llama3.1:8b" ;;
  5) SELECTED_MODELS="qwen3-coder:30b" ;;
  6) SELECTED_MODELS="qwen2.5-coder:32b" ;;
  7) SELECTED_MODELS="qwen3-vl:8b" ;;
  8) SELECTED_MODELS="gemma4:12b" ;;
  9) SELECTED_MODELS="embeddinggemma" ;;
  a) SELECTED_MODELS="nomic-embed-text" ;;
  b) SELECTED_MODELS="bge-m3" ;;
  c) SELECTED_MODELS="qwen3.6:27b llama3.3:70b deepseek-r1:70b llama3.1:8b" ;;
  d) SELECTED_MODELS="qwen3-coder:30b qwen2.5-coder:32b" ;;
  e) SELECTED_MODELS="qwen3-vl:8b gemma4:12b" ;;
  f) SELECTED_MODELS="qwen3.6:27b qwen3-coder:30b qwen3-vl:8b embeddinggemma" ;;
  g) SELECTED_MODELS="qwen3.6:27b llama3.3:70b deepseek-r1:70b llama3.1:8b qwen3-coder:30b qwen2.5-coder:32b qwen3-vl:8b gemma4:12b embeddinggemma nomic-embed-text bge-m3" ;;
  0)
    echo ""
    echo -e "  Enter model names separated by space"
    echo -e "  Available: qwen3.6:27b llama3.3:70b deepseek-r1:70b llama3.1:8b qwen3-coder:30b qwen2.5-coder:32b qwen3-vl:8b gemma4:12b embeddinggemma nomic-embed-text bge-m3"
    read -p "  Models: " SELECTED_MODELS
    SELECTED_MODELS=${SELECTED_MODELS:-"qwen3.6:27b"}
    ;;
  *) SELECTED_MODELS="qwen3.6:27b" ;;
esac

echo ""
echo -e "${CYAN}  Installing models: ${SELECTED_MODELS}${NC}"
echo ""

echo -e "${YELLOW}[4/6] Downloading models (this may take a while)...${NC}"
for MODEL in $SELECTED_MODELS; do
  echo -e "  ${CYAN}Pulling $MODEL...${NC}"
  ollama pull "$MODEL" 2>/dev/null || echo -e "${YELLOW}  ⚠ $MODEL may already exist or download in progress${NC}"
done
echo -e "${GREEN}  ✓ Models ready${NC}"

echo -e "${YELLOW}[5/6] Installing Krelz Miner...${NC}"
INSTALL_DIR="$HOME/krelz-miner"
if [ -d "$INSTALL_DIR" ]; then
  cd "$INSTALL_DIR" && git pull > /dev/null 2>&1
else
  git clone https://github.com/jamalmousavii/krelz.xyz.git "$INSTALL_DIR" > /dev/null 2>&1
fi
cd "$INSTALL_DIR/miner-app" && npm install > /dev/null 2>&1
echo -e "${GREEN}  ✓ Miner installed at $INSTALL_DIR${NC}"

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
