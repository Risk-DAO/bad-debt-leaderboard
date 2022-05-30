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

const specialAssetPriceFetchers = {
  AVAX_0x57319d41F71E81F3c65F2a47CA4e001EbAFd4F33: () => {
    return 0
  },
  AVAX_0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7: () => {
    return 0
  },
}

const getPrice = async (network, address, web3) => {
  try {
    const { Contract } = web3.eth
    const token = new Contract(Addresses.erc20Abi, address)
    const decimal = await token.methods.decimals().call()
    const symbol = await token.methods.symbol().call()
    let apiPrice
    const coinGeckoApiCall = `https://api.coingecko.com/api/v3/simple/token_price/${coinGeckoChainIdMap[network]}?contract_addresses=${address}&vs_currencies=USD`
    console.log({coinGeckoApiCall})
    try{
      const specialPriceFetcher = specialAssetPriceFetchers[`${network}_${address}`]
      if(specialPriceFetcher){
        apiPrice = specialPriceFetcher()
      } else {
        const {data} = await axios.get(coinGeckoApiCall)
        //console.log(data)
        apiPrice = Object.values(data)[0].usd || 0
      }
    } catch(e){
      console.log('err: failed to fetch price for: ' + address)
      console.error(e)
      apiPrice = 0
    }
    const normlizer = (18 - decimal).toString()
    console.log({ apiPrice })
    const price = toBN(toWei(apiPrice.toString())).mul(toBN('10').pow(toBN(normlizer)))
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