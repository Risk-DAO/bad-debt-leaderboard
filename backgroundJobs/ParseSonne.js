const Addresses = require("./Addresses.js")
const Compound = require("./CompoundParser.js")
const Web3 = require("web3")
require('dotenv').config()

class SonneParser extends Compound {
  constructor() {
    const sonneInfo = Addresses.sonneAddress
    const network = 'OPTIMISM'
    const web3 = new Web3(process.env.OPTIMISM_NODE_URL)
    const fetchDelayInHours = 24 * 5
    super(sonneInfo, network, web3, fetchDelayInHours)
  }
}

module.exports = { Parser: SonneParser }
