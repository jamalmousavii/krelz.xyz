# Krelz Network Smart Contracts

## قراردادهای هوشمند

### 1. KrelzToken.sol
توکن اصلی پروژه با قابلیت سوزاندن.

### 2. StakingPool.sol
استخر استیکینگ برای ماینرها.

---

## نصب وابستگی‌ها

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts
```

## تنظیم Hardhat

```javascript
// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      accounts: [process.env.DEPLOY_PRIVATE_KEY]
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: [process.env.DEPLOY_PRIVATE_KEY]
    }
  }
};
```

## Compile

```bash
npx hardhat compile
```

## Test

```bash
npx hardhat test
```

## Deploy

```bash
# BSC Testnet
npx hardhat run scripts/deploy.js --network bscTestnet

# BSC Mainnet
npx hardhat run scripts/deploy.js --network bsc
```

---

## آدرس قراردادها

| قرارداد | آدرس |
|---------|------|
| KrelzToken | 0x... |
| StakingPool | 0x... |
