const Addresses = require("./Addresses.js")
const Compound = require("./CompoundParser")
const Web3 = require("web3")
require('dotenv').config()

class OvixParser extends Compound {
  constructor() {
    const compoundInfo = Addresses.ovixAddress
    const network = 'MATIC'
    const web3 = new Web3(process.env.MATIC_NODE_URL)
    super(compoundInfo, network, web3, 24 * 5)
  }
}

module.exports = { Parser: OvixParser }