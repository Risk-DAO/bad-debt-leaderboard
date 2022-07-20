const Addresses = require("./Addresses.js")
const Compound = require("./CompoundParser")
const User = require("./User")
const { getPrice, fetchZapperTotal, getUniV2LPTokenPrice } = require('./priceFetcher')
const Web3 = require("web3")
const { toBN, toWei, fromWei } = Web3.utils
require('dotenv').config()


class IronBankParser extends Compound {
  constructor(web3Url = undefined) {
    const compoundInfo = Addresses.ironBankAddress
    const network = 'ETH'
    const web3 = new Web3(web3Url ? web3Url : process.env.ETH_NODE_URL)
    super(compoundInfo, network, web3, 24 * 1)
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
      const alphaTokenCollateralValue = await this.balanceValue(alphaTokenAddress, alphaEscrowAddress)
      let exploiterContractData;
      const exploiterContractAddress = "0x560A8E3B79d23b0A525E15C6F3486c6A293DDAd2"
      for(const [user, data] of Object.entries(this.users)) {
        if (user == exploiterContractAddress){
          exploiterContractData = new User(user, data.marketsIn, data.borrowBalance, data.collateralBalace, data.error)
          break;
        }
      }
      const exploiterContractNetValue = exploiterContractData.getUserNetValue(this.web3, this.prices);
      return alphaTokenCollateralValue.add(exploiterContractNetValue.netValue);
    }
    else if(userAddress === "0xba5eBAf3fc1Fcca67147050Bf80462393814E54B") {
      console.log("alpha homora v2")
      const alphaHomoraLPTokenNFT = "0x06799a1e4792001AA9114F0012b9650cA28059a3"
      const result = await fetchZapperTotal(alphaHomoraLPTokenNFT)
      return toBN(toWei(result.toString()))
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
      // yearm and fixed forex
      // first get debt of yearn and fixed forex 2, and substruct it from the extra collateral
      const otherYearnUser = "0x0a0B06322825cb979678C722BA9932E0e4B5fd90"
      let otherDebt = toBN("0")
      const data = this.users[otherYearnUser]
      if(data) {
        const userData = new User(otherYearnUser, data.marketsIn, data.borrowBalance, data.collateralBalace, data.error)  
        const userValue = userData.getUserNetValue(this.web3, this.prices)
        otherDebt = userValue.debt
        console.log("other debt", otherDebt.toString())  
      }

      const zapperResult = await fetchZapperTotal("0x0D5Dc686d0a2ABBfDaFDFb4D0533E886517d4E83")

      return toBN(toWei(zapperResult.toString())).sub(toBN(otherDebt.toString()))
    }
    else if(userAddress === "0x0a0B06322825cb979678C722BA9932E0e4B5fd90") {
      // fixed forex 2
      const otherYearnUser = "0x8338Aa899fB3168598D871Edc1FE2B4F0Ca6BBEF"
      let otherDebt = toBN("0")
      const data = this.users[otherYearnUser]
      if(data) {
        const userData = new User(otherYearnUser, data.marketsIn, data.borrowBalance, data.collateralBalace, data.error)  
        const userValue = userData.getUserNetValue(this.web3, this.prices)
        otherDebt = userValue.debt
        console.log("other debt", otherDebt.toString())  
      }

      const zapperResult = await fetchZapperTotal("0x0D5Dc686d0a2ABBfDaFDFb4D0533E886517d4E83")

      return toBN(toWei(zapperResult.toString())).sub(toBN(otherDebt.toString()))
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
  //await ironBank.main()
  
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


module.exports = { Parser: IronBankParser }
