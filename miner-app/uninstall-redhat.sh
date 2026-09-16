#!/bin/bash
# ============================================
#   Krelz Network Miner - RedHat/CentOS/Fedora Uninstall
# ============================================
# Usage:
#   wget https://raw.githubusercontent.com/jamalmousavii/krelz.xyz/main/miner-app/uninstall-redhat.sh && bash uninstall-redhat.sh
# ============================================

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

INSTALL_DIR="$HOME/krelz-miner"

echo ""
echo -e "${RED}========================================${NC}"
echo -e "${RED}  Krelz Miner Uninstaller (RedHat/Fedora)${NC}"
echo -e "${RED}========================================${NC}"
echo ""
echo -e "  What do you want to remove?"
echo ""
echo -e "  ${GREEN}1${NC}) Miner only (service + app files)"
echo -e "  ${GREEN}2${NC}) Everything (miner + Ollama + all downloaded models)"
echo -e "  ${RED}0${NC}) Cancel"
echo ""

read -p "  Choice [0-2]: " choice

case $choice in
  1)
    echo ""
    echo -e "${YELLOW}Removing miner...${NC}"

    # Stop service
    if systemctl is-active --quiet krelz-miner 2>/dev/null; then
      echo -e "  Stopping krelz-miner service..."
      sudo systemctl stop krelz-miner
      echo -e "  ${GREEN}✓ Service stopped${NC}"
    fi

    # Disable service
    if systemctl is-enabled --quiet krelz-miner 2>/dev/null; then
      echo -e "  Disabling krelz-miner service..."
      sudo systemctl disable krelz-miner
      echo -e "  ${GREEN}✓ Service disabled${NC}"
    fi

    # Remove service file
    if [ -f /etc/systemd/system/krelz-miner.service ]; then
      echo -e "  Removing service file..."
      sudo rm -f /etc/systemd/system/krelz-miner.service
      sudo systemctl daemon-reload
      echo -e "  ${GREEN}✓ Service file removed${NC}"
    fi

    # Remove app files
    if [ -d "$INSTALL_DIR" ]; then
      echo -e "  Removing $INSTALL_DIR..."
      rm -rf "$INSTALL_DIR"
      echo -e "  ${GREEN}✓ Miner files removed${NC}"
    fi

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Miner removed successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "  Ollama and models are still installed."
    echo -e "  To remove them, run this script again and choose option 2."
    echo ""
    ;;

  2)
    echo ""
    echo -e "${RED}Removing everything...${NC}"

    # Stop miner service
    if systemctl is-active --quiet krelz-miner 2>/dev/null; then
      echo -e "  Stopping krelz-miner service..."
      sudo systemctl stop krelz-miner
    fi

    # Disable miner service
    if systemctl is-enabled --quiet krelz-miner 2>/dev/null; then
      sudo systemctl disable krelz-miner
    fi

    # Remove miner service file
    if [ -f /etc/systemd/system/krelz-miner.service ]; then
      sudo rm -f /etc/systemd/system/krelz-miner.service
      sudo systemctl daemon-reload
      echo -e "  ${GREEN}✓ Miner service removed${NC}"
    fi

    # Remove miner app files
    if [ -d "$INSTALL_DIR" ]; then
      rm -rf "$INSTALL_DIR"
      echo -e "  ${GREEN}✓ Miner files removed${NC}"
    fi

    # Stop Ollama
    if systemctl is-active --quiet ollama 2>/dev/null; then
      echo -e "  Stopping Ollama service..."
      sudo systemctl stop ollama
    fi

    # Disable Ollama
    if systemctl is-enabled --quiet ollama 2>/dev/null; then
      sudo systemctl disable ollama
    fi

    # Remove Ollama binary
    if [ -f /usr/local/bin/ollama ]; then
      echo -e "  Removing Ollama binary..."
      sudo rm -f /usr/local/bin/ollama
      echo -e "  ${GREEN}✓ Ollama binary removed${NC}"
    fi

    # Remove Ollama service file
    if [ -f /etc/systemd/system/ollama.service ]; then
      sudo rm -f /etc/systemd/system/ollama.service
      sudo systemctl daemon-reload
    fi

    # Remove Ollama models and data
    if [ -d "$HOME/.ollama" ]; then
      echo -e "  Removing Ollama models (~/.ollama)..."
      rm -rf "$HOME/.ollama"
      echo -e "  ${GREEN}✓ Ollama models removed${NC}"
    fi

    # Remove Ollama user
    if id "ollama" &>/dev/null; then
      echo -e "  Removing ollama user..."
      sudo userdel -r ollama 2>/dev/null || true
      echo -e "  ${GREEN}✓ Ollama user removed${NC}"
    fi

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Everything removed successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    ;;

  0)
    echo ""
    echo -e "${YELLOW}Cancelled.${NC}"
    echo ""
    ;;

  *)
    echo ""
    echo -e "${RED}Invalid choice. Cancelled.${NC}"
    echo ""
    ;;
esac
