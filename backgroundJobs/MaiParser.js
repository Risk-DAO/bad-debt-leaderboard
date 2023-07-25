const Web3 = require('web3')
const { toBN, toWei, fromWei } = Web3.utils
const axios = require('axios')
const Addresses = require("./Addresses.js")
//const { getPrice, getEthPrice, getCTokenPriceFromZapper } = require('./priceFetcher')
const User = require("./User.js")
const {waitForCpuToGoBelowThreshold} = require("../machineResources")
const {retry} = require("../utils")
const { assert } = require('console')


class MaiParser {
    constructor(maiInfo, network, web3, heavyUpdateInterval = 24) {
      this.web3 = web3
      this.heavyUpdateInterval = heavyUpdateInterval

      this.tvl = toBN("0")
      this.totalBorrows = toBN("0")

      this.vault = new web3.eth.Contract(Addresses.maiVaultAbi, maiInfo.address)
      this.multicallSize = maiInfo.multicallSize
      this.multicall = new web3.eth.Contract(Addresses.multicallAbi, Addresses.multicallAddress[network])

      this.mainCntr = 0

      this.price = toBN(0)

      this.userDebt = {}
      this.userCollateral = {}

      this.feedDecimals = 0
      this.tokenDecimals = 0

      this.network = network

      this.output = {}
    }

    async heavyUpdate() {
        await this.initPrices()
        await this.updateAllUsers()
    }

    async main(onlyOnce = false) {
        try {
            await waitForCpuToGoBelowThreshold()
            const currBlock = await this.web3.eth.getBlockNumber() - 10
            const currTime = (await this.web3.eth.getBlock(currBlock)).timestamp

            console.log("heavyUpdate start")
            await this.heavyUpdate()
            console.log('heavyUpdate success')
            console.log("calc bad debt")
            await this.calcBadDebt(currTime)
            
            this.lastUpdateBlock = currBlock

            // don't  increase cntr, this way if heavy update is needed, it will be done again next time
            console.log("sleeping", this.mainCntr++)
        }
        
        catch(err) {
            console.log("main failed", {err})
        }

        if(onlyOnce) {
            return Number(fromWei(this.sumOfBadDebt.toString()))
        }

        setTimeout(this.main.bind(this), 1000 * 60 * 60 * 2) // sleep for 2 hours
    }

    async initPrices() {
        console.log("getting prices")
        try {
            this.price = await this.vault.methods.getEthPriceSource().call()
        }
        catch(err) {
            if(err.toString().includes("Error: Returned error: execution reverted")) {
                this.price = 0
            }
            else {
                console.log("should revert")
                throw new Error(err)
            }            
        }
        console.log(this.price)

        const rawTokenVaults = [
            "0x88d84a85A87ED12B8f098e8953B322fF789fCD1a",
            "0xa3Fa99A148fA48D14Ed51d610c367C61876997F1"
        ]

        if(this.network === "MATIC" && rawTokenVaults.includes(this.vault.options.address)) {
            this.feedDecimals = 8
            this.tokenDecimals = 18
            return
        }

        if(this.network === "MATIC" && this.vault.options.address === "0x7dDA5e1A389E0C1892CaF55940F5fcE6588a9ae0") {
            this.feedDecimals = 8
            this.tokenDecimals = 8
            return
        }

        console.log("get collateral decimals")
        try {
            this.feedDecimals = await this.vault.methods.collateralDecimals().call()
        }
        catch(err) {
            this.feedDecimals = await this.vault.methods.priceSourceDecimals().call()            
        }
        console.log("get collateral")
        const tokenAddress = await this.vault.methods.collateral().call()

        const token = new this.web3.eth.Contract(Addresses.erc20Abi, tokenAddress)
        this.tokenDecimals = await token.methods.decimals().call()
    }

    async updateAllUsers() {
        const lastVault = await this.vault.methods.vaultCount().call()
        console.log({lastVault})

        const users = []
        for(let i = 0 ; i <= Number(lastVault) ; i++) {
            users.push(i)
        }

        const bulkSize = this.multicallSize
        for(let i = 0 ; i < users.length ; i+= bulkSize) {
            const start = i
            const end = i + bulkSize > users.length ? users.length : i + bulkSize
            console.log("update", i.toString() + " / " + users.length.toString())
            try {
                await this.updateUsers(users.slice(start, end))
            }
            catch(err) {
                console.log("update user failed, trying again", err)
                i -= bulkSize
            }
        }
    }

