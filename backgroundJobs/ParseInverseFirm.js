const FIRM = require("./InverseFirmParser.js")
const Addresses = require("./Addresses.js")
const Web3 = require("web3")
require('dotenv').config()

const network = 'ETH'
class InverseFirmParser extends FIRM {
  constructor(i) {
    const web3 = new Web3(process.env.ETH_NODE_URL)
    console.log("InverseFirmParser constructor")
    super(Addresses.firmInfos, network, web3)
  }
}

module.exports = {
  Parser: InverseFirmParser
}

async function test() {
    const Web3 = require("web3")
    const web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE_URL))

    const comp = new FIRM(Addresses.firmInfos, network, web3);
    await comp.test();
}

test()