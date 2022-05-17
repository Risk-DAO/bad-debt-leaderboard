const Addresses = require("./Addresses.js")

class User {
    constructor(marketsIn, borrowBalance, collateralBalace, error) {
        this.marketsIn = marketsIn
        this.borrowBalance = borrowBalance
        this.collateralBalace = collateralBalace
        this.error = error
    }

    getUserNetValue(web3, prices) {
        let netValue = web3.utils.toBN("0")
        const _1e18 = web3.utils.toBN(web3.utils.toWei("1"))

        for(const market of this.marketsIn) {
            const plus = web3.utils.toBN(this.collateralBalace[market]).mul(prices[market]).div(_1e18)
            const minus = web3.utils.toBN(this.borrowBalance[market]).mul(prices[market]).div(_1e18)
            netValue = netValue.add(plus).sub(minus)
            //console.log("asset", market, "plus", plus.toString(), "minus", minus.toString(), this.collateralBalace[market].toString(), 
            //this.borrowBalance[market].toString(), prices[market].toString())

            // ignore this account for now
            if(prices[market].toString() === web3.utils.toBN("0").toString()) return web3.utils.toBN("0")
        }

        return netValue
    }
}

class Compound {
    constructor(compoundInfo, network, web3) {
      this.web3 = web3
      this.network = network
      this.comptroller = new web3.eth.Contract(Addresses.comptrollerAbi, compoundInfo[network].comptroller)
      this.cETHAddress = compoundInfo[network].cETH
      this.priceOracle = new web3.eth.Contract(Addresses.oneInchOracleAbi, Addresses.oneInchOracleAddress[network])
      this.multicall = new web3.eth.Contract(Addresses.multicallAbi, Addresses.multicallAddress[network])
      this.usdcAddress = Addresses.usdcAddress[network]
      this.deployBlock = compoundInfo[network].deployBlock
      this.blockStepInInit = compoundInfo[network].blockStepInInit

      this.prices = {}
      this.markets = []
      this.users = {}
      this.userList = []

      this.sumOfBadDebt = web3.utils.toBN("0")
      this.lastUpdateBlock = 0

      this.mainCntr = 0
    }

    async heavyUpdate() {
        const currBlock = await this.web3.eth.getBlockNumber() - 10

        await this.initPrices()
        await this.collectAllUsers()
        await this.updateAllUsers()

        this.lastUpdateBlock = currBlock
    }

    async lightUpdate() {
        const currBlock = await this.web3.eth.getBlockNumber() - 10

        await this.periodicUpdateUsers(this.lastUpdateBlock)
        await this.calcBadDebt()

        this.lastUpdateBlock = currBlock
    }

    async main() {
        if(this.mainCntr % 24 == 0) await this.heavyUpdate()
        else await this.lightUpdate()

        console.log("calc bad debt")
        await this.calcBadDebt()
        
        console.log("sleeping", this.mainCntr++)

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
                const newEvents = await ctoken.getPastEvents(key, {fromBlock: lastUpdatedBlock, toBlock:currBlock})
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

        await this.updateUsers(accountsToUpdate)
    }

    async collectAllUsers() {
        const currBlock = await this.web3.eth.getBlockNumber() - 10
        console.log({currBlock})
        for(let startBlock = this.deployBlock ; startBlock < currBlock ; startBlock += this.blockStepInInit) {
            console.log({startBlock}, this.userList.length)

            const endBlock = (startBlock + this.blockStepInInit > currBlock) ? currBlock : startBlock + this.blockStepInInit
            const events = await this.comptroller.getPastEvents("MarketEntered", {fromBlock: startBlock, toBlock:endBlock})
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
        const bulkSize = 500
        for(let i = 0 ; i < users.length ; i+= bulkSize) {
            const start = i
            const end = i + bulkSize > users.length ? users.length : i + bulkSize
            console.log("update", i)
            await this.updateUsers(users.slice(start, end))
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

    async calcBadDebt() {
        // reset bad debt
        this.sumOfBadDebt = this.web3.utils.toBN("0")
        //this.users = require('./users.json')
        //await this.updateUsers(["0xEaD38EC4220729bad12ec8A51E823b8BEBE0423E"])
        //console.log(this.users["0xEaD38EC4220729bad12ec8A51E823b8BEBE0423E"])
        
        for(const [user, data] of Object.entries(this.users)) {
            //if(user !== "0xEaD38EC4220729bad12ec8A51E823b8BEBE0423E") continue
            //console.log({user})
            //console.log(this.users[user])
            //const data = this.users[user]
            const userData = new User(data.marketsIn, data.borrowBalance, data.collateralBalace, data.error)
            //console.log({user})
            const netValue = userData.getUserNetValue(web3, this.prices)
            if(this.web3.utils.toBN(netValue).lt(this.web3.utils.toBN("0"))) {
                const result = await this.comptroller.methods.getAccountLiquidity(user).call()
                console.log("bad debt for user", user, Number(netValue.toString())/1e6, {result})
                this.sumOfBadDebt = this.sumOfBadDebt.add(this.web3.utils.toBN(netValue), userData)

                console.log("total bad debt", Number(this.sumOfBadDebt.toString()) / 1e6)
                //sd
            }
        }

        console.log("total bad debt", this.sumOfBadDebt.toString())

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

            const userData = new User(assetsIn, borrowBalances, collateralBalances, ! success)
            this.users[user] = userData
        }
    }
  }



async function test() {
    const comp = new Compound(Addresses.rariTetranodeAddress, "ETH", web3)
    await comp.main()
    //await comp.updateUsers(["0x6C09184c823CC246435d1287F0AA3948742830E0","0x16b134c44170d78e2f8cad567bb70462dbf05a04"])
    //await comp.collectAllUsers()
    //await comp.updateUsers(["0xb3fbE25Be2e8CA097e9ac924e94aF000DD3A5663"])
    //await comp.updateAllUsers()
    //await comp.periodicUpdate(14788673 - 1000)
    //await comp.calcBadDebt()
 }

 test()