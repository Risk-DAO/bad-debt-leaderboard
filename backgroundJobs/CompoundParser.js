const Addresses = require("./Addresses.js")

class User {
    constructor(user, marketsIn, borrowBalance, collateralBalace, error) {
        this.marketsIn = marketsIn
        this.borrowBalance = borrowBalance
        this.collateralBalace = collateralBalace
        this.error = error
        this.user = user
    }

    getUserNetValue(web3, prices) {
        //console.log(this.user, this.error, this.marketsIn, this.collateralBalace, this.prices)

        let netValue = web3.utils.toBN("0")
        const _1e18 = web3.utils.toBN(web3.utils.toWei("1"))

        for(const market of this.marketsIn) {
            // ignore the account if no price or no collateral/debt values
            // in IB there are assets that no longer appear in the market assets. but are part of asset in (go figure...)
            if(this.collateralBalace[market] === undefined ||
                prices[market].toString() === web3.utils.toBN("0").toString() ||
                this.borrowBalance[market] === undefined ) return web3.utils.toBN("0")
            const plus = web3.utils.toBN(this.collateralBalace[market]).mul(prices[market]).div(_1e18)
            const minus = web3.utils.toBN(this.borrowBalance[market]).mul(prices[market]).div(_1e18)
            netValue = netValue.add(plus).sub(minus)
            //console.log("asset", market, "plus", plus.toString(), "minus", minus.toString(), this.collateralBalace[market].toString(), 
            //this.borrowBalance[market].toString(), prices[market].toString())

        }

        return netValue
    }
}

class Compound {
    constructor(compoundInfo, network, web3, heavyUpdateInterval = 24) {
      this.web3 = web3
      this.network = network
      this.comptroller = new web3.eth.Contract(Addresses.comptrollerAbi, compoundInfo[network].comptroller)
      this.cETHAddress = compoundInfo[network].cETH
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

      this.output = {}
    }

    async heavyUpdate() {
        const currBlock = await this.web3.eth.getBlockNumber() - 10
        const currTime = (await this.web3.eth.getBlock(currBlock)).timestamp        

        await this.initPrices()
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
            const currBlock = await this.web3.eth.getBlockNumber() - 10
            const currTime = (await this.web3.eth.getBlock(currBlock)).timestamp

            const usdcContract = new this.web3.eth.Contract(Addresses.cTokenAbi, this.usdcAddress)
            this.usdcDecimals = Number(await usdcContract.methods.decimals().call())
            console.log("usdc decimals", this.usdcDecimals)
            if(this.mainCntr % this.heavyUpdateInterval == 0) await this.heavyUpdate()
            else await this.lightUpdate()


            console.log("calc bad debt")
            await this.calcBadDebt(currTime)

            // don't  increase cntr, this way if heavy update is needed, it will be done again next time
            console.log("sleeping", this.mainCntr++)
        }
        catch(err) {
            console.log("main failed", {err})
        }

        setTimeout(this.main.bind(this), 1000 * 60 * 60) // sleep for 1 hour
    }

    async initPrices() {
        console.log("get markets")
        this.markets = await this.comptroller.methods.getAllMarkets().call()
        console.log(this.markets)

        for(const market of this.markets) {
            let price
            if(this.web3.utils.toChecksumAddress(market) === this.web3.utils.toChecksumAddress(this.cETHAddress)) {
                price = await this.priceOracle.methods.getRateToEth(this.usdcAddress, false).call()
                price = (this.web3.utils.toBN("10")).pow(this.web3.utils.toBN(36)).div(this.web3.utils.toBN(price))
            }
            else {
                const ctoken = new this.web3.eth.Contract(Addresses.cTokenAbi, market)
                console.log("getting underlying")
                const underlying = await ctoken.methods.underlying().call()
                if(this.web3.utils.toChecksumAddress(underlying) === this.web3.utils.toChecksumAddress(this.usdcAddress)) {
                    price = this.web3.utils.toWei("1")
                }
                else {
                    price = await this.priceOracle.methods.getRate(underlying, this.usdcAddress, false).call()
                }
            }

            this.prices[market] = this.web3.utils.toBN(price)
            console.log(market, price.toString())
        }
    }

    async getPastEventsInSteps(cToken, key, from, to){
        let totalEvents = []
        for (let i = from; i < to; i = i + this.blockStepInInit) {
            const fromBlock = i
            const toBlock = i + this.blockStepInInit > to ? to : i + this.blockStepInInit
            const events = await cToken.getPastEvents(key, {fromBlock, toBlock})
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
        for (let i = 0; i < accountsToUpdate.length; i = i + 10) {
            const to = i + 10 > accountsToUpdate.length ? accountsToUpdate.length : i + 10
            const slice = accountsToUpdate.slice(i, to)
            await this.updateUsers(slice)
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
        /*
        require('fs').writeFile(

            './my.json',
        
            JSON.stringify(this.userList),
        
            function (err) {
                if (err) {
                    console.error('Crap happens');
                }
            }
        );*/        
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
        /*
        require('fs').writeFile(

            './users.json',
        
            JSON.stringify(this.users),
        
            function (err) {
                if (err) {
                    console.error('Crap happens');
                }
            }
        );*/        
    }

    async calcBadDebt(currTime) {
        this.sumOfBadDebt = this.web3.utils.toBN("0")

        const userWithBadDebt = []
        
        for(const [user, data] of Object.entries(this.users)) {

            const userData = new User(user, data.marketsIn, data.borrowBalance, data.collateralBalace, data.error)
            //console.log({user})
            const netValue = userData.getUserNetValue(this.web3, this.prices)
            if(this.web3.utils.toBN(netValue).lt(this.web3.utils.toBN("0"))) {
                //const result = await this.comptroller.methods.getAccountLiquidity(user).call()
                console.log("bad debt for user", user, Number(netValue.toString())/1e6/*, {result}*/)
                this.sumOfBadDebt = this.sumOfBadDebt.add(this.web3.utils.toBN(netValue), userData)

                console.log("total bad debt", Number(this.sumOfBadDebt.toString()) / 1e6)
                
                userWithBadDebt.push({"user" : user, "badDebt" : netValue.toString()})
            }
        }

        this.output = { "total" :  this.sumOfBadDebt.toString(), "updated" : currTime.toString(), "decimals" : this.usdcDecimals.toString(), "users" : userWithBadDebt }

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
                collatCall["callData"] = ctoken.methods.balanceOfUnderlying(user).encodeABI()
                borrowCall["callData"] = ctoken.methods.borrowBalanceCurrent(user).encodeABI()

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