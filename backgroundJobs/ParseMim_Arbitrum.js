const Addresses = require("./Addresses.js")
const MIM = require("./MimParser")
const Web3 = require("web3")
require('dotenv').config()

const arbitrumCalderons = [
    { "name" : "ETH", "address" : "0xC89958B03A55B5de2221aCB25B58B89A000215E6", "deployBlock" :5896 }
]

class MimParser extends MIM {
  constructor(i) {
    const mimInfo = {
      "ARBITRUM": {
        "blockStepInInit": 50000,
        "multicallSize": 200,
        "calderons": [arbitrumCalderons[i]]
      }
    }
    const network = 'ARBITRUM'
    const web3 = new Web3(process.env.ARBITRUM_NODE_URL)
    super(mimInfo, network, web3)
  }
}

module.exports = {
  subJobs: arbitrumCalderons,
  Parser: MimParser
}