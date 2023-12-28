const Web3 = require('web3')
const { toBN, toWei, fromWei } = Web3.utils
const axios = require('axios')
const Addresses = require("./Addresses.js")
const { getPrice, getEthPrice, getCTokenPriceFromZapper } = require('./priceFetcher')
const User = require("./User.js")
const {waitForCpuToGoBelowThreshold} = require("../machineResources")
const {retry} = require("../utils")


const _1e18 = toBN("10").pow(toBN("18"))
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

class MorphoFlagship {
    /**
     * build a compound parser
     * @param {*} morphoInfo addresses and other informations about the morpho vault
     * @param {string} network the name of the network, must be the same as in the indexkey in compoundInfo
     * @param {Web3} web3 web3 connector
     * @param {number} heavyUpdateInterval defines the amount of fetch between two heavy updates
     * @param {number} fetchDelayInHours defines the delay between 2 fetch, in hours
     */
    constructor(morphoInfo, network, web3, heavyUpdateInterval = 24, fetchDelayInHours = 1) {
      this.web3 = web3
      this.network = network
      this.vault = new web3.eth.Contract(Addresses.metaMorphoAbi, morphoInfo[network].vaultAddress)

      this.multicall = new web3.eth.Contract(Addresses.multicallAbi, Addresses.multicallAddress[network])
      this.usdcAddress = Addresses.usdcAddress[network]
      this.deployBlock = morphoInfo[network].deployBlock
      this.blockStepInInit = morphoInfo[network].blockStepInInit
      this.multicallSize = morphoInfo[network].multicallSize

      this.prices = {}
      this.markets = []
      this.marketData = {}
      this.users = {}
      this.userList = []

      this.sumOfBadDebt = web3.utils.toBN("0")
      this.lastUpdateBlock = 0

      this.mainCntr = 0
      this.usdcDecimals = 6
      this.heavyUpdateInterval = heavyUpdateInterval

      this.tvl = toBN("0")
      this.totalBorrows = toBN("0")
      this.totalSupply = toBN("0")      
      this.totalCollateral = toBN("0")

      this.output = {}
      this.fetchDelayInHours = fetchDelayInHours
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

        setTimeout(this.main.bind(this), this.fetchDelayInHours * 3600 * 1000) // sleep for 'this.fetchDelayInHours' hour
    }

    async getFallbackPrice(market) {
        return toBN("0") // todo - override in each market
    }

    async initPrices() {
        console.log("get markets")

        console.log("getting blue address")
        const blue = new this.web3.eth.Contract(Addresses.morphoBlueAbi, await this.vault.methods.MORPHO().call())
        this.blue = blue      

        console.log("get withdrawal queue length")
        const queueLen = await this.vault.methods.withdrawQueueLength().call()

        console.log({queueLen})

        const markets = []

        for(let q = 0 ; q < queueLen ; q++) {
            console.log("getting q id")
            const id = await this.vault.methods.withdrawQueue(q).call()
            console.log({id})

            markets.push(id)
        }

        this.markets = markets

        let totalBorrows = toBN("0")
        let totalSupply = toBN("0")

        for(const market of this.markets) {
            let price
            let borrows
            let supply
            console.log("getting market params", {market})
            const marketParams = await blue.methods.idToMarketParams(market).call()
            console.log({marketParams})
            price = this.prices[marketParams.loanToken] = await getPrice(this.network, marketParams.loanToken, this.web3)

            if(marketParams.collateralToken !== ZERO_ADDRESS) {
                this.prices[marketParams.collateralToken] = await getPrice(this.network, marketParams.collateralToken, this.web3)
            }
            else {
                this.prices[ZERO_ADDRESS] = toBN("1")
            }

            console.log("calling market")
            const marketInfo = await blue.methods.market(market).call()

            supply = marketInfo.totalSupplyAssets
            borrows = marketInfo.totalBorrowAssets

            this.marketData[market] = {
                "loanToken" : marketParams.loanToken,
                "collateralToken" : marketParams.collateralToken,
                "totalSupply" : supply,
                "totalBorrow" : borrows,
                "totalSupplyShares" : marketInfo.totalSupplyShares,
                "totalBorrowShares" : marketInfo.totalBorrowShares,
            }

            totalBorrows = totalBorrows.add(  (toBN(borrows)).mul(toBN(price)).div(_1e18)  )
            totalSupply = totalSupply.add(  (toBN(supply)).mul(toBN(price)).div(_1e18)  )
        }

        this.totalBorrows = totalBorrows
        this.totalSupply = totalSupply        

        console.log("init prices: total supply ", fromWei(totalSupply.toString()), " total borrows ", fromWei(this.totalBorrows.toString()))
    }


    async getPastEventsInSteps(cToken, market, key, from, to){
        let totalEvents = []
        for (let i = from; i < to; i = i + this.blockStepInInit) {
            const fromBlock = i
            const toBlock = i + this.blockStepInInit > to ? to : i + this.blockStepInInit
            const fn = (...args) => cToken.getPastEvents(...args)
            const events = await retry(fn, [key, {filter: {id: market}, fromBlock, toBlock}])
            totalEvents = totalEvents.concat(events)
        }
        return totalEvents
    }

