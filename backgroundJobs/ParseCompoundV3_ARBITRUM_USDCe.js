const Addresses = require("./Addresses.js")
const CompoundV3 = require("./CompoundV3Parser")
const Web3 = require("web3")
require('dotenv').config()

class CompoundV3ARBITRUMUSDCeParser extends CompoundV3 {
  constructor() {
    const compoundInfo = Addresses.compoundV3Address['ARBITRUM']['USDCe']
    const network = 'ARBITRUM'
    const web3 = new Web3(process.env.ARBITRUM_NODE_URL)
    super(compoundInfo, network, web3, 24 * 5)
  }
}

module.exports = { Parser: CompoundV3ARBITRUMUSDCeParser }

async function test() {

  const comp = new CompoundV3ARBITRUMUSDCeParser()
  await comp.main()
}

// test()
