const Addresses = require("./Addresses.js")
const PriceAddresses = require("./PriceAddresses.js")
const Web3 = require("web3")
const { toBN, toWei, fromWei, toChecksumAddress } = Web3.utils
const axios = require('axios')

const coinGeckoChainIdMap = {
  ETH: 'ethereum',
  AVAX: 'avalanche',
  MATIC: 'polygon-pos',
  BSC: 'binance-smart-chain',
  NEAR: 'aurora'
}

const specialAssetPriceFetchers = {
  AVAX_0x57319d41F71E81F3c65F2a47CA4e001EbAFd4F33: async (web3, network, stakedTokenAddress) => {
    // xJoe
    const stakedTokenContract = new web3.eth.Contract(PriceAddresses.xJoeAbi, stakedTokenAddress)
    const tokenAddress = await stakedTokenContract.methods.joe().call()
    const tokenContract = new web3.eth.Contract(Addresses.cTokenAbi, tokenAddress)
    
    const stakedDecimals = Number(await stakedTokenContract.methods.decimals().call())
    const stakedTokenTotalSupply = await stakedTokenContract.methods.totalSupply().call()
    const stakedTokenUnderlyingBalance = await tokenContract.methods.balanceOf(stakedTokenAddress).call()

    const underlyingPrice = await getPrice(network, tokenAddress, web3)

    const decFactor = toBN("10").pow(toBN(18 - stakedDecimals))

    // balance * price * 10 ^(18-decimals) / total supply    
    return fromWei(toBN(stakedTokenUnderlyingBalance).mul(underlyingPrice).mul(decFactor).div(toBN(stakedTokenTotalSupply)))
  },

  AVAX_0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7: async (web3, network, address) => {
    // AVAX usdt
    // return ETH usdt price

    const coingeckoCall = "https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=0xdAC17F958D2ee523a2206206994597C13D831ec7&vs_currencies=USD"
    const {data} = await axios.get(coingeckoCall)
    //console.log(data)
    const apiPrice = Object.values(data)[0].usd || 0
    return apiPrice
  },  
  ETH_0x26FA3fFFB6EfE8c1E69103aCb4044C26B9A106a9: async (web3, network, stakedTokenAddress) => {
    // sSPELL
    const stakedTokenContract = new web3.eth.Contract(PriceAddresses.stakedTokenAbi, stakedTokenAddress)
    const tokenAddress = await stakedTokenContract.methods.token().call()
    const tokenContract = new web3.eth.Contract(Addresses.cTokenAbi, tokenAddress)
    
    const stakedTokenTotalSupply = await stakedTokenContract.methods.totalSupply().call()
    const stakedTokenUnderlyingBalance = await tokenContract.methods.balanceOf(stakedTokenAddress).call()

    const underlyingPrice = await getPrice(network, tokenAddress, web3)

    // balance * price * 10 ^(18-decimals) / total supply    
    return Number(fromWei(toBN(stakedTokenUnderlyingBalance).mul(underlyingPrice).div(toBN(stakedTokenTotalSupply))))
  },  
  ETH_0xF3A43307DcAFa93275993862Aae628fCB50dC768: async  (web3, network, address) => {
    // curve lp token for cvxFXS / FXS
    const curveContract = new web3.eth.Contract(PriceAddresses.curveAbi, PriceAddresses.cvxFXSFXSCurveAddress)
    const priceInFxs = toBN(await curveContract.methods.lp_price().call())

    const fxsPrice = await getPrice(network, PriceAddresses.fxsAddress, web3)
    console.log({priceInFxs}, {fxsPrice})

    return Number(fromWei(priceInFxs.mul(fxsPrice)))
  },  
  ETH_0x1985365e9f78359a9B6AD760e32412f4a445E862: async (web3, network, address) => {
    // old REP
    // return price of new rep
    return await getPrice(network, "0x221657776846890989a759BA2973e427DfF5C9bB", web3)
  },  
  ETH_0x9cA85572E6A3EbF24dEDd195623F188735A5179f: async  (web3, network, address) => {
    // y3Crv
    const stakedTokenContract = new web3.eth.Contract(PriceAddresses.stakedTokenAbi, address)
    const tokenAddress = await stakedTokenContract.methods.token().call()
    const tokenContract = new web3.eth.Contract(Addresses.cTokenAbi, tokenAddress)
    
    const stakedTokenTotalSupply = await stakedTokenContract.methods.totalSupply().call()
    const stakedTokenUnderlyingBalance = await tokenContract.methods.balanceOf(address).call()

    const underlyingPrice = await getPrice(network, tokenAddress, web3)

    // balance * price * 10 ^(18-decimals) / total supply    
    return Number(fromWei(toBN(stakedTokenUnderlyingBalance).mul(underlyingPrice).div(toBN(stakedTokenTotalSupply))))
  },  
  ETH_0x81d66D255D47662b6B16f3C5bbfBb15283B05BC2: async (web3, network, address) => {
    // ibZAR
    const apiCall = `https://free.currconv.com/api/v7/convert?q=USD_ZAR&compact=ultra&apiKey=66771e34ef6815203ee5`
    console.log({apiCall})
    const result = await axios.get(apiCall)
    return (1 / result.data["USD_ZAR"]).toFixed(10)
   },  
  ETH_0x69681f8fde45345C3870BCD5eaf4A05a60E7D227: async (web3, network, address) => {
    // ibGBP
    const apiCall = `https://free.currconv.com/api/v7/convert?q=USD_GBP&compact=ultra&apiKey=66771e34ef6815203ee5`
    console.log({apiCall})
    const result = await axios.get(apiCall)
    return (1 / result.data["USD_GBP"]).toFixed(10)
  },  
  ETH_0xFAFdF0C4c1CB09d430Bf88c75D88BB46DAe09967: async (web3, network, address) => {
    // ibAUD
    const apiCall = `https://free.currconv.com/api/v7/convert?q=USD_AUD&compact=ultra&apiKey=66771e34ef6815203ee5`
    console.log({apiCall})
    const result = await axios.get(apiCall)
    return (1 / result.data["USD_AUD"]).toFixed(10)
  },  
  ETH_0x5555f75e3d5278082200Fb451D1b6bA946D8e13b: async (web3, network, address) => {
    // ibJPY
    const apiCall = `https://free.currconv.com/api/v7/convert?q=USD_JPY&compact=ultra&apiKey=66771e34ef6815203ee5`
    console.log({apiCall})
    const result = await axios.get(apiCall)
    return (1 / result.data["USD_JPY"]).toFixed(10)
  },  
  ETH_0x95dFDC8161832e4fF7816aC4B6367CE201538253: async (web3, network, address) => {
    // ibKRW
    const apiCall = `https://free.currconv.com/api/v7/convert?q=USD_KRW&compact=ultra&apiKey=66771e34ef6815203ee5`
    console.log({apiCall})
    const result = await axios.get(apiCall)
    return (1 / result.data["USD_KRW"]).toFixed(10)
  },  
  ETH_0x1CC481cE2BD2EC7Bf67d1Be64d4878b16078F309: async (web3, network, address) => {
    // ibCHF
    const apiCall = `https://free.currconv.com/api/v7/convert?q=USD_CHF&compact=ultra&apiKey=66771e34ef6815203ee5`
    console.log({apiCall})
    const result = await axios.get(apiCall)
    return (1 / result.data["USD_CHF"]).toFixed(10)
  },
}

