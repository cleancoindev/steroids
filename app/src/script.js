import 'core-js/stable'
import 'regenerator-runtime/runtime'
import Aragon, { events } from '@aragon/api'
import UniV2PairAbi from './abi/UniV2Pair.json'
import Erc20Abi from './abi/ERC20.json'
import TokenManagerAbi from './abi/TokenManager.json'
import { first } from 'rxjs/operators'

const app = new Aragon()
app
  .call('wrappedTokenManager')
  .subscribe(initialize, (err) =>
    console.error(`Could not start background script execution due to: ${err}`)
  )

async function initialize(_wrappedTokenManagerAddress) {
  const network = await app.network().pipe(first()).toPromise()
  const wrappedTokenManagerContract = app.external(
    _wrappedTokenManagerAddress,
    TokenManagerAbi
  )

  const settings = {
    network,
  }
  return createStore(wrappedTokenManagerContract, settings)
}

function createStore(_tokenManagerContract, _settings) {
  return app.store(
    async (state, { event, returnValues }) => {
      const nextState = {
        ...state,
      }

      try {
        switch (event) {
          case events.ACCOUNTS_TRIGGER:
            return handleAccountChange(nextState, returnValues)
          case events.SYNC_STATUS_SYNCING:
            return { ...nextState, isSyncing: true }
          case events.SYNC_STATUS_SYNCED:
            return { ...nextState, isSyncing: false }
          case 'Staked':
            return handleEvent(nextState)
          case 'Unstaked':
            return handleEvent(nextState, returnValues)
          default:
            return state
        }
      } catch (_err) {
        console.error(`Failed to create store: ${_err.message}`)
      }
    },
    {
      init: initializeState(_tokenManagerContract, _settings),
    }
  )
}

function initializeState(_tokenManagerContract, _settings) {
  return async (_cachedState) => {
    try {
      const miniMeTokenAddress = await _tokenManagerContract.token().toPromise()
      const wrappedToken = await getTokenData(miniMeTokenAddress)

      const uniV2PairAddress = await app.call('uniV2Pair').toPromise()
      const uniV2Pair = await getUniV2PairData(uniV2PairAddress)

      const vaultAddress = await app.call('vault').toPromise()
      const vaultBalance = await getTokenBalance(
        uniV2PairAddress,
        uniV2Pair.decimals,
        vaultAddress
      )

      return {
        ..._cachedState,
        wrappedToken,
        uniV2Pair,
        minLockTime: await app.call('minLockTime').toPromise(),
        vaultBalance,
        vaultAddress,
        settings: _settings,
      }
    } catch (_err) {
      console.error(`Failed to initialize state: ${_err.message}`)
      return _cachedState
    }
  }
}

const handleEvent = async (_nextState) => {
  try {
    if (_nextState.account) {
      const { wrappedTokenBalance, uniV2PairBalance } = await getTokenBalances(
        _nextState.wrappedToken.address,
        _nextState.wrappedToken.decimals,
        _nextState.uniV2Pair.address,
        _nextState.uniV2Pair.decimals,
        _nextState.account
      )

      return {
        ..._nextState,
        wrappedTokenBalance,
        uniV2PairBalance,
        stakedLocks: await getStakedLocks(_nextState.account),
        vaultBalance: await getTokenBalance(
          _nextState.uniV2Pair.address,
          _nextState.uniV2Pair.decimals,
          _nextState.vaultAddress
        ),
      }
    }

    return _nextState
  } catch (_err) {
    console.error(`Failed to handle event: ${_err.message}`)
    return _nextState
  }
}

const handleAccountChange = async (_nextState, { account }) => {
  try {
    if (account) {
      const { wrappedTokenBalance, uniV2PairBalance } = await getTokenBalances(
        _nextState.wrappedToken.address,
        _nextState.wrappedToken.decimals,
        _nextState.uniV2Pair.address,
        _nextState.uniV2Pair.decimals,
        account
      )

      return {
        ..._nextState,
        wrappedTokenBalance,
        uniV2PairBalance,
        account,
        stakedLocks: await getStakedLocks(account),
      }
    }

    return _nextState
  } catch (_err) {
    console.error(`Failed to handle account change: ${_err.message}`)
    return _nextState
  }
}

const getStakedLocks = (_tokenAddress) => {
  try {
    return app.call('getStakedLocks', _tokenAddress).toPromise()
  } catch (_err) {
    console.error(`Failed to load staked locks: ${_err.message}`)
    return []
  }
}

const getUniV2PairData = async (_uniV2PairAddress) => {
  try {
    const pair = app.external(_uniV2PairAddress, UniV2PairAbi)
    const totalSupply = await pair.totalSupply().toPromise()
    const reserve0 = (await pair.getReserves().toPromise())[0]
    const reserve1 = (await pair.getReserves().toPromise())[1]

    const token0Address = await pair.token0().toPromise()
    const token1Address = await pair.token1().toPromise()

    const uniV2Pair = await getTokenData(_uniV2PairAddress)
    const token0 = await getTokenData(token0Address)
    const token1 = await getTokenData(token1Address)

    return {
      ...uniV2Pair,
      totalSupply,
      reserve0,
      reserve1,
      token0,
      token1,
    }
  } catch (_err) {
    console.error(`Failed to load uniV2Pair data: ${_err.message}`)
    throw new Error(_err.message)
  }
}

const getTokenData = async (_tokenAddress) => {
  try {
    const token = app.external(_tokenAddress, Erc20Abi)
    const decimals = await token.decimals().toPromise()
    const name = await token.name().toPromise()
    const symbol = await token.symbol().toPromise()

    return {
      decimals,
      name,
      symbol,
      address: _tokenAddress,
    }
  } catch (err) {
    console.error(`Failed to load token data: ${_err.message}`)
    throw new Error(_err.message)
  }
}

const getTokenBalances = async (
  _miniMeTokenAddress,
  _miniMeTokenDecimals,
  _depositTokenAddress,
  _depositTokenDecimals,
  _account
) => {
  try {
    const wrappedTokenBalance = await getTokenBalance(
      _miniMeTokenAddress,
      _miniMeTokenDecimals,
      _account
    )
    const uniV2PairBalance = await getTokenBalance(
      _depositTokenAddress,
      _depositTokenDecimals,
      _account
    )

    return {
      wrappedTokenBalance,
      uniV2PairBalance,
    }
  } catch (_err) {
    console.error(`Failed to load token balances: ${_err.message}`)
    throw new Error(_err.message)
  }
}

const getTokenBalance = (_tokenAddress, _tokenDecimals, _address) => {
  try {
    const token = app.external(_tokenAddress, Erc20Abi)
    return token.balanceOf(_address).toPromise()
  } catch (_err) {
    console.error(`Failed to load token balance: ${_err.message}`)
    throw new Error(_err.message)
  }
}
