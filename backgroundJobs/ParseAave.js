const Addresses = require("./Addresses.js")
const Aave = require("./AaveParser")
const Web3 = require("web3")
require('dotenv').config()

class ParseAave extends Aave {
  constructor() {
    const network = 'ETH'
    const web3 = new Web3(process.env.ETH_NODE_URL)
    super(Addresses.aaveAddress, network, web3)
  }
}

module.exports = { Parser: ParseAave }