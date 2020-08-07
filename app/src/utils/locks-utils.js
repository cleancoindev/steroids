import BigNumber from 'bignumber.js'
import { onChainFormat, offChainFormat } from './amount-utils'

const getTotalAmountOfUnlockedTokens = (_locks) => {
  if (!_locks || _locks.length === 0) return new BigNumber(0)

  let unlocked = new BigNumber(0)
  _locks.forEach((_lock) => {
    if (isUnlocked(_lock)) {
      unlocked = unlocked.plus(_lock.uniV2PairAmount)
    }
  })

  return unlocked
}

const getTotalAmountOfLockedTokens = (_locks) => {
  if (!_locks || _locks.length === 0) return new BigNumber(0)

  let locked = new BigNumber(0)
  _locks.forEach((_lock) => {
    if (!isUnlocked(_lock)) {
      locked = locked.plus(_lock.uniV2PairAmount)
    }
  })

  return locked
}

const calculateMaxUnstakableAmount = (_stakedLocks, _uniV2Pair) => {
  let unstakableAmount = new BigNumber(0)
  for (let i = 0; i < _stakedLocks.length; i++) {
    if (!_isStakedLockEmpty(_stakedLocks[i]) && isUnlocked(_stakedLocks[i])) {
      unstakableAmount = unstakableAmount.plus(_stakedLocks[i].uniV2PairAmount)
    }
  }

  return offChainFormat(unstakableAmount, _uniV2Pair.decimals).toFixed()
}

const calculateStakedAmount = (_stakedLocks, _uniV2Pair) => {
  let stakedAmount = new BigNumber(0)
  for (let i = 0; i < _stakedLocks.length; i++) {
    stakedAmount = stakedAmount.plus(_stakedLocks[i].uniV2PairAmount)
  }

  return offChainFormat(stakedAmount, _uniV2Pair.decimals).toFixed()
}

const isUnlocked = (_lock) => {
  const now = new Date().getTime() / 1000
  return _lock.lockDate + _lock.duration < now
}

const _isStakedLockEmpty = ({
  lockDate,
  duration,
  uniV2PairAmount,
  wrappedTokenAmount,
}) =>
  lockDate === 0 &&
  duration === 0 &&
  uniV2PairAmount.isEqualTo(0) &&
  wrappedTokenAmount.isEqualTo(0)

export {
  getTotalAmountOfUnlockedTokens,
  getTotalAmountOfLockedTokens,
  calculateMaxUnstakableAmount,
  calculateStakedAmount,
}
