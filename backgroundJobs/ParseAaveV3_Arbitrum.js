const Addresses = require("./Addresses.js")
const AaveV3 = require("./AaveV3Parser")
const Web3 = require("web3")
require('dotenv').config()

class ParseAaveV3_Arbitrum extends AaveV3 {
  constructor() {
    const network = 'ARBITRUM'
    const web3 = new Web3(process.env.ARBITRUM_NODE_URL)
    super(Addresses.aaveV3Configuration, network, web3)
  }
}

module.exports = { Parser: ParseAaveV3_Arbitrum }

// async function test() {
//     const aavev3 = new ParseAaveV3_Arbitrum();
//     await aavev3.main();
// }

// test()