const ETH_ADDRESS = '0x0000000000000000000000000000000000000000'
const MOCK_TOKEN_BALANCE = '1000000000000000000000000'
const MOCK_TOKEN_DECIMALS = 18
const ONE_DAY = 86400
const MAX_LOCKS = 20

let vault, wrappedTokenManager, miniMeToken, voting, acl, uniV2Pair
let appManager

module.exports = {
  preDao: async ({ log }, { web3, artifacts }) => {
    accounts = await web3.eth.getAccounts()
    appManager = accounts[0]
  },

  postDao: async (
    { dao, _experimentalAppInstaller, log },
    { web3, artifacts }
  ) => {
    const ACL = artifacts.require('@aragon/os/build/contracts/acl/ACL')
    acl = await ACL.at(await dao.acl())
  },

  preInit: async (
    { proxy, _experimentalAppInstaller, log },
    { web3, artifacts }
  ) => {
    const MiniMeToken = artifacts.require('MiniMeToken')
    const MiniMeTokenFactory = artifacts.require('MiniMeTokenFactory')
    const ERC20 = artifacts.require('StandardToken')
    const UniswapV2Pair = artifacts.require('UniswapV2Pair')
    const UniswapV2Factory = artifacts.require('UniswapV2Factory')

    const miniMeTokenFactory = await MiniMeTokenFactory.new()
    miniMeToken = await MiniMeToken.new(
      miniMeTokenFactory.address,
      ETH_ADDRESS,
      0,
      'DaoToken',
      18,
      'DAOT',
      true
    )

    voting = await _experimentalAppInstaller('voting', {
      skipInitialize: true,
    })
    vault = await _experimentalAppInstaller('vault')
    wrappedTokenManager = await _experimentalAppInstaller('token-manager', {
      skipInitialize: true,
    })

    await miniMeToken.changeController(wrappedTokenManager.address)
    await wrappedTokenManager.initialize([miniMeToken.address, false, 0])
    await voting.initialize([
      miniMeToken.address,
      '510000000000000000', // 51%
      '510000000000000000', // 51%
      '604800', // 1 week
    ])

    token0 = await ERC20.new(
      'Token0',
      'TKN0',
      MOCK_TOKEN_DECIMALS,
      MOCK_TOKEN_BALANCE
    )
    token1 = await ERC20.new(
      'Token1',
      'TKN1',
      MOCK_TOKEN_DECIMALS,
      MOCK_TOKEN_BALANCE
    )
    uniswapV2Factory = await UniswapV2Factory.new(appManager)
    const receipt = await uniswapV2Factory.createPair(
      token0.address,
      token1.address
    )
    const { args } = receipt.logs.find(({ event }) => event === 'PairCreated')
    uniV2Pair = await UniswapV2Pair.at(args.pair)

    await token0.transfer(uniV2Pair.address, '1000000000000000000000', {
      from: appManager,
    })
    await token1.transfer(uniV2Pair.address, '500000000000000000000', {
      from: appManager,
    })
    await uniV2Pair.mint(appManager)

    log(`Vault: ${vault.address}`)
    log(`MiniMeToken: ${miniMeToken.address}`)
    log(`TokenManager: ${wrappedTokenManager.address}`)
    log(`uniV2Pair: ${uniV2Pair.address}`)
    log(`${appManager} balance: ${await uniV2Pair.balanceOf(appManager)}`)
  },

  postInit: async ({ proxy, log }, { web3, artifacts }) => {
    // NOTE: anyone can vote
    await voting.createPermission(
      'CREATE_VOTES_ROLE',
      '0xffffffffffffffffffffffffffffffffffffffff'
    )
    await wrappedTokenManager.createPermission('MINT_ROLE', proxy.address)
    await wrappedTokenManager.createPermission('BURN_ROLE', proxy.address)
    await vault.createPermission('TRANSFER_ROLE', proxy.address)
  },

  getInitParams: async ({ log }, { web3, artifacts }) => {
    return [
      wrappedTokenManager.address,
      vault.address,
      uniV2Pair.address,
      180,
      MAX_LOCKS,
    ]
  },

  postUpdate: async ({ proxy, log }, { web3, artifacts }) => {},
}
