const Web3 = require('web3')
const { toBN, toWei, fromWei } = Web3.utils
const axios = require('axios')
const Addresses = require("./Addresses.js")
const { getPrice, getEthPrice, getCTokenPriceFromZapper } = require('./priceFetcher')
const User = require("./User.js")

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
            //console.log(`success on first try`)
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

class MimParser {
    constructor(mimInfo, network, web3, heavyUpdateInterval = 24) {
      this.web3 = web3
      this.network = network
      this.calderons = []
      this.deployBlock = {}
      this.userDeposit = {}
      this.userBorrow = {}
      this.collateral = {}
      this.calderonAddressToContract = {}
      this.bentobox = {}
      for(const calderon of mimInfo[network].calderons) {
        this.name = calderon.name // support for multiple calderons is broken
        const calderonAddress = web3.utils.toChecksumAddress(calderon.address)
        const calderonContract = new web3.eth.Contract(Addresses.calderonAbi, calderonAddress)
        this.calderons.push(calderonContract)
        this.deployBlock[calderonAddress] = calderon.deployBlock
        this.userDeposit[calderonAddress] = {}
        this.userBorrow[calderonAddress] = {}
        this.calderonAddressToContract[calderonAddress] = calderon
      }

      this.multicall = new web3.eth.Contract(Addresses.multicallAbi, Addresses.multicallAddress[network])

      this.blockStepInInit = mimInfo[network].blockStepInInit
      this.multicallSize = mimInfo[network].multicallSize

      this.prices = {}
      this.elastic = {}
      this.base = {}
      this.users = {}
      this.userList = []

      this.sumOfBadDebt = web3.utils.toBN("0")
      this.lastUpdateBlock = this.deployBlock

      this.mainCntr = 0
      this.heavyUpdateInterval = heavyUpdateInterval

      this.tvl = toBN("0")
      this.totalBorrows = toBN("0")

      this.output = {}
    }

    async heavyUpdate() {
        await this.initPrices()
        if(this.network === "ARBITRUM") await this.lightUpdate(true)
        else await this.collectAllUsers()
        
        await this.updateAllUsers()
    }

    async lightUpdate(firstTime = false) {
        await this.initPrices()        
        await this.periodicUpdateUsers(firstTime)
    }

