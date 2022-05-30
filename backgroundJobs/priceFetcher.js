const Addresses = require("./Addresses.js")
const Web3 = require("web3")
const { toBN, toWei } = Web3.utils
const axios = require('axios')

const coinGeckoChainIdMap = {
  ETH: 'ethereum',
  AVAX: 'avalanche',
  MATIC: 'polygon-pos',
  BSC: 'binance-smart-chain',
}

const getPrice = async (network, address, web3) => {
  try {
    const { Contract } = web3.eth
    const token = new Contract(Addresses.erc20Abi, address)
    const decimal = await token.methods.decimals().call()
    const symbol = await token.methods.symbol().call()
    let price
    const coinGeckoApiCall = `https://api.coingecko.com/api/v3/simple/token_price/${coinGeckoChainIdMap[network]}?contract_addresses=${address}&vs_currencies=USD`
    console.log({coinGeckoApiCall})
    const {data} = await axios.get(coinGeckoApiCall)
    console.log(data)
    const apiPrice = Object.values(data)[0].usd || 0
    const normlizer = (18 - decimal).toString()
    console.log({ apiPrice })
    price = toBN(toWei(apiPrice.toString())).mul(toBN('10').pow(toBN(normlizer)))
    console.log({
      address,
      symbol,
      price: price.toString(),
    })
    return price
  } catch (e) {
    console.error(e)
    return 0
  }
}

module.exports = {
  getPrice
}