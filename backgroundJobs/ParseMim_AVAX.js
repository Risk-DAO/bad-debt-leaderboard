const Addresses = require("./Addresses.js")
const MIM = require("./MimParser")
const Web3 = require("web3")
require('dotenv').config()

const avaxCalderons =[
    { "name" : "AVAX", "address" : "0x3CFEd0439aB822530b1fFBd19536d897EF30D2a2", "deployBlock" :3709091 },
    { "name" : "wMEMO (deprecated)", "address" : "0x56984F04d2d04B2F63403f0EbeDD3487716bA49d", "deployBlock" : 5046414},
    { "name" : "xJOE", "address" : "0x3b63f81Ad1fc724E44330b4cf5b5B6e355AD964B", "deployBlock" : 6414426},
    { "name" : "USDC/AVAX JLP", "address" : "0x95cCe62C3eCD9A33090bBf8a9eAC50b699B54210", "deployBlock" : 6415427},
    { "name" : "wMEMO", "address" : "0x35fA7A723B3B39f15623Ff1Eb26D8701E7D6bB21", "deployBlock" : 6888366},
    { "name" : "USDT/AVAX JLP", "address" : "0x0a1e6a80E93e62Bd0D3D3BFcF4c362C40FB1cF3D", "deployBlock" : 6877723},
    { "name" : "MIM/AVAX JLP", "address" : "0x2450Bf8e625e98e14884355205af6F97E3E68d07", "deployBlock" : 6877772},
    { "name" : "MIM/AVAX SLP", "address" : "0xAcc6821d0F368b02d223158F8aDA4824dA9f28E3", "deployBlock" : 9512704}
]

class MimParser extends MIM {
  constructor(i) {
    const mimInfo = {
      "AVAX": {
        "blockStepInInit": 500000,
        "multicallSize": 200,
        "calderons": [avaxCalderons[i]]
      }
    }
    const network = 'AVAX'
    const web3 = new Web3(process.env.AVAX_NODE_URL)
    super(mimInfo, network, web3)
  }
}

module.exports = {
  subJobs: avaxCalderons,
  Parser: MimParser
}