const Web3 = require('web3')
const { toBN, toWei, fromWei } = Web3.utils
const axios = require('axios')
const Addresses = require("./Addresses.js")
const { getPrice, getEthPrice, getCTokenPriceFromZapper } = require('./priceFetcher')
const User = require("./User.js")
const {waitForCpuToGoBelowThreshold} = require("../machineResources")
const {retry} = require("../utils")

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

class CompoundV3 {
    /**
     * build a compoundV3 parser
     * @param {*} compoundInfo addresses and other informations about the protocol
     * @param {string} network the name of the network, must be the same as in the indexkey in compoundInfo
     * @param {Web3} web3 web3 connector
     * @param {number} heavyUpdateInterval defines the amount of fetch between two heavy updates
     * @param {number} fetchDelayInHours defines the delay between 2 fetch, in hours
     */
    constructor(compoundInfo, network, web3, heavyUpdateInterval = 24, fetchDelayInHours = 1) {
      this.web3 = web3
      this.network = network
      this.comet = new web3.eth.Contract(Addresses.cometAbi, compoundInfo.comet)

      this.nonBorrowableMarkets = []
      if(compoundInfo.nonBorrowableMarkets) this.nonBorrowableMarkets = compoundInfo.nonBorrowableMarkets

      this.rektMarkets = []
      if(compoundInfo.rektMarkets) this.rektMarkets = compoundInfo.rektMarkets

      this.priceOracle = new web3.eth.Contract(Addresses.oneInchOracleAbi, Addresses.oneInchOracleAddress[network])
      this.multicall = new web3.eth.Contract(Addresses.multicallAbi, Addresses.multicallAddress[network])
      this.usdcAddress = Addresses.usdcAddress[network]
      this.deployBlock = compoundInfo.deployBlock
      this.blockStepInInit = compoundInfo.blockStepInInit
      this.multicallSize = compoundInfo.multicallSize

      this.prices = {}
      this.baseTokenAddress = "0x0"
      this.numAssets = 0
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

        // reset the markets otherwise we will always news markets added
        // (as duplicate) to the array each times we init prices (every hours)
        this.markets = [];

        // Add base token to markets
        this.baseTokenAddress = await this.comet.methods.baseToken().call()
        this.markets.push(this.baseTokenAddress)

        this.numAssets = await this.comet.methods.numAssets().call()

        for(let i = 0 ; i < this.numAssets; i++) {
            const assetInfo = await this.comet.methods.getAssetInfo(i).call()
            this.markets.push(assetInfo.asset)
        }
        console.log(this.markets)

        let tvl = toBN("0")
        let totalBorrows = toBN("0")

        for(const market of this.markets) {
            let price
            let balance
            let borrows
            console.log({market})

            if(false && this.cETHAddresses.includes(market)) { // V3 works with weth, no need for special eth handling
                price = await getEthPrice(this.network)
                balance = await this.web3.eth.getBalance(market)
            }
            else {
                console.log("getting underlying")
                const underlying = market
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
                balance = await token.methods.balanceOf(this.comet._address).call()
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
                if (market == this.baseTokenAddress) {
                    borrows = await this.comet.methods.totalBorrow().call()
                } else {
                    borrows = toBN("0")
                }
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

        const events = {"Supply" : ["dst"],
                        "Withdraw" : ["src"],
                        "SupplyCollateral" : ["dst"],
                        "TransferCollateral" : ["from", "to"],
                        "WithdrawCollateral" : ["src"],
                        "Transfer" : ["from", "to"] }

        for(const market of this.markets) {
            const keys = Object.keys(events)
            console.log({keys})
            for (const key of keys) {
                const value = events[key]
                console.log({key}, {value})
                const newEvents = await this.getPastEventsInSteps(this.comet, key, lastUpdatedBlock, currBlock)
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
        const eventTypes = [{"Transfer" : ["from"]}, {"Withdraw" : ["src"] }]

        const currBlock = await this.web3.eth.getBlockNumber() - 10
        console.log({currBlock})
        for(let startBlock = this.deployBlock ; startBlock < currBlock ; startBlock += this.blockStepInInit) {
            console.log({startBlock}, this.userList.length, this.blockStepInInit)

            for (const t of eventTypes) {

                const endBlock = (startBlock + this.blockStepInInit > currBlock) ? currBlock : startBlock + this.blockStepInInit
                let events
                try {
                    // Try to run this code
                    events = await this.comet.getPastEvents(Object.keys(t)[0], {
                        fromBlock: startBlock,
                        toBlock: endBlock
                    })
                } catch (err) {
                    // if any error, Code throws the error
                    console.log("call failed, trying again", err.toString())
                    startBlock -= this.blockStepInInit // try again
                    continue
                }
                for (const e of events) {
                    const a = e.returnValues[Object.values(t)[0]]
                    if (!this.userList.includes(a)) this.userList.push(a)
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

        this.output = { "total" :  this.sumOfBadDebt.toString(), "updated" : currTime.toString(), "decimals" : "18", "users" : userWithBadDebt,
                        "tvl" : this.tvl.toString(), "deposits" : deposits.toString(), "borrows" : borrows.toString(),
                        "calculatedBorrows" : this.totalBorrows.toString()}

        console.log(JSON.stringify(this.output))

        console.log("total bad debt", this.sumOfBadDebt.toString(), {currTime})

        return this.sumOfBadDebt
    }

    async updateUsers(userAddresses) {
        // need to get: 1) user in market 2) user collateral in all markets 3) user borrow balance in all markets

        // collateral balance
        const collateralBalanceCalls = []
        const borrowBalanceCalls = []
        for(const user of userAddresses) {
            for(const market of this.markets) {
                const collatCall = {}
                const borrowCall = {}
    
                collatCall["target"] = this.comet._address
                borrowCall["target"] = this.comet._address
                if(market == this.baseTokenAddress || this.rektMarkets.includes(market)) {
                    // encode something that will return 0
                    collatCall["callData"] = this.comet.methods.userCollateral(ZERO_ADDRESS, market).encodeABI()
                }
                else {
                    collatCall["callData"] = this.comet.methods.userCollateral(user, market).encodeABI() // TODO: need to figure out if and how to use scale
                }
                if(market != this.baseTokenAddress || this.nonBorrowableMarkets.includes(market)) {
                    // encode something that will return 0
                    borrowCall["callData"] = this.comet.methods.borrowBalanceOf(ZERO_ADDRESS).encodeABI()
                }
                else {
                    borrowCall["callData"] = this.comet.methods.borrowBalanceOf(user).encodeABI()
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
        let globalIndex = 0
        for(const user of userAddresses) {
            let success = true

            const borrowBalances = {}
            const collateralBalances = {}
            for(const market of this.markets) {
                if(! collateralBalaceResults[globalIndex].success) success = false
                if(! borrowBalanceResults[globalIndex].success) success = false

                const colatBalRet = this.web3.eth.abi.decodeParameters(["uint128", "uint128"], collateralBalaceResults[globalIndex].returnData)
                const borrowBal = this.web3.eth.abi.decodeParameter("uint256", borrowBalanceResults[globalIndex].returnData)

                borrowBalances[market] = this.web3.utils.toBN(borrowBal)
                collateralBalances[market] = this.web3.utils.toBN(colatBalRet[0])

                globalIndex++
            }

            // As opposed to V2, here we always return all of this.markets (which already contains only numAssets)
            const userData = new User(user, this.markets, borrowBalances, collateralBalances, ! success)
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

module.exports = CompoundV3


// const Web3 = require("web3")



async function test() {
    //const comp = new Compound(Addresses.traderJoeAddress, "AVAX", web3)
    //const comp = new Compound(Addresses.ironBankAddress, "AVAX", web3)
    //const comp = new Compound(Addresses.ironBankAddress, "ETH", web3)
    //const comp = new Compound(Addresses.venusAddress, "BSC", web3)

    const web3 = require("web3")

    // const compoundInfo = Addresses.compoundV3Address['ETH']['USDC']
    const compoundInfo = Addresses.compoundV3Address['MATIC']['USDCe']
   
  
    const comp = new CompoundV3(
        compoundInfo,
        "MATIC",
        web3
    )

    await comp.main()
    //const user = comp.users["0xF1f304DEF83D6CF4680a81C49cAC184a8119a538"]
    //console.log(user.borrowBalance["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"].toString())
    //console.log(user.collateralBalace["0xBe9895146f7AF43049ca1c1AE358B0541Ea49704"].toString())
    //console.log(user.collateralBalace["0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0"].toString())
    //await comp.updateUsers(["0xF1f304DEF83D6CF4680a81C49cAC184a8119a538"])
    //await comp.collectAllUsers()
    //await comp.updateUsers(["0xb3fbE25Be2e8CA097e9ac924e94aF000DD3A5663"])
    //await comp.updateAllUsers()
   // await comp.periodicUpdateUsers(16994426 - 1000)
    //await comp.calcBadDebt()
 }

 // test()

