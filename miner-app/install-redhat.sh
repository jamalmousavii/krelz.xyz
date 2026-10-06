#!/bin/bash
# ============================================
#   Krelz Network Miner - RedHat/CentOS/Fedora Install
# ============================================
# Usage:
#   wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/install-redhat.sh && bash install-redhat.sh
#   bash install-redhat.sh --email user@email.com --token-file /path/to/token
#   (--token still works, but a token on the command line is readable from
#    `ps` by every user on the box — prefer --token-file or the prompt.)
# ============================================

set -e

KRELZ_VERSION="3.39.1"

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
  local logfile
  logfile=$(mktemp)
  "$@" > "$logfile" 2>&1 &
  local pid=$!
  spinner "$pid" "$msg"
  wait "$pid" 2>/dev/null
  local exit_code=$?
  if [ "$exit_code" -ne 0 ]; then
    # M1: under `set -e` a failing step used to kill the script BEFORE the
    # captured log was ever shown — a silent half-install with no clue why.
    # Show the tail of the failing step's output, then exit with its code.
    printf "\r  \r"
    echo -e "${RED}  ✗ ${msg} failed (exit ${exit_code})${NC}"
    tail -n 20 "$logfile" 2>/dev/null | sed 's/^/      /'
    rm -f "$logfile"
    exit "$exit_code"
  fi
  rm -f "$logfile"
  return 0
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

# H5: never pipe a remote script into a shell unpinned — download, verify the
# SHA-256 below, then execute. Pins were captured 2026-10-04; if upstream
# rotates its installer the check fails loudly (update the pin after
# re-verifying, or bypass deliberately with KRELZ_ALLOW_UNVERIFIED=1).
PIN_NODESOURCE_SHA256="23ae8de502785a06421a83736e519004e02ab85b2e61464a52a5259833a1c27d"
PIN_OLLAMA_SHA256="25f64b810b947145095956533e1bdf56eacea2673c55a7e586be4515fc882c9f"

fetch_verified() {
  local url=$1 expect=$2 dest=$3
  if ! curl -fsSL "$url" -o "$dest"; then
    echo -e "${RED}  ✗ Download failed: ${url}${NC}"
    return 1
  fi
  local got
  got=$(sha256sum "$dest" | awk '{print $1}')
  if [ "$got" != "$expect" ]; then
    if [ "${KRELZ_ALLOW_UNVERIFIED:-0}" = "1" ]; then
      echo -e "${YELLOW}  ⚠ Checksum mismatch — running UNVERIFIED ${url} (KRELZ_ALLOW_UNVERIFIED=1)${NC}"
      return 0
    fi
    echo -e "${RED}  ✗ Checksum mismatch for ${url}${NC}"
    echo -e "    expected: ${expect}"
    echo -e "    got:      ${got}"
    echo -e "    Upstream likely rotated its installer: re-verify the file and update the pin in this script, or re-run with KRELZ_ALLOW_UNVERIFIED=1."
    rm -f "$dest"
    return 1
  fi
}

install_nodesource_repo() {
  local tmp rc
  tmp=$(mktemp)
  fetch_verified "https://rpm.nodesource.com/setup_20.x" "$PIN_NODESOURCE_SHA256" "$tmp" || { rm -f "$tmp"; return 1; }
  $SUDO bash "$tmp"
  rc=$?
  rm -f "$tmp"
  return $rc
}

install_ollama_binary() {
  local tmp rc
  tmp=$(mktemp)
  fetch_verified "https://ollama.com/install.sh" "$PIN_OLLAMA_SHA256" "$tmp" || { rm -f "$tmp"; return 1; }
  sh "$tmp"
  rc=$?
  rm -f "$tmp"
  return $rc
}

# Model size map
declare -A MODEL_SIZES
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
MODEL_SIZES[llama3.2:3b]="2 GB"
MODEL_SIZES[phi4:14b]="9 GB"
MODEL_SIZES[gpt-oss:20b]="14 GB"
MODEL_SIZES[mistral-small3.2:24b]="15 GB"
MODEL_SIZES[gemma3:27b]="18 GB"
MODEL_SIZES[qwen3:32b]="20 GB"

