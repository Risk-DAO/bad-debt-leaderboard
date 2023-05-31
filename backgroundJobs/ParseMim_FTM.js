const Addresses = require("./Addresses.js")
const MIM = require("./MimParser")
const Web3 = require("web3")
require('dotenv').config()


const ftmCalderons = [
    { "name" : "FTM+MIM Spirit", "address" : "0x7208d9F9398D7b02C5C22c334c2a7A3A98c0A45d", "deployBlock" : 31494241},
    { "name" : "FTM+MIM Spooky", "address" : "0x4fdfFa59bf8dda3F4d5b38F260EAb8BFaC6d7bC1", "deployBlock" : 31497878},
    { "name" : "wFTM (3.5% interest)", "address" : "0x8E45Af6743422e488aFAcDad842cE75A09eaEd34", "deployBlock" : 11536771},
    { "name" : "wFTM (1.8% interest)", "address" : "0xd4357d43545F793101b592bACaB89943DC89d11b", "deployBlock" : 11536803},
    { "name" : "yvWFTM", "address" : "0xed745b045f9495B8bfC7b58eeA8E0d0597884e12", "deployBlock" : 17494828},
    { "name" : "xBOO", "address" : "0xa3Fc1B4b7f06c2391f7AD7D4795C1cD28A59917e", "deployBlock" :3124064 }
]

class MimParser extends MIM {
  constructor(i) {
    const mimInfo = {
      "FTM": {
        "blockStepInInit": 500000,
        "multicallSize": 200,
        "calderons": [ftmCalderons[i]]
      }
    }
    const network = 'FTM'
    const web3 = new Web3(process.env.FTM_NODE_URL)
    super(mimInfo, network, web3)
  }
}

module.exports = {
  subJobs: ftmCalderons,
  Parser: MimParser
}