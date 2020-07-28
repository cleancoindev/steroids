# steroids

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
      ✓ Should revert when passed non-contract address as token manager (58ms)
      ✓ Should revert when passed non-contract address as vault
      ✓ Should revert when passed non-contract address as deposit token
    initialize(address _tokenManager, address _vault, address address _depositToken, _uint256 _minLockTime, _uint256 maxLocks)
      ✓ Should set correct variables
      ✓ Should set able to set maxLocks and minLockTime and vault (195ms)
      ✓ Should not be able to set maxLocks because of no permission (44ms)
      ✓ Should not be able to set minLockTime because of no permission (60ms)
      ✓ Should not be able to set a new Vault because of no permission (49ms)
      ✓ Should not be able to adjust a balance because of no permission (44ms)
      stake(uint256 _amount, uint256 _lockTime, address _receiver) & unstake(uint256 _amount)
        ✓ Should not be able to stake without token approve
        ✓ Should not be able to perform more stake than allowed (maxLocks) (1452ms)
        ✓ Should not be able to set maxLocks because of of value too high (103ms)
        ✓ Should not be able to stake more than you have approved
        ✓ Should not be able to stake with a lock time less than the minimun one
        ✓ Should get organization tokens in exchange for uniV2 and viceversa (213ms)
        ✓ Should not be able to unstake more than you have (100ms)
        ✓ Should not be able to unstake because it needs to wait the correct time (84ms)
        ✓ Should not be able to unstake because it needs to wait the correct time (148ms)
        ✓ Should be able to unstake with many unstaking txs and adjusting balance (425ms)
        ✓ Should be able to unstake with different lock times (446ms)
        ✓ Should be able to stake for a non sender address and unstake without adjusting (190ms)
        ✓ Should not be able to stake for a non sender address and unstake to msg.sender (99ms)
        ✓ Should be able to insert in an empty slot (6615ms)
        ✓ Should be able to stake MAX_LOCKS times, unstake until staked locks array is empty and staking other MAX_LOCKS times (5357ms)
        ✓ Should be able to stake MAX_LOCKS times and unstake in two times (1592ms)
        ✓ Should be able to unwrap after changing CHANGE_MAX_LOCKS_ROLE until MAX_LOCKS + 1 (1309ms)
      adjustBalanceOf(address _owner)
        ✓ Should adjust the balance when liquidity increases (156ms)
        ✓ Should adjust the balance when liquidity decreases (153ms)


  28 passing (41s)
```

&nbsp;

***

&nbsp;

## :rocket: How to publish

Create an __`.env`__ file with the following format

```
PRIVATE_KEY=
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