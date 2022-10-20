const Web3 = require('web3')
const { toBN, toWei, fromWei } = Web3.utils
const axios = require('axios')
const Addresses = require("./Addresses.js")
const { getPrice, getEthPrice, getCTokenPriceFromZapper } = require('./priceFetcher')
const User = require("./User.js")
const {waitForCpuToGoBelowThreshold} = require("../machineResources")

/**
 * a small retry wrapper with an incrameting 5s sleep delay
 * @param {*} fn 
 * @param {*} params 
 * @param {*} retries 
 * @returns 
 */
async function retry(fn, params, retries = 0) {
    try {
        const res = await  fn(...params)
        if(retries){
            console.log(`retry success after ${retries} retries`)
        } else {
            console.log(`success on first try`)
        }
        return res
    } catch (e) {
        console.error(e)
        retries++
        console.log(`retry #${retries}`)
        await new Promise(resolve => setTimeout(resolve, 1000 * 5 * retries))
        return retry(fn, params, retries)
    }
}

class Compound {
    constructor(compoundInfo, network, web3, heavyUpdateInterval = 24) {
      this.web3 = web3
      this.network = network
      this.comptroller = new web3.eth.Contract(Addresses.comptrollerAbi, compoundInfo[network].comptroller)

      this.cETHAddresses = [compoundInfo[network].cETH]
      if(compoundInfo[network].cETH2) this.cETHAddresses.push(compoundInfo[network].cETH2)

      this.nonBorrowableMarkets = []
      if(compoundInfo[network].nonBorrowableMarkets) this.nonBorrowableMarkets = compoundInfo[network].nonBorrowableMarkets

      this.rektMarkets = []
      if(compoundInfo[network].rektMarkets) this.rektMarkets = compoundInfo[network].rektMarkets

      this.priceOracle = new web3.eth.Contract(Addresses.oneInchOracleAbi, Addresses.oneInchOracleAddress[network])
      this.multicall = new web3.eth.Contract(Addresses.multicallAbi, Addresses.multicallAddress[network])
      this.usdcAddress = Addresses.usdcAddress[network]
      this.deployBlock = compoundInfo[network].deployBlock
      this.blockStepInInit = compoundInfo[network].blockStepInInit
      this.multicallSize = compoundInfo[network].multicallSize

      this.prices = {}
      this.markets = []
      this.users = {}
      this.userList = []

      this.sumOfBadDebt = web3.utils.toBN("0")
      this.lastUpdateBlock = 0

      this.mainCntr = 0
      this.usdcDecimals = 6
      this.heavyUpdateInterval = heavyUpdateInterval

      this.tvl = toBN("0")
      this.totalBorrows = toBN("0")

      this.output = {}
    }

    async heavyUpdate() {
        const currBlock = await this.web3.eth.getBlockNumber() - 10
        const currTime = (await this.web3.eth.getBlock(currBlock)).timestamp        

        if(this.userList.length == 0) await this.collectAllUsers()
        await this.updateAllUsers()
    }

    async lightUpdate() {
        const currBlock = await this.web3.eth.getBlockNumber() - 10
        const currTime = (await this.web3.eth.getBlock(currBlock)).timestamp

        await this.periodicUpdateUsers(this.lastUpdateBlock)
        //await this.calcBadDebt(currTime) 
    }

    async main() {
        try {
            await waitForCpuToGoBelowThreshold()
            await this.initPrices()
                        
            const currBlock = await this.web3.eth.getBlockNumber() - 10
            const currTime = (await this.web3.eth.getBlock(currBlock)).timestamp

            const usdcContract = new this.web3.eth.Contract(Addresses.cTokenAbi, this.usdcAddress)
            this.usdcDecimals = Number(await usdcContract.methods.decimals().call())
            console.log("usdc decimals", this.usdcDecimals)
            if(this.mainCntr % this.heavyUpdateInterval == 0) {
                console.log("heavyUpdate start")
                await this.heavyUpdate()
                console.log('heavyUpdate success')
            } else {
                console.log("lightUpdate start")
                await this.lightUpdate()
                console.log('lightUpdate success')
            }
            console.log("calc bad debt")
            await this.calcBadDebt(currTime)
            
            this.lastUpdateBlock = currBlock

            // don't  increase cntr, this way if heavy update is needed, it will be done again next time
            console.log("sleeping", this.mainCntr++)
        }
        catch(err) {
            console.log("main failed", {err})
        }

        setTimeout(this.main.bind(this), 1000 * 60 * 60) // sleep for 1 hour
    }

