const Addresses = require("./Addresses.js")
const Compound = require("./CompoundParser.js")
const Web3 = require("web3")
require('dotenv').config()

class IonicParser extends Compound {
  constructor() {
    const ionicInfo = Addresses.ionicAddress
    const network = 'MODE'
    const web3 = new Web3(process.env.MODE_NODE_URL)
    super(ionicInfo, network, web3, 24 * 5)
  }
}

module.exports = { Parser: IonicParser }


async function test() {
  const x = new IonicParser()
  await x.main()
}

//test()