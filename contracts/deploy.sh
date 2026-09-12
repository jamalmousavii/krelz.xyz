#!/bin/bash
# Krelz Network - BSC Testnet Deploy Script
# Run this after getting BNB Testnet from faucet

set -e

echo "🚀 Deploying Krelz Contracts to BSC Testnet..."
echo ""

# Check for .env
if [ ! -f .env ]; then
  echo "❌ .env file not found!"
  echo "Create .env with: DEPLOY_PRIVATE_KEY=your_private_key"
  exit 1
fi

source .env

if [ -z "$DEPLOY_PRIVATE_KEY" ] || [ "$DEPLOY_PRIVATE_KEY" = "0x0000000000000000000000000000000000000000000000000000000000000000" ]; then
  echo "❌ DEPLOY_PRIVATE_KEY not set in .env!"
  exit 1
fi

echo "📦 Compiling contracts..."
npx hardhat compile

echo ""
echo "🚀 Deploying to BSC Testnet..."
npx hardhat run scripts/deploy.js --network bscTestnet

echo ""
echo "✅ Deploy complete!"
echo "Update these values in /opt/krelz/.env.secrets:"
echo "  BSC_TESTNET_TOKEN_ADDRESS=<from output above>"
echo "  BSC_TESTNET_STAKING_ADDRESS=<from output above>"
