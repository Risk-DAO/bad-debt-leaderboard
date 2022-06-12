const Addresses = require("./Addresses.js")
const Compound = require("./CompoundParser")
const Web3 = require("web3")
require('dotenv').config()



class InverseParser extends Compound {
  constructor(web3Url = undefined) {
    const compoundInfo = Addresses.inverseAddress
    const network = 'ETH'
    const url = web3Url == undefined ? process.env.ETH_NODE_URL : web3Url
    console.log({url})
    const web3 = new Web3(url)
    super(compoundInfo, network, web3, 24 * 5)
  }
}


module.exports = InverseParser