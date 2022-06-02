const Addresses = require("./Addresses.js")
const Compound = require("./CompoundParser")
const { getPrice, getCethPrice, getUniV2LPTokenPrice } = require('./priceFetcher')
const Web3 = require("web3")
const { toBN, toWei, fromWei } = Web3.utils
require('dotenv').config()

class IronBankParser extends Compound {
  constructor(web3Url = undefined) {
    const compoundInfo = Addresses.ironBankAddress
    const network = 'ETH'
    const web3 = new Web3(web3Url ? web3Url : process.env.ETH_NODE_URL)
    super(compoundInfo, network, web3, 24 * 5)
  }

  async balanceValue(token, user) {
    const alphaTokenContract = new this.web3.eth.Contract(Addresses.erc20Abi, token)
    const balance = await alphaTokenContract.methods.balanceOf(user).call()
    const price = await getPrice(this.network, token, this.web3)

    const _1e18 = toBN(toWei("1"))
    return toBN(price).mul(toBN(balance)).div(_1e18)    
  }

  async additionalCollateralBalance(userAddress) {
    
    if(userAddress === "0x5f5Cd91070960D13ee549C9CC47e7a4Cd00457bb") {
      console.log("alpha homora v1 incident")
      const alphaTokenAddress = "0xa1faa113cbE53436Df28FF0aEe54275c13B40975"
      const alphaEscrowAddress = "0xB80C75B574715404dB4B5097688B3338fE637953"

      return await this.balanceValue(alphaTokenAddress, alphaEscrowAddress)
    }
    else if(userAddress === "0xba5eBAf3fc1Fcca67147050Bf80462393814E54B") {
      console.log("alpha homora v2")
      const alphaHomoraLpTokens = [
        "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
        "0x3041CbD36888bECc7bbCBc0045E3B1f144466f5f",
        "0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5",
        "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11"
      ]

      let sum = toBN("0")
      
      const alphaHomoraLPTokenNFT = "0x06799a1e4792001AA9114F0012b9650cA28059a3"
      for(const lpToken of alphaHomoraLpTokens) {
        const lpTokenContract = new this.web3.eth.Contract(Addresses.erc20Abi, lpToken)
        const balance = await lpTokenContract.methods.balanceOf(alphaHomoraLPTokenNFT).call()
        const price = await getUniV2LPTokenPrice(this.network, lpToken, this.web3)

        const _1e18 = toBN(toWei("1"))
        const value = toBN(balance).mul(price).div(_1e18)
        sum = sum.add(value)
      }

      return sum
    }
    else if(userAddress === "0xcDDBA405f8129e5bAe101045aa45aCa11C03b1c8") {
      console.log("cream")
      const creamTokenAddress = "0x2ba592F78dB6436527729929AAf6c908497cB200"
      return await this.balanceValue(creamTokenAddress, userAddress)
    }
    else if(userAddress === "0x085682716f61a72bf8C573FBaF88CCA68c60E99B") {
      console.log("ice")
      const iceTokenAddress = "0xf16e81dce15B08F326220742020379B855B87DF9"
      return await this.balanceValue(iceTokenAddress, userAddress)
    }
    else if(userAddress === "0x9ae50BD64e45fd87dD05c768ff314b8FE246B3fF") {
      console.log("ftm")
      const ftmTokenAddress = "0x4E15361FD6b4BB609Fa63C81A2be19d873717870"
      return await this.balanceValue(ftmTokenAddress, userAddress)
    }
    else if(userAddress === "0x8338Aa899fB3168598D871Edc1FE2B4F0Ca6BBEF") {
      // TODO - yearm and fixed forex
      return toBN("0")      
    }
    else if(userAddress === "0x0a0B06322825cb979678C722BA9932E0e4B5fd90") {
      // TODO - yearn and fixed forex 2
      return toBN("0")
    }
    else {
      return toBN("0")
    }
  }
}

async function test() {
  const addresses = [
    "0x5f5Cd91070960D13ee549C9CC47e7a4Cd00457bb",
    "0xba5eBAf3fc1Fcca67147050Bf80462393814E54B",
    "0xcDDBA405f8129e5bAe101045aa45aCa11C03b1c8",
    "0x085682716f61a72bf8C573FBaF88CCA68c60E99B",
    "0x9ae50BD64e45fd87dD05c768ff314b8FE246B3fF",
    "0x8338Aa899fB3168598D871Edc1FE2B4F0Ca6BBEF",
    "0x0a0B06322825cb979678C722BA9932E0e4B5fd90"
  ]

  const ironBank = new IronBankParser("https://cloudflare-eth.com")
  const results = []

  for(const user of addresses) {
    const value = await ironBank.additionalCollateralBalance(user)
    results.push(fromWei(value))
    console.log("test:", {user}, fromWei(value))
  }

  console.log("------------------------")
  for(let i = 0 ; i < addresses.length ; i++) {
    console.log(addresses[i], results[i])
  }
}

//test()


module.exports = IronBankParser
