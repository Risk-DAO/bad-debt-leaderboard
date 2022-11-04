const Addresses = require("./Addresses.js")
const AaveV3 = require("./AaveV3Parser")
const Web3 = require("web3")
require('dotenv').config()

class ParseAaveV3_MATIC extends AaveV3 {
  constructor() {
    const network = 'MATIC'
    const web3 = new Web3(process.env.MATIC_NODE_URL)
    super(Addresses.aaveV3Configuration, network, web3)
  }
}

// module.exports = { Parser: ParseAaveV3_MATIC }

// async function test() {
//     const aavev3 = new ParseAaveV3_MATIC()
//     await aavev3.main()
// }

test()