const Addresses = require("./Addresses.js")
const Compound = require("./CompoundParser")
const Web3 = require("web3")
require('dotenv').config()

class BastionParser extends Compound {
  constructor() {
    const compoundInfo = Addresses.bastionAddress
    const network = 'NEAR'
    const web3 = new Web3(process.env.NEAR_NODE_URL)
    super(compoundInfo, network, web3, 24 * 5)
  }
}

module.exports = { Parser: BastionParser }