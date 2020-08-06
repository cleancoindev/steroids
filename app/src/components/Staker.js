import React, { Fragment, Component } from 'react'
import styled from 'styled-components'
import {
  Button,
  Field,
  GU,
  Info,
  TextInput,
  DropDown,
  Checkbox,
} from '@aragon/ui'
import PropTypes from 'prop-types'
import Web3 from 'web3'
import BigNumber from 'bignumber.js'
import {
  parseSeconds,
  calculateInitialDate,
  formatSeconds,
  LOCK_FORMAT_OPTIONS,
} from '../utils/time-utils'
import { toWrappedToken } from '../utils/converters'
import { calculateMaxUnstakableAmount } from '../utils/locks-utils'
import { offChainFormat } from '../utils/amount-utils'

const web3 = new Web3()

class Staker extends Component {
  constructor(_props, _context) {
    super(_props, _context)

    const { account, defaultAmount, minLockTime, uniV2Pair } = _props

    const { format, time } = calculateInitialDate(minLockTime)
    this.state = {
      lockFormat: LOCK_FORMAT_OPTIONS.indexOf(format),
      duration: time,
      amount: defaultAmount ? defaultAmount : '',
      convertedAmount: defaultAmount
        ? new BigNumber(
            toWrappedToken(new BigNumber(defaultAmount), uniV2Pair)
          ).toFixed(2)
        : '',
      receiver: account ? account : '',
      error: '',
      advance: false,
    }
  }

  handleAction = () => {
    const {
      action,
      uniV2PairBalance,
      minLockTime,
      onAction,
      stakedLocks,
      uniV2Pair,
      wrappedTokenBalance,
    } = this.props

    this.setState({ error: null })
    if (action === 'Stake') {
      if (
        offChainFormat(uniV2PairBalance, uniV2Pair.decimals).isLessThan(
          new BigNumber(this.state.amount)
        )
      ) {
        this.setState({ error: 'Balance too low' })
        return
      }

      const secondsLockTime =
        this.state.duration * formatSeconds[this.state.lockFormat]

      if (secondsLockTime < minLockTime) {
        this.setState({
          error: `Lock Time too low. Please insert a lock of at least ${parseSeconds(
            minLockTime
          )}.`,
        })
        return
      }

      if (!web3.utils.isAddress(this.state.receiver)) {
        this.setState({ error: 'Invalid Ethereum address.' })
        return
      }

      onAction({
        amount: this.state.amount,
        action,
        receiver: this.state.receiver,
        duration: secondsLockTime,
      })
      return
    } else {
      const maxUnstakableAmount = parseFloat(
        calculateMaxUnstakableAmount(stakedLocks, uniV2Pair)
      )
      if (this.state.amount > maxUnstakableAmount) {
        this.setState({ error: 'Impossible to unstake the selected amount' })
        return
      }

      this.props.onAction({
        amount: this.state.amount,
        action,
      })
    }
  }

  handleAmountChange = (_amount) => {
    const { uniV2Pair } = this.props

    this.setState({
      amount: _amount,
      convertedAmount:
        _amount.length > 0
          ? new BigNumber(
              toWrappedToken(new BigNumber(_amount), uniV2Pair)
            ).toFixed(2)
          : '',
    })
  }

