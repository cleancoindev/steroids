import { useMemo } from 'react'
import { useAppState } from '@aragon/api-react'
import { strip } from '../utils/amount-utils'
import { offChainFormat } from '../utils/amount-utils'
import { toWrappedToken } from '../utils/converters'
import { parseSeconds } from '../utils/time-utils'

const useStakeHistoryDetails = () => {
  const { stakedLocks, uniV2Pair, wrappedToken } = useAppState()

  const now = new Date().getTime() / 1000

  return useMemo(() => {
    return {
      stakedLocks: stakedLocks.map(
        ({ uniV2PairAmount, lockDate, duration }) => {
          const offchainUniV2PairAmount = offChainFormat(
            uniV2PairAmount,
            uniV2Pair.decimals
          )
          return {
            uniV2PairAmount: offchainUniV2PairAmount,
            textedUniV2PairAmount: `${strip(
              offchainUniV2PairAmount.toString()
            )} ${uniV2Pair.symbol}`,
            textedWrappedTokenAmount: `(${strip(
              toWrappedToken(offchainUniV2PairAmount, uniV2Pair).toString()
            )} ${wrappedToken.symbol})`,
            lockDate,
            duration,
            isUnlocked: lockDate + duration < now,
            remainderSeconds: parseSeconds(lockDate + duration - now),
          }
        }
      ),
    }
  }, [stakedLocks])
}

export { useStakeHistoryDetails }
