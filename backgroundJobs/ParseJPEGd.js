const Addresses = require("./Addresses.js")
const { getPrice, fetchZapperTotal } = require('./priceFetcher')
const Web3 = require("web3")
const { toBN, toWei, fromWei } = Web3.utils
require('dotenv').config()

class JPEGDParser {
  constructor(web3Url = undefined) {
    this.network = 'ETH'
    this.web3 = new Web3(web3Url ? web3Url : process.env.ETH_NODE_URL)

    const pusdAddress = "0x466a756E9A7401B5e2444a3fCB3c2C12FBEa0a54"
    const ape1Vaults = "0x7B179f9bFBE50cFA401C1Cdde3cB2C339c6635F3"
    const ape2Vaults = "0x271c7603AAf2BD8F68e8Ca60f4A4F22c4920259f"
    const punkTreasury = "0x810fdbc7E5Cfe998127a1f2Aa26f34E64e0364f4"

    this.psmAddress = "0xFD110cf7985f6B7cAb4dc97dF1932495cADa9d08"
    this.pusdContract = new this.web3.eth.Contract(Addresses.erc20Abi, pusdAddress)
    this.usdcContract = new this.web3.eth.Contract(Addresses.erc20Abi, Addresses.usdcAddress["ETH"])
    this.nftVaults = [ape1Vaults, ape2Vaults, punkTreasury]
  }

  async getTreasuryBalance() {
    const usdcBalance = await this.usdcContract.methods.balanceOf(this.psmAddress).call()
    const usdPrice = await getPrice(this.network, this.usdcContract.options.address, this.web3)
    //console.log(usdPrice.toString(), usdcBalance.toString())
    const psmBalance = Number(fromWei(fromWei(toBN(usdPrice).mul(toBN(usdcBalance)))))

    //console.log({psmBalance})

    let nftBalance = 0.0
    for(const nftVault of this.nftVaults) {
      const balance = await fetchZapperTotal(nftVault)
      //console.log({balance})
      nftBalance += Number(balance)
    }

    return psmBalance + nftBalance
  }

  async getTotalDebt() {
    return Number(fromWei(await this.pusdContract.methods.totalSupply().call()))
  }

  async calcBadDebt() {
    const currTime = (await this.web3.eth.getBlock("latest")).timestamp
    const collateral = await this.getTreasuryBalance()
    const debt = await this.getTotalDebt()

    const badDebt = debt > collateral ? debt - collateral : 0

    this.output = { "total" : toWei(badDebt.toString()), "updated" : currTime.toString(), "decimals" : "18", "users" : {},
    "tvl" : toWei(collateral.toString()), "deposits" : toWei(collateral.toString()), "borrows" : toWei(debt.toString()),
    "calculatedBorrows" : toWei(debt.toString())}

    console.log(JSON.stringify(this.output))

    console.log("total bad debt", fromWei(badDebt.toString()), {currTime})    
  }

  async main() {
    try {
      await this.calcBadDebt()
    }
    catch(err) {
        console.log("main failed", {err})
    }

    setTimeout(this.main.bind(this), 1000 * 60 * 60) // sleep for 1 hour    
  }
}

async function test() {
  const comp = new JPEGDParser("https://cloudflare-eth.com")
  //console.log(await comp.getTreasuryBalance())
  //console.log(await comp.getTotalDebt())  
  await comp.main()
}

test()

module.exports = JPEGDParser