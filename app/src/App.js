import React, { Fragment, useState } from 'react'
import { useAppLogic } from './hooks'
import { Button, Header, Main, SidePanel, SyncIndicator } from '@aragon/ui'
import { Row, Col } from 'react-bootstrap'
import { onChainFormat } from './utils/amount-utils'
import { useGuiStyle } from '@aragon/api-react'
import VotingPower from './components/VotingPower'
import Staker from './components/Staker'
import StakeHistory from './components/StakeHistory'
import Wallet from './components/Wallet'
import Info from './components/Info'
import { useAppState } from '@aragon/api-react'
import BigNumber from 'bignumber.js'

const App = () => {
  const { actions, panelState } = useAppLogic()
  const {
    account,
    minLockTime,
    isSyncing,
    uniV2Pair,
    wrappedToken,
    uniV2PairBalance,
    wrappedTokenBalance,
    stakedLocks,
  } = useAppState()
  const { appearance } = useGuiStyle()

  const [action, setAction] = useState(null)
  const [defaultAmount, setDefaultAmount] = useState(null)

  const handleAction = ({ amount, action, duration, receiver }) => {
    setDefaultAmount(null)

    if (action === 'Stake') {
      const onChainAmount = onChainFormat(
        new BigNumber(amount),
        uniV2Pair.decimals
      )

      actions.stake(onChainAmount.toFixed(), duration, receiver, {
        token: {
          address: uniV2Pair.address,
          value: onChainAmount.toFixed(),
        },
      })
    } else if (action === 'Unstake') {
      actions.unstake(
        onChainFormat(new BigNumber(amount), wrappedToken.decimals).toFixed()
      )
    }
  }

  return (
    <Main theme={appearance}>
      {isSyncing ? (
        <SyncIndicator />
      ) : (
        <Fragment>
          <Header
            primary="Steroids"
            secondary={
              <React.Fragment>
                <Button
                  mode="normal"
                  label={'Unstake'}
                  onClick={(_e) => {
                    panelState.requestOpen(_e)
                    setAction('Unstake')
                  }}
                />
                <Button
                  style={{ marginLeft: '10px' }}
                  mode="strong"
                  label={'Stake'}
                  onClick={(_e) => {
                    panelState.requestOpen(_e)
                    setAction('Stake')
                  }}
                />
              </React.Fragment>
            }
          />
          <SidePanel
            title={`${action} your tokens`}
            opened={panelState.visible}
            onClose={(_e) => {
              setAction(null)
              setDefaultAmount(null)
              panelState.requestClose(_e)
            }}
            onTransitionEnd={panelState.endTransition}
          >
            <Staker
              action={action}
              account={account}
              defaultAmount={defaultAmount}
              minLockTime={minLockTime}
              uniV2PairBalance={uniV2PairBalance}
              wrappedTokenBalance={wrappedTokenBalance}
              wrappedToken={wrappedToken}
              stakedLocks={stakedLocks}
              uniV2Pair={uniV2Pair}
              onAction={handleAction}
            />
          </SidePanel>

          <Row>
            <Col xs={12} xl={6}>
              <VotingPower />
            </Col>
            <Col xs={12} xl={6} className="mt-3 mt-xl-0">
              <Wallet />
            </Col>
            <Col xs={12} xl={12} className="mt-3">
              <Info />
            </Col>
          </Row>
          <Row>
            <Col xs={12} className="mt-3">
              <StakeHistory
                onUnwrap={({ amount }) => {
                  setDefaultAmount(amount)
                  panelState.requestOpen()
                  setAction('Unstake')
                }}
                onOpenSidebar={() => {
                  panelState.requestOpen()
                  setAction('Stake')
                }}
              />
            </Col>
          </Row>
        </Fragment>
      )}
    </Main>
  )
}

export default App
