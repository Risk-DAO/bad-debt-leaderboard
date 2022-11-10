const Addresses = require("./Addresses.js")
const MIM = require("./MimParser")
const Web3 = require("web3")
require('dotenv').config()

const ethCalderons =[
    { "name" : "yvDAI", "address" : "0x7Ce7D9ED62B9A6c5aCe1c6Ec9aeb115FA3064757", "deployBlock" : 14580479},
    { "name" : "ALCX", "address" : "0x7b7473a76D6ae86CE19f7352A1E89F6C9dc39020", "deployBlock" : 13127188},
    { "name" : "yvCVXETH", "address" : "0xf179fe36a36B32a4644587B8cdee7A23af98ed37", "deployBlock" : 14262369},
    { "name" : "FTM", "address" : "0x05500e2Ee779329698DF35760bEdcAAC046e7C27", "deployBlock" : 13127890},
    { "name" : "wsOHM", "address" : "0x003d5A75d284824Af736df51933be522DE9Eed0f", "deployBlock" : 13071089},
    { "name" : "xSUSHI", "address" : "0x98a84EfF6e008c5ed0289655CcdCa899bcb6B99F", "deployBlock" : 13082618},
    { "name" : "yvcrvIB", "address" : "0xEBfDe87310dc22404d918058FAa4D56DC4E93f0A", "deployBlock" : 12903352},
    { "name" : "yvstETH", "address" : "0x0BCa8ebcB26502b013493Bf8fE53aA2B1ED401C1", "deployBlock" : 13097463},
    { "name" : "yvWETH v2", "address" : "0x920D9BD936Da4eAFb5E25c6bDC9f6CB528953F9f", "deployBlock" : 12776693},
    { "name" : "cvxtricrypto2", "address" : "0x4EAeD76C3A388f4a841E9c765560BBe7B3E4B3A0", "deployBlock" : 13297740},
    { "name" : "SHIB", "address" : "0x252dCf1B621Cc53bc22C256255d2bE5C8c32EaE4", "deployBlock" : 13452048},
    { "name" : "cvxrenCrv", "address" : "0x35a0Dd182E4bCa59d5931eae13D0A2332fA30321", "deployBlock" : 13393468},
    { "name" : "ALGD", "address" : "0xc1879bf24917ebE531FbAA20b0D05Da027B592ce", "deployBlock" : 13318362},    
    { "name" : "FTT", "address" : "0x9617b633EF905860D919b88E1d9d9a6191795341", "deployBlock" : 13491944},
    { "name" : "SPELL (DegenBox)", "address" : "0xCfc571f3203756319c231d3Bc643Cee807E74636", "deployBlock" : 13492855},
    { "name" : "sSPELL (New)", "address" : "0x3410297D89dCDAf4072B805EFc1ef701Bb3dd9BF", "deployBlock" : 13492815},
    { "name" : "cvx3pool (non deprecated)", "address" : "0x257101F20cB7243E2c7129773eD5dBBcef8B34E0", "deployBlock" : 13518049},
    { "name" : "WETH", "address" : "0x390Db10e65b5ab920C19149C919D970ad9d18A41", "deployBlock" : 13852120},
    { "name" : "WBTC", "address" : "0x5ec47EE69BEde0b6C2A2fC0D9d094dF16C192498", "deployBlock" : 13941597},
    { "name" : "UST V2 (Degenbox)", "address" : "0x59E9082E068Ddb27FC5eF1690F9a9f22B32e573f", "deployBlock" : 13709174},
    { "name" : "yvUSDC v2", "address" : "0x6cbAFEE1FaB76cA5B5e144c43B3B50d42b7C8c8f", "deployBlock" : 12558945},
    { "name" : "yvUSDT v2", "address" : "0x551a7CfF4de931F32893c928bBc3D25bF1Fc5147", "deployBlock" : 12558932},
    { "name" : "yvWETH", "address" : "0x6Ff9061bB8f97d948942cEF376d98b51fA38B91f", "deployBlock" : 12558932},
    { "name" : "xSUSHI2", "address" : "0xbb02A884621FB8F5BFd263A67F58B65df5b090f3", "deployBlock" : 12558960},
    { "name" : "sSPELL", "address" : "0xC319EEa1e792577C319723b5e60a15dA3857E7da", "deployBlock" : 13239675},
    { "name" : "yvYFI", "address" : "0xFFbF4892822e0d552CFF317F65e1eE7b5D3d9aE6", "deployBlock" : 12558943},
    { "name" : "cvx3pool (old)", "address" : "0x806e16ec797c69afa8590A55723CE4CC1b54050E", "deployBlock" : 13148516},
    { "name" : "cvx3pool (new)", "address" : "0x6371EfE5CD6e3d2d7C477935b7669401143b7985", "deployBlock" : 13505014},
    { "name" : "UST (Degenbox)", "address" : "0xbc36FdE44A7FD8f545d459452EF9539d7A14dd63", "deployBlock" : 13486613}
]

class MimParser extends MIM {
  constructor(i) {
    const mimInfo = {
      "ETH": {
        "blockStepInInit": 500000,
        "multicallSize": 200,
        "calderons": [ethCalderons[i]]
      }
    }
    const network = 'ETH'
    const web3 = new Web3(process.env.ETH_NODE_URL)
    super(mimInfo, network, web3)
  }
}

module.exports = {
  subJobs: ethCalderons,
  Parser: MimParser
}