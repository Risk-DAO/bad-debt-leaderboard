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

const getChainlinkPrice = async (web3, feedAddress) => {
  const feed = new web3.eth.Contract(PriceAddresses.chainlinkAbi, feedAddress)

  const answer = await feed.methods.latestAnswer().call()
  const decimals = await feed.methods.decimals().call()
  const factor = toBN("10").pow(toBN(18 - Number(decimals)))

  return Number(fromWei(toBN(answer).mul(factor)))
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

    // balance * price * 10 ^(18-decimals) / total supply    
    return fromWei(toBN(stakedTokenUnderlyingBalance).mul(underlyingPrice).div(toBN(stakedTokenTotalSupply)))
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
  BSC_0x20bff4bbEDa07536FF00e073bd8359E5D80D733d: async (web3, network, stakedTokenAddress) => {
    //CAN (cannon)
    return "0.0000000000000001"
  },
  BSC_0xd4CB328A82bDf5f03eB737f37Fa6B370aef3e888: async (web3, network, stakedTokenAddress) => {
    // CREAM
    const {data} = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=cream-2&vs_currencies=USD')
    return Number(Object.values(data)[0].usd)
  },  
  BSC_0xAD6cAEb32CD2c308980a548bD0Bc5AA4306c6c18: async (web3, network, stakedTokenAddress) => {
    // BAND
    const {data} = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=band-protocol&vs_currencies=USD')
    return Number(Object.values(data)[0].usd)
  },  
  BSC_0x16939ef78684453bfDFb47825F8a5F714f12623a: async (web3, network, stakedTokenAddress) => {
    // tezos
    const {data} = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=tezos&vs_currencies=USD')
    return Number(Object.values(data)[0].usd)
  },  
  BSC_0x88f1A5ae2A3BF98AEAF342D26B30a79438c9142e: async (web3, network, stakedTokenAddress) => {
    // yearn-finance
    const {data} = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=yearn-finance&vs_currencies=USD')
    return Number(Object.values(data)[0].usd)
  },  
  BSC_0x101d82428437127bF1608F699CD651e6Abf9766E: async (web3, network, stakedTokenAddress) => {
    // basic-attention-token
    const {data} = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=basic-attention-token&vs_currencies=USD')
    return Number(Object.values(data)[0].usd)
  },  
  BSC_0x695FD30aF473F2960e81Dc9bA7cB67679d35EDb7: async (web3, network, stakedTokenAddress) => {
    // renzec
    const {data} = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=renzec&vs_currencies=USD')
    return Number(Object.values(data)[0].usd)
  },  
  BSC_0xA527a61703D82139F8a06Bc30097cC9CAA2df5A6: async (web3, network, stakedTokenAddress) => {
    // Pancake LPs (Cake-LP)
    // TODO:
    return Number(0)
  },
  BSC_0x1B96B92314C44b159149f7E0303511fB2Fc4774f: async (web3, network, stakedTokenAddress) => {
    // Pancake LPs (Cake-LP)
    // TODO:
    return Number(0)
  },
  BSC_0x7561EEe90e24F3b348E1087A005F78B4c8453524: async (web3, network, stakedTokenAddress) => {
    // Pancake LPs (Cake-LP)
    // TODO:
    return Number(0)
  },
  BSC_0x70D8929d04b60Af4fb9B58713eBcf18765aDE422: async (web3, network, stakedTokenAddress) => {
    // Pancake LPs (Cake-LP)
    // TODO:
    return Number(0)
  },
  BSC_0xc15fa3E22c912A276550F3E5FE3b0Deb87B55aCd: async (web3, network, stakedTokenAddress) => {
    // Pancake LPs (Cake-LP)
    // TODO:
    return Number(0)
  },
  BSC_0x0eD7e52944161450477ee417DE9Cd3a859b14fD0: async (web3, network, stakedTokenAddress) => {
    // Pancake LPs (Cake-LP)
    // TODO:
    return Number(0)
  },
  BSC_0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16: async (web3, network, stakedTokenAddress) => {
    // Pancake LPs (Cake-LP)
    // TODO:
    return Number(0)
  },
  BSC_0x61EB789d75A95CAa3fF50ed7E47b96c132fEc082: async (web3, network, stakedTokenAddress) => {
    // Pancake LPs (Cake-LP)
    // TODO:
    return Number(0)
  },
  BSC_0x74E4716E431f45807DCF19f284c7aA99F18a4fbc: async (web3, network, stakedTokenAddress) => {
    // Pancake LPs (Cake-LP)
    // TODO:
    return Number(0)
  },
  BSC_0x7EFaEf62fDdCCa950418312c6C91Aef321375A00: async (web3, network, stakedTokenAddress) => {
    // Pancake LPs (Cake-LP)
    // TODO:
    return Number(0)
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
    return Number(fromWei(await getPrice(network, "0x221657776846890989a759BA2973e427DfF5C9bB", web3)))
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
    return getChainlinkPrice(web3, PriceAddresses.zarPriceFeedAddress)
   },  
  ETH_0x69681f8fde45345C3870BCD5eaf4A05a60E7D227: async (web3, network, address) => {
    // ibGBP
    return getChainlinkPrice(web3, PriceAddresses.gbpPriceFeedAddress)    
  },  
  ETH_0xFAFdF0C4c1CB09d430Bf88c75D88BB46DAe09967: async (web3, network, address) => {
    // ibAUD
    return getChainlinkPrice(web3, PriceAddresses.audPriceFeedAddress)    
  },  
  ETH_0x5555f75e3d5278082200Fb451D1b6bA946D8e13b: async (web3, network, address) => {
    // ibJPY
    return getChainlinkPrice(web3, PriceAddresses.jpyPriceFeedAddress)    
  },  
  ETH_0x95dFDC8161832e4fF7816aC4B6367CE201538253: async (web3, network, address) => {
    // ibKRW
    return getChainlinkPrice(web3, PriceAddresses.krwPriceFeedAddress)    
  },  
  ETH_0x1CC481cE2BD2EC7Bf67d1Be64d4878b16078F309: async (web3, network, address) => {
    // ibCHF
    return getChainlinkPrice(web3, PriceAddresses.chfPriceFeedAddress)
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

    let price
    if(decimal > 18) {
      const normlizer = decimal - 18
      price = toBN(toWei(apiPrice.toString())).div(toBN('10').pow(toBN(normlizer)))
    }
    else {
      const normlizer = 18 -decimal
      price = toBN(toWei(apiPrice.toString())).mul(toBN('10').pow(toBN(normlizer)))
    }

    console.log({ apiPrice })
    
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

const getEthPrice = async (network) => {
  try{
    const { price: apiPrice, decimal } = await chainTokenFetchers[`${network}`]()
    const normlizer = (18 - decimal).toString()
    console.log({ apiPrice })
    const price = toBN(toWei(apiPrice.toString())).mul(toBN('10').pow(toBN(normlizer)))
    return price
  } catch (e) {
    console.error(e)
    return toBN("0")
  }
}

const getUniV2LPTokenPrice = async (network, address, web3) => {
  try {
    const lptoken = new web3.eth.Contract(PriceAddresses.uniswapV2PairAbi, address)
    const token0Address = await lptoken.methods.token0().call()
    const token1Address = await lptoken.methods.token1().call()
    const totalSupply = await lptoken.methods.totalSupply().call()

    const token0 = new web3.eth.Contract(PriceAddresses.erc20Abi, token0Address)
    const token1 = new web3.eth.Contract(PriceAddresses.erc20Abi, token1Address)

    const bal0 = await token0.methods.balanceOf(address).call()
    const bal1 = await token1.methods.balanceOf(address).call()

    const price0 = await getPrice(network, token0Address, web3)
    const price1 = await getPrice(network, token1Address, web3)

    const _1e18 = toBN(toWei("1"))
    
    const token0Val = toBN(bal0).mul(toBN(price0))
    const token1Val = toBN(bal1).mul(toBN(price1))
    
    const lpValue = (token0Val.add(token1Val)).div(toBN(totalSupply))

    return lpValue
  }
  catch (e) {
    console.error(e)
    return toBN("0")
  }
}

const fetchZapperTotal = async (address) => {
  const options = {
    method: 'get',
    url: 'https://api.zapper.fi/v2/balances',
    params: {
      'addresses[]': address,
      useNewBalancesFormat: 'true',
      bundled: 'false',
      'addresses%5B%5D': address
    },
    headers: {
      'Cache-Control': 'no-cache',
      Authorization: 'Basic OTZlMGNjNTEtYTYyZS00MmNhLWFjZWUtOTEwZWE3ZDJhMjQxOg==',
      accept: 'application/json'
    }
  };

  const res = await axios(options)
  const netCollateral = res.data.split("event: balance\ndata: ")
    .filter(b => b != "")
    .map(b => b.split("\n")[0])
    .map(b => JSON.parse(b))
    .map(b=> {
      if(b.appId == 'tokens' || b.appId == 'nft'){
        return b.totals.reduce((a, b)=> a.balanceUSD + b.balanceUSD, {balanceUSD: 0})
      } else {
        return b.app.meta.total
      }
    })
    .reduce((a, b)=> a + b, 0)
  return netCollateral
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

async function testLPTokenPrice() {
  const alphaHomoraLpTokens = [
    "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
    "0x3041CbD36888bECc7bbCBc0045E3B1f144466f5f",
    "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5",
    "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11"
  ]

  const web3Eth = new Web3("https://cloudflare-eth.com")
  for(const token of alphaHomoraLpTokens) {
    const price = await getUniV2LPTokenPrice("ETH", token, web3Eth)
    console.log("testLPTokenPrice:", {token}, web3Eth.utils.fromWei(price.toString()))
  }
}

//testLPTokenPrice()
//testPrices()

module.exports = {
  getPrice, 
  getUniV2LPTokenPrice,
  getEthPrice,
  fetchZapperTotal
}