TOTAL_STEPS=8
SCRIPT_START=$(date +%s)

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Krelz Network Miner Installer (RedHat/Fedora) v${KRELZ_VERSION}${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Parse --email, --token and --name flags
USER_EMAIL=""
MINER_TOKEN=""
MINER_NAME=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --email) USER_EMAIL="$2"; shift 2 ;;
    --token) MINER_TOKEN="$2"; shift 2 ;;
    --token-file) MINER_TOKEN=$(tr -d '\r\n' < "$2" 2>/dev/null); shift 2 ;;
    --name) MINER_NAME="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [ "$EUID" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

if command -v dnf &> /dev/null; then PKG_MGR="dnf"
elif command -v yum &> /dev/null; then PKG_MGR="yum"
else echo -e "${RED}  ✗ No supported package manager found${NC}"; exit 1; fi

# M1: ask for the sudo password NOW, visibly, before the first spinner —
# otherwise the first privileged step prompts invisibly inside the spinner
# and the install looks hung with no feedback.
if [ -n "$SUDO" ]; then
  echo -e "${YELLOW}  Admin privileges required for system packages — sudo password now.${NC}"
  if ! sudo -v; then
    echo -e "${RED}  ✗ sudo authentication failed${NC}"
    exit 1
  fi
fi

# --- Step 1: Prerequisites ---
step_start 1 "Installing prerequisites..."
STEP_START=$(date +%s)
run_with_spinner "Installing build tools..." $SUDO $PKG_MGR install -y -q curl git gcc-c++ make jq
STEP_END=$(date +%s)
step_done "Prerequisites installed ($((STEP_END - STEP_START))s)"

# --- Step 2: Node.js ---
step_start 2 "Installing Node.js..."
STEP_START=$(date +%s)
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
  run_with_spinner "Setting up NodeSource repository (sha256-verified)..." install_nodesource_repo
  run_with_spinner "Installing Node.js..." $SUDO $PKG_MGR install -y -q nodejs
  NODE_VER=$(node -v)
  STEP_END=$(date +%s)
  step_done "Node.js ${NODE_VER} installed ($((STEP_END - STEP_START))s)"
else
  NODE_VER=$(node -v)
  STEP_END=$(date +%s)
  step_done "Node.js ${NODE_VER} already installed ($((STEP_END - STEP_START))s)"
fi

# --- Step 3: Ollama ---
step_start 3 "Installing Ollama..."
STEP_START=$(date +%s)
if ! command -v ollama &> /dev/null; then
  run_with_spinner "Installing Ollama (sha256-verified)..." install_ollama_binary
  STEP_END=$(date +%s)
  step_done "Ollama installed ($((STEP_END - STEP_START))s)"
else
  STEP_END=$(date +%s)
  step_done "Ollama already installed ($((STEP_END - STEP_START))s)"
fi

$SUDO systemctl enable ollama 2>/dev/null || true
$SUDO systemctl start ollama 2>/dev/null || true
sleep 2

if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo -e "  ${YELLOW}  Starting Ollama manually...${NC}"
  nohup ollama serve > /dev/null 2>&1 &
  sleep 3
fi

echo -ne "  ${CYAN}  Waiting for Ollama to be ready...${NC}"
for i in $(seq 1 30); do
  if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e " ${GREEN}ready${NC}"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo -e " ${RED}timeout${NC}"
    echo -e "  ${RED}  ✗ Ollama failed to start. Try: ollama serve &${NC}"
    exit 1
  fi
  sleep 1
done

