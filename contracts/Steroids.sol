pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/apps-token-manager/contracts/TokenManager.sol";
import "@aragon/apps-vault/contracts/Vault.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/lib/math/SafeMath64.sol";
import "./interfaces/IUniswapV2Pair.sol";


contract Steroids is AragonApp {
    using SafeMath for uint256;
    using SafeMath64 for uint64;

    // prettier-ignore
    bytes32 public constant CHANGE_LOCK_TIME_ROLE = keccak256("CHANGE_LOCK_TIME_ROLE");
    // prettier-ignore
    bytes32 public constant CHANGE_MAX_LOCKS_ROLE = keccak256("CHANGE_MAX_LOCKS_ROLE");
    // prettier-ignore
    bytes32 public constant CHANGE_VAULT_ROLE = keccak256("CHANGE_VAULT_ROLE");
    // prettier-ignore
    bytes32 public constant ADJUST_BALANCE_ROLE = keccak256("ADJUST_BALANCE_ROLE");

    uint64 public constant MAX_LOCKS_LIMIT = 20;

    // prettier-ignore
    string private constant ERROR_ADDRESS_NOT_CONTRACT = "STEROIDS_ADDRESS_NOT_CONTRACT";
    // prettier-ignore
    string private constant ERROR_TOKEN_WRAP_REVERTED = "STEROIDS_WRAP_REVERTED";
    // prettier-ignore
    string private constant ERROR_INSUFFICENT_TOKENS = "STEROIDS_INSUFFICENT_TOKENS";
    // prettier-ignore
    string private constant ERROR_NOT_ENOUGH_UNWRAPPABLE_TOKENS = "STEROIDS_NOT_ENOUGH_UNWRAPPABLE_TOKENS";
    // prettier-ignore
    string private constant ERROR_TOKENS_NOT_APPROVED = "STEROIDS_TOKENS_NOT_APPROVED";
    // prettier-ignore
    string private constant ERROR_STAKE_ZERO_TOKENS = "STEROIDS_STAKE_ZERO_TOKENS";
    // prettier-ignore
    string private constant ERROR_LOCK_TIME_TOO_LOW = "STEROIDS_LOCK_TIME_TOO_LOW";
    // prettier-ignore
    string private constant ERROR_IMPOSSIBLE_TO_INSERT = "STEROIDS_IMPOSSIBLE_TO_INSERT";
    // prettier-ignore
    string private constant ERROR_MAX_LOCKS_TOO_HIGH = "STEROIDS_MAX_LOCKS_TOO_HIGH";

    struct Lock {
        uint64 lockDate;
        uint64 duration;
        uint256 uniV2PairAmount;
        uint256 wrappedTokenAmount;
    }

    TokenManager public wrappedTokenManager;
    Vault public vault;
    IUniswapV2Pair public uniswapV2Pair;

    uint64 public minLockTime;
    uint64 public maxLocks;

    mapping(address => Lock[]) public addressStakeLocks;

    event Staked(
        address sender,
        address receiver,
        uint256 uniV2Amount,
        uint256 wrappedTokenAmount,
        uint64 duration,
        uint64 lockDate
    );
    event Unstaked(
        address receiver,
        uint256 uniV2Amount,
        uint256 wrappedTokenAmount
    );
    event LockTimeChanged(uint256 duration);
    event MaxLocksChanged(uint64 maxLocks);
    event VaultChanged(address vault);
    event StakedLockAdjusted(address owner, uint256 amount);

    /**
     * @notice Initialize Steroids app contract
     * @param _tokenManager TokenManager address
     * @param _vault Vault address
     * @param _uniswapV2Pair Accepted token address
     * @param _minLockTime number of seconds after which it's possible to unwrap tokens related to a wrap
     * @param _maxLocks number of possible stakedLocks for a given address before doing an unwrap
     */
    function initialize(
        address _tokenManager,
        address _vault,
        address _uniswapV2Pair,
        uint64 _minLockTime,
        uint64 _maxLocks
    ) external onlyInit {
        require(isContract(_tokenManager), ERROR_ADDRESS_NOT_CONTRACT);
        require(isContract(_uniswapV2Pair), ERROR_ADDRESS_NOT_CONTRACT);
        require(isContract(_vault), ERROR_ADDRESS_NOT_CONTRACT);
        require(_maxLocks <= MAX_LOCKS_LIMIT, ERROR_MAX_LOCKS_TOO_HIGH);

        wrappedTokenManager = TokenManager(_tokenManager);
        vault = Vault(_vault);
        uniswapV2Pair = IUniswapV2Pair(_uniswapV2Pair);
        minLockTime = _minLockTime;
        maxLocks = _maxLocks;

        initialized();
    }

    /**
     * @notice Stake a given amount of uniswapV2Pair into wrappedTokenManager's token
     * @dev This function requires the MINT_ROLE permission on the TokenManager specified
     * @param _amount number of uniswapV2Pair tokens to stake
     * @param _duration lock time for this wrapping
     * @param _receiver address who will receive back once unwrapped
     */
    function stake(
        uint256 _amount,
        uint64 _duration,
        address _receiver
    ) external returns (bool) {
        require(_duration >= minLockTime, ERROR_LOCK_TIME_TOO_LOW);
        require(
            uniswapV2Pair.balanceOf(msg.sender) >= _amount,
            ERROR_INSUFFICENT_TOKENS
        );
        require(
            uniswapV2Pair.allowance(msg.sender, this) >= _amount,
            ERROR_TOKENS_NOT_APPROVED
        );
        require(
            uniswapV2Pair.transferFrom(msg.sender, address(vault), _amount),
            ERROR_TOKEN_WRAP_REVERTED
        );

        // the amount to stake is the _amount of staked tokens within an Uniswap pool by msg.sender
        // amount = (_amount / totalSupply) * reserve0
        uint256 uniswapV2PairTotalSupply = uniswapV2Pair.totalSupply();
        (uint256 uniswapV2PairReserve0, , ) = uniswapV2Pair.getReserves();
        uint256 wrappedTokenAmountToStake = _amount
            .mul(uniswapV2PairReserve0)
            .div(uniswapV2PairTotalSupply);

        require(wrappedTokenAmountToStake > 0, ERROR_STAKE_ZERO_TOKENS);

        wrappedTokenManager.mint(_receiver, wrappedTokenAmountToStake);
        (
            uint256 emptyIndex,
            uint256 totalNumberOfStakedLocks
        ) = _getEmptyLockIndexForAddress(_receiver);
        uint64 lockDate = getTimestamp64();

        if (emptyIndex < totalNumberOfStakedLocks) {
            addressStakeLocks[_receiver][emptyIndex] = Lock(
                lockDate,
                _duration,
                _amount,
                wrappedTokenAmountToStake
            );
        } else {
            addressStakeLocks[_receiver].push(
                Lock(lockDate, _duration, _amount, wrappedTokenAmountToStake)
            );
        }

        emit Staked(
            msg.sender,
            _receiver,
            _amount,
            wrappedTokenAmountToStake,
            _duration,
            lockDate
        );
        return true;
    }

    /**
     * @notice Unstake a given amount of wrappedTokenManager's token
     * @dev This function requires the MINT_ROLE and BURN_ROLE permissions on the TokenManager and TRANSFER_ROLE on the Vault specified
     * @param _amount Wrapped amount
     */
    function unstake(uint256 _amount) external returns (uint256) {
        uint256 uniswapV2PairTotalSupply = uniswapV2Pair.totalSupply();
        (uint256 uniswapV2PairReserve0, , ) = uniswapV2Pair.getReserves();

        require(
            _updateStakedTokenLocks(
                msg.sender,
                _amount,
                uniswapV2PairTotalSupply,
                uniswapV2PairReserve0
            ),
            ERROR_NOT_ENOUGH_UNWRAPPABLE_TOKENS
        );

        wrappedTokenManager.burn(msg.sender, _amount);

        uint256 uniV2AmountToTransfer = _amount
            .mul(uniswapV2PairTotalSupply)
            .div(uniswapV2PairReserve0);

        vault.transfer(uniswapV2Pair, msg.sender, uniV2AmountToTransfer);

        emit Unstaked(msg.sender, uniV2AmountToTransfer, _amount);
        return uniV2AmountToTransfer;
    }

    /**
     * @notice Adjust the user balance for an array of addresses in order to
     *         unstake the correct amount of tokens
     * @param _owners token owners
     */
    function adjustBalanceOfMany(address[] _owners)
        external
        auth(ADJUST_BALANCE_ROLE)
    {
        for (uint256 i = 0; i < _owners.length; i++) {
            adjustBalanceOf(_owners[i]);
        }
    }

    /**
     * @notice Change lock time
     * @param _minLockTime Lock time
     */
    function changeMinLockTime(uint64 _minLockTime)
        external
        auth(CHANGE_LOCK_TIME_ROLE)
    {
        minLockTime = _minLockTime;
        emit LockTimeChanged(minLockTime);
    }

    /**
     * @notice Change max stakedLocks
     * @param _maxLocks Maximun number of stakedLocks allowed for an address
     */
    function changeMaxAllowedStakeLocks(uint64 _maxLocks)
        external
        auth(CHANGE_MAX_LOCKS_ROLE)
    {
        require(_maxLocks <= MAX_LOCKS_LIMIT, ERROR_MAX_LOCKS_TOO_HIGH);
        maxLocks = _maxLocks;
        emit MaxLocksChanged(maxLocks);
    }

    /**
     * @notice Change vault
     * @param _vault new Vault address
     */
    function changeVaultContractAddress(address _vault)
        external
        auth(CHANGE_VAULT_ROLE)
    {
        require(isContract(_vault), ERROR_ADDRESS_NOT_CONTRACT);

        vault = Vault(_vault);
        emit VaultChanged(_vault);
    }

    /**
     * @notice Return all Locks for a given _address
     * @param _address address
     */
    function getStakedLocks(address _address) external view returns (Lock[]) {
        return addressStakeLocks[_address];
    }

    /**
     * @notice Adjust the user balance for an address in order to
     *         unstake the correct amount of tokens
     * @dev This function requires the MINT_ROLE and BURN_ROLE permission on the TokenManager specified
     * @param _owner token owner
     */
    function adjustBalanceOf(address _owner)
        public
        auth(ADJUST_BALANCE_ROLE)
        returns (bool)
    {
        Lock[] storage stakedLocks = addressStakeLocks[_owner];

        uint256 uniswapV2PairTotalSupply = uniswapV2Pair.totalSupply();
        (uint256 uniswapV2PairReserve0, , ) = uniswapV2Pair.getReserves();

        for (uint256 i = 0; i < stakedLocks.length; i++) {
            _adjustBalanceAndStakedLockOf(
                _owner,
                stakedLocks[i],
                uniswapV2PairTotalSupply,
                uniswapV2PairReserve0
            );
        }
        return true;
    }

    /**
     * @notice Check if it's possible to unwrap the specified _amountToUnstake of tokens and updates (or deletes) related stakedLocks
     * @param _unstaker address who want to unwrap
     * @param _amountToUnstake amount
     * @param _uniswapV2PairTotalSupply UniV2 current total supply
     * @param _uniswapV2PairReserve0 UniV2 current value of Reserve0
     */
    function _updateStakedTokenLocks(
        address _unstaker,
        uint256 _amountToUnstake,
        uint256 _uniswapV2PairTotalSupply,
        uint256 _uniswapV2PairReserve0
    ) internal returns (bool) {
        Lock[] storage stakedLocks = addressStakeLocks[_unstaker];

        uint256 totalAmountUnstakedSoFar = 0;
        uint256 stakedLocksLength = stakedLocks.length;
        uint64[] memory locksToRemove = new uint64[](stakedLocksLength);
        uint64 currentIndexOfLocksToBeRemoved = 0;

        bool result = false;
        uint64 timestamp = getTimestamp64();
        uint64 i = 0;
        for (; i < stakedLocksLength; i++) {
            if (
                timestamp >=
                stakedLocks[i].lockDate.add(stakedLocks[i].duration) &&
                !_isStakedLockEmpty(stakedLocks[i])
            ) {
                _adjustBalanceAndStakedLockOf(
                    _unstaker,
                    stakedLocks[i],
                    _uniswapV2PairTotalSupply,
                    _uniswapV2PairReserve0
                );

                totalAmountUnstakedSoFar = totalAmountUnstakedSoFar.add(
                    stakedLocks[i].wrappedTokenAmount
                );

                if (_amountToUnstake == totalAmountUnstakedSoFar) {
                    locksToRemove[currentIndexOfLocksToBeRemoved] = i;
                    currentIndexOfLocksToBeRemoved = currentIndexOfLocksToBeRemoved
                        .add(1);
                    result = true;
                    break;
                } else if (_amountToUnstake < totalAmountUnstakedSoFar) {
                    stakedLocks[i].wrappedTokenAmount = totalAmountUnstakedSoFar
                        .sub(_amountToUnstake);

                    stakedLocks[i].uniV2PairAmount = stakedLocks[i]
                        .wrappedTokenAmount
                        .mul(_uniswapV2PairTotalSupply)
                        .div(_uniswapV2PairReserve0);

                    result = true;
                    break;
                } else {
                    locksToRemove[currentIndexOfLocksToBeRemoved] = i;
                    currentIndexOfLocksToBeRemoved = currentIndexOfLocksToBeRemoved
                        .add(1);
                }
            }
        }

        for (i = 0; i < currentIndexOfLocksToBeRemoved; i++) {
            delete stakedLocks[locksToRemove[i]];
        }

        return result;
    }

    /**
     * @notice Adjust a staked lock amount
     * @dev This function requires the MINT_ROLE and BURN_ROLE permission on the TokenManager specified
     * @param _owner token owner
     * @param _lock lock to adjust
     * @param _uniswapV2PairTotalSupply UniV2 current total supply
     * @param _uniswapV2PairReserve0 UniV2 current value of Reserve0
     */
    function _adjustBalanceAndStakedLockOf(
        address _owner,
        Lock storage _lock,
        uint256 _uniswapV2PairTotalSupply,
        uint256 _uniswapV2PairReserve0
    ) internal returns (bool) {
        uint256 currentOwnerWrappedTokenAmount = _lock.wrappedTokenAmount;
        uint256 adjustedOwnerWrappedTokenLockAmount = _lock
            .uniV2PairAmount
            .mul(_uniswapV2PairReserve0)
            .div(_uniswapV2PairTotalSupply);

        if (
            adjustedOwnerWrappedTokenLockAmount ==
            currentOwnerWrappedTokenAmount
        ) {
            return false;
        }

        if (
            adjustedOwnerWrappedTokenLockAmount > currentOwnerWrappedTokenAmount
        ) {
            wrappedTokenManager.mint(
                _owner,
                adjustedOwnerWrappedTokenLockAmount.sub(
                    currentOwnerWrappedTokenAmount
                )
            );
        } else {
            wrappedTokenManager.burn(
                _owner,
                currentOwnerWrappedTokenAmount.sub(
                    adjustedOwnerWrappedTokenLockAmount
                )
            );
        }

        _lock.wrappedTokenAmount = adjustedOwnerWrappedTokenLockAmount;
        emit StakedLockAdjusted(_owner, adjustedOwnerWrappedTokenLockAmount);
        return true;
    }

    /**
     * @notice Returns the position in which it's possible to insert a new Lock within addressStakeLocks
     * @param _address address
     */
    function _getEmptyLockIndexForAddress(address _address)
        internal
        view
        returns (uint256, uint256)
    {
        Lock[] storage stakedLocks = addressStakeLocks[_address];
        uint256 numberOfStakeLocks = stakedLocks.length;

        if (numberOfStakeLocks < maxLocks) {
            return (maxLocks.add(1), numberOfStakeLocks);
        } else {
            for (uint256 i = 0; i < numberOfStakeLocks; i++) {
                if (_isStakedLockEmpty(stakedLocks[i])) {
                    return (i, numberOfStakeLocks);
                }
            }

            revert(ERROR_IMPOSSIBLE_TO_INSERT);
        }
    }

    /**
     * @notice Check if a Lock is empty
     * @param _lock lock
     */
    function _isStakedLockEmpty(Lock memory _lock)
        internal
        pure
        returns (bool)
    {
        return
            _lock.duration == 0 &&
            _lock.lockDate == 0 &&
            _lock.uniV2PairAmount == 0 &&
            _lock.wrappedTokenAmount == 0;
    }
}