    async calcBadDebt(currTime) {
        this.sumOfBadDebt = this.web3.utils.toBN("0")
        let deposits = this.web3.utils.toBN("0")
        let borrows = this.web3.utils.toBN("0")
        let tvl = this.web3.utils.toBN("0")

        const userWithBadDebt = []

        //console.log(this.users)
        const users = Object.keys(this.userCollateral)
        for(const user of users) {
            const debt = toBN(this.userDebt[Number(user)])

            const decimalsFactor = toBN("10").pow(toBN(18 - this.tokenDecimals))
            const priceFeedDecimalsFactor = toBN(10).pow(toBN(this.feedDecimals))

            const collateralValue = toBN(this.userCollateral[user]).mul(toBN(this.price)).mul(decimalsFactor).div(priceFeedDecimalsFactor)
            //console.log(user.toString() + ")", fromWei(collateralValue), this.price.toString(), this.userCollateral[user])

            if(collateralValue.lt(debt)) {
                this.sumOfBadDebt = this.sumOfBadDebt.add(collateralValue.sub(debt))
                userWithBadDebt.push({"user" : user, "badDebt" : (collateralValue.sub(debt)).toString()})
            }
            
            tvl = tvl.add(collateralValue)
            deposits = deposits.add(collateralValue)
            borrows = borrows.add(debt)
        }

        this.tvl = tvl

        this.output = { "total" :  this.sumOfBadDebt.toString(), "updated" : currTime.toString(), "decimals" : "18", "users" : userWithBadDebt,
                        "tvl" : this.tvl.toString(), "deposits" : deposits.toString(), "borrows" : borrows.toString(),
                        "calculatedBorrows" : this.totalBorrows.toString(),
                        "name" : this.name}

        console.log(JSON.stringify(this.output))

        console.log("total bad debt", this.sumOfBadDebt.toString(), {currTime})

        return this.sumOfBadDebt
    }

    async updateUsers(users) {
        console.log("updateUsers")
        // need to get: 1) urns
        const collateralCalls = []
        const debtCalls = []
        for(let i of users) {
            const colCall = {}
            colCall["target"] = this.vault.options.address
            colCall["callData"] = this.vault.methods.vaultCollateral(i).encodeABI()
            collateralCalls.push(colCall)


            const debCall = {}
            debCall["target"] = this.vault.options.address
            debCall["callData"] = this.vault.methods.vaultDebt(i).encodeABI()
            debtCalls.push(debCall)
        }

        console.log("getting collateral data")
        const colCallResults = await this.multicall.methods.tryAggregate(false, collateralCalls).call()
        console.log("getting debt data")
        const debtCallResults = await this.multicall.methods.tryAggregate(false, debtCalls).call()        

        for(let i = 0 ; i < users.length ; i++) {
            const col = this.web3.eth.abi.decodeParameter("uint256", colCallResults[i].returnData)
            const debt = this.web3.eth.abi.decodeParameter("uint256", debtCallResults[i].returnData)            

            this.userCollateral[users[i]] = col
            this.userDebt[users[i]] = debt
        }
    }
  }

module.exports = MaiParser

async function test() {
    //ckey_2d9319e5566c4c63b7b62ccf862"

    const web3 = new Web3("https://polygon-rpc.com")

    const maiInfo = {
        "multicallSize" : 1000,
        "address" : "0xa3Fa99A148fA48D14Ed51d610c367C61876997F1"
    }

    const addresses = [
        "0xa3fa99a148fa48d14ed51d610c367c61876997f1",
        "0x3fd939B017b31eaADF9ae50C7fF7Fa5c0661d47C",
        "0x61167073E31b1DAd85a3E531211c7B8F1E5cAE72",
        "0x87ee36f780ae843A78D5735867bc1c13792b7b11",
        "0x98B5F32dd9670191568b661a3e847Ed764943875",
        "0x701A1824e5574B0b6b1c8dA808B184a7AB7A2867",
        "0x649Aa6E6b6194250C077DF4fB37c23EE6c098513",
        "0x37131aEDd3da288467B6EBe9A77C523A700E6Ca1",
        "0xF086dEdf6a89e7B16145b03a6CB0C0a9979F1433",         
        "0x88d84a85A87ED12B8f098e8953B322fF789fCD1a",
        "0x11A33631a5B5349AF3F165d2B7901A4d67e561ad",
        "0x578375c3af7d61586c2C3A7BA87d2eEd640EFA40",
        "0x7dda5e1a389e0c1892caf55940f5fce6588a9ae0",
        "0xD2FE44055b5C874feE029119f70336447c8e8827",
        "0x57cbf36788113237d64e46f25a88855c3dff1691",
        "0xff2c44fb819757225a176e825255a01b3b8bb051",        
        "0x7CbF49E4214C7200AF986bc4aACF7bc79dd9C19a",        
        "0x506533B9C16eE2472A6BF37cc320aE45a0a24F11",        
        "0x7d36999a69f2b99bf3fb98866cbbe47af43696c8",
        "0x1f0aa72b980d65518e88841ba1da075bd43fa933",
        "0x178f1c95c85fe7221c7a6a3d6f12b7da3253eeae",
        "0x305f113ff78255d4f8524c8f50c7300b91b10f6a",
        "0x1dcc1f864a4bd0b8f4ad33594b758b68e9fa872c",
        "0xaa19d0e397c964a35e6e80262c692dbfc9c23451",
        "0x11826d20b6a16a22450978642404da95b4640123",
        "0xa3b0A659f2147D77A443f70D96b3cC95E7A26390",
        "0x7d75F83f0aBe2Ece0b9Daf41CCeDdF38Cb66146b",
        "0x9A05b116b56304F5f4B3F1D5DA4641bFfFfae6Ab",        
        "0xF1104493eC315aF2cb52f0c19605443334928D38",
        "0x3bcbAC61456c9C9582132D1493A00E318EA9C122",
        "0xb1f28350539b06d5a35d016908eef0424bd13c4b"
    ]

    let badDebt = 0.0

    for(const addr of addresses) {
        maiInfo["address"] = addr

        console.log({maiInfo})

        const mai = new MaiParser(maiInfo, "MATIC", web3)
        badDebt += await mai.main(true)

        console.log({badDebt})    
    }

 }

test()
