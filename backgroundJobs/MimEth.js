const MimParser = require("./MimParser.js")


const ethCalderons =
[
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
    { "name" : "xSUSHI", "address" : "0xbb02A884621FB8F5BFd263A67F58B65df5b090f3", "deployBlock" : 12558960},
    { "name" : "sSPELL", "address" : "0xC319EEa1e792577C319723b5e60a15dA3857E7da", "deployBlock" : 13239675},
    { "name" : "yvYFI", "address" : "0xFFbF4892822e0d552CFF317F65e1eE7b5D3d9aE6", "deployBlock" : 12558943},
    { "name" : "cvx3pool (old)", "address" : "0x806e16ec797c69afa8590A55723CE4CC1b54050E", "deployBlock" : 13148516},
    { "name" : "cvx3pool (new)", "address" : "0x6371EfE5CD6e3d2d7C477935b7669401143b7985", "deployBlock" : 13505014},
    { "name" : "UST (Degenbox)", "address" : "0xbc36FdE44A7FD8f545d459452EF9539d7A14dd63", "deployBlock" : 13486613}
]


const ftmCalderons = 
[
    { "name" : "FTM/MIM Spirit", "address" : "0x7208d9F9398D7b02C5C22c334c2a7A3A98c0A45d", "deployBlock" : 31494241},
    { "name" : "FTM/MIM Spooky", "address" : "0x4fdfFa59bf8dda3F4d5b38F260EAb8BFaC6d7bC1", "deployBlock" : 31497878},
    { "name" : "wFTM (3.5% interest)", "address" : "0x8E45Af6743422e488aFAcDad842cE75A09eaEd34", "deployBlock" : 11536771},
    { "name" : "wFTM (1.8% interest)", "address" : "0xd4357d43545F793101b592bACaB89943DC89d11b", "deployBlock" : 11536803},
    { "name" : "yvWFTM", "address" : "0xed745b045f9495B8bfC7b58eeA8E0d0597884e12", "deployBlock" : 17494828},
    { "name" : "xBOO", "address" : "0xa3Fc1B4b7f06c2391f7AD7D4795C1cD28A59917e", "deployBlock" :3124064 }
]

const avaxCalderons =
[
    { "name" : "AVAX", "address" : "0x3CFEd0439aB822530b1fFBd19536d897EF30D2a2", "deployBlock" :3709091 },
    { "name" : "wMEMO (deprecated)", "address" : "0x56984F04d2d04B2F63403f0EbeDD3487716bA49d", "deployBlock" : 5046414},
    { "name" : "xJOE", "address" : "0x3b63f81Ad1fc724E44330b4cf5b5B6e355AD964B", "deployBlock" : 6414426},
    { "name" : "USDC/AVAX JLP", "address" : "0x95cCe62C3eCD9A33090bBf8a9eAC50b699B54210", "deployBlock" : 6415427},
    { "name" : "wMEMO", "address" : "0x35fA7A723B3B39f15623Ff1Eb26D8701E7D6bB21", "deployBlock" : 6888366},
    { "name" : "USDT/AVAX JLP", "address" : "0x0a1e6a80E93e62Bd0D3D3BFcF4c362C40FB1cF3D", "deployBlock" : 6877723},
    { "name" : "MIM/AVAX JLP", "address" : "0x2450Bf8e625e98e14884355205af6F97E3E68d07", "deployBlock" : 6877772},
    { "name" : "MIM/AVAX SLP", "address" : "0xAcc6821d0F368b02d223158F8aDA4824dA9f28E3", "deployBlock" : 9512704}
]

const arbitrumCalderons =
[
    { "name" : "ETH", "address" : "0xC89958B03A55B5de2221aCB25B58B89A000215E6", "deployBlock" :5896 }
]

const bscCalderons =
[
    { "name" : "CAKE", "address" : "0xF8049467F3A9D50176f4816b20cDdd9bB8a93319", "deployBlock" :12765698 },
    { "name" : "BNB", "address" : "0x692CF15F80415D83E8c0e139cAbcDA67fcc12C90", "deployBlock" :12763666 }    
]



