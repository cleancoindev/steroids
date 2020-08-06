import { useMemo } from 'react'
import { useAppState } from '@aragon/api-react'
import { strip } from '../utils/amount-utils'
import { parsePercentage, offChainFormat } from '../utils/amount-utils'

const useVotingPowerDetails = () => {
  const {
    vaultBalance,
    wrappedTokenBalance,
    account,
    uniV2Pair,
  } = useAppState()

  return useMemo(() => {
    const minimedVaultBalance = vaultBalance
      .dividedBy(uniV2Pair.totalSupply)
      .multipliedBy(uniV2Pair.reserve0)

    const votingPower =
      vaultBalance && !vaultBalance.isEqualTo(0)
        ? parseFloat(wrappedTokenBalance.dividedBy(minimedVaultBalance))
        : 0

    return [
      {
        votingPower,
        votingPowerText: votingPower ? parsePercentage(votingPower) : '-',
        wrappedTokenBalance:
          wrappedTokenBalance && account
            ? strip(
                offChainFormat(
                  wrappedTokenBalance,
                  uniV2Pair.decimals
                ).toString()
              )
            : '-',
        vaultBalance: minimedVaultBalance
          ? strip(
              offChainFormat(minimedVaultBalance, uniV2Pair.decimals).toString()
            )
          : '-',
      },
    ]
  }, [wrappedTokenBalance, vaultBalance])
}

export { useVotingPowerDetails }
