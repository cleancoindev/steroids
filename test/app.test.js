const { assert } = require('chai')
const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const { newDao, newApp } = require('./helpers/dao')
const { setPermission } = require('./helpers/permissions')
const { timeTravel } = require('./helpers/time-travel')
const {
  stake,
  unstake,
  addLiquidity,
  removeLiquidity,
  getAdjustedAmount,
  hasBeenUnstakedWithRounding,
} = require('./helpers/utils')
const { getEventArgument } = require('@aragon/test-helpers/events')

const MiniMeToken = artifacts.require('MiniMeToken')
const MiniMeTokenFactory = artifacts.require('MiniMeTokenFactory')
const MockErc20 = artifacts.require('TokenMock')
const TokenManager = artifacts.require('TokenManager')
const Steroids = artifacts.require('Steroids')
const Vault = artifacts.require('Vault')
const UniswapV2Pair = artifacts.require('UniswapV2Pair.json')
const UniswapV2Factory = artifacts.require('UniswapV2Factory.json')
const { hash: nameHash } = require('eth-ens-namehash')

const ETH_ADDRESS = '0x0000000000000000000000000000000000000000'
const MOCK_TOKEN_BALANCE = 1000000000000
const ONE_DAY = 86400
const MAX_LOCKS = 20
const LOCK_TIME = ONE_DAY * 7