  render() {
    const {
      minLockTime,
      action,
      uniV2Pair,
      uniV2PairBalance,
      wrappedToken,
      stakedLocks,
    } = this.props

    return (
      <Fragment>
        <Info
          title="ACTION"
          css={`
            width: 100%;
            margin-top: ${2 * GU}px;
          `}
        >
          {`This action will ${
            action === 'Stake'
              ? `create organization's tokens and transfer them to the address specified below`
              : `burn organization's tokens and will transfer the corresponding amount (of deposited tokens) to the transaction sender.`
          } `}
          <br />
          {action === 'Stake'
            ? `Keep in mind that you cannot unstake them before ${parseSeconds(
                minLockTime
              )}.`
            : ''}
        </Info>
        <WrapperField>
          <Field
            label={`Enter the amount here (${uniV2Pair.symbol}):`}
            required
            css={`
              margin-top: ${3 * GU}px;
              margin-bottom: 0px;
            `}
          >
            <TextInput
              value={this.state.amount}
              onChange={(_e) => this.handleAmountChange(_e.target.value)}
              wide
              min={0}
              type="number"
              step="any"
              required
            />
          </Field>
          <ConvertedAmountField>
            {this.state.convertedAmount && wrappedToken
              ? `${wrappedToken.symbol}: ~${this.state.convertedAmount}`
              : ''}
          </ConvertedAmountField>
        </WrapperField>
        <Button
          css={`
            width: 40px;
            min-width: 0px;
            margin-top: ${1 * GU}px;
          `}
          size="mini"
          mode="strong"
          label="max"
          onClick={() =>
            this.handleAmountChange(
              action === 'Unstake'
                ? calculateMaxUnstakableAmount(stakedLocks, uniV2Pair)
                : offChainFormat(uniV2PairBalance, uniV2Pair.decimals)
            )
          }
        />
        {action === 'Stake' ? (
          <LabelCheckBox>
            <Checkbox
              checked={this.state.advance}
              onChange={(advance) => this.setState({ advance })}
            />
            Advanced
          </LabelCheckBox>
        ) : null}
        {action === 'Stake' && this.state.advance ? (
          <Fragment>
            <WrapperField>
              <Field
                label="Enter the receiver here:"
                required
                css={`
                  margin-top: ${1 * GU}px;
                `}
              >
                <TextInput
                  value={this.state.receiver}
                  onChange={(e) => this.setState({ receiver: e.target.value })}
                  wide
                  type="test"
                  required
                />
              </Field>
            </WrapperField>
            <WrapperLockTimeSelection>
              <Field
                label="Select a lock time"
                required
                css={`
                  margin-top: ${1 * GU}px;
                  width: 50%;
                `}
              >
                <TextInput
                  value={this.state.duration}
                  onChange={(e) => this.setState({ duration: e.target.value })}
                  min={0}
                  type="number"
                  step="any"
                  required
                />
              </Field>
              <DropDown
                width={'50%'}
                selected={this.state.lockFormat}
                onChange={(lockFormat) => this.setState({ lockFormat })}
                items={LOCK_FORMAT_OPTIONS}
              />
            </WrapperLockTimeSelection>
          </Fragment>
        ) : null}
        <Button
          css={`
            margin-top: ${action === 'Stake' ? 0 : 3 * GU}px;
          `}
          onClick={this.handleAction}
          label={action}
          disabled={
            action === 'Stake'
              ? this.state.amount.length === 0 ||
                this.state.receiver.length === 0 ||
                this.state.duration === 0 ||
                this.state.duration.length === 0
              : this.state.amount.length === 0
          }
        />
        {this.state.error ? (
          <Info
            css={`
              margin-top: ${2 * GU}px;
            `}
            mode="error"
            title="Error"
          >
            {this.state.error}
          </Info>
        ) : null}
      </Fragment>
    )
  }
}

const WrapperField = styled.div`
  label {
    width: 100% !important;
  }
`
const WrapperLockTimeSelection = styled.div`
  display: flex;
  align-items: baseline;
`

const LabelCheckBox = styled.label`
  align-items: center;
  display: flex;
  font-size: 12px;
  margin-top: ${3 * GU}px;
  margin-bottom: ${1 * GU}px;
`

const ConvertedAmountField = styled.span`
  margin-top: 6px;
  align-items: center;
  height: 16px;
  margin-bottom: 4px;
  color: #637381;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  text-transform: uppercase;
`

Staker.propTypes = {
  action: PropTypes.string,
  account: PropTypes.string,
  onAction: PropTypes.func,
  minLockTime: PropTypes.number,
  uniV2Pair: PropTypes.object,
  wrappedToken: PropTypes.object,
  stakedLocks: PropTypes.array,
}

export default Staker
