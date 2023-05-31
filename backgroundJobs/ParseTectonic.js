const Addresses = require('./Addresses.js');
const Compound = require('./CompoundParser.js');
const Web3 = require('web3');
require('dotenv').config();

class TectonicParser extends Compound {
  constructor() {
    const tectonicInfo = Addresses.tectonicAddress;
    const network = 'CRO';
    const web3 = new Web3(process.env.CRO_NODE_URL);
    super(tectonicInfo, network, web3, 24 * 5);
  }
}

module.exports = { Parser: TectonicParser };

async function test() {
  const x = new TectonicParser();
  await x.main();
}

//test()
