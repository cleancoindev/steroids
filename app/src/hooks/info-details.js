import { useMemo } from 'react'
import { useAppState } from '@aragon/api-react'
import {
  getTotalAmountOfUnlockedTokens,
  getTotalAmountOfLockedTokens,
} from '../utils/locks-utils'
import { strip, offChainFormat } from '../utils/amount-utils'

const useInfoDetails = () => {
  const { stakedLocks, account, uniV2Pair } = useAppState()

  return useMemo(() => {
    const lockedbn = offChainFormat(
      getTotalAmountOfLockedTokens(stakedLocks),
      uniV2Pair.decimals
    )
    const unlockedbn = offChainFormat(
      getTotalAmountOfUnlockedTokens(stakedLocks),
      uniV2Pair.decimals
    )
    const sumbn = unlockedbn.plus(lockedbn)

    return {
      locked: lockedbn && account ? strip(lockedbn.toString(), 6) : '-',
      unlocked: unlockedbn && account ? strip(unlockedbn.toString(), 6) : '-',
      sum: sumbn && account ? strip(sumbn.toString(), 6) : '-',
      perLocked: !sumbn.isEqualTo(0)
        ? parseFloat(
            parseFloat(lockedbn.dividedBy(sumbn).multipliedBy(100).toString())
              .toFixed(4)
              .toString()
          )
        : 0,
      perUnlocked: !sumbn.isEqualTo(0)
        ? parseFloat(
            parseFloat(unlockedbn.dividedBy(sumbn).multipliedBy(100).toString())
              .toFixed(4)
              .toString()
          )
        : 0,
    }
  }, [stakedLocks])
}

export { useInfoDetails }
