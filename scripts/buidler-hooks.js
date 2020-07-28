let acl

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
  ) => {},

  postInit: async ({ proxy, log }, { web3, artifacts }) => {},

  getInitParams: async ({ log }, { web3, artifacts }) => {
    return []
  },

  postUpdate: async ({ proxy, log }, { web3, artifacts }) => {},
}
