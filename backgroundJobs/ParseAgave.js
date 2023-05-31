const Addresses = require('./Addresses.js');
const Aave = require('./AaveParser');
const Web3 = require('web3');
require('dotenv').config();

class ParseAgave extends Aave {
  constructor() {
    const network = 'GNOSIS';
    const web3 = new Web3(process.env.GNOSIS_NODE_URL); // "https://rpc.gnosischain.com"
    super(Addresses.agaveAddress, network, web3);
  }
}

module.exports = { Parser: ParseAgave };

//  async function test() {
//      const agave = new ParseAave()
//      await agave.main()
//  }

// test()
