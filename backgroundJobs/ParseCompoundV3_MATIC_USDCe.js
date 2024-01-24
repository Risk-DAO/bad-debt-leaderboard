const Addresses = require("./Addresses.js")
const CompoundV3 = require("./CompoundV3Parser")
const Web3 = require("web3")
require('dotenv').config()

class CompoundVMATICUSDCeParser extends CompoundV3 {
  constructor() {
    const compoundInfo = Addresses.compoundV3Address['MATIC']['USDCe']
    const network = 'MATIC'
    const web3 = new Web3(process.env.MATIC_NODE_URL)
    super(compoundInfo, network, web3, 24 * 5)
  }
}

module.exports = { Parser: CompoundVMATICUSDCeParser }

async function test() {

  const comp = new CompoundVMATICUSDCeParser()
  await comp.main()
}

// test()
