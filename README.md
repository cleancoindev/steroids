# :boom: steroids

An Aragon app that allows to lock for a customizable amount of time, a quantity of UniV2 tokens in exchange for organization's tokens.

&nbsp;

***

&nbsp;

## :arrow_down: How to install

```
dao install <DAO address> steroids.open.aragonpm.eth --app-init-args <token manager> <vault> <univ2 token address> <min lock time> <max locks> --env aragon:rinkeby
```

&nbsp;

***

&nbsp;

## :clipboard: How to run locally

```
yarn install
```

```
yarn start
```

&nbsp;

***

&nbsp;

## :guardsman: Test

```
yarn test
```

### Result

```
    initialize(address _tokenManager, address _vault, address _depositToken, _uint256 _minLockTime _uint256 maxLocks) fails
      ✓ Should revert when passed non-contract address as token manager (53ms)
      ✓ Should revert when passed non-contract address as vault
      ✓ Should revert when passed non-contract address as deposit token
    initialize(address _tokenManager, address _vault, address address _depositToken, _uint256 _minLockTime, _uint256 maxLocks)
      ✓ Should set correct variables (39ms)
      ✓ Should set able to set maxLocks and minLockTime and vault (186ms)
      ✓ Should not be able to set maxLocks because of no permission (41ms)
      ✓ Should not be able to set minLockTime because of no permission (46ms)
      ✓ Should not be able to set a new Vault because of no permission (47ms)
      ✓ Should not be able to adjust a balance because of no permission (43ms)
      stake(uint256 _amount, uint256 _lockTime, address _receiver) & unstake(uint256 _amount)
        ✓ Should not be able to stake without token approve
        ✓ Should not be able to perform more stake than allowed (maxLocks) (1365ms)
        ✓ Should not be able to set maxLocks because of of value too high (71ms)
        ✓ Should not be able to stake more than you have approved
        ✓ Should not be able to stake with a lock time less than the minimun one
        ✓ Should get organization tokens in exchange for uniV2 and viceversa (224ms)
        ✓ Should not be able to unstake more than you have (120ms)
        ✓ Should not be able to unstake because it needs to wait the correct time (137ms)
        ✓ Should not be able to unstake because it needs to wait the correct time (164ms)
        ✓ Should be able to unstake with many unstaking txs and adjusting balance (385ms)
        ✓ Should be able to unstake with different lock times (355ms)
        ✓ Should be able to stake for a non sender address and unstake without adjusting (178ms)
        ✓ Should not be able to stake for a non sender address and unstake to msg.sender (95ms)
        ✓ Should be able to insert in an empty slot (6542ms)
        ✓ Should be able to stake MAX_LOCKS times, unstake until staked locks array is empty and staking other MAX_LOCKS times (2801ms)
        ✓ Should be able to stake MAX_LOCKS times and unstake in two times (1418ms)
        ✓ Should be able to unstake from differents locks (1) (350ms)
        ✓ Should be able to unstake from differents locks (2) (356ms)
        ✓ Should be able to unstake from differents locks (3) (538ms)
        ✓ Should be able to unstake from differents locks (4) (479ms)
        ✓ Should be able to unstake after changing CHANGE_MAX_LOCKS_ROLE until MAX_LOCKS + 1 (1254ms)
        ✓ Should not be able to stake zero tokens
      adjustBalanceOf(address _owner)
        ✓ Should adjust the balance when liquidity increases (142ms)
        ✓ Should adjust the balance when liquidity decreases (174ms)


  33 passing (41s)
```

&nbsp;

***

&nbsp;

## :rocket: How to publish

Create an __`.env`__ file with the following format

```
RINKEBY_PRIVATE_KEY=
MAINNET_PRIVATE_KEY=
INFURA_KEY=
```

Run the local IPFS node:

```
aragon ipfs start
```

and then publish.

```
npx buidler publish "version or patch/minor/major" --network "rinkeby or mainnet"
```

&nbsp;

***

&nbsp;

## :white_check_mark: How to verify

Add the following field to __`.env`__ file

```
ETHERSCAN_API_KEY=
```

and then verify.

```
npx buidler verify-contract --contract-name Steroids --address 'deployed contract address' "constructor arguments"
```