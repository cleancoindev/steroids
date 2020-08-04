const stake = async (
  _depositToken,
  _lockableTokenWrapper,
  _amountToWrap,
  _lockTime,
  _receiver,
  _appManager
) => {
  await _depositToken.approve(_lockableTokenWrapper.address, _amountToWrap, {
    from: _appManager,
  })

  return _lockableTokenWrapper.stake(_amountToWrap, _lockTime, _receiver, {
    from: _appManager,
  })
}

const unstake = (_lockableTokenWrapper, _amountToWrap, _appManager) =>
  _lockableTokenWrapper.unstake(_amountToWrap, {
    from: _appManager,
  })

const getBalances = async (_depositToken, _vault, _receiver) => {
  const balanceReceiver = parseInt(await _depositToken.balanceOf(_receiver))

  const balanceVault = parseInt(await _vault.balance(_depositToken.address))

  return {
    balanceReceiver,
    balanceVault,
  }
}

const addLiquidity = async (
  _token0,
  _token1,
  _token0Amount,
  _token1Amount,
  _pair,
  _appManager
) => {
  await _token0.transfer(_pair.address, _token0Amount, {
    from: _appManager,
  })
  await _token1.transfer(_pair.address, _token1Amount, {
    from: _appManager,
  })
  await _pair.mint(_appManager)
}

const removeLiquidity = async (_pair, _appManager, _liquidity) => {
  await _pair.transfer(_pair.address, _liquidity)
  await _pair.burn(_appManager)
}

const getAdjustedAmount = async (_pair, _amount) => {
  const reserves = await _pair.getReserves()
  const reserve0 = parseInt(reserves[0])
  const totalSupply = parseInt(await _pair.totalSupply())
  return Math.floor((_amount * reserve0) / totalSupply)
}

// NOTE: call steroids.adjusteBalanceOf() before getting staked locks to process
// and is supposed that all staked locks are unlocked. Basically this function
// calculates the total amount of unstakable tokens
const calculateMaxUnstakableAmount = async (_stakedLocks, _pair) => {
  const reserves = await _pair.getReserves()
  const reserve0 = parseInt(reserves[0])
  const totalSupply = parseInt(await _pair.totalSupply())

  let unstakableAmount = 0
  for (let i = 0; i < _stakedLocks.length; i++) {
    if (!_isStakedLockEmpty(_stakedLocks[i])) {
      const adjustedWrappedTokenLockAmount = Math.floor(
        (parseInt(_stakedLocks[i].uniV2PairAmount) * reserve0) / totalSupply
      )
      unstakableAmount += adjustedWrappedTokenLockAmount
    }
  }

  return unstakableAmount
}

const _isStakedLockEmpty = ({
  lockDate,
  duration,
  uniV2PairAmount,
  wrappedTokenAmount,
}) =>
  lockDate === '0' &&
  duration === '0' &&
  uniV2PairAmount === '0' &&
  wrappedTokenAmount === '0'

module.exports = {
  addLiquidity,
  removeLiquidity,
  stake,
  unstake,
  getBalances,
  getAdjustedAmount,
  calculateMaxUnstakableAmount,
}
