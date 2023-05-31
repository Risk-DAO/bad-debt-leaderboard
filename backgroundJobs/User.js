class User {
  constructor(user, marketsIn, borrowBalance, collateralBalace, error) {
    this.marketsIn = marketsIn;
    this.borrowBalance = borrowBalance;
    this.collateralBalace = collateralBalace;
    this.error = error;
    this.user = user;
  }

  getUserNetValue(web3, prices) {
    //console.log(this.user, this.error, this.marketsIn, this.collateralBalace, this.prices)

    let netValue = web3.utils.toBN('0');
    let sumCollateral = web3.utils.toBN('0');
    let sumbDebt = web3.utils.toBN('0');
    const _1e18 = web3.utils.toBN(web3.utils.toWei('1'));

    for (const market of this.marketsIn) {
      // ignore the account if no price or no collateral/debt values
      // in IB there are assets that no longer appear in the market assets. but are part of asset in (go figure...)
      if (
        this.collateralBalace[market] === undefined ||
        prices[market].toString() === web3.utils.toBN('0').toString() ||
        this.borrowBalance[market] === undefined
      ) {
        console.log('zero price for market', { market });
        return {
          netValue: web3.utils.toBN('0'),
          collateral: web3.utils.toBN('0'),
          debt: web3.utils.toBN('0'),
        };
      }

      const plus = web3.utils.toBN(this.collateralBalace[market]).mul(prices[market]).div(_1e18);
      const minus = web3.utils.toBN(this.borrowBalance[market]).mul(prices[market]).div(_1e18);
      netValue = netValue.add(plus).sub(minus);
      //console.log("asset", market, "plus", plus.toString(), "minus", minus.toString(), this.collateralBalace[market].toString(),
      //this.borrowBalance[market].toString(), prices[market].toString())
      sumCollateral = sumCollateral.add(plus);
      sumbDebt = sumbDebt.add(minus);
    }

    return { netValue: netValue, collateral: sumCollateral, debt: sumbDebt };
  }
}

module.exports = User;