    async getFallbackPrice(market) {
        return toBN("0") // todo - override in each market
    }

    async initPrices() {
        console.log("get markets")
        this.markets = await this.comptroller.methods.getAllMarkets().call()
        console.log(this.markets)

        let tvl = toBN("0")
        let totalBorrows = toBN("0")

        for(const market of this.markets) {
            let price
            let balance
            let borrows
            console.log({market})
            const ctoken = new this.web3.eth.Contract(Addresses.cTokenAbi, market)

            if(this.cETHAddresses.includes(market)) {
                price = await getEthPrice(this.network)
                balance = await this.web3.eth.getBalance(market)
            }
            else {
                console.log("getting underlying")
                const underlying = await ctoken.methods.underlying().call()
                price = await getPrice(this.network, underlying, this.web3)
                if(price.toString() == "0" && this.network === "ETH") {
                    console.log("trying with zapper")
                    price = await getCTokenPriceFromZapper(market, underlying, this.web3, this.network)
                }
                if(price.toString() === "0"){  // test and handle price is zero 
                    // we should not get here but if we do the process exits 
                    // & so bad debt will not be calulated without a real price
                    console.log({ 
                        underlying, 
                        price, 
                        message: "no price was obtained"
                    })

                }
                const token = new this.web3.eth.Contract(Addresses.cTokenAbi, underlying)
                balance = await token.methods.balanceOf(market).call()
            }

            if(price.toString() === "0") {
                price = await this.getFallbackPrice(market)
            }
            
            this.prices[market] = this.web3.utils.toBN(price)
            console.log(market, price.toString())

            if(this.nonBorrowableMarkets.includes(market)) {
                borrows = toBN("0")
            }
            else {
                borrows = await ctoken.methods.totalBorrows().call()
            }

            const _1e18 = toBN(toWei("1"))
            tvl = tvl.add(  (toBN(balance)).mul(toBN(price)).div(_1e18)  )
            totalBorrows = totalBorrows.add(  (toBN(borrows)).mul(toBN(price)).div(_1e18)  )
        }

        this.tvl = tvl
        this.totalBorrows = totalBorrows

        console.log("init prices: tvl ", fromWei(tvl.toString()), " total borrows ", fromWei(this.totalBorrows.toString()))
    }


    async getPastEventsInSteps(cToken, key, from, to){
        let totalEvents = []
        for (let i = from; i < to; i = i + this.blockStepInInit) {
            const fromBlock = i
            const toBlock = i + this.blockStepInInit > to ? to : i + this.blockStepInInit
            const fn = (...args) => cToken.getPastEvents(...args)
            const events = await retry(fn, [key, {fromBlock, toBlock}])
            totalEvents = totalEvents.concat(events)
        }
        return totalEvents
    }

