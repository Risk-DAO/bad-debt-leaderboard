const Addresses = require("./Addresses.js")
const BSCParser = require("./BSCParser.js")
const Web3 = require("web3")
require('dotenv').config()

class ParseApeswap extends BSCParser {
  constructor(webUrl = undefined) {
    const compoundInfo = Addresses.apeSwapAddress
    const network = 'BSC'
    const web3 = new Web3(webUrl ? webUrl : process.env.BSC_NODE_URL)
    super(compoundInfo, network, web3, 24 * 5)
  }
}

async function test() {
  const comp = new ParseApeswap("https://bsc-dataseed1.defibit.io/")
  await comp.main()
}

test()

module.exports = { Parser: ParseApeswap }