# --- Model Selection ---
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Select models to install${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "  ${CYAN}--- Chat ---${NC}"
echo -e "  ${GREEN}1${NC}) llama3.1:8b        (5 GB)   - Best budget all-rounder"
echo -e "  ${GREEN}2${NC}) llama3.3:70b       (43 GB)  - Best large model"
echo -e "  ${GREEN}3${NC}) deepseek-r1:70b    (43 GB)  - Best reasoning"
echo -e "  ${GREEN}4${NC}) llama3.1:8b        (5 GB)   - Recommended default (Enter)"
echo -e "  ${GREEN}h${NC}) llama3.2:3b        (2 GB)   - Fastest everyday chat"
echo -e "  ${GREEN}i${NC}) phi4:14b           (9 GB)   - Best small reasoner"
echo -e "  ${GREEN}j${NC}) gpt-oss:20b        (14 GB)  - OpenAI open-weight"
echo -e "  ${GREEN}k${NC}) qwen3:32b          (20 GB)  - Thinking reasoning"
echo ""

echo -e "  ${CYAN}--- Code ---${NC}"
echo -e "  ${GREEN}5${NC}) qwen3-coder:30b    (18 GB)  - Best coding model"
echo -e "  ${GREEN}6${NC}) qwen2.5-coder:32b  (20 GB)  - Best dense coder"
echo ""
echo -e "  ${CYAN}--- Vision ---${NC}"
echo -e "  ${GREEN}7${NC}) qwen3-vl:8b        (8 GB)   - Best vision model"
echo -e "  ${GREEN}8${NC}) gemma4:12b         (7 GB)   - Multimodal + tools"
echo -e "  ${GREEN}l${NC}) mistral-small3.2:24b (15 GB) - Fast vision + tools"
echo -e "  ${GREEN}m${NC}) gemma3:27b         (18 GB)  - Google multimodal"
echo ""

echo -e "  ${CYAN}--- Embedding ---${NC}"
echo -e "  ${GREEN}9${NC}) embeddinggemma      (0.5 GB) - Newest embeddings"
echo -e "  ${GREEN}a${NC}) nomic-embed-text   (0.3 GB) - Classic default"
echo -e "  ${GREEN}b${NC}) bge-m3             (1.2 GB) - Multilingual RAG"
echo ""
echo -e "  ${YELLOW}--- Presets ---${NC}"
echo -e "  ${GREEN}c${NC}) All Chat (1+2+3+4+h+i+j+k)"
echo -e "  ${GREEN}d${NC}) All Code (5+6)"
echo -e "  ${GREEN}e${NC}) All Vision (7+8+l+m)"
echo -e "  ${GREEN}f${NC}) All recommended (1+5+7+9)"
echo -e "  ${GREEN}g${NC}) Everything (all 16 local models)"
echo -e "  ${GREEN}0${NC}) Custom (enter model names manually)"
echo ""

SELECTED_MODELS=""

read -r -p "  Enter choice [1-9, a-m, 0] (default: 1): " choice
choice=${choice:-4}

case $choice in
  1) SELECTED_MODELS="llama3.1:8b" ;;
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
  c) SELECTED_MODELS="llama3.3:70b deepseek-r1:70b llama3.1:8b llama3.2:3b phi4:14b gpt-oss:20b qwen3:32b" ;;
  d) SELECTED_MODELS="qwen3-coder:30b qwen2.5-coder:32b" ;;
  e) SELECTED_MODELS="qwen3-vl:8b gemma4:12b mistral-small3.2:24b gemma3:27b" ;;
  f) SELECTED_MODELS="llama3.1:8b qwen3-coder:30b qwen3-vl:8b embeddinggemma" ;;
  g) SELECTED_MODELS="llama3.3:70b deepseek-r1:70b llama3.1:8b qwen3-coder:30b qwen2.5-coder:32b qwen3-vl:8b gemma4:12b embeddinggemma nomic-embed-text bge-m3 llama3.2:3b phi4:14b gpt-oss:20b qwen3:32b mistral-small3.2:24b gemma3:27b" ;;
  h) SELECTED_MODELS="llama3.2:3b" ;;
  i) SELECTED_MODELS="phi4:14b" ;;
  j) SELECTED_MODELS="gpt-oss:20b" ;;
  k) SELECTED_MODELS="qwen3:32b" ;;
  l) SELECTED_MODELS="mistral-small3.2:24b" ;;
  m) SELECTED_MODELS="gemma3:27b" ;;
  0)
    echo ""
    echo -e "  ${CYAN}Select models by number:${NC}"
    echo -e "  ${GREEN}1${NC}) llama3.1:8b        (5 GB)"
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
    echo -e "  ${GREEN}h${NC}) llama3.2:3b        (2 GB)"
    echo -e "  ${GREEN}i${NC}) phi4:14b           (9 GB)"
    echo -e "  ${GREEN}j${NC}) gpt-oss:20b        (14 GB)"
    echo -e "  ${GREEN}k${NC}) qwen3:32b          (20 GB)"
    echo -e "  ${GREEN}l${NC}) mistral-small3.2:24b (15 GB)"
    echo -e "  ${GREEN}m${NC}) gemma3:27b         (18 GB)"
    echo ""
    read -r -p "  Numbers (e.g. 1 4 7, or h j for new picks): " custom_input
    SELECTED_MODELS=""
    for num in $custom_input; do
      case $num in
        1) SELECTED_MODELS="$SELECTED_MODELS llama3.1:8b" ;;
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
        h) SELECTED_MODELS="$SELECTED_MODELS llama3.2:3b" ;;
        i) SELECTED_MODELS="$SELECTED_MODELS phi4:14b" ;;
        j) SELECTED_MODELS="$SELECTED_MODELS gpt-oss:20b" ;;
        k) SELECTED_MODELS="$SELECTED_MODELS qwen3:32b" ;;
        l) SELECTED_MODELS="$SELECTED_MODELS mistral-small3.2:24b" ;;
        m) SELECTED_MODELS="$SELECTED_MODELS gemma3:27b" ;;
      esac
    done
    SELECTED_MODELS=$(echo "$SELECTED_MODELS" | xargs)
    SELECTED_MODELS=${SELECTED_MODELS:-"llama3.1:8b"}
    ;;
  *) SELECTED_MODELS="llama3.1:8b" ;;
