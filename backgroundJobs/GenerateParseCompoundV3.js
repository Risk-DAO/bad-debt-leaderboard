const Addresses = require("./Addresses.js")
const CompoundV3 = require("./CompoundV3Parser")
const Web3 = require("web3")
require('dotenv').config()

const marketToProcessEnv = {
    'ETH' : process.env.ETH_NODE_URL,
    'MATIC' : process.env.MATIC_NODE_URL,
    'ARBITRUM' : process.env.ARBITRUM_NODE_URL,
    'BASE' : process.env.BASE_NODE_URL
}

const networkEnum = {
    ETH : 'ETH',
    MATIC : 'MATIC',
    ARBITRUM : 'ARBITRUM',
    BASE  : 'BASE'
  }; 
  
  const currencyEnum = {
    USDC: 'USDC',
    USDCe: 'USDCe',
    WETH: 'WETH'
  };
  
  const networkCurrencyDic = {
    [networkEnum.ETH]: {
        [currencyEnum.USDC]: 'USDC',
        [currencyEnum.WETH]: 'WETH',
    },
    [networkEnum.MATIC]: {
      [currencyEnum.USDC]: 'USDC',
    },
    [networkEnum.ARBITRUM]: {
        [currencyEnum.USDC]: 'USDC',
        [currencyEnum.USDCe]: 'USDCe',
    },
    [networkEnum.BASE]: {
        [currencyEnum.USDC]: 'USDC',
        [currencyEnum.WETH]: 'WETH',
    },
  };
  function isValidNetwork(network) {
    return Object.values(networkEnum).includes(network);
  }
  function isValidCurrency(network, currency) {
    return Object.values(networkCurrencyDic[network]).includes(currency);
  }
function GenerateParseCompoundV3 (network, currency) {
    return class extends CompoundV3 {
        constructor() {
            if (!isValidNetwork(network)) {
                throw new Error('INVALID NETWORK');
            } if (!isValidCurrency(network,currency)) {
                const validInputs = Object.values(networkCurrencyDic[network]).join(', ');
                throw new Error(`INVALID CURRENCY! valid input for ${network} network: ${validInputs}`);
            }
            else {
                const compoundInfo =  Addresses.compoundV3Address[network][currency];
                const web3 = new Web3(marketToProcessEnv[network]);
                super(compoundInfo, network, web3, 24 * 5);
            }
        }
    };
}


//module.exports = { Parser: CompoundV3ETHUSDCParser }

async function test() {
 // const compETHUSDC = GenerateParseCompoundV3('ETH','USDC');
  //const compETHUSDC = GenerateParseCompoundV3('MATIC','USDCe');
  //const compETHUSDC = GenerateParseCompoundV3('ARBITRUM','USDC');
  const compETHUSDC = GenerateParseCompoundV3(networkEnum.BASE, currencyEnum.USDC);
  const comp = new compETHUSDC();
  await comp.main()
}

test();