    async main(onlyOnce = false) {
        try {
            const currBlock = await this.web3.eth.getBlockNumber() - 10
            const currTime = (await this.web3.eth.getBlock(currBlock)).timestamp

            // always do heavy update, as mim is small enough
            if(this.mainCntr % this.heavyUpdateInterval == 0 || true) {
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
            
            this.lastUpdateBlock[this.calderons[0].options.address] = currBlock

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

    async getFallbackPrice(calderon) {
        return toBN("0") // todo - override in each market
    }

    async initPrices() {
        for(const calderon of this.calderons) {
            const bentoBoxAddress = await calderon.methods.bentoBox().call()
            //console.log({bentoBoxAddress})
            this.bentobox[calderon.options.address] = new this.web3.eth.Contract(Addresses.bentoboxAbi, bentoBoxAddress)            
            //console.log({calderon})
            const priceResult = await calderon.methods.updateExchangeRate().call()
            console.log(calderon.options.address)
            console.log(priceResult.rate)
            this.prices[calderon.options.address] = priceResult.rate
            
            const totalBorrowsResult = await calderon.methods.totalBorrow().call()
            this.elastic[calderon.options.address] = totalBorrowsResult.elastic
            this.base[calderon.options.address] = totalBorrowsResult.base
            this.collateral[calderon.options.address] = await calderon.methods.collateral().call()
        }
    }


    async getPastEventsInSteps(cToken, key, from, to){
        console.log("getPastEventsInSteps", from, to)
        let totalEvents = []
        for (let i = from; i < to; i = i + this.blockStepInInit) {
            const fromBlock = i
            const toBlock = i + this.blockStepInInit > to ? to : i + this.blockStepInInit
            console.log(fromBlock, "/", to, totalEvents.length)
            const fn = (...args) => cToken.getPastEvents(...args)
            const events = await retry(fn, [key, {fromBlock, toBlock}])
            totalEvents = totalEvents.concat(events)
        }
        return totalEvents
    }

    async collectAllUsers() {
        let chainId = 1
        if(this.network === "ETH") chainId = 1
        if(this.network === "BSC") chainId = 56
        if(this.network === "FTM") chainId = 250
        if(this.network === "AVAX") chainId = 43114

        // read all users who ever added a collateral

        // event LogAddCollateral(address indexed from, address indexed to, uint256 share);
        const addCollateralTopic = this.web3.utils.keccak256('LogAddCollateral(address,address,uint256)')
        console.log({addCollateralTopic})
        await this.collectAllUsersFromEvents(chainId, addCollateralTopic, 2)
    }

    async collectAllUsersFromEvents(chainId, eventTopic, userTopicIndex) {
        const currBlock = await this.web3.eth.getBlockNumber() - 10
        const calderonAddress = this.calderons[0].options.address
        console.log({currBlock})
        for(let startBlock = this.lastUpdateBlock[calderonAddress] ; startBlock < currBlock ; startBlock += this.blockStepInInit) {
            console.log({startBlock}, this.userList.length, this.blockStepInInit)
            const endBlock = (startBlock + this.blockStepInInit > currBlock) ? currBlock : startBlock + this.blockStepInInit

            let hasMore = true
            for(let pageNumber = 0 ; hasMore ; pageNumber++) {
                //console.log("query")
                const url = "https://api.covalenthq.com/v1/"+ chainId.toString() +"/events/topics/" +
                eventTopic.toString() +
                //0x9ed03113de523cebfe5e49d5f8e12894b1c0d42ce805990461726444c90eab87
                "/?quote-currency=USD&format=JSON&"
                +
                "starting-block=" + startBlock.toString() + "&ending-block=" + endBlock.toString() +
                "&sender-address=" + calderonAddress + "&page-number="
                    + pageNumber.toString() + 
                    "&key=ckey_2d9319e5566c4c63b7b62ccf862"                 
                const result = await axios.get(url)
                const data = result.data.data
                for(const item of data.items) {
                    //console.log({item})
                    const user = this.web3.utils.toChecksumAddress("0x" + item.raw_log_topics[1].slice(-40))
                    // TODO - adjust checksum
        
                    if(! this.userList.includes(user)) this.userList.push(user)
                    //console.log(user)            
                }
        
                //console.log(result.data)
                hasMore = data.pagination.has_more        
            }
            //console.log(this.userList.length)            
        }

        //console.log(this.userList)        
    }    

    async periodicUpdateUsers(firstTime) {
        const accountsToUpdate = []
        const currBlock = await this.web3.eth.getBlockNumber() - 10
        console.log({currBlock})

        const events = {"LogAddCollateral" : ["to"],
                        "LogRemoveCollateral" : ["from"],
                        "LogBorrow" : ["from"],
                        "LogRepay" : ["to"],
                        /*"LogLiquidation" : ["from","to"]*/}

        for(const calderon of this.calderons) {
            const keys = Object.keys(events)
            //console.log({keys})
            for (const key of keys) {
                const value = events[key]
                //console.log({key}, {value})
                const newEvents = await this.getPastEventsInSteps(calderon, key, this.lastUpdateBlock[calderon.options.address], currBlock) 
                for(const e of newEvents) {
                    for(const field of value) {
                        //console.log({field})
                        const a = e.returnValues[field]
                        //console.log({a})
                        if(! accountsToUpdate.includes(a)) accountsToUpdate.push(a)
                    }
                }

                if(firstTime) break // reading add collateral is enough for first time
            }
        }

        //console.log({accountsToUpdate})
        for(const a of accountsToUpdate) {
            if(! this.userList.includes(a)) this.userList.push(a)            
        }

        // updating users in slices
        const bulkSize = this.multicallSize
        for (let i = 0; i < accountsToUpdate.length; i = i + bulkSize) {
            const to = i + bulkSize > accountsToUpdate.length ? accountsToUpdate.length : i + bulkSize
            //console.log({to}, bulkSize, accountsToUpdate.length)
            const slice = accountsToUpdate.slice(i, to)
            const fn = (...args) => this.updateUsers(...args)
            //console.log({slice})
            await retry(fn, [slice])
        }

        for(const calderon of this.calderons) {
            this.lastUpdateBlock[calderon.options.address] = currBlock
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

        //console.log(this.users)
        for(const user of Object.keys(this.users)) {
            //console.log({user})
            for(const calderon of Object.keys(this.users[user])) {
                const data = this.users[user][calderon]
                const price = toBN(this.prices[calderon])
                const collateraValue = toBN(data.collateral).mul(toBN(toWei("1"))).div(toBN(price))
                const debt = toBN(data.debt).mul(toBN(this.elastic[calderon])).div(toBN(this.base[calderon]))

                //console.log(user, debt.toString(), collateraValue.toString(), price.toString(), data.collateral.toString())

                if(collateraValue.lt(debt)) {
                    this.sumOfBadDebt = this.sumOfBadDebt.add(collateraValue.sub(debt))
                    userWithBadDebt.push({"user" : user, "badDebt" : (collateraValue.sub(debt)).toString()})
                }

                tvl = tvl.add(collateraValue)
                deposits = deposits.add(collateraValue)
                borrows = borrows.add(debt)
            }
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

    async updateUsers(userAddresses) {
        console.log("updateUsers")
        // need to get: 1) userCollateralShare 2) userBorrowPart 3) bentoBox.toAmount
        const collateralBalanceCalls = []
        const borrowBalanceCalls = []
        for(const user of userAddresses) {
            for(const calderon of this.calderons) {
                const collatCall = {}
                const borrowCall = {}
    
                collatCall["target"] = calderon.options.address
                borrowCall["target"] = calderon.options.address
                    
                collatCall["callData"] = calderon.methods.userCollateralShare(user).encodeABI()
                borrowCall["callData"] = calderon.methods.userBorrowPart(user).encodeABI()

                //console.log({collatCall})
 
                collateralBalanceCalls.push(collatCall)
                borrowBalanceCalls.push(borrowCall)
            }
        }

        //console.log({borrowBalanceCalls},{collateralBalanceCalls})        

        console.log("getting collateral balances")
        const collateralBalaceResults = await this.multicall.methods.tryAggregate(false, collateralBalanceCalls).call()
        console.log("getting borrow balances")        
        const borrowBalanceResults = await this.multicall.methods.tryAggregate(false, borrowBalanceCalls).call()
        console.log("getting collateral to amount")
        const toAmountCalls = []
        for(const collatResult of collateralBalaceResults) {
            for(const calderon of this.calderons) {
                const colatBal = this.web3.eth.abi.decodeParameter("uint256", collatResult.returnData)
                //console.log(user, colatBal.toString())

                const call = {}
                //console.log(this.bentobox[calderon.options.address].options.address)
                call["target"] = this.bentobox[calderon.options.address].options.address
                call["callData"] = this.bentobox[calderon.options.address].methods.toAmount(this.collateral[calderon.options.address],
                                                                                            colatBal.toString(),
                                                                                            false).encodeABI()

                toAmountCalls.push(call)
            }
        }

        const collateralAmountResults = await this.multicall.methods.tryAggregate(false, toAmountCalls).call()

        // init class for all users
        let userIndex = 0
        for(const user of userAddresses) {

            let success = true
            if(! borrowBalanceResults[userIndex].success) success = false
            if(! collateralAmountResults[userIndex].success) success = false

            const colatBal = this.web3.eth.abi.decodeParameter("uint256", collateralAmountResults[userIndex].returnData)
            const borrowBal = this.web3.eth.abi.decodeParameter("uint256", borrowBalanceResults[userIndex].returnData)
            
            userIndex++

            for(const calderon of this.calderons) {
                if(! this.users[user]) this.users[user] = {}
                this.users[user][calderon.options.address] = { "debt" :  this.web3.utils.toBN(borrowBal), "collateral" : this.web3.utils.toBN(colatBal) }
            }
        }
    }
  }

module.exports = MimParser