esac

echo ""
echo -e "${CYAN}  Installing models: ${SELECTED_MODELS}${NC}"
echo ""

# Disk preflight: a full disk mid-pull leaves a corrupt blob and a miner
# that fails every task. 15GB covers the default picks (llama3.1:8b ≈ 5GB)
# with headroom; KRELZ_SKIP_DISK_CHECK=1 overrides (air-gapped/tiny boxes).
if [ "${KRELZ_SKIP_DISK_CHECK:-0}" != "1" ]; then
  FREE_KB=$(df -Pk / | awk 'NR==2 {print $4}')
  FREE_GB=$(( ${FREE_KB:-0} / 1024 / 1024 ))
  if [ "$FREE_GB" -lt 15 ]; then
    echo -e "  ${RED:-}  ✗ Only ${FREE_GB}GB free on / — model downloads need ≥15GB.${NC:-}"
    echo -e "  ${YELLOW:-}  Free up disk space and re-run, or set KRELZ_SKIP_DISK_CHECK=1 to skip this check.${NC:-}"
    exit 1
  fi
fi

# --- Step 4: Download Models ---
step_start 4 "Downloading models..."
STEP_START=$(date +%s)
MODEL_COUNT=$(echo "$SELECTED_MODELS" | wc -w)
MODEL_CURRENT=0

for MODEL in $SELECTED_MODELS; do
  MODEL_CURRENT=$((MODEL_CURRENT + 1))
  SIZE="${MODEL_SIZES[$MODEL]:-unknown}"
  echo -e "  ${CYAN}[${MODEL_CURRENT}/${MODEL_COUNT}]${NC} 📦 ${BOLD}${MODEL}${NC} (${SIZE})"
  ollama pull "$MODEL" || echo -e "  ${YELLOW}  ⚠ ${MODEL} may already exist or download in progress${NC}"
  echo ""
done

STEP_END=$(date +%s)
ELAPSED=$((STEP_END - STEP_START))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))
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
# M7: reproducible install from the committed lockfile, prod deps only —
# `npm install` re-resolved the tree and pulled Electron's devDependencies
# onto headless miners for nothing.
run_with_spinner "Installing npm dependencies..." bash -c "cd '$INSTALL_DIR/miner-app' && npm ci --omit=dev"
STEP_END=$(date +%s)
step_done "Miner installed at $INSTALL_DIR ($((STEP_END - STEP_START))s)"

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
  read -r -p "  Email: " USER_EMAIL
fi

if [ -z "$MINER_TOKEN" ]; then
  # H4: silent input — the token must not echo to the terminal or scrollback.
  read -rsp "  Miner Token: " MINER_TOKEN
  echo ""
fi

# --- Miner name (shown in dashboard) ---
if [ -z "$MINER_NAME" ]; then
  DEFAULT_NAME=$(hostname 2>/dev/null || echo "miner")
  read -r -p "  Miner Name [${DEFAULT_NAME}]: " MINER_NAME
  MINER_NAME=${MINER_NAME:-$DEFAULT_NAME}
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
step_done "System info detected ($((STEP_END - STEP_START))s)"