    async periodicUpdateUsers(lastUpdatedBlock) {
        const accountsToUpdate = []
        const currBlock = await this.web3.eth.getBlockNumber() - 10
        console.log({currBlock})

        const events = {"Mint" : ["minter"],
                        "Redeem" : ["redeemer"],
                        "Borrow" : ["borrower"],
                        "RepayBorrow" : ["borrower"],
                        "LiquidateBorrow" : ["liquidator","borrower"],
                        "Transfer" : ["from", "to"] }

        for(const market of this.markets) {
            const ctoken = new this.web3.eth.Contract(Addresses.cTokenAbi, market)
            const keys = Object.keys(events)
            console.log({keys})
            for (const key of keys) {
                const value = events[key]
                console.log({key}, {value})
                const newEvents = await this.getPastEventsInSteps(ctoken, key, lastUpdatedBlock, currBlock) 
                for(const e of newEvents) {
                    for(const field of value) {
                        console.log({field})
                        const a = e.returnValues[field]
                        console.log({a})
                        if(! accountsToUpdate.includes(a)) accountsToUpdate.push(a)
                    }
                }
            }
        }

        console.log({accountsToUpdate})
        for(const a of accountsToUpdate) {
            if(! this.userList.includes(a)) this.userList.push(a)            
        }
        // updating users in slices
        const bulkSize = this.multicallSize
        for (let i = 0; i < accountsToUpdate.length; i = i + bulkSize) {
            const to = i + bulkSize > accountsToUpdate.length ? accountsToUpdate.length : i + bulkSize
            const slice = accountsToUpdate.slice(i, to)
            const fn = (...args) => this.updateUsers(...args)
            await retry(fn, [slice])
        }
    }

    async collectAllUsers() {
        const currBlock = await this.web3.eth.getBlockNumber() - 10
        console.log({currBlock})
        for(let startBlock = this.deployBlock ; startBlock < currBlock ; startBlock += this.blockStepInInit) {
            console.log({startBlock}, this.userList.length, this.blockStepInInit)

            const endBlock = (startBlock + this.blockStepInInit > currBlock) ? currBlock : startBlock + this.blockStepInInit
            let events
            try {
                // Try to run this code
                events = await this.comptroller.getPastEvents("MarketEntered", {fromBlock: startBlock, toBlock:endBlock})
            }
            catch(err) {
                // if any error, Code throws the error
                console.log("call failed, trying again", err.toString())
                startBlock -= this.blockStepInInit // try again
                continue
            }
            for(const e of events) {
                const a = e.returnValues.account
                if(! this.userList.includes(a)) this.userList.push(a)
            }
        }
    }

