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
      ✓ Should revert when passed non-contract address as token manager (51ms)
      ✓ Should revert when passed non-contract address as vault
      ✓ Should revert when passed non-contract address as deposit token
    initialize(address _tokenManager, address _vault, address address _depositToken, _uint256 _minLockTime, _uint256 maxLocks)
      ✓ Should set correct variables
      ✓ Should set able to set maxLocks and minLockTime and vault (172ms)
      ✓ Should not be able to set maxLocks because of no permission (64ms)
      ✓ Should not be able to set minLockTime because of no permission (43ms)
      ✓ Should not be able to set a new Vault because of no permission (41ms)
      stake(uint256 _amount, uint256 _lockTime, address _receiver)
        ✓ Should not be able to stake without token approve
        ✓ Should not be able to perform more stake than allowed (maxLocks) (1344ms)
        ✓ Should not be able to set maxLocks because of of value too high (62ms)
        ✓ Should not be able to stake more than you have approved
        ✓ Should not be able to stake with a lock time less than the minimun one
      unstake(uint256 _amount)
        ✓ Should get organization tokens in exchange for uniV2 and viceversa (270ms)
        ✓ Should not be able to unstake more than you have (100ms)
        ✓ Should not be able to unstake because it needs to wait the correct time (84ms)
        ✓ Should not be able to unstake because it needs to wait the correct time (150ms)
        ✓ Should be able to unstake with many unstaking txs and adjusting balance (432ms)
        ✓ Should be able to unstake with different lock times (437ms)
        ✓ Should be able to stake for a non sender address and unstake without adjusting (153ms)
        ✓ Should not be able to stake for a non sender address and unstake to msg.sender (90ms)
        ✓ Should be able to insert in an empty slot (5733ms)
        ✓ Should be able to stake MAX_LOCKS times, unstake until staked locks array is empty and staking other MAX_LOCKS times (5099ms)
        ✓ Should be able to stake MAX_LOCKS times and unstake in two times (1507ms)
        ✓ Should be able to unwrap after changing CHANGE_MAX_LOCKS_ROLE until MAX_LOCKS + 1 (1293ms)


  25 passing (34s)
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