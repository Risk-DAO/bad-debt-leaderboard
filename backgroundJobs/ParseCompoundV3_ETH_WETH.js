const Addresses = require("./Addresses.js")
const CompoundV3 = require("./CompoundV3Parser")
const Web3 = require("web3")
require('dotenv').config()

class CompoundV3ETHWETHParser extends CompoundV3 {
  constructor() {
    const compoundInfo = Addresses.compoundV3Address['ETH']['WETH']
    const network = 'ETH'
    const web3 = new Web3(process.env.ETH_NODE_URL)
    super(compoundInfo, network, web3, 24 * 5)
  }
}

module.exports = { Parser: CompoundV3ETHWETHParser }

async function test() {

     const comp = new CompoundV3ETHWETHParser()
     await comp.main()
}

// test()