    async periodicUpdateUsers(lastUpdatedBlock) {
        const accountsToUpdate = []
        const currBlock = await this.web3.eth.getBlockNumber() - 10
        console.log({currBlock})

        const events = {"Supply" : ["onBehalf"],
                        "Withdraw" : ["onBehalf"],
                        "Borrow" : ["onBehalf"],
                        "Repay" : ["onBehalf"],
                        "SupplyCollateral" : ["onBehalf"],
                        "WithdrawCollateral" : ["onBehalf"],
                        "Liquidate" : ["borrower"] }

        for(const market of this.markets) {
            const keys = Object.keys(events)
            console.log({keys})
            for (const key of keys) {
                const value = events[key]
                console.log({key}, {value})
                const newEvents = await this.getPastEventsInSteps(this.blue, market, key, lastUpdatedBlock, currBlock) 
                for(const e of newEvents) {
                    console.log("printing event", {e})
                    for(const field of value) {
                        console.log({field})
                        const a = e.returnValues[field] + "_" + market.toString()
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
        for(const market of this.markets) {
            for(let startBlock = this.deployBlock ; startBlock < currBlock ; startBlock += this.blockStepInInit) {
                console.log({startBlock}, this.userList.length, this.blockStepInInit)

                const endBlock = (startBlock + this.blockStepInInit > currBlock) ? currBlock : startBlock + this.blockStepInInit
                let events1
                try {
                    // Try to run this code
                    console.log("get supply events")
                    events1 = await this.blue.getPastEvents("Supply", {filter: {id: market}, fromBlock: startBlock, toBlock:endBlock})
                }
                catch(err) {
                    // if any error, Code throws the error
                    console.log("call failed, trying again", err.toString())
                    startBlock -= this.blockStepInInit // try again
                    continue
                }

                let events2
                try {
                    // Try to run this code
                    console.log("get supply collateral events")                    
                    events2 = await this.blue.getPastEvents("SupplyCollateral", {filter: {id: market}, fromBlock: startBlock, toBlock:endBlock})
                }
                catch(err) {
                    // if any error, Code throws the error
                    console.log("call failed, trying again", err.toString())
                    startBlock -= this.blockStepInInit // try again
                    continue
                }

                const events = events1.concat(events2)

                for(const e of events) {
                    const a = e.returnValues.onBehalf + "_" + market.toString()
                    if(! this.userList.includes(a)) this.userList.push(a)
                }
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

        deposits = deposits.add(this.totalSupply)
        tvl = tvl.add(this.totalSupply)

        this.tvl = tvl

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
        const positionCall = []
        console.log("preparing position calls")
        for(const user of userAddresses) {
            //console.log({user})
            const address = user.split("_")[0]
            const id = user.split("_")[1]
            //console.log({address},{id})
            const call = {}
            call["target"] = this.blue.options.address
            call["callData"] = this.blue.methods.position(id, address).encodeABI()
            positionCall.push(call)
        }
        const positionResults = await this.multicall.methods.tryAggregate(false, positionCall).call()

        // init class for all users
        let userIndex = 0
        for(const user of userAddresses) {
            let success = true
            const id = user.split("_")[1]

            if(! positionResults[userIndex].success) success = false
            const position = this.web3.eth.abi.decodeParameters(
                ["uint256", "uint128", "uint128"],
                positionResults[userIndex].returnData
            )

            const supplyShares = position["0"]
            const borrowShares = position["1"]
            const collateral = position["2"]            
            userIndex++

            let borrow = 0
            if(toBN(borrowShares).gt(toBN("0"))) {
                borrow = toBN(this.marketData[id].totalBorrow).mul(toBN(borrowShares)).div(toBN(this.marketData[id].totalBorrowShares))
            }

            const loanToken = this.marketData[id].loanToken
            const collateralToken = this.marketData[id].collateralToken

            const borrowBalances = {}
            const collateralBalaces = {}

            borrowBalances[loanToken] = borrow
            borrowBalances[collateralToken] = toBN("0")

            collateralBalaces[loanToken] = toBN("0")
            collateralBalaces[collateralToken] = collateral

            const userData = new User(user, [loanToken, collateralToken], borrowBalances, collateralBalaces, ! success)
            this.users[user] = userData
        }
    }

    intersect(arr1, arr2) {
        const result = []
        for(const a of arr1) {
            if(arr2.includes(a)) result.push(a)
        }

        return result
    }
  }

module.exports = MorphoFlagship


const web3 = new Web3("https://goerli.infura.io/v3/XXX")
async function test() {
    const morphoInfo = {
        "GORELI" : {
            "vaultAddress" : "0xb6c383fF0257D20e4c9872B6c9F1ce412F4AAC4C",
            "deployBlock" : 10038133,
            "blockStepInInit" : 10_000,
            "multicallSize" : 100

        }

    }

    const morpho = new MorphoFlagship(morphoInfo, "GORELI", web3)        
    await morpho.main()
 }

 test()