const axios = require('axios');
const Addresses = require('./Addresses.js');
const BSCParser = require('./BSCParser');
const Web3 = require('web3');
require('dotenv').config();

class VenusParser extends BSCParser {
  constructor() {
    const compoundInfo = Addresses.venusAddress;
    const network = 'BSC';
    const web3 = new Web3(process.env.BSC_NODE_URL);
    super(compoundInfo, network, web3, 24 * 5);
  }
}

module.exports = { Parser: VenusParser };

// async function test() {
//     const Web3 = require("web3")
//     const web3 = new Web3("https://bsc-dataseed1.defibit.io/")

//     const comp = new VenusParser(Addresses.venusAddress, "BSC", web3)
//     await comp.main()
// }

// test()