    async updateAllUsers() {
        const users = this.userList //require('./my.json')
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

    async additionalCollateralBalance(userAddress) {
        return this.web3.utils.toBN("0")
    }

    async calcBadDebt(currTime) {
        this.sumOfBadDebt = this.web3.utils.toBN("0")
        let deposits = this.web3.utils.toBN("0")
        let borrows = this.web3.utils.toBN("0")
        let tvl = this.web3.utils.toBN("0")

        const userWithBadDebt = []
        
        for(const [user, data] of Object.entries(this.users)) {

            const userData = new User(user, data.marketsIn, data.borrowBalance, data.collateralBalace, data.error)
            //console.log({user})
            const additionalCollateral = await this.additionalCollateralBalance(user)
            const userValue = userData.getUserNetValue(this.web3, this.prices)

            //console.log("XXX", user, userValue.collateral.toString(), additionalCollateral.toString())
            deposits = deposits.add(userValue.collateral).add(additionalCollateral)
            borrows = borrows.add(userValue.debt)

            const netValue = this.web3.utils.toBN(userValue.netValue).add(additionalCollateral)
            tvl = tvl.add(netValue).add(additionalCollateral)

            if(this.web3.utils.toBN(netValue).lt(this.web3.utils.toBN("0"))) {
                //const result = await this.comptroller.methods.getAccountLiquidity(user).call()
                console.log("bad debt for user", user, Number(netValue.toString())/1e6/*, {result}*/)
                this.sumOfBadDebt = this.sumOfBadDebt.add(this.web3.utils.toBN(netValue))

                console.log("total bad debt", Number(this.sumOfBadDebt.toString()) / 1e6)
                
                userWithBadDebt.push({"user" : user, "badDebt" : netValue.toString()})
            }
        }

        this.output = { "total" :  this.sumOfBadDebt.toString(), "updated" : currTime.toString(), "decimals" : "18", "users" : userWithBadDebt,
                        "tvl" : this.tvl.toString(), "deposits" : deposits.toString(), "borrows" : borrows.toString(),
                        "calculatedBorrows" : this.totalBorrows.toString()}

        console.log(JSON.stringify(this.output))

        console.log("total bad debt", this.sumOfBadDebt.toString(), {currTime})

        return this.sumOfBadDebt
    }

    async updateUsers(userAddresses) {
        // need to get: 1) user in market 2) user collateral in all markets 3) user borrow balance in all markets
        
        // market in
        const assetInCalls = []
        console.log("preparing asset in calls")
        for(const user of userAddresses) {
            const call = {}
            call["target"] = this.comptroller.options.address
            call["callData"] = this.comptroller.methods.getAssetsIn(user).encodeABI()
            assetInCalls.push(call)
        }
        const assetInResult = await this.multicall.methods.tryAggregate(false, assetInCalls).call()

        const ctoken = new this.web3.eth.Contract(Addresses.cTokenAbi)
        
        // collateral balance
        const collateralBalanceCalls = []
        const borrowBalanceCalls = []
        for(const user of userAddresses) {
            for(const market of this.markets) {
                const collatCall = {}
                const borrowCall = {}
    
                collatCall["target"] = market
                borrowCall["target"] = market
                if(this.rektMarkets.includes(market)) {
                    // encode something that will return 0
                    collatCall["callData"] = ctoken.methods.balanceOf(market).encodeABI()
                }
                else {
                    collatCall["callData"] = ctoken.methods.balanceOfUnderlying(user).encodeABI()
                }
                if(this.nonBorrowableMarkets.includes(market)) {
                    // encode something that will return 0
                    borrowCall["callData"] = ctoken.methods.balanceOf(market).encodeABI()
                }
                else {
                    borrowCall["callData"] = ctoken.methods.borrowBalanceCurrent(user).encodeABI()
                }

                collateralBalanceCalls.push(collatCall)
                borrowBalanceCalls.push(borrowCall)
            }
        }

        console.log("getting collateral balances")
        const collateralBalaceResults = await this.multicall.methods.tryAggregate(false, collateralBalanceCalls).call()
        console.log("getting borrow balances")        
        const borrowBalanceResults = await this.multicall.methods.tryAggregate(false, borrowBalanceCalls).call()

        // init class for all users
        let userIndex = 0
        let globalIndex = 0
        for(const user of userAddresses) {
            let success = true
            if(! assetInResult[userIndex].success) success = false
            const assetsIn = this.web3.eth.abi.decodeParameter("address[]", assetInResult[userIndex].returnData)
            userIndex++

            const borrowBalances = {}
            const collateralBalances = {}
            for(const market of this.markets) {
                if(! collateralBalaceResults[globalIndex].success) success = false
                if(! borrowBalanceResults[globalIndex].success) success = false

                const colatBal = this.web3.eth.abi.decodeParameter("uint256", collateralBalaceResults[globalIndex].returnData)
                const borrowBal = this.web3.eth.abi.decodeParameter("uint256", borrowBalanceResults[globalIndex].returnData)

                borrowBalances[market] = this.web3.utils.toBN(borrowBal)
                collateralBalances[market] = this.web3.utils.toBN(colatBal)               

                globalIndex++
            }

            const userData = new User(user, assetsIn, borrowBalances, collateralBalances, ! success)
            this.users[user] = userData
        }
    }
  }

module.exports = Compound

/*
const Web3 = require("web3")



async function test() {
    //const comp = new Compound(Addresses.traderJoeAddress, "AVAX", web3)
    //const comp = new Compound(Addresses.ironBankAddress, "AVAX", web3)
    const comp = new Compound(Addresses.ironBankAddress, "ETH", web3)
    //const comp = new Compound(Addresses.venusAddress, "BSC", web3)

        
    await comp.main()
    //await comp.updateUsers(["0x6C09184c823CC246435d1287F0AA3948742830E0","0x16b134c44170d78e2f8cad567bb70462dbf05a04"])
    //await comp.collectAllUsers()
    //await comp.updateUsers(["0xb3fbE25Be2e8CA097e9ac924e94aF000DD3A5663"])
    //await comp.updateAllUsers()
    //await comp.periodicUpdate(14788673 - 1000)
    //await comp.calcBadDebt()
 }

 test()*/

