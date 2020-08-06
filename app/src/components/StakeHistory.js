import React from 'react'
import {
  Button,
  Table,
  TableHeader,
  TableRow,
  TableCell,
  Text,
  IconUnlock,
  Tag,
} from '@aragon/ui'
import { parseSeconds } from '../utils/time-utils'
import PropTypes from 'prop-types'
import NoTokenStaked from './NoTokenStaked'
import { strip } from '../utils/amount-utils'
import { toWrappedToken } from '../utils/converters'
import { useStakeHistoryDetails } from '../hooks/stake-history'
import { useAppState } from '@aragon/api-react'
import styled from 'styled-components'

const StakeHistory = (_props) => {
  const { onUnwrap, onOpenSidebar } = _props

  const { wrappedToken } = useAppState()

  const { stakedLocks } = useStakeHistoryDetails()

  return stakedLocks && stakedLocks.length > 0 ? (
    <Table
      header={
        <TableRow>
          <TableHeader
            title={`UNDERLAYING ASSETS FOR YOUR ${wrappedToken.symbol}`}
          />
        </TableRow>
      }
    >
      {stakedLocks.map(
        (
          {
            uniV2PairAmount,
            textedUniV2PairAmount,
            textedWrappedTokenAmount,
            remainderSeconds,
            isUnlocked,
          },
          _index
        ) => {
          return (
            <TableRow key={_index}>
              <TableCell>
                <Text>
                  {textedUniV2PairAmount}
                  <ConvertedAmountField>
                    {textedWrappedTokenAmount}
                  </ConvertedAmountField>
                </Text>
              </TableCell>
              <TableCell>
                {isUnlocked ? (
                  <Tag mode="new">Unlocked</Tag>
                ) : (
                  <Tag mode="identifier">Locked</Tag>
                )}
              </TableCell>
              <TableCell>
                {isUnlocked ? (
                  <Button
                    onClick={() =>
                      onUnwrap({
                        action: 'Unstake',
                        amount: uniV2PairAmount,
                      })
                    }
                  >
                    <IconUnlock />
                  </Button>
                ) : (
                  <Text
                    css={`
                      font-weight: bold;
                    `}
                  >
                    {remainderSeconds}
                  </Text>
                )}
              </TableCell>
            </TableRow>
          )
        }
      )}
    </Table>
  ) : (
    <NoTokenStaked onOpenSidebar={onOpenSidebar} />
  )
}

const ConvertedAmountField = styled.span`
  height: 16px;
  margin-left: 4px;
  font-size: 12px;
`

StakeHistory.propTypes = {
  onOpenSidebar: PropTypes.func,
  onUnwrap: PropTypes.func,
}

export default StakeHistory
