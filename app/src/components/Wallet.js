import React from 'react'
import { useWalletDetails } from '../hooks/wallet'
import { Box, useTheme, GU } from '@aragon/ui'
import styled from 'styled-components'
import { useAppState } from '@aragon/api-react'

const Wallet = (_props) => {
  const { uniV2Pair, wrappedToken } = useAppState()

  const {
    wrappedTokenBalance,
    uniV2PairBalance,
    minLockTime,
  } = useWalletDetails()

  const theme = useTheme()

  return (
    <Box
      heading={'Your wallet holdings'}
      css={`
        height: 100%;
      `}
    >
      <TokenDetails>
        <TokenSymbol
          css={`
            color: ${theme.info};
          `}
        >
          {` ${uniV2Pair.symbol} `}
        </TokenSymbol>
        <TokenBalance>{uniV2PairBalance}</TokenBalance>
      </TokenDetails>
      <TokenDetails>
        <TokenSymbol
          css={`
            color: ${theme.info};
          `}
        >
          {` ${wrappedToken.symbol} `}
        </TokenSymbol>
        <TokenBalance>{wrappedTokenBalance}</TokenBalance>
      </TokenDetails>

      <LockDetails>
        Stake your
        <TokenSymbol
          css={`
            color: ${theme.info};
          `}
        >
          {` ${uniV2Pair.symbol} `}
        </TokenSymbol>
        and get the corresponding amount of
        <TokenSymbol
          css={`
            color: ${theme.info};
          `}
        >
          {` ${wrappedToken.symbol}`}
        </TokenSymbol>
        {'. '}
        After staking, it will be possible to unstake them only after at least
        <Days
          css={`
            color: ${theme.info};
          `}
        >
          {` ${minLockTime}`}.
        </Days>
      </LockDetails>
    </Box>
  )
}

const TokenSymbol = styled.span`
  font-weight: bold;
`

const TokenDetails = styled.div`
  margin-top: ${GU}px;
  display: flex;
  justify-content: space-between;
`

const TokenBalance = styled.span`
  float: right;
  font-weight: bold;
`

const LockDetails = styled.div`
  margin-right: 5px;
  margin-bottom: 15px;
  margin-top: 75px;
`

const Days = styled.span`
  font-size: 18px;
  font-weight: bold;
`

export default Wallet
