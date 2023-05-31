const Addresses = require("./Addresses.js")
const Compound = require("./CompoundParser")
const { getPrice, getEthPrice, getCTokenPriceFromZapper } = require('./priceFetcher')
const Web3 = require("web3")
require('dotenv').config()



class InverseParser extends Compound {
  constructor(web3Url) {
    const compoundInfo = Addresses.inverseAddress
    const network = 'ETH'
    const url = web3Url ? web3Url : process.env.ETH_NODE_URL
    const web3 = new Web3(url)
    super(compoundInfo, network, web3, 24 * 5, 24)
  }

  async getFallbackPrice(market) {
    const oracleAddress = await this.comptroller.methods.oracle().call()
    const oracleContract = new this.web3.eth.Contract(Addresses.compoundOracleAbi, oracleAddress)

    return await oracleContract.methods.getUnderlyingPrice(market).call()
  }  

  async getPrice(network, underlying, web3) {

    return getPrice(network, underlying, web3)
  }  
}

/*
async function test() {
  const comp = new InverseParser("TODO")
  await comp.main()
}

test()
*/
module.exports = { Parser: InverseParser }