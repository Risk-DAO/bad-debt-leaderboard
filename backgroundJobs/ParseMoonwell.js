const Addresses = require('./Addresses.js');
const Compound = require('./CompoundParser');
const Web3 = require('web3');
require('dotenv').config();

class MoonwellParser extends Compound {
  constructor() {
    const compoundInfo = Addresses.moonwellAddress;
    const network = 'MOONBEAM';
    const web3 = new Web3(process.env.MOONBEAM_NODE_URL);
    super(compoundInfo, network, web3, 24 * 5);
  }

  async getFallbackPrice(market) {
    const rektMarkets = [
      '0xc3090f41Eb54A7f18587FD6651d4D3ab477b07a4', // mETH
      '0x24A9d8f1f350d59cB0368D3d52A77dB29c833D1D', // mWBTC
      '0x02e9081DfadD37A852F9a73C4d7d69e615E61334', // mUSDC
    ];

    // negligable value
    if (rektMarkets.includes(market)) return '1';

    const oracleAddress = await this.comptroller.methods.oracle().call();
    const oracleContract = new this.web3.eth.Contract(Addresses.compoundOracleAbi, oracleAddress);

    return await oracleContract.methods.getUnderlyingPrice(market).call();
  }
}

module.exports = { Parser: MoonwellParser };

async function test() {
  const moon = new MoonwellParser();
  await moon.main();
}

//test()
