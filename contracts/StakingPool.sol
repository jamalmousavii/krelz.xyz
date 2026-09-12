// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StakingPool
 * @dev استخر استیکینگ برای ماینرها
 */
contract StakingPool is ReentrancyGuard, Ownable {
    IERC20 public token;
    
    uint256 public totalStaked;
    uint256 public rewardPerBlock = 10 * 10**18; // 10 توکن در هر بلاک
    uint256 public platformFeePercent = 10; // 10% کارمزد پلتفرم
    
    struct MinerInfo {
        uint256 stakedAmount;
        uint256 rewardDebt;
        uint256 lastClaimTime;
        bool isActive;
    }
    
    mapping(address => MinerInfo) public miners;
    address[] public minerList;
    
    event Staked(address indexed miner, uint256 amount);
    event Unstaked(address indexed miner, uint256 amount);
    event RewardClaimed(address indexed miner, uint256 reward);
    
    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }
    
    /**
     * @dev استیک کردن توکن
     */
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        // انتقال توکن از کاربر
        token.transferFrom(msg.sender, address(this), amount);
        
        MinerInfo storage miner = miners[msg.sender];
        
        // اگر ماینر جدید است، به لیست اضافه کن
        if (!miner.isActive) {
            minerList.push(msg.sender);
        }
        
        miner.stakedAmount += amount;
        miner.isActive = true;
        totalStaked += amount;
        
        emit Staked(msg.sender, amount);
    }
    
    /**
     * @dev برداشت توکن از استیک
     */
    function unstake(uint256 amount) external nonReentrant {
        MinerInfo storage miner = miners[msg.sender];
        require(miner.stakedAmount >= amount, "Insufficient staked amount");
        
        miner.stakedAmount -= amount;
        totalStaked -= amount;
        
        if (miner.stakedAmount == 0) {
            miner.isActive = false;
        }
        
        token.transfer(msg.sender, amount);
        
        emit Unstaked(msg.sender, amount);
    }
    
    /**
     * @dev دریافت پاداش
     */
    function claimReward() external nonReentrant {
        MinerInfo storage miner = miners[msg.sender];
        require(miner.isActive, "Not active miner");
        
        uint256 reward = calculateReward(msg.sender);
        require(reward > 0, "No reward to claim");
        
        // کارمزد پلتفرم
        uint256 platformFee = reward * platformFeePercent / 100;
        uint256 minerReward = reward - platformFee;
        
        miner.lastClaimTime = block.timestamp;
        
        // انتقال پاداش
        token.transfer(msg.sender, minerReward);
        token.transfer(owner(), platformFee);
        
        emit RewardClaimed(msg.sender, minerReward);
    }
    
    /**
     * @dev محاسبه پاداش
     */
    function calculateReward(address minerAddr) public view returns (uint256) {
        MinerInfo storage miner = miners[minerAddr];
        if (!miner.isActive) return 0;
        
        uint256 timeElapsed = block.timestamp - miner.lastClaimTime;
        uint256 blocksElapsed = timeElapsed / 12; // 12 ثانیه در هر بلاک BSC
        
        uint256 totalReward = blocksElapsed * rewardPerBlock;
        uint256 share = (miner.stakedAmount * totalReward) / totalStaked;
        
        return share;
    }
    
    /**
     * @dev دریافت لیست ماینرها
     */
    function getMiners() external view returns (address[] memory) {
        return minerList;
    }
}
