const Addresses = require("./Addresses.js")
const Web3 = require("web3")
const { toBN, toWei, toChecksumAddress } = Web3.utils
const axios = require('axios')

const coinGeckoChainIdMap = {
  ETH: 'ethereum',
  AVAX: 'avalanche',
  MATIC: 'polygon-pos',
  BSC: 'binance-smart-chain',
  NEAR: 'aurora'
}

const specialAssetPriceFetchers = {
  AVAX_0x57319d41F71E81F3c65F2a47CA4e001EbAFd4F33: () => {
    return 0
  },
  AVAX_0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7: () => {
    return 0
  },  
  ETH_0x26FA3fFFB6EfE8c1E69103aCb4044C26B9A106a9: () => {
    return 0
  },  
  ETH_0xF3A43307DcAFa93275993862Aae628fCB50dC768: () => {
    return 0
  },  
  ETH_0x1985365e9f78359a9B6AD760e32412f4a445E862: () => {
    return 0
  },  
  ETH_0x9cA85572E6A3EbF24dEDd195623F188735A5179f: () => {
    return 0
  },  
  ETH_0x81d66D255D47662b6B16f3C5bbfBb15283B05BC2: () => {
    return 0
  },  
  ETH_0x69681f8fde45345C3870BCD5eaf4A05a60E7D227: () => {
    return 0
  },  
  ETH_0xFAFdF0C4c1CB09d430Bf88c75D88BB46DAe09967: () => {
    return 0
  },  
  ETH_0x5555f75e3d5278082200Fb451D1b6bA946D8e13b: () => {
    return 0
  },  
  ETH_0x95dFDC8161832e4fF7816aC4B6367CE201538253: () => {
    return 0
  },  
  ETH_0x1CC481cE2BD2EC7Bf67d1Be64d4878b16078F309: () => {
    return 0
  },
}

const getPrice = async (network, address, web3) => {
  try {
    const { Contract } = web3.eth
    const token = new Contract(Addresses.erc20Abi, address)
    const decimal = await token.methods.decimals().call()
    //console.log({decimal})
    const symbol = await token.methods.symbol().call().catch(err => '???')
    //console.log({symbol})
    let apiPrice

    try{
      const specialPriceFetcher = specialAssetPriceFetchers[`${network}_${address}`]
      if(specialPriceFetcher){
        apiPrice = specialPriceFetcher()
      } else if (network === 'ETH') {
        const krystalApiCall = `https://pricing-prod.krystal.team/v1/market?addresses=${address.toLowerCase()}&chain=ethereum@1&sparkline=false`
        console.log({krystalApiCall})
        const { data } = await axios.get(krystalApiCall)
        //console.log(data)
        apiPrice = data.marketData[0].price || 0
      } else {
        const coinGeckoApiCall = `https://api.coingecko.com/api/v3/simple/token_price/${coinGeckoChainIdMap[network]}?contract_addresses=${address}&vs_currencies=USD`
        console.log({coinGeckoApiCall})
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

const chainTokenFetchers = {
  NEAR: async () => {
    const {data} = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=USD')
    const res = Object.values(data)[0].usd
    console.log({res})
    return {
      price: res,
      decimal: 18
    }
  },  
  ETH: async () => {
    const {data} = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=USD')
    const res = Object.values(data)[0].usd
    console.log({res})
    return {
      price: res,
      decimal: 18
    }
  },  
  AVAX: async () => {
    const {data} = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=USD')
    const res = Object.values(data)[0].usd
    console.log({res})
    return {
      price: res,
      decimal: 18
    }
  },  
  MATIC: async () => {
    const {data} = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=USD')
    const res = Object.values(data)[0].usd
    console.log({res})
    return {
      price: res,
      decimal: 18
    }
  },  
  BSC: async () => {
    const {data} = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=USD')
    const res = Object.values(data)[0].usd
    console.log({res})
    return {
      price: res,
      decimal: 18
    }
  },
}

const getCethPrice = async (network, address, web3) => {
  try{
    const { price: apiPrice, decimal } = await chainTokenFetchers[`${network}`]()
    const normlizer = (18 - decimal).toString()
    console.log({ apiPrice })
    const price = toBN(toWei(apiPrice.toString())).mul(toBN('10').pow(toBN(normlizer)))
    return price
  } catch (e) {
    console.error(e)
    return 0
  }
}

module.exports = {
  getPrice, 
  getCethPrice
}