contract('Steroids', ([appManager, ACCOUNTS_1, ...accounts]) => {
  let miniMeToken,
    steroidsBase,
    steroids,
    wrappedTokenManager,
    tokenManagerBase,
    uniV2Pair,
    vaultBase,
    vault,
    token0,
    token1
  let MINT_ROLE,
    BURN_ROLE,
    ISSUE_ROLE,
    ASSIGN_ROLE,
    TRANSFER_ROLE,
    CHANGE_LOCK_TIME_ROLE,
    CHANGE_MAX_LOCKS_ROLE,
    CHANGE_VAULT_ROLE,
    ADJUST_BALANCE_ROLE

  const NOT_CONTRACT = appManager

  before('deploy base apps', async () => {
    steroidsBase = await Steroids.new()
    CHANGE_LOCK_TIME_ROLE = await steroidsBase.CHANGE_LOCK_TIME_ROLE()
    CHANGE_MAX_LOCKS_ROLE = await steroidsBase.CHANGE_MAX_LOCKS_ROLE()
    CHANGE_VAULT_ROLE = await steroidsBase.CHANGE_VAULT_ROLE()
    ADJUST_BALANCE_ROLE = await steroidsBase.ADJUST_BALANCE_ROLE()

    tokenManagerBase = await TokenManager.new()
    MINT_ROLE = await tokenManagerBase.MINT_ROLE()
    BURN_ROLE = await tokenManagerBase.BURN_ROLE()
    ISSUE_ROLE = await tokenManagerBase.ISSUE_ROLE()
    ASSIGN_ROLE = await tokenManagerBase.ASSIGN_ROLE()

    vaultBase = await Vault.new()
    TRANSFER_ROLE = await vaultBase.TRANSFER_ROLE()
  })

  beforeEach('deploy dao and token deposit', async () => {
    const daoDeployment = await newDao(appManager)
    dao = daoDeployment.dao
    acl = daoDeployment.acl

    const miniMeTokenFactory = await MiniMeTokenFactory.new()
    miniMeToken = await MiniMeToken.new(
      miniMeTokenFactory.address,
      ETH_ADDRESS,
      0,
      'DaoToken',
      18,
      'DPT',
      true
    )

    steroids = await Steroids.at(
      await newApp(
        dao,
        nameHash('steroids.aragonpm.test'),
        steroidsBase.address,
        appManager
      )
    )

    wrappedTokenManager = await TokenManager.at(
      await newApp(
        dao,
        nameHash('token-manager.aragonpm.test'),
        tokenManagerBase.address,
        appManager
      )
    )
    await miniMeToken.changeController(wrappedTokenManager.address)

    vault = await Vault.at(
      await newApp(
        dao,
        nameHash('vault.aragonpm.test'),
        vaultBase.address,
        appManager
      )
    )

    await vault.initialize()
    await wrappedTokenManager.initialize(miniMeToken.address, false, 0)

    // Uniswap stuff. token0 is the token used by steroid
    token0 = await MockErc20.new(appManager, MOCK_TOKEN_BALANCE)
    token1 = await MockErc20.new(appManager, MOCK_TOKEN_BALANCE)
    const uniswapV2Factory = await UniswapV2Factory.new(appManager)
    const receipt = await uniswapV2Factory.createPair(
      token0.address,
      token1.address
    )
    const log = receipt.logs.find(({ event }) => event === 'PairCreated')
    uniV2Pair = await UniswapV2Pair.at(log.args.pair)
  })

  describe('initialize(address _tokenManager, address _vault, address _depositToken, _uint256 _minLockTime _uint256 maxLocks) fails', async () => {
    it('Should revert when passed non-contract address as token manager', async () => {
      await assertRevert(
        steroids.initialize(
          NOT_CONTRACT,
          vault.address,
          ETH_ADDRESS,
          ONE_DAY * 6,
          MAX_LOCKS
        ),
        'STEROIDS_ADDRESS_NOT_CONTRACT'
      )
    })

    it('Should revert when passed non-contract address as vault', async () => {
      await assertRevert(
        steroids.initialize(
          wrappedTokenManager.address,
          NOT_CONTRACT,
          ETH_ADDRESS,
          ONE_DAY * 6,
          MAX_LOCKS
        ),
        'STEROIDS_ADDRESS_NOT_CONTRACT'
      )
    })

    it('Should revert when passed non-contract address as deposit token', async () => {
      await assertRevert(
        steroids.initialize(
          wrappedTokenManager.address,
          vault.address,
          NOT_CONTRACT,
          ONE_DAY * 6,
          MAX_LOCKS
        ),
        'STEROIDS_ADDRESS_NOT_CONTRACT'
      )
    })
  })

  describe('initialize(address _tokenManager, address _vault, address address _depositToken, _uint256 _minLockTime, _uint256 maxLocks)', () => {
    beforeEach(async () => {
      await steroids.initialize(
        wrappedTokenManager.address,
        vault.address,
        uniV2Pair.address,
        ONE_DAY * 6,
        MAX_LOCKS
      )
    })

    it('Should set correct variables', async () => {
      const actualTokenManager = await steroids.wrappedTokenManager()
      const actualVault = await steroids.vault()
      const actualDepositToken = await steroids.uniV2Pair()

      assert.strictEqual(actualTokenManager, wrappedTokenManager.address)
      assert.strictEqual(actualVault, vault.address)
      assert.strictEqual(actualDepositToken, uniV2Pair.address)
    })

    it('Should set able to set maxLocks and minLockTime and vault', async () => {
      await setPermission(
        acl,
        appManager,
        steroids.address,
        CHANGE_LOCK_TIME_ROLE,
        appManager
      )

      await setPermission(
        acl,
        appManager,
        steroids.address,
        CHANGE_MAX_LOCKS_ROLE,
        appManager
      )

      await setPermission(
        acl,
        appManager,
        steroids.address,
        CHANGE_VAULT_ROLE,
        appManager
      )

      await steroids.changeMinLockTime(ONE_DAY * 7, {
        from: appManager,
      })

      await steroids.changeMaxAllowedStakeLocks(MAX_LOCKS - 1, {
        from: appManager,
      })

      await steroids.changeVaultContractAddress(vault.address, {
        from: appManager,
      })

      const maxLocks = parseInt(await steroids.maxLocks())
      const lockTime = parseInt(await steroids.minLockTime())

      assert.strictEqual(maxLocks, MAX_LOCKS - 1)
      assert.strictEqual(lockTime, ONE_DAY * 7)
    })

    it('Should not be able to set maxLocks because of no permission', async () => {
      await assertRevert(
        steroids.changeMaxAllowedStakeLocks(MAX_LOCKS + 1, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    it('Should not be able to set minLockTime because of no permission', async () => {
      await assertRevert(
        steroids.changeMinLockTime(ONE_DAY * 7, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    it('Should not be able to set a new Vault because of no permission', async () => {
      await assertRevert(
        steroids.changeVaultContractAddress(vault.address, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    it('Should not be able to adjust a balance because of no permission', async () => {
      await assertRevert(
        steroids.adjustBalanceOf(appManager, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    describe('stake(uint256 _amount, uint256 _lockTime, address _receiver) & unstake(uint256 _amount)', async () => {
      beforeEach(async () => {
        await setPermission(
          acl,
          steroids.address,
          wrappedTokenManager.address,
          MINT_ROLE,
          appManager
        )

        await setPermission(
          acl,
          steroids.address,
          wrappedTokenManager.address,
          BURN_ROLE,
          appManager
        )

        await setPermission(
          acl,
          steroids.address,
          vault.address,
          TRANSFER_ROLE,
          appManager
        )

        await addLiquidity(
          token0,
          token1,
          500000,
          1000000,
          uniV2Pair,
          appManager
        )
      })

      it('Should not be able to stake without token approve', async () => {
        await assertRevert(
          steroids.stake(10, LOCK_TIME, appManager, {
            from: appManager,
          }),
          'STEROIDS_TOKENS_NOT_APPROVED'
        )
      })

      it('Should not be able to perform more stake than allowed (maxLocks)', async () => {
        const amountToStake = 10
        for (let i = 0; i < MAX_LOCKS; i++) {
          await stake(
            uniV2Pair,
            steroids,
            amountToStake,
            LOCK_TIME,
            appManager,
            appManager
          )
        }

        await assertRevert(
          stake(
            uniV2Pair,
            steroids,
            amountToStake,
            LOCK_TIME,
            appManager,
            appManager
          ),
          'STEROIDS_IMPOSSIBLE_TO_INSERT'
        )
      })

      it('Should not be able to set maxLocks because of of value too high', async () => {
        await setPermission(
          acl,
          appManager,
          steroids.address,
          CHANGE_MAX_LOCKS_ROLE,
          appManager
        )

        await assertRevert(
          steroids.changeMaxAllowedStakeLocks(MAX_LOCKS + 1, {
            from: appManager,
          }),
          'STEROIDS_MAX_LOCKS_TOO_HIGH'
        )
      })

      it('Should not be able to stake more than you have approved', async () => {
        const amountToStake = 100
        await uniV2Pair.approve(steroids.address, amountToStake / 2, {
          from: appManager,
        })

        await assertRevert(
          steroids.stake(amountToStake, LOCK_TIME, appManager, {
            from: appManager,
          }),
          'STEROIDS_TOKENS_NOT_APPROVED'
        )
      })

      it('Should not be able to stake with a lock time less than the minimun one', async () => {
        await assertRevert(
          stake(uniV2Pair, steroids, 20, LOCK_TIME / 2, appManager, appManager),
          'STEROIDS_LOCK_TIME_TOO_LOW'
        )
      })

      it('Should get organization tokens in exchange for uniV2 and viceversa', async () => {
        const swapAmount = 10000
        const amountToStake = 1000
        const amount0Out = 4000

        const expectedStakedAmount = await getAdjustedAmount(
          uniV2Pair,
          amountToStake
        )

        let receipt = await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )
        let uniV2Amount = getEventArgument(receipt, 'Staked', 'uniV2Amount')
        let wrappedTokenAmount = getEventArgument(
          receipt,
          'Staked',
          'wrappedTokenAmount'
        )
        assert.strictEqual(parseInt(wrappedTokenAmount), expectedStakedAmount)
        assert.strictEqual(parseInt(uniV2Amount), amountToStake)

        await token1.transfer(uniV2Pair.address, swapAmount)
        await uniV2Pair.swap(amount0Out, 0, appManager, '0x')

        await timeTravel(LOCK_TIME)

        const expectedUnstakedAmount = await getAdjustedAmount(
          uniV2Pair,
          amountToStake
        )

        receipt = await unstake(steroids, amountToStake, appManager)
        uniV2Amount = getEventArgument(receipt, 'Unstaked', 'uniV2Amount')
        wrappedTokenAmount = getEventArgument(
          receipt,
          'Unstaked',
          'wrappedTokenAmount'
        )
        const receiver = getEventArgument(receipt, 'Unstaked', 'receiver')

        assert.strictEqual(parseInt(uniV2Amount), amountToStake)
        assert.strictEqual(parseInt(wrappedTokenAmount), expectedUnstakedAmount)
        assert.strictEqual(receiver, appManager)
      })

      it('Should not be able to unstake more than you have', async () => {
        const amountToStake = 100

        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await timeTravel(LOCK_TIME)

        await assertRevert(
          unstake(steroids, amountToStake * 2, appManager),
          'STEROIDS_NOT_ENOUGH_UNWRAPPABLE_TOKENS'
        )
      })

      it('Should not be able to unstake because it needs to wait the correct time', async () => {
        const amountToStake = 100

        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )
        await assertRevert(
          unstake(steroids, amountToStake * 2, appManager),
          'STEROIDS_NOT_ENOUGH_UNWRAPPABLE_TOKENS'
        )
      })

      it('Should not be able to unstake because it needs to wait the correct time', async () => {
        const amountToStake = 100
        const amountToUnstake = 200

        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )
        await timeTravel(ONE_DAY * 6 + ONE_DAY)
        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await assertRevert(
          unstake(steroids, amountToUnstake, appManager),
          'STEROIDS_NOT_ENOUGH_UNWRAPPABLE_TOKENS'
        )
      })

      it('Should be able to unstake with many unstaking txs and adjusting balance', async () => {
        const amountToStake = 200
        const swapAmount = 10000
        const amount0Out = 4000

        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await timeTravel(LOCK_TIME)
        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await token1.transfer(uniV2Pair.address, swapAmount)
        await uniV2Pair.swap(amount0Out, 0, appManager, '0x')

        await timeTravel(LOCK_TIME)

        for (let i = 0; i < 2; i++) {
          const expectedUnstakedAmount = await getAdjustedAmount(
            uniV2Pair,
            amountToStake
          )
          const receipt = await unstake(steroids, amountToStake, appManager)
          const uniV2Amount = parseInt(
            getEventArgument(receipt, 'Unstaked', 'uniV2Amount')
          )
          const wrappedTokenAmount = getEventArgument(
            receipt,
            'Unstaked',
            'wrappedTokenAmount'
          )
          assert.strictEqual(parseInt(uniV2Amount), amountToStake)
          assert.strictEqual(
            parseInt(wrappedTokenAmount),
            expectedUnstakedAmount
          )
        }

        const balance = parseInt(await miniMeToken.balanceOf(appManager))
        // 0 since there is no remainder taken from other locks
        assert.strictEqual(balance, 0)
      })

      it('Should be able to unstake with different lock times', async () => {
        const amountToStake = 200
        const swapAmount = 10000
        const amount0Out = 4000

        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await timeTravel(LOCK_TIME * 2)
        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await token1.transfer(uniV2Pair.address, swapAmount)
        await uniV2Pair.swap(amount0Out, 0, appManager, '0x')

        for (let i = 0; i < 2; i++) {
          await timeTravel(LOCK_TIME * 5)
          const expectedUnstakedAmount = await getAdjustedAmount(
            uniV2Pair,
            amountToStake
          )
          const receipt = await unstake(steroids, amountToStake, appManager)
          const uniV2Amount = parseInt(
            getEventArgument(receipt, 'Unstaked', 'uniV2Amount')
          )
          const wrappedTokenAmount = getEventArgument(
            receipt,
            'Unstaked',
            'wrappedTokenAmount'
          )
          assert.strictEqual(parseInt(uniV2Amount), amountToStake)
          assert.strictEqual(
            parseInt(wrappedTokenAmount),
            expectedUnstakedAmount
          )
        }

        const balance = parseInt(await miniMeToken.balanceOf(appManager))
        // 0 since there is no remainder taken from other locks
        assert.strictEqual(balance, 0)
      })

      it('Should be able to stake for a non sender address and unstake without adjusting', async () => {
        const amountToStake = 200
        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          ACCOUNTS_1,
          appManager
        )

        await timeTravel(LOCK_TIME)

        const expectedUnstakedAmount = await getAdjustedAmount(
          uniV2Pair,
          amountToStake
        )
        const receipt = await unstake(steroids, amountToStake, ACCOUNTS_1)
        const uniV2Amount = parseInt(
          getEventArgument(receipt, 'Unstaked', 'uniV2Amount')
        )
        const wrappedTokenAmount = getEventArgument(
          receipt,
          'Unstaked',
          'wrappedTokenAmount'
        )
        assert.strictEqual(parseInt(uniV2Amount), amountToStake)
        assert.strictEqual(parseInt(wrappedTokenAmount), expectedUnstakedAmount)

        const balance = parseInt(await miniMeToken.balanceOf(ACCOUNTS_1))
        // 0 since there is no remainder taken from other locks
        assert.strictEqual(balance, 0)
      })

      it('Should not be able to stake for a non sender address and unstake to msg.sender', async () => {
        const amountToStake = 100
        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          ACCOUNTS_1,
          appManager
        )

        const unstakableAmount = await getAdjustedAmount(
          uniV2Pair,
          amountToStake
        )

        await assertRevert(
          unstake(steroids, unstakableAmount, appManager),
          'STEROIDS_NOT_ENOUGH_UNWRAPPABLE_TOKENS'
        )
      })

      it('Should be able to insert in an empty slot', async () => {
        const expectedLock = undefined
        const amountToStake = 10
        for (let i = 0; i < MAX_LOCKS; i++) {
          await stake(
            uniV2Pair,
            steroids,
            amountToStake,
            LOCK_TIME,
            appManager,
            appManager
          )
        }

        await timeTravel(LOCK_TIME)

        for (let i = 0; i < MAX_LOCKS; i++) {
          await unstake(steroids, amountToStake, appManager)
        }

        for (let i = 0; i < MAX_LOCKS; i++) {
          await stake(
            uniV2Pair,
            steroids,
            amountToStake,
            LOCK_TIME,
            appManager,
            appManager
          )
        }

        await timeTravel(LOCK_TIME)

        for (let i = 0; i < MAX_LOCKS; i++) {
          await unstake(steroids, amountToStake, appManager)
        }

        const locks = await steroids.getStakedLocks(appManager)
        const lock = locks.find(
          ({ lockDate, lockTime, amount }) =>
            lockDate === '0' && lockTime === '0' && amount === '0'
        )

        assert.strictEqual(lock, expectedLock)

        const balance = parseInt(await miniMeToken.balanceOf(appManager))
        assert.strictEqual(balance, 0)
      })

      it('Should be able to stake MAX_LOCKS times, unstake until staked locks array is empty and staking other MAX_LOCKS times', async () => {
        const amountToStake = 100
        const expectedLock = undefined

        for (let i = 0; i < MAX_LOCKS; i++) {
          await stake(
            uniV2Pair,
            steroids,
            amountToStake,
            LOCK_TIME,
            appManager,
            appManager
          )
        }

        const balanceAfterStaking = parseInt(
          await miniMeToken.balanceOf(appManager)
        )

        await timeTravel(LOCK_TIME)
        await unstake(steroids, amountToStake * MAX_LOCKS, appManager)

        locks = await steroids.getStakedLocks(appManager)
        let filtered = locks.filter(
          ({ lockDate, duration, uniV2PairAmount, wrappedTokenAmount }) =>
            lockDate === '0' &&
            duration === '0' &&
            uniV2PairAmount === '0' &&
            wrappedTokenAmount === '0'
        )

        assert.strictEqual(locks.length, filtered.length)
        assert.strictEqual(parseInt(await miniMeToken.balanceOf(appManager)), 0)

        for (let i = 0; i < MAX_LOCKS; i++) {
          await stake(
            uniV2Pair,
            steroids,
            amountToStake,
            LOCK_TIME,
            appManager,
            appManager
          )
        }

        locks = await steroids.getStakedLocks(appManager)
        const lock = locks.find(
          ({ lockDate, duration, uniV2PairAmount, wrappedTokenAmount }) =>
            lockDate === '0' &&
            duration === '0' &&
            uniV2PairAmount === '0' &&
            wrappedTokenAmount === '0'
        )
        assert.strictEqual(lock, expectedLock)

        const currentBalance = parseInt(await miniMeToken.balanceOf(appManager))
        assert.strictEqual(currentBalance, balanceAfterStaking)
      })

      it('Should be able to stake MAX_LOCKS times and unstake in two times', async () => {
        const amountToStake = 200
        for (let i = 0; i < MAX_LOCKS; i++) {
          await stake(
            uniV2Pair,
            steroids,
            amountToStake,
            LOCK_TIME,
            appManager,
            appManager
          )
        }

        await timeTravel(LOCK_TIME)
        await unstake(steroids, (amountToStake * MAX_LOCKS) / 2, appManager)
        await unstake(steroids, (amountToStake * MAX_LOCKS) / 2, appManager)

        locks = await steroids.getStakedLocks(appManager)
        const emptyLocks = locks.filter(
          ({ lockDate, duration, uniV2PairAmount, wrappedTokenAmount }) =>
            lockDate === '0' &&
            duration === '0' &&
            uniV2PairAmount === '0' &&
            wrappedTokenAmount === '0'
        )
        assert.strictEqual(emptyLocks.length, locks.length)
        assert.strictEqual(parseInt(await miniMeToken.balanceOf(appManager)), 0)

        const balance = parseInt(await miniMeToken.balanceOf(appManager))
        // 0 since there is no remainder taken from other locks
        assert.strictEqual(balance, 0)
      })

      it('Should be able to unstake from differents locks (1)', async () => {
        const amountToStake = 200
        const partialUnstake = 10
        const initialBalance = parseInt(await miniMeToken.balanceOf(appManager))

        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await stake(
          uniV2Pair,
          steroids,
          partialUnstake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await addLiquidity(
          token0,
          token1,
          10000000,
          10000000,
          uniV2Pair,
          appManager
        )

        await timeTravel(LOCK_TIME)

        for (let i = 0; i < 2; i++) {
          const expectedUnstakedAmount = await getAdjustedAmount(
            uniV2Pair,
            partialUnstake
          )
          const receipt = await unstake(steroids, partialUnstake, appManager)
          const uniV2Amount = parseInt(
            getEventArgument(receipt, 'Unstaked', 'uniV2Amount')
          )
          const wrappedTokenAmount = parseInt(
            getEventArgument(receipt, 'Unstaked', 'wrappedTokenAmount')
          )
          assert.strictEqual(uniV2Amount, partialUnstake)
          assert.strictEqual(
            hasBeenUnstakedWithRounding(
              wrappedTokenAmount,
              expectedUnstakedAmount
            ),
            true
          )
        }

        // there is a remainder of 1 but we are interested on that the current
        // balance is greater or equal than initial one since it means that no
        // tokens generated from other apps have been burned
        assert.strictEqual(
          parseInt(await miniMeToken.balanceOf(appManager)) >= initialBalance,
          true
        )
      })

      it('Should be able to unstake from differents locks (2)', async () => {
        const amountToStake = 200
        const partialStake = 10
        const partialUnstake = 50
        const finalUnstake = 160 // (200 + 10) - 50
        const initialBalance = parseInt(await miniMeToken.balanceOf(appManager))

        await stake(
          uniV2Pair,
          steroids,
          partialStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await addLiquidity(
          token0,
          token1,
          10000000,
          10000000,
          uniV2Pair,
          appManager
        )

        await timeTravel(LOCK_TIME)

        let expectedUnstakedAmount = await getAdjustedAmount(
          uniV2Pair,
          partialUnstake
        )
        let receipt = await unstake(steroids, partialUnstake, appManager)
        let uniV2Amount = parseInt(
          getEventArgument(receipt, 'Unstaked', 'uniV2Amount')
        )
        let wrappedTokenAmount = parseInt(
          getEventArgument(receipt, 'Unstaked', 'wrappedTokenAmount')
        )
        assert.strictEqual(uniV2Amount, partialUnstake)
        assert.strictEqual(
          hasBeenUnstakedWithRounding(
            wrappedTokenAmount,
            expectedUnstakedAmount
          ),
          true
        )

        expectedUnstakedAmount = await getAdjustedAmount(
          uniV2Pair,
          finalUnstake
        )
        receipt = await unstake(steroids, finalUnstake, appManager)
        uniV2Amount = parseInt(
          getEventArgument(receipt, 'Unstaked', 'uniV2Amount')
        )
        wrappedTokenAmount = parseInt(
          getEventArgument(receipt, 'Unstaked', 'wrappedTokenAmount')
        )
        assert.strictEqual(uniV2Amount, finalUnstake)
        assert.strictEqual(
          hasBeenUnstakedWithRounding(
            wrappedTokenAmount,
            expectedUnstakedAmount
          ),
          true
        )

        // there is a remainder of 1 but we are interested on that the current
        // balance is greater or equal than initial one since it means that no
        // tokens generated from other apps have been burned
        assert.strictEqual(
          parseInt(await miniMeToken.balanceOf(appManager)) >= initialBalance,
          true
        )
      })

      it('Should be able to unstake from differents locks (3)', async () => {
        const amountToStake = 50
        const partialStake = 10
        const partialUnstake = 115
        const finalUnstake = 5 // (50 + 50 + 10 + 10) - 115
        const initialBalance = parseInt(await miniMeToken.balanceOf(appManager))

        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await stake(
          uniV2Pair,
          steroids,
          partialStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await stake(
          uniV2Pair,
          steroids,
          partialStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await addLiquidity(
          token0,
          token1,
          '100000000000',
          '100000000000',
          uniV2Pair,
          appManager
        )

        await timeTravel(LOCK_TIME)

        let expectedUnstakedAmount = await getAdjustedAmount(
          uniV2Pair,
          partialUnstake
        )

        let receipt = await unstake(steroids, partialUnstake, appManager)

        await setPermission(
          acl,
          appManager,
          steroids.address,
          ADJUST_BALANCE_ROLE,
          appManager
        )
        await steroids.adjustBalanceOf(appManager)

        let uniV2Amount = parseInt(
          getEventArgument(receipt, 'Unstaked', 'uniV2Amount')
        )
        let wrappedTokenAmount = parseInt(
          getEventArgument(receipt, 'Unstaked', 'wrappedTokenAmount')
        )
        assert.strictEqual(uniV2Amount, partialUnstake)
        assert.strictEqual(
          hasBeenUnstakedWithRounding(
            wrappedTokenAmount,
            expectedUnstakedAmount
          ),
          true
        )

        expectedUnstakedAmount = await getAdjustedAmount(
          uniV2Pair,
          finalUnstake
        )
        receipt = await unstake(steroids, finalUnstake, appManager)
        uniV2Amount = parseInt(
          getEventArgument(receipt, 'Unstaked', 'uniV2Amount')
        )
        wrappedTokenAmount = parseInt(
          getEventArgument(receipt, 'Unstaked', 'wrappedTokenAmount')
        )
        assert.strictEqual(uniV2Amount, finalUnstake)
        assert.strictEqual(
          hasBeenUnstakedWithRounding(
            wrappedTokenAmount,
            expectedUnstakedAmount
          ),
          true
        )

        assert.strictEqual(
          parseInt(await miniMeToken.balanceOf(appManager)),
          initialBalance
        )
      })

      it('Should be able to unstake from differents locks (4)', async () => {
        const amountToStake = 50
        const partialStake = 10
        const finalUnstake = 120 // (50 + 50 + 10 + 10)
        const initialBalance = parseInt(await miniMeToken.balanceOf(appManager))

        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await stake(
          uniV2Pair,
          steroids,
          partialStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await stake(
          uniV2Pair,
          steroids,
          partialStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await timeTravel(LOCK_TIME)

        await addLiquidity(
          token0,
          token1,
          10000000,
          10000000,
          uniV2Pair,
          appManager
        )

        const expectedUnstakedAmount = await getAdjustedAmount(
          uniV2Pair,
          finalUnstake
        )
        const receipt = await unstake(steroids, finalUnstake, appManager)
        const uniV2Amount = parseInt(
          getEventArgument(receipt, 'Unstaked', 'uniV2Amount')
        )
        const wrappedTokenAmount = parseInt(
          getEventArgument(receipt, 'Unstaked', 'wrappedTokenAmount')
        )
        assert.strictEqual(uniV2Amount, finalUnstake)
        assert.strictEqual(
          hasBeenUnstakedWithRounding(
            wrappedTokenAmount,
            expectedUnstakedAmount
          ),
          true
        )
        assert.strictEqual(
          parseInt(await miniMeToken.balanceOf(appManager)),
          initialBalance
        )
      })

      it('Should be able to unstake after changing CHANGE_MAX_LOCKS_ROLE until MAX_LOCKS + 1', async () => {
        await setPermission(
          acl,
          appManager,
          steroids.address,
          CHANGE_MAX_LOCKS_ROLE,
          appManager
        )

        await steroids.changeMaxAllowedStakeLocks(MAX_LOCKS - 1, {
          from: appManager,
        })

        for (let i = 0; i < MAX_LOCKS - 1; i++) {
          await stake(
            uniV2Pair,
            steroids,
            10,
            LOCK_TIME,
            appManager,
            appManager
          )
        }

        await assertRevert(
          stake(uniV2Pair, steroids, 10, LOCK_TIME, appManager, appManager),
          'STEROIDS_IMPOSSIBLE_TO_INSERT'
        )
      })

      it('Should not be able to stake zero tokens', async () => {
        await assertRevert(
          stake(uniV2Pair, steroids, 0, LOCK_TIME, appManager, appManager),
          'STEROIDS_AMOUNT_TOO_LOW'
        )
      })
    })
    describe('adjustBalanceOf(address _owner)', async () => {
      beforeEach(async () => {
        await setPermission(
          acl,
          steroids.address,
          wrappedTokenManager.address,
          MINT_ROLE,
          appManager
        )

        await setPermission(
          acl,
          steroids.address,
          vault.address,
          TRANSFER_ROLE,
          appManager
        )

        await setPermission(
          acl,
          appManager,
          steroids.address,
          ADJUST_BALANCE_ROLE,
          appManager
        )

        await addLiquidity(
          token0,
          token1,
          500000,
          1000000,
          uniV2Pair,
          appManager
        )
      })

      it('Should adjust the balance when liquidity increases', async () => {
        const token0Amount = 1000000000
        const token1Amount = 5000000000
        const amountToStake = 50000
        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await addLiquidity(
          token0,
          token1,
          token0Amount,
          token1Amount,
          uniV2Pair,
          appManager
        )

        const receipt = await steroids.adjustBalanceOf(appManager)
        const owner = getEventArgument(receipt, 'StakedLockAdjusted', 'owner')
        const amount = parseInt(
          getEventArgument(receipt, 'StakedLockAdjusted', 'amount')
        )

        const reserves = await uniV2Pair.getReserves()
        const reserve0 = parseInt(reserves[0])
        const totalSupply = parseInt(await uniV2Pair.totalSupply())
        const expectedAdjustedBalance = Math.floor(
          (amountToStake * reserve0) / totalSupply
        )
        const actualBalance = parseInt(await miniMeToken.balanceOf(appManager))

        assert.strictEqual(actualBalance, expectedAdjustedBalance)
        assert.strictEqual(amount, expectedAdjustedBalance)
        assert.strictEqual(owner, appManager)
      })

      it('Should adjust the balance when liquidity decreases', async () => {
        const token0Amount = 1000000000
        const token1Amount = 5000000000
        const amountToStake = 50000
        const liquidityToRemove = 10000
        await stake(
          uniV2Pair,
          steroids,
          amountToStake,
          LOCK_TIME,
          appManager,
          appManager
        )

        await addLiquidity(
          token0,
          token1,
          token0Amount,
          token1Amount,
          uniV2Pair,
          appManager
        )

        await removeLiquidity(uniV2Pair, appManager, liquidityToRemove)
        const receipt = await steroids.adjustBalanceOf(appManager)
        const owner = getEventArgument(receipt, 'StakedLockAdjusted', 'owner')
        const amount = parseInt(
          getEventArgument(receipt, 'StakedLockAdjusted', 'amount')
        )

        const reserves = await uniV2Pair.getReserves()
        const reserve0 = parseInt(reserves[0])
        const totalSupply = parseInt(await uniV2Pair.totalSupply())

        const expectedAdjustedBalance = Math.floor(
          (amountToStake * reserve0) / totalSupply
        )
        const actualBalance = parseInt(await miniMeToken.balanceOf(appManager))

        assert.strictEqual(actualBalance, expectedAdjustedBalance)
        assert.strictEqual(amount, expectedAdjustedBalance)
        assert.strictEqual(owner, appManager)
      })
    })
  })
})
