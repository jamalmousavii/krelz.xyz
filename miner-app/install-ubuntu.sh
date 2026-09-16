#!/bin/bash
# ============================================
#   Krelz Network Miner - Ubuntu/Debian Install
# ============================================
# Usage:
#   wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-ubuntu.sh && bash install-ubuntu.sh
#   bash install-ubuntu.sh --email user@email.com --token kz_xxx
# ============================================

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# --- Helper Functions ---
spinner() {
  local pid=$1
  local msg=$2
  local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  local delay=0.1
  while kill -0 "$pid" 2>/dev/null; do
    for (( i=0; i<${#spinstr}; i++ )); do
      printf "\r  ${CYAN}${spinstr:$i:1}${NC} %s" "$msg"
      sleep $delay
    done
  done
  printf "\r  \r"
}

run_with_spinner() {
  local msg=$1
  shift
  local logfile=$(mktemp)
  "$@" > "$logfile" 2>&1 &
  local pid=$!
  spinner "$pid" "$msg"
  wait "$pid" 2>/dev/null
  local exit_code=$?
  rm -f "$logfile"
  return $exit_code
}

step_start() {
  echo -e "${YELLOW}[$1/$TOTAL_STEPS] ⏳ $2${NC}"
}

step_done() {
  echo -e "${GREEN}  ✅ $1${NC}"
}

step_fail() {
  echo -e "${RED}  ⚠ $1${NC}"
}

# Model size map
declare -A MODEL_SIZES
MODEL_SIZES[qwen3.6:27b]="17 GB"
MODEL_SIZES[llama3.3:70b]="43 GB"
MODEL_SIZES[deepseek-r1:70b]="43 GB"
MODEL_SIZES[llama3.1:8b]="5 GB"
MODEL_SIZES[qwen3-coder:30b]="18 GB"
MODEL_SIZES[qwen2.5-coder:32b]="20 GB"
MODEL_SIZES[qwen3-vl:8b]="8 GB"
MODEL_SIZES[gemma4:12b]="7 GB"
MODEL_SIZES[embeddinggemma]="0.5 GB"
MODEL_SIZES[nomic-embed-text]="0.3 GB"
MODEL_SIZES[bge-m3]="1.2 GB"

TOTAL_STEPS=8
SCRIPT_START=$(date +%s)

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Krelz Network Miner Installer (Ubuntu/Debian)${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Parse --email and --token flags
USER_EMAIL=""
MINER_TOKEN=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --email) USER_EMAIL="$2"; shift 2 ;;
    --token) MINER_TOKEN="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [ "$EUID" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

# --- Step 1: Prerequisites ---
step_start 1 "Installing prerequisites..."
STEP_START=$(date +%s)
run_with_spinner "Downloading packages..." $SUDO apt-get update -qq
run_with_spinner "Installing build tools..." $SUDO apt-get install -y -qq curl git build-essential
STEP_END=$(date +%s)
step_done "Prerequisites installed ($(($STEP_END - $STEP_START))s)"

# --- Step 2: Node.js ---
step_start 2 "Installing Node.js..."
STEP_START=$(date +%s)
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
  run_with_spinner "Setting up NodeSource repository..." bash -c "curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -"
  run_with_spinner "Installing Node.js..." $SUDO apt-get install -y -qq nodejs
  NODE_VER=$(node -v)
  STEP_END=$(date +%s)
  step_done "Node.js ${NODE_VER} installed ($(($STEP_END - $STEP_START))s)"
else
  NODE_VER=$(node -v)
  STEP_END=$(date +%s)
  step_done "Node.js ${NODE_VER} already installed ($(($STEP_END - $STEP_START))s)"
fi

# --- Step 3: Ollama ---
step_start 3 "Installing Ollama..."
STEP_START=$(date +%s)
if ! command -v ollama &> /dev/null; then
  run_with_spinner "Downloading Ollama binary..." bash -c "curl -fsSL https://ollama.com/install.sh | sh"
  STEP_END=$(date +%s)
  step_done "Ollama installed ($(($STEP_END - $STEP_START))s)"
else
  STEP_END=$(date +%s)
  step_done "Ollama already installed ($(($STEP_END - $STEP_START))s)"
fi

# --- Model Selection ---
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
    echo -e "  ${CYAN}Select models by number:${NC}"
    echo -e "  ${GREEN}1${NC}) qwen3.6:27b        (17 GB)"
    echo -e "  ${GREEN}2${NC}) llama3.3:70b       (43 GB)"
    echo -e "  ${GREEN}3${NC}) deepseek-r1:70b    (43 GB)"
    echo -e "  ${GREEN}4${NC}) llama3.1:8b        (5 GB)"
    echo -e "  ${GREEN}5${NC}) qwen3-coder:30b    (18 GB)"
    echo -e "  ${GREEN}6${NC}) qwen2.5-coder:32b  (20 GB)"
    echo -e "  ${GREEN}7${NC}) qwen3-vl:8b        (8 GB)"
    echo -e "  ${GREEN}8${NC}) gemma4:12b         (7 GB)"
    echo -e "  ${GREEN}9${NC}) embeddinggemma      (0.5 GB)"
    echo -e "  ${GREEN}a${NC}) nomic-embed-text   (0.3 GB)"
    echo -e "  ${GREEN}b${NC}) bge-m3             (1.2 GB)"
    echo ""
    read -p "  Numbers (e.g. 1 4 7): " custom_input
    SELECTED_MODELS=""
    for num in $custom_input; do
      case $num in
        1) SELECTED_MODELS="$SELECTED_MODELS qwen3.6:27b" ;;
        2) SELECTED_MODELS="$SELECTED_MODELS llama3.3:70b" ;;
        3) SELECTED_MODELS="$SELECTED_MODELS deepseek-r1:70b" ;;
        4) SELECTED_MODELS="$SELECTED_MODELS llama3.1:8b" ;;
        5) SELECTED_MODELS="$SELECTED_MODELS qwen3-coder:30b" ;;
        6) SELECTED_MODELS="$SELECTED_MODELS qwen2.5-coder:32b" ;;
        7) SELECTED_MODELS="$SELECTED_MODELS qwen3-vl:8b" ;;
        8) SELECTED_MODELS="$SELECTED_MODELS gemma4:12b" ;;
        9) SELECTED_MODELS="$SELECTED_MODELS embeddinggemma" ;;
        a) SELECTED_MODELS="$SELECTED_MODELS nomic-embed-text" ;;
        b) SELECTED_MODELS="$SELECTED_MODELS bge-m3" ;;
      esac
    done
    SELECTED_MODELS=$(echo $SELECTED_MODELS | xargs)
    SELECTED_MODELS=${SELECTED_MODELS:-"qwen3.6:27b"}
    ;;
  *) SELECTED_MODELS="qwen3.6:27b" ;;
