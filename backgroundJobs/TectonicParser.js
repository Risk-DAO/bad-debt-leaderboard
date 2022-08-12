const Web3 = require("web3");
const { toBN, toWei, fromWei } = Web3.utils;
const axios = require("axios");
const Addresses = require("./Addresses.js");
const PriceAddresses = require("./PriceAddresses.js");
const { getEthPrice, getCTokenPriceFromZapper } = require("./priceFetcher");
const Compound = require("./CompoundParser");

const TUSD_ADDRESS = "0x87EFB3ec1576Dec8ED47e58B832bEdCd86eE186e";
const getPrice = async (address, web3) => {
  try {
    const { Contract } = web3.eth;
    const token = new Contract(PriceAddresses.erc20Abi, address);
    const decimal = await token.methods.decimals().call();
    // console.log({decimal})
    const symbol = await token.methods
      .symbol()
      .call()
      .catch((err) => "???");
    // console.log({symbol})
    let apiPrice;

    try {
      // coingecko api doesn't support cronos TUSD, refer TUSD price on ethereum instead
      const coinGeckoApiCall =
        address === TUSD_ADDRESS
          ? `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=0x0000000000085d4780B73119b644AE5ecd22b376&vs_currencies=USD`
          : `https://api.coingecko.com/api/v3/simple/token_price/cronos?contract_addresses=${address}&vs_currencies=USD`;
      console.log({ coinGeckoApiCall });
      const { data } = await axios.get(coinGeckoApiCall);
      // console.log(data)
      apiPrice = Object.values(data)[0].usd || 0;
    } catch (e) {
      console.log("err: failed to fetch price for: " + address);
      console.error(e);
      apiPrice = 0;
    }

    let price;
    if (decimal > 18) {
      const normalizer = decimal - 18;
      price = toBN(toWei(apiPrice.toFixed(18))).div(
        toBN("10").pow(toBN(normalizer))
      );
    } else {
      const normalizer = 18 - decimal;
      price = toBN(toWei(apiPrice.toFixed(18))).mul(
        toBN("10").pow(toBN(normalizer))
      );
    }

    console.log({ apiPrice });

    console.log({
      address,
      symbol,
      price: price.toString(),
    });
    return price;
  } catch (e) {
    console.error(e);
    return 0;
  }
};

class Tectonic extends Compound {
  async initPrices() {
    console.log("get markets");
    this.markets = await this.comptroller.methods.getAllMarkets().call();
    console.log(this.markets);

    let tvl = toBN("0");
    let totalBorrows = toBN("0");

    for (const market of this.markets) {
      let price;
      let balance;
      let borrows;
      console.log({ market });
      const ctoken = new this.web3.eth.Contract(Addresses.cTokenAbi, market);

      if (this.cETHAddresses.includes(market)) {
        price = await getEthPrice(this.network);
        balance = await this.web3.eth.getBalance(market);
      } else {
        console.log("getting underlying");
        const underlying = await ctoken.methods.underlying().call();
        price = await getPrice(underlying, this.web3);
        // console.log('@@@', price)
        if (price.toString() == "0" && this.network === "ETH") {
          console.log("trying with zapper");
          price = await getCTokenPriceFromZapper(
            market,
            underlying,
            this.web3,
            this.network
          );
        }
        if (price.toString() === "0") {
          // test and handle price is zero
          // we should not get here but if we do the process exits
          // & so bad debt will not be calculated without a real price
          console.log({
            underlying,
            price,
            message: "no price was obtained",
          });
        }
        const token = new this.web3.eth.Contract(
          Addresses.cTokenAbi,
          underlying
        );
        balance = await token.methods.balanceOf(market).call();
      }

      if (price.toString() === "0") {
        price = await this.getFallbackPrice(market);
      }

      this.prices[market] = this.web3.utils.toBN(price);
      console.log(market, price.toString());

      if (this.nonBorrowableMarkets.includes(market)) {
        borrows = toBN("0");
      } else {
        borrows = await ctoken.methods.totalBorrows().call();
      }

      const _1e18 = toBN(toWei("1"));
      tvl = tvl.add(toBN(balance).mul(toBN(price)).div(_1e18));
      totalBorrows = totalBorrows.add(
        toBN(borrows).mul(toBN(price)).div(_1e18)
      );
    }

    this.tvl = tvl;
    this.totalBorrows = totalBorrows;

    console.log(
      "init prices: tvl ",
      fromWei(tvl.toString()),
      " total borrows ",
      fromWei(this.totalBorrows.toString())
    );
  }
}

module.exports = Tectonic;

/*
const Web3 = require("web3")



async function test() {
    const comp = new Compound(Addresses.tectonicAddress, "CRO", web3)

    await comp.main()
    //await comp.collectAllUsers()
    //await comp.updateAllUsers()
    //await comp.periodicUpdate(14788673 - 1000)
    //await comp.calcBadDebt()
 }

 test()*/