# --- Step 7: Register Miner ---
step_start 7 "Registering miner..."
STEP_START=$(date +%s)

# M6/H4: build the body with jq (quotes in name/email can't break it) and
# stream it on stdin — curl's argv is world-readable via `ps`, and this body
# carries the miner token.
SETUP_PAYLOAD=$(jq -n \
  --arg email "$USER_EMAIL" \
  --arg token "$MINER_TOKEN" \
  --arg name "$MINER_NAME" \
  --arg gpu "$GPU_MODEL" \
  --arg ram "$RAM_SIZE" \
  --arg cpu "$CPU_MODEL" \
  --arg models "$SELECTED_MODELS" \
  '{email: $email, miner_token: $token, name: $name, gpu_model: $gpu, ram: $ram, cpu: $cpu, models: ($models | split(" ") | map(select(length > 0)))}')

SETUP_RESPONSE=$(printf '%s' "$SETUP_PAYLOAD" | curl -s -X POST https://krelz.xyz/api/miners/setup \
  -H "Content-Type: application/json" \
  --data-binary @-)

STEP_END=$(date +%s)
if echo "$SETUP_RESPONSE" | grep -q '"success":true'; then
  step_done "Miner registered ($((STEP_END - STEP_START))s)"
else
  step_fail "Registration failed. Check email and token."
  echo -e "  ${YELLOW}Response: $SETUP_RESPONSE${NC}"
  # M2: do not start a service with a token the server rejected — the old
  # script only warned and continued into step 8.
  exit 1
fi

# --- Step 8: Systemd Service ---
step_start 8 "Saving config + starting service..."
STEP_START=$(date +%s)

# M6/H4: jq-encode (a quote in the miner name used to produce invalid JSON)
# and keep the file owner-only — it holds the miner token.
jq -n \
  --arg models "$(echo "$SELECTED_MODELS" | tr ' ' ',')" \
  --arg default_model "$(echo "$SELECTED_MODELS" | awk '{print $1}')" \
  --arg miner_token "$MINER_TOKEN" \
  --arg name "$MINER_NAME" \
  '{models: $models, default_model: $default_model, miner_token: $miner_token, name: $name}' \
  > "$INSTALL_DIR/miner-app/config.json"
chmod 600 "$INSTALL_DIR/miner-app/config.json"
echo -e "  ${GREEN}✓ Configuration saved (chmod 600)${NC}"

SERVICE_FILE="/etc/systemd/system/krelz-miner.service"
NODE_PATH=$(which node)
# M10: one templated unit for every install — the hardening block lives in
# the repo's miner-app/krelz-miner.service; this only fills the placeholders.
UNIT_TEMPLATE="$INSTALL_DIR/miner-app/krelz-miner.service"
if [ ! -f "$UNIT_TEMPLATE" ]; then
  echo -e "${RED}  ✗ Missing $UNIT_TEMPLATE — run git pull in $INSTALL_DIR and retry${NC}"
  exit 1
fi
sed -e "s|@USER@|$(whoami)|g" \
    -e "s|@WORKDIR@|$INSTALL_DIR/miner-app|g" \
    -e "s|@NODE@|$NODE_PATH|g" \
    -e "s|^@ENV_LINES@$|" \
    "$UNIT_TEMPLATE" | $SUDO tee "$SERVICE_FILE" > /dev/null

run_with_spinner "Enabling service..." $SUDO systemctl daemon-reload
run_with_spinner "Starting service..." bash -c "$SUDO systemctl enable krelz-miner && $SUDO systemctl start krelz-miner"

STEP_END=$(date +%s)
step_done "Service started ($((STEP_END - STEP_START))s)"

# --- Summary ---
SCRIPT_END=$(date +%s)
TOTAL_ELAPSED=$((SCRIPT_END - SCRIPT_START))
TOTAL_MINUTES=$((TOTAL_ELAPSED / 60))
TOTAL_SECONDS=$((TOTAL_ELAPSED % 60))

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
# M8: self-delete only when $0 really IS this installer — the same content
# guard the uninstaller uses, so a piped run ($0 = bash) or any unrelated
# file is never removed.
SELF="$0"
if [ -f "$SELF" ] && head -n 6 "$SELF" | grep -q "Krelz Network Miner - .* Install"; then
  rm -f -- "$SELF"
fi