esac

echo ""
echo -e "${CYAN}  Installing models: ${SELECTED_MODELS}${NC}"
echo ""

# --- Step 4: Download Models ---
step_start 4 "Downloading models..."
STEP_START=$(date +%s)
MODEL_COUNT=$(echo $SELECTED_MODELS | wc -w)
MODEL_CURRENT=0

for MODEL in $SELECTED_MODELS; do
  MODEL_CURRENT=$((MODEL_CURRENT + 1))
  SIZE="${MODEL_SIZES[$MODEL]:-unknown}"
  echo -e "  ${CYAN}[${MODEL_CURRENT}/${MODEL_COUNT}]${NC} 📦 ${BOLD}${MODEL}${NC} (${SIZE})"
  ollama pull "$MODEL" || echo -e "  ${YELLOW}  ⚠ ${MODEL} may already exist or download in progress${NC}"
  echo ""
done

STEP_END=$(date +%s)
ELAPSED=$(($STEP_END - $STEP_START))
MINUTES=$(($ELAPSED / 60))
SECONDS=$(($ELAPSED % 60))
if [ $MINUTES -gt 0 ]; then
  step_done "Models ready (${MINUTES}m ${SECONDS}s)"
else
  step_done "Models ready (${SECONDS}s)"
fi

# --- Step 5: Install Miner ---
step_start 5 "Installing Krelz Miner..."
STEP_START=$(date +%s)
INSTALL_DIR="$HOME/krelz-miner"
if [ -d "$INSTALL_DIR" ]; then
  run_with_spinner "Updating repository..." bash -c "cd '$INSTALL_DIR' && git pull"
else
  run_with_spinner "Cloning repository..." git clone https://github.com/jamalmousavii/krelz.xyz.git "$INSTALL_DIR"
fi
run_with_spinner "Installing npm dependencies..." bash -c "cd '$INSTALL_DIR/miner-app' && npm install"
STEP_END=$(date +%s)
step_done "Miner installed at $INSTALL_DIR ($(($STEP_END - $STEP_START))s)"

