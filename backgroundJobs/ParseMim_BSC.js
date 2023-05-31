const Addresses = require('./Addresses.js');
const MIM = require('./MimParser');
const Web3 = require('web3');
require('dotenv').config();

const bscCalderons = [
  { name: 'CAKE', address: '0xF8049467F3A9D50176f4816b20cDdd9bB8a93319', deployBlock: 12765698 },
  { name: 'BNB', address: '0x692CF15F80415D83E8c0e139cAbcDA67fcc12C90', deployBlock: 12763666 },
];

class MimParser extends MIM {
  constructor(i) {
    const mimInfo = {
      BSC: {
        blockStepInInit: 500000,
        multicallSize: 200,
        calderons: [bscCalderons[i]],
      },
    };
    const network = 'BSC';
    const web3 = new Web3(process.env.BSC_NODE_URL);
    super(mimInfo, network, web3);
  }
}

module.exports = {
  subJobs: bscCalderons,
  Parser: MimParser,
};
