import { useMemo } from 'react'
import { useAppState } from '@aragon/api-react'
import { strip, offChainFormat } from '../utils/amount-utils'
import { parseSeconds } from '../utils/time-utils'

const useWalletDetails = () => {
  const {
    wrappedTokenBalance,
    uniV2PairBalance,
    minLockTime,
    account,
    uniV2Pair,
  } = useAppState()

  return useMemo(() => {
    return {
      wrappedTokenBalance:
        wrappedTokenBalance && account
          ? strip(
              offChainFormat(wrappedTokenBalance, uniV2Pair.decimals).toString()
            )
          : '-',
      uniV2PairBalance:
        uniV2PairBalance && account
          ? strip(
              offChainFormat(uniV2PairBalance, uniV2Pair.decimals).toString()
            )
          : '-',
      minLockTime: minLockTime ? parseSeconds(minLockTime) : '-',
    }
  }, [uniV2PairBalance, wrappedTokenBalance, minLockTime])
}

export { useWalletDetails }
