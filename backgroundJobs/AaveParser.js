const Web3 = require('web3')
const { toBN, toWei } = Web3.utils
const Addresses = require("./Addresses.js")
const { getPrice, getEthPrice, getCTokenPriceFromZapper } = require('./priceFetcher')
const User = require("./User.js")
const {waitForCpuToGoBelowThreshold} = require("../machineResources")
const {retry} = require("../utils")

class Aave {
    constructor(AaveInfo, network, web3, heavyUpdateInterval = 24) {
      this.web3 = web3
      this.network = network
      this.lendingPoolAddressesProvider = new web3.eth.Contract(Addresses.lendingPoolAddressesProviderAbi, AaveInfo[network].lendingPoolAddressesProviderAddress)

      this.multicall = new web3.eth.Contract(Addresses.multicallAbi, Addresses.multicallAddress[network])
      this.deployBlock = AaveInfo[network].deployBlock
      this.blockStepInInit = AaveInfo[network].blockStepInInit
      this.multicallSize = AaveInfo[network].multicallSize

      this.ethPrice = 0
      this.users = {}
      this.userList = []

      this.sumOfBadDebt = web3.utils.toBN("0")
      this.lastUpdateBlock = 0

      this.mainCntr = 0
      this.heavyUpdateInterval = heavyUpdateInterval

      this.tvl = toBN("0")
      this.totalBorrows = toBN("0")

      this.output = {}
    }

    async initPrices() {
        // init lending pool contract
        const lendingPoolAddress = await this.lendingPoolAddressesProvider.methods.getLendingPool().call()
        this.lendingPool = new this.web3.eth.Contract(Addresses.lendingPoolAbi, lendingPoolAddress)

        // get eth price
        this.ethPrice = await getEthPrice(this.network)
    }

    async heavyUpdate() {
        if(this.userList.length == 0) await this.collectAllUsers()
        await this.updateAllUsers()
    }

    async lightUpdate() {        
        await this.periodicUpdateUsers(this.lastUpdateBlock)
    }

    async main() {
        try {
            await waitForCpuToGoBelowThreshold()
            await this.initPrices()

            const currBlock = await this.web3.eth.getBlockNumber() - 10
            const currTime = (await this.web3.eth.getBlock(currBlock)).timestamp

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

    async getPastEventsInSteps(contract, key, from, to){
        let totalEvents = []
        for (let i = from; i < to; i = i + this.blockStepInInit) {
            const fromBlock = i
            const toBlock = i + this.blockStepInInit > to ? to : i + this.blockStepInInit
            const fn = (...args) => contract.getPastEvents(...args)
            const events = await retry(fn, [key, {fromBlock, toBlock}])
            totalEvents = totalEvents.concat(events)
        }
        return totalEvents
    }

    async periodicUpdateUsers(lastUpdatedBlock) {
        const accountsToUpdate = []
        const currBlock = await this.web3.eth.getBlockNumber() - 10
        console.log({currBlock})

        // we ignore atokens transfer, and catch it when doing the all users update
        const events = {"Deposit" : ["onBehalfOf"],
                        "Withdraw" : ["user"],        
                        "Borrow" : ["onBehalfOf"],
                        "Repay" : ["user"],
                        "LiquidationCall" : ["user", "liquidator"]}

        const keys = Object.keys(events)
        console.log({keys})
        for (const key of keys) {
            const value = events[key]
            console.log({key}, {value})
            const newEvents = await this.getPastEventsInSteps(this.lendingPool, key, lastUpdatedBlock, currBlock) 
            for(const e of newEvents) {
                for(const field of value) {
                    console.log({field})
                    const a = e.returnValues[field]
                    console.log({a})
                    if(! accountsToUpdate.includes(a)) accountsToUpdate.push(a)
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
        const currBlock = /*this.deployBlock + 5000 * 5 //*/ await this.web3.eth.getBlockNumber() - 10
        console.log({currBlock})
        for(let startBlock = this.deployBlock ; startBlock < currBlock ; startBlock += this.blockStepInInit) {
            console.log({startBlock}, this.userList.length, this.blockStepInInit)

            const endBlock = (startBlock + this.blockStepInInit > currBlock) ? currBlock : startBlock + this.blockStepInInit
            let events
            try {
                // Try to run this code
                events = await this.lendingPool.getPastEvents("Deposit", {fromBlock: startBlock, toBlock:endBlock})
            }
            catch(err) {
                // if any error, Code throws the error
                console.log("call failed, trying again", err.toString())
                startBlock -= this.blockStepInInit // try again
                continue
            }
            for(const e of events) {
                const a = e.returnValues.onBehalfOf
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
            const collateral = data.collateral.mul(toBN(this.ethPrice)).div(toBN(toWei("1")))
            const debt = data.debt.mul(toBN(this.ethPrice)).div(toBN(toWei("1")))

            deposits = deposits.add(collateral)
            borrows = borrows.add(debt)

            const netValue = collateral.sub(debt)
            tvl = tvl.add(netValue)

            if(this.web3.utils.toBN(netValue).lt(this.web3.utils.toBN("0"))) {
                //const result = await this.comptroller.methods.getAccountLiquidity(user).call()
                console.log("bad debt for user", user, Number(netValue.toString())/1e6/*, {result}*/)
                this.sumOfBadDebt = this.sumOfBadDebt.add(this.web3.utils.toBN(netValue))

                console.log("total bad debt", Number(this.sumOfBadDebt.toString()) / 1e6)
                
                userWithBadDebt.push({"user" : user, "badDebt" : netValue.toString()})
            }
        }

        this.tvl = tvl

        this.output = { "total" :  this.sumOfBadDebt.toString(), "updated" : currTime.toString(), "decimals" : "18", "users" : userWithBadDebt,
                        "tvl" : this.tvl.toString(), "deposits" : deposits.toString(), "borrows" : borrows.toString(),
                        "calculatedBorrows" : this.totalBorrows.toString()}

        console.log(JSON.stringify(this.output))

        console.log("total bad debt", this.sumOfBadDebt.toString(), {currTime})

        return this.sumOfBadDebt
    }

    async updateUsers(userAddresses) {
        // need to get: 1) getUserAccountData
        
        const getUserAccountCalls = []
        console.log("preparing getUserAccountCalls")
        for(const user of userAddresses) {
            const call = {}
            call["target"] = this.lendingPool.options.address
            call["callData"] = this.lendingPool.methods.getUserAccountData(user).encodeABI()
            getUserAccountCalls.push(call)
        }

        console.log("getting getUserAccountCalls")
        const getUserAccountResults = await this.multicall.methods.tryAggregate(false, getUserAccountCalls).call()

        for(let i = 0 ; i < userAddresses.length ; i++) {
            const user = userAddresses[i]
            const result = getUserAccountResults[i]

            /*
            uint256 totalCollateralETH,
            uint256 totalDebtETH,
            uint256 availableBorrowsETH,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor*/

            const paramType = ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"]
            const parsedResult = this.web3.eth.abi.decodeParameters(paramType,result.returnData)
            
            const collateral = parsedResult["0"]
            const debt = parsedResult["1"]

            this.users[user] = {"collateral" : toBN(collateral), "debt" : toBN(debt)}

            if(user === "0x4846AEe6d7C9f176F3F329E01A014c2794E21B92") console.log(collateral.toString(), debt.toString())
        }
    }
  }

module.exports = Aave
/*
async function test() {
    const web3 = new Web3("TODO")
    const aave = new Aave(Addresses.aaveAddress, "ETH", web3)
    await aave.main()
 }

 test()*/