const getPrice = async (network, address, web3) => {
  try {
    const { Contract } = web3.eth
    const token = new Contract(PriceAddresses.erc20Abi, address)
    const decimal = await token.methods.decimals().call()
    //console.log({decimal})
    const symbol = await token.methods.symbol().call().catch(err => '???')
    //console.log({symbol})
    let apiPrice

    try{
      const specialPriceFetcher = specialAssetPriceFetchers[`${network}_${address}`]
      if(specialPriceFetcher){
        apiPrice = await specialPriceFetcher(web3, network, address)
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

const get1InchPrice = async (network, address, web3) => {
  const oneInch = new web3.eth.Contract(Addresses.oneInchOracleAbi, Addresses.oneInchOracleAddress[network])
  const price = await oneInch.methods.getRate(address, Addresses.usdcAddress[network], false).call()
  return price
}

async function testPrices() {
  const wiredTokensAvax = ["0x57319d41F71E81F3c65F2a47CA4e001EbAFd4F33", "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7"]
  const wiredTokensEth = [ "0x26FA3fFFB6EfE8c1E69103aCb4044C26B9A106a9",
  "0xF3A43307DcAFa93275993862Aae628fCB50dC768",
  "0x1985365e9f78359a9B6AD760e32412f4a445E862",
  "0x9cA85572E6A3EbF24dEDd195623F188735A5179f",
  "0x81d66D255D47662b6B16f3C5bbfBb15283B05BC2",
  "0x69681f8fde45345C3870BCD5eaf4A05a60E7D227",
  "0xFAFdF0C4c1CB09d430Bf88c75D88BB46DAe09967",
  "0x5555f75e3d5278082200Fb451D1b6bA946D8e13b",
  "0x95dFDC8161832e4fF7816aC4B6367CE201538253",
  "0x1CC481cE2BD2EC7Bf67d1Be64d4878b16078F309" ]

  // free public nodes
  const web3Eth = new Web3("https://cloudflare-eth.com")
  const web3Avax = new Web3("https://api.avax.network/ext/bc/C/rpc")

  const factor = toBN("10").pow(toBN("12"))

  for(const token of wiredTokensAvax) {
    const oneInchPrice = await get1InchPrice("AVAX", token, web3Avax)
    const apiPrice = await getPrice("AVAX", token, web3Avax)

    const adjustedOneInch = web3Avax.utils.fromWei(toBN(oneInchPrice).mul(factor))
    const adjustedApiPrice = web3Avax.utils.fromWei(toBN(apiPrice))

    console.log("avax", {token}, {adjustedApiPrice}, {adjustedOneInch}, Number(adjustedApiPrice) / Number(adjustedOneInch))
  }

  for(const token of wiredTokensEth) {

    const oneInchPrice = await get1InchPrice("ETH", token, web3Eth)
    const apiPrice = await getPrice("ETH", token, web3Eth)

    const adjustedOneInch = web3Eth.utils.fromWei(toBN(oneInchPrice).mul(factor))
    const adjustedApiPrice = web3Eth.utils.fromWei(toBN(apiPrice))

    console.log("ETH", {token}, {adjustedApiPrice}, {adjustedOneInch},"ratio", Number(adjustedOneInch) / Number(adjustedApiPrice))
  }  
}

//testPrices()

module.exports = {
  getPrice, 
  getCethPrice
}
