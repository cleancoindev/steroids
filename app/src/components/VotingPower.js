import React from 'react'
import { Box, useTheme, GU } from '@aragon/ui'
import { useAppState } from '@aragon/api-react'
import styled from 'styled-components'
import { useVotingPowerDetails } from '../hooks/voting-power'

const VotingPower = (_props) => {
  const { uniV2Pair } = useAppState()

  const [{ uniV2PairBalance, vaultBalance }] = useVotingPowerDetails()

  const theme = useTheme()

  return (
    <Box
      heading={`DAO STATS`}
      css={`
        height: 100%;
      `}
    >
      <Detail>
        <DetailText>
          Total
          <TokenSymbol
            css={`
              color: ${theme.info};
            `}
          >
            {` ${uniV2Pair.symbol}`}
          </TokenSymbol>{' '}
          staked in the DAO:{' '}
        </DetailText>
        <DetailValue>{vaultBalance}</DetailValue>
      </Detail>
      <Detail>
        <DetailText>
          Your
          <TokenSymbol
            css={`
              color: ${theme.info};
            `}
          >
            {` ${uniV2Pair.symbol}`}
          </TokenSymbol>{' '}
          staked in the DAO:{' '}
        </DetailText>
        <DetailValue>{uniV2PairBalance}</DetailValue>
      </Detail>
    </Box>
  )
}

const TokenSymbol = styled.span`
  font-weight: bold;
`

const DetailText = styled.span`
  float: left;
`

const DetailValue = styled.span`
  float: right;
  font-weight: bold;
`

const Detail = styled.div`
  margin-top: ${GU}px;
  margin-bottom: ${2 * GU}px;
  display: flex;
  justify-content: space-between;
`

export default VotingPower
