import { offChainFormat } from './utils/amount-utils'
import BigNumber from 'bignumber.js'

const reducer = (_state) => {
  if (_state === null) {
    return {
      account: null,
      uniV2PairBalance: new BigNumber(0),
      uniV2Pair: null,
      wrappedTokenBalance: new BigNumber(0),
      wrappedToken: null,
      isSyncing: true,
      minLockTime: 0,
      stakedLocks: [],
      settings: null,
      vaultBalance: new BigNumber(0),
      vaultAddress: null,
    }
  }

  const {
    stakedLocks,
    wrappedTokenBalance,
    uniV2Pair,
    uniV2PairBalance,
    vaultBalance,
    minLockTime,
  } = _state

  return {
    ..._state,
    minLockTime: parseInt(minLockTime),
    wrappedTokenBalance: new BigNumber(wrappedTokenBalance),
    uniV2PairBalance: new BigNumber(uniV2PairBalance),
    vaultBalance: new BigNumber(vaultBalance),
    stakedLocks: stakedLocks
      ? stakedLocks
          .map((_stakedLock) => {
            return {
              lockDate: parseInt(_stakedLock.lockDate),
              duration: parseInt(_stakedLock.duration),
              uniV2PairAmount: new BigNumber(_stakedLock.uniV2PairAmount),
              wrappedTokenAmount: new BigNumber(_stakedLock.wrappedTokenAmount),
            }
          })
          .filter(
            ({ wrappedTokenAmount, uniV2PairAmount, lockDate, duration }) =>
              !wrappedTokenAmount.isEqualTo(0) &&
              !uniV2PairAmount.isEqualTo(0) &&
              lockDate !== 0 &&
              duration !== 0
          )
      : [],
    uniV2Pair: {
      ...uniV2Pair,
      totalSupply: new BigNumber(uniV2Pair.totalSupply),
      reserve0: new BigNumber(uniV2Pair.reserve0),
    },
  }
}

export default reducer
