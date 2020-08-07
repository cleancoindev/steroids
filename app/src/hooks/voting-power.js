import { useMemo } from 'react'
import { useAppState } from '@aragon/api-react'
import { strip } from '../utils/amount-utils'
import { parsePercentage, offChainFormat } from '../utils/amount-utils'
import { calculateStakedAmount } from '../utils/locks-utils'

const useVotingPowerDetails = () => {
  const {
    vaultBalance,
    uniV2PairBalance,
    account,
    uniV2Pair,
    stakedLocks,
    wrappedTokenBalance,
  } = useAppState()

  return useMemo(() => {
    const minimedVaultBalance = vaultBalance
      .dividedBy(uniV2Pair.totalSupply)
      .multipliedBy(uniV2Pair.reserve0)

    const stakedAmount = calculateStakedAmount(stakedLocks, uniV2Pair)

    return [
      {
        uniV2PairBalance:
          uniV2PairBalance && account ? strip(stakedAmount, 6) : '-',
        vaultBalance: minimedVaultBalance
          ? strip(
              offChainFormat(
                minimedVaultBalance,
                uniV2Pair.decimals
              ).toString(),
              6
            )
          : '-',
      },
    ]
  }, [uniV2PairBalance, vaultBalance])
}

export { useVotingPowerDetails }
