const Addresses = require('./Addresses.js');
const AaveV3 = require('./AaveV3Parser');
const Web3 = require('web3');
require('dotenv').config();

class ParseAaveV3_Harmony extends AaveV3 {
  constructor() {
    const network = 'HARMONY';
    const web3 = new Web3(process.env.HARMONY_NODE_URL);
    super(Addresses.aaveV3Configuration, network, web3);
  }
}

module.exports = { Parser: ParseAaveV3_Harmony };

// async function test() {
//     const aavev3 = new ParseAaveV3_HARMONY()
//     await aavev3.main()
// }

// test()