# --- Email & Token ---
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Connect to Krelz Network${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

if [ -z "$USER_EMAIL" ]; then
  echo -e "  Enter your account email and miner token"
  echo -e "  (Get your token from https://krelz.xyz/profile)"
  echo ""
  read -p "  Email: " USER_EMAIL
fi

if [ -z "$MINER_TOKEN" ]; then
  read -p "  Miner Token: " MINER_TOKEN
fi

# --- Step 6: Detect System ---
step_start 6 "Detecting system info..."
STEP_START=$(date +%s)

GPU_MODEL="Unknown"
if command -v nvidia-smi &> /dev/null; then
  GPU_MODEL=$(nvidia-smi --query-gpu=name --format=csv,noheader,nounits 2>/dev/null | head -1)
  [ -z "$GPU_MODEL" ] && GPU_MODEL="Unknown"
fi
echo -e "  ${GREEN}✓ GPU: ${GPU_MODEL}${NC}"

RAM_SIZE=$(free -h | awk '/^Mem:/{print $2}' | head -1)
[ -z "$RAM_SIZE" ] && RAM_SIZE="Unknown"
echo -e "  ${GREEN}✓ RAM: ${RAM_SIZE}${NC}"

CPU_MODEL=$(lscpu | grep 'Model name' | sed 's/Model name:\s*//' | head -1)
if [ -z "$CPU_MODEL" ]; then
  CPU_MODEL=$(cat /proc/cpuinfo | grep 'model name' | head -1 | sed 's/.*:\s*//')
fi
[ -z "$CPU_MODEL" ] && CPU_MODEL="Unknown"
echo -e "  ${GREEN}✓ CPU: ${CPU_MODEL}${NC}"

STEP_END=$(date +%s)
step_done "System info detected ($(($STEP_END - $STEP_START))s)"

# --- Step 7: Register Miner ---
step_start 7 "Registering miner..."
STEP_START=$(date +%s)

SETUP_RESPONSE=$(curl -s -X POST https://krelz.xyz/api/miners/setup \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${USER_EMAIL}\",
    \"miner_token\": \"${MINER_TOKEN}\",
    \"gpu_model\": \"${GPU_MODEL}\",
    \"ram\": \"${RAM_SIZE}\",
    \"cpu\": \"${CPU_MODEL}\",
    \"models\": [\"$(echo $SELECTED_MODELS | sed 's/ /", "/g')\"]
  }")

STEP_END=$(date +%s)
if echo "$SETUP_RESPONSE" | grep -q '"success":true'; then
  step_done "Miner registered ($(($STEP_END - $STEP_START))s)"
else
  step_fail "Registration failed. Check email and token."
  echo -e "  ${YELLOW}Response: $SETUP_RESPONSE${NC}"
fi

# --- Step 8: Systemd Service ---
step_start 8 "Saving config + starting service..."
STEP_START=$(date +%s)

cat > "$INSTALL_DIR/miner-app/config.json" << EOF
{
  "models": "$(echo $SELECTED_MODELS | tr ' ' ',')",
  "default_model": "$(echo $SELECTED_MODELS | awk '{print $1}')",
  "miner_token": "${MINER_TOKEN}"
}
EOF
echo -e "  ${GREEN}✓ Configuration saved${NC}"

SERVICE_FILE="/etc/systemd/system/krelz-miner.service"
NODE_PATH=$(which node)
$SUDO tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Krelz Network Miner
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$INSTALL_DIR/miner-app
ExecStart=${NODE_PATH} src/cli.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

run_with_spinner "Enabling service..." $SUDO systemctl daemon-reload
run_with_spinner "Starting service..." bash -c "$SUDO systemctl enable krelz-miner && $SUDO systemctl start krelz-miner"

STEP_END=$(date +%s)
step_done "Service started ($(($STEP_END - $STEP_START))s)"

# --- Summary ---
SCRIPT_END=$(date +%s)
TOTAL_ELAPSED=$(($SCRIPT_END - $SCRIPT_START))
TOTAL_MINUTES=$(($TOTAL_ELAPSED / 60))
TOTAL_SECONDS=$(($TOTAL_ELAPSED % 60))

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Email:  ${GREEN}${USER_EMAIL}${NC}"
echo -e "  GPU:    ${GREEN}${GPU_MODEL}${NC}"
echo -e "  RAM:    ${GREEN}${RAM_SIZE}${NC}"
echo -e "  CPU:    ${GREEN}${CPU_MODEL}${NC}"
echo ""
echo -e "  Models installed:"
for MODEL in $SELECTED_MODELS; do
  SIZE="${MODEL_SIZES[$MODEL]:-?}"
  echo -e "    ${GREEN}✓ $MODEL${NC} (${SIZE})"
done
echo ""
echo -e "  Service: ${GREEN}krelz-miner${NC}"
echo -e "  Status:  ${YELLOW}sudo systemctl status krelz-miner${NC}"
echo -e "  Logs:    ${YELLOW}sudo journalctl -u krelz-miner -f${NC}"
echo -e "  Stop:    ${YELLOW}sudo systemctl stop krelz-miner${NC}"
echo -e "  Restart: ${YELLOW}sudo systemctl restart krelz-miner${NC}"
echo ""
echo -e "  ${BOLD}Total time: ${TOTAL_MINUTES}m ${TOTAL_SECONDS}s${NC}"
echo ""
rm -f "$0"
