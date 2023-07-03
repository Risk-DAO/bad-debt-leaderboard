const Addresses = require("./Addresses.js")
const Aave = require("./AaveParser")
const Web3 = require("web3")
const { toBN, toWei, fromWei } = Web3.utils
require('dotenv').config()

class ParseGranary extends Aave {
  constructor() {
    const network = 'OPTIMISM'
    const web3 = new Web3(process.env.OPTIMISM_NODE_URL)
    super(Addresses.granaryAddress, network, web3)
  }

  async initPrices() {
    await super.initPrices()

    // override eth price - as in granary the result is in 8 decimals USD
    this.ethPrice = toBN("10").pow(toBN("28"))
}  
}

module.exports = { Parser: ParseGranary }

async function test() {
  const g = new ParseGranary()
  await g.main()
}

//test()
