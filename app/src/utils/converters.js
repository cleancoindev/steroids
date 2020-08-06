const toWrappedToken = (_amount, _univ2Pair) =>
  _amount
    .multipliedBy(_univ2Pair.reserve0)
    .dividedBy(_univ2Pair.totalSupply)
    .toFixed()

export { toWrappedToken }
