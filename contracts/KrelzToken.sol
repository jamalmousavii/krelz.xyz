// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title KrelzToken
 * @dev توکن KRELZ برای شبکه Krelz Network
 */
contract KrelzToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;
    
    address public burnAddress = 0x0000000000000000000000000000000000000001;
    
    event TokensBurned(address indexed account, uint256 amount);
    
    constructor() ERC20("Krelz", "KRELZ") Ownable(msg.sender) {
        _mint(msg.sender, MAX_SUPPLY);
    }
    
    /**
     * @dev سوزاندن توکن‌ها از موجودی فرستنده
     */
    function burn(uint256 amount) public {
        require(amount > 0, "Amount must be greater than 0");
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }
    
    /**
     * @dev سوزاندن توکن‌ها از موجودی دیگران (نیاز به allowance)
     */
    function burnFrom(address account, uint256 amount) public {
        require(amount > 0, "Amount must be greater than 0");
        _burn(account, amount);
        emit TokensBurned(account, amount);
    }
    
    /**
     * @dev سوزاندن خودکار (برای کارمزد تراکنش)
     */
    function autoBurn(uint256 amount) internal {
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }
}