async function testETH() {
    const Web3 = require('web3')
    const web3 = new Web3("https://cloudflare-eth.com")
    

    let sumOfBadDebt = 0.0
    for(const calderon of ethCalderons) {
        const mimInfo = { "ETH" : {"blockStepInInit": 500000,
                                   "multicallSize" : 200,
                                   "calderons" : [calderon]}}
        const mim = new MimParser(mimInfo, "ETH", web3)

        console.log(calderon.name)
        await mim.main()
        /*
        const newBadDebt = await mim.main(true)
        sumOfBadDebt += newBadDebt        
        console.log(calderon.name, " new bad debt", newBadDebt.toString(), " total ", sumOfBadDebt.toString())        */
    }
 }

 async function testFTM() {
    const Web3 = require('web3')
    const web3 = new Web3("https://rpc.ftm.tools/")
    

    let sumOfBadDebt = 0.0
    for(const calderon of ftmCalderons) {
        const mimInfo = { "FTM" : {"blockStepInInit": 500000,
                                   "multicallSize" : 200,
                                   "calderons" : [calderon]}}
        const mim = new MimParser(mimInfo, "FTM", web3)

        console.log(calderon.name)
        const newBadDebt = await mim.main(true)
        sumOfBadDebt += newBadDebt        
        console.log(calderon.name, " new bad debt", newBadDebt.toString(), " total ", sumOfBadDebt.toString())        
    }
 }

 async function testAVAX() {
    const Web3 = require('web3')
    const web3 = new Web3("https://api.avax.network/ext/bc/C/rpc")
    

    let sumOfBadDebt = 0.0
    for(const calderon of avaxCalderons) {
        const mimInfo = { "AVAX" : {"blockStepInInit": 500000,
                                   "multicallSize" : 200,
                                   "calderons" : [calderon]}}
        const mim = new MimParser(mimInfo, "AVAX", web3)

        console.log(calderon.name)
        const newBadDebt = await mim.main(true)
        sumOfBadDebt += newBadDebt        
        console.log(calderon.name, " new bad debt", newBadDebt.toString(), " total ", sumOfBadDebt.toString())        
    }
 }

 async function testBSC() {
    const Web3 = require('web3')
    const web3 = new Web3("https://bsc-dataseed1.defibit.io/")
    

    let sumOfBadDebt = 0.0
    for(const calderon of bscCalderons) {
        const mimInfo = { "BSC" : {"blockStepInInit": 500000,
                                   "multicallSize" : 200,
                                   "calderons" : [calderon]}}
        const mim = new MimParser(mimInfo, "BSC", web3)

        console.log(calderon.name)
        //await mim.main()
        const newBadDebt = await mim.main(true)
        sumOfBadDebt += newBadDebt        
        console.log(calderon.name, " new bad debt", newBadDebt.toString(), " total ", sumOfBadDebt.toString())        
    }
 } 

 async function testArbitrum() {
    const Web3 = require('web3')
    const web3 = new Web3("https://arb1.arbitrum.io/rpc")
    

    let sumOfBadDebt = 0.0
    for(const calderon of arbitrumCalderons) {
        const mimInfo = { "ARBITRUM" : {"blockStepInInit": 50000,
                                   "multicallSize" : 200,
                                   "calderons" : [calderon]}}
        const mim = new MimParser(mimInfo, "ARBITRUM", web3)

        console.log(calderon.name)
        //await mim.main()
        const newBadDebt = await mim.main(true)
        sumOfBadDebt += newBadDebt        
        console.log(calderon.name, " new bad debt", newBadDebt.toString(), " total ", sumOfBadDebt.toString())        
    }
 } 

 testETH()
 /*
 async function testAll() {
    testETH()
    testAVAX()
    testArbitrum()
    testBSC()
    testFTM()
 }

 testAll()
*/


