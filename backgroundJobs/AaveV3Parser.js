const Web3 = require('web3')
const { toBN, toWei, fromWei } = Web3.utils
const axios = require('axios')
const Addresses = require("./Addresses.js")
const { getPriceUSD18Decimals } = require('./priceFetcher')
const User = require("./User.js")
const {waitForCpuToGoBelowThreshold} = require("../machineResources")
const fs = require('fs');

// this param tell the script to load users from disk and also to save users into disk file 
// when running heavy update
const LOAD_USERS_FROM_DISK = process.env.AAVEV3_LOAD_USER_FROM_DISK && process.env.AAVEV3_LOAD_USER_FROM_DISK.toLowerCase() == 'true';
require('dotenv').config()
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
            // console.log(`retry success after ${retries} retries`)
        } else {
            // console.log(`success on first try`)
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

class AaveV3 {
    constructor(AaveV3Info, network, web3, heavyUpdateInterval = 24) {
      this.web3 = web3
      this.network = network
      this.poolAddressesProviderRegistryContract = new web3.eth.Contract(Addresses.aaveV3poolAddressesProviderRegistryAbi, AaveV3Info[network].poolAddressesProviderRegistry)

      console.log(`Created aave v3 parser for network ${this.network} and poolAddressesProviderRegistry: ${AaveV3Info[network].poolAddressesProviderRegistry}`)
      this.multicall = new web3.eth.Contract(Addresses.multicallAbi, Addresses.multicallAddress[network])
      this.deployBlock = AaveV3Info[network].deployBlock
      this.firstEventBlock = AaveV3Info[network].firstEventBlock
      this.blockStepInInit = AaveV3Info[network].blockStepInInit
      this.multicallSize = AaveV3Info[network].multicallSize
      
      // default base currency to USD for aave v3 pools
      this.baseCurrencyAddress = '0x0000000000000000000000000000000000000000'
      this.baseCurrencyDecimals = 8;
      this.baseCurrencyIsUSD = true;
      this.baseCurrencyPriceWith8Decimals = toBN('0');
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

    /** 
     * @notice initialize the pool address from the pool addresses provider registry and the network eth price
     * @dev will only work if one pool provider address is in the pool provider registry. seems to be always the case but 
     *      it is enforced with a throw if not exactly one pool provider address
     */
    async init() {
        // init lending pool contract by calling the pool address provider registry
        console.log('Getting addresses providers list from registry');
        const poolProviderAddresses = await this.poolAddressesProviderRegistryContract.methods.getAddressesProvidersList().call()

        console.log('poolProviderAddresses', poolProviderAddresses.join(', '));
        if(poolProviderAddresses.length != 1) {
            throw 'more than one pool provider address';
        }

        const poolAddressProviderV3Contract = new this.web3.eth.Contract(Addresses.aaveV3poolAddressProviderAbi, poolProviderAddresses[0]);

        const lendingPoolAddress = await poolAddressProviderV3Contract.methods.getPool().call()
        console.log('lendingPoolAddress', lendingPoolAddress);
        this.lendingPool = new this.web3.eth.Contract(Addresses.aaveV3PoolAbi, lendingPoolAddress)

        const priceOracleAddress = await poolAddressProviderV3Contract.methods.getPriceOracle().call();
        console.log('priceOracleAddress', priceOracleAddress);
        const priceOracleContract = new this.web3.eth.Contract(Addresses.aaveV3PriceOracleABI, priceOracleAddress); 
        const baseCurrency = await priceOracleContract.methods.BASE_CURRENCY().call();
        const baseCurrencyUnit = await priceOracleContract.methods.BASE_CURRENCY_UNIT().call();
        const calculatedDecimals = (baseCurrencyUnit.match(/0/g)||[]).length;
        console.log(`Found base currency: ${baseCurrency} and decimals ${calculatedDecimals}`);
        if(baseCurrency != this.baseCurrencyAddress) {
            console.log('BASE CURRENCY IS NOT USD on network:', this.network, ':', baseCurrency);
            this.baseCurrencyAddress = baseCurrency;
            this.baseCurrencyDecimals = calculatedDecimals;
            this.baseCurrencyIsUSD = false;
            this.basePriceUSD18Decimals = await getPriceUSD18Decimals(this.network, this.baseCurrencyAddress, this.web3);
            console.log('basePriceUSD18Decimals:', this.baseCurrencyPrice.toString());
        }
    }

    async heavyUpdate() {
        if(this.userList.length == 0
            // if load users from disk, collect all users each time heavy update is called 
            // even is there is already some user in the user list
            // it does not take too much time to fetch new users that way
            || LOAD_USERS_FROM_DISK) {
                await this.collectAllUsers();
        }

        await this.updateAllUsers()
    }

    async lightUpdate() {        
        await this.periodicUpdateUsers(this.lastUpdateBlock)
    }

    async main() {
        try {
            await waitForCpuToGoBelowThreshold()
            await this.init()

            const currBlock = (await this.web3.eth.getBlockNumber()) - 10
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
            console.log("this.mainCntr:", this.mainCntr++)
        }
        catch(err) {
            console.log("main failed", {err})
        }

        const sleepTime = 1000 * 60 * 60;
        console.log("sleeping sec", sleepTime/1000)
        setTimeout(this.main.bind(this), sleepTime) // sleep for 1 hour
    }

    async getFallbackPrice(market) {
        return toBN("0") // todo - override in each market
    }

    async getPastEventsInSteps(contract, key, from, to){
        let totalEvents = []
        console.log(`getPastEventsInSteps[${key}]: getting events from ${from} to ${to}`);
        for (let i = from; i < to; i = i + this.blockStepInInit) {
            const fromBlock = i
            const toBlock = i + this.blockStepInInit > to ? to : i + this.blockStepInInit
            const fn = (...args) => contract.getPastEvents(...args)
            const events = await retry(fn, [key, {fromBlock, toBlock}])
            totalEvents = totalEvents.concat(events)
        }
        console.log(`getPastEventsInSteps[${key}]: found ${totalEvents.length} events from ${from} to ${to}`);
        return totalEvents
    }

    async periodicUpdateUsers(lastUpdatedBlock) {
        const accountsToUpdate = []
        const currBlock = (await this.web3.eth.getBlockNumber()) - 10
        console.log(`periodicUpdateUsers: start from block ${lastUpdatedBlock} to ${currBlock}`);

        // we ignore atokens transfer, and catch it when doing the all users update
        const events = {"Supply" : ["onBehalfOf"],
                        "Withdraw" : ["user"],        
                        "Borrow" : ["onBehalfOf"],
                        "Repay" : ["user"],
                        "LiquidationCall" : ["user", "liquidator"]}

        const keys = Object.keys(events)
        console.log('periodicUpdateUsers: Fetching account updates from events:', keys);
        for (const key of keys) {
            const value = events[key]
            console.log(`periodicUpdateUsers: Fetching events '${key}' for fields ${value}`);
            const newEvents = await this.getPastEventsInSteps(this.lendingPool, key, lastUpdatedBlock, currBlock) 
            for(const e of newEvents) {
                for(const field of value) {
                    // console.log({field})
                    const a = e.returnValues[field]
                    // console.log({a})
                    if(! accountsToUpdate.includes(a)) accountsToUpdate.push(a)
                }
            }
        }

        console.log(`periodicUpdateUsers: found a total of ${accountsToUpdate.length} to update`);
        const userListPreviousLength = this.userList.length;
        for(const a of accountsToUpdate) {
            if(! this.userList.includes(a)) this.userList.push(a)            
        }
        
        console.log(`periodicUpdateUsers: Update userList from ${userListPreviousLength} to ${this.userList.length} users`);
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
        const dtCollectStart = Date.now();
        let currBlock = (await this.web3.eth.getBlockNumber()) - 10
        let firstBlockToFetch = this.firstEventBlock - 1;

        const dataFileName = `aavev3_${this.network}_users.json`;
        if(LOAD_USERS_FROM_DISK) {
            if(!fs.existsSync('saved_data')) {
                fs.mkdirSync('saved_data');
            }
            if(fs.existsSync(`saved_data/${dataFileName}`)) {
                const savedData = JSON.parse(fs.readFileSync(`saved_data/${dataFileName}`));
                if(savedData.lastFetchedBlock && savedData.users) {
                    firstBlockToFetch = savedData.lastFetchedBlock;
                    this.userList = savedData.users;
                    console.log(`collectAllUsers: Loaded user list from disk, next block to fetch: ${firstBlockToFetch}. Current userList.length: ${this.userList.length}.`)
                }
            } else {
                console.log(`Could not find saved data file saved_data/${dataFileName}, will fetch data from the begining`)
            }
        }

        
        console.log('collectAllUsers: current block:', currBlock)
        console.log('collectAllUsers: fetching users from block:', firstBlockToFetch)

        let currentStep = this.blockStepInInit;

        let lastBlockFetched = firstBlockToFetch;
        while(lastBlockFetched < currBlock) {
            const startBlock = lastBlockFetched + 1;
            const endBlock = startBlock + currentStep - 1 > currBlock ? currBlock : startBlock + currentStep - 1;

            let events;
            try {
                events = await this.lendingPool.getPastEvents("Supply", {fromBlock: startBlock, toBlock:endBlock})
                console.log(`collectAllUsers: block ${startBlock} -> ${endBlock}. Found ${events.length} events in ${currentStep} blocks. Current userList.length: ${this.userList.length}.`)
            }
            catch(err) {
                console.log(`call failed when fetching events from block ${startBlock} -> ${endBlock}, trying again`, err.toString())
                const newStepSize = Math.round(currentStep/2);
                console.log(`Changing step size from ${currentStep} to ${newStepSize}`)
                currentStep = newStepSize;
                continue
            }
            for(const e of events) {
                const a = e.returnValues.onBehalfOf
                if(!this.userList.includes(a)) {
                    this.userList.push(a)
                }
            }
            lastBlockFetched = endBlock;
            
            // reset step size to default
            currentStep = this.blockStepInInit;
        }

        

        if(LOAD_USERS_FROM_DISK) {
            const savedUserData = {
                lastFetchedBlock: currBlock,
                users: this.userList
            };

            fs.writeFileSync(`saved_data/${dataFileName}`, JSON.stringify(savedUserData));
        }
        console.log(`collectAllUsers: collecting ${this.userList.length} users took ${Math.round((Date.now() - dtCollectStart)/1000)} s`);
    }

    async updateAllUsers() {
        const dtUpdateStart = Date.now();
        const users = this.userList //require('./my.json')
        const bulkSize = this.multicallSize
        for(let i = 0 ; i < users.length ; i+= bulkSize) {
            const start = i
            const end = i + bulkSize > users.length ? users.length : i + bulkSize
            console.log("updateAllUsers:", i.toString() + " / " + users.length.toString())
            try {
                await this.updateUsers(users.slice(start, end))
            }
            catch(err) {
                console.log("update user failed, trying again", err)
                i -= bulkSize
            }
        }

        const updateElapsedSeconds = Math.round((Date.now() - dtUpdateStart)/1000);
        const userPerSec = this.userList.length / updateElapsedSeconds;
        console.log(`updateAllUsers: updated ${this.userList.length} users took ${Math.round((Date.now() - dtUpdateStart)/1000)} s`);
        console.log(`updateAllUsers: update rate ${userPerSec} user/s`);
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

            
            let collateral = toBN('0');
            let debt = toBN('0');
            
            // if aave v3 collateral and debt are reported in USD with 8 decimals, just store the value as is
            if(this.baseCurrencyIsUSD) {
                collateral = data.collateral;
                debt = data.debt;
            }
            // else, calculate the price in USD and keep the base decimal number
            else {
                collateral = data.collateral.mul(this.basePriceUSD18Decimals)
                                            // divide by 10^18 because the price is with 18 decimals
                                            .div(toBN('10').pow(toBN('18')));
                debt = data.debt.mul(this.basePriceUSD18Decimals)
                                            // divide by 10^18 because the price is with 18 decimals
                                            .div(toBN('10').pow(toBN('18')));
            }
            

            deposits = deposits.add(collateral)
            borrows = borrows.add(debt)

            const netValue = collateral.sub(debt)
            tvl = tvl.add(netValue)

            if(this.web3.utils.toBN(netValue).lt(this.web3.utils.toBN("0"))) {
                //const result = await this.comptroller.methods.getAccountLiquidity(user).call()
                // console.log("bad debt for user", user, Number(netValue.toString())/1e8/*, {result}*/)
                this.sumOfBadDebt = this.sumOfBadDebt.add(this.web3.utils.toBN(netValue))

                // console.log("total bad debt", Number(this.sumOfBadDebt.toString()) / 1e8)
                
                userWithBadDebt.push({"user" : user, "badDebt" : netValue.toString()})
            }
        }

        this.tvl = tvl

        this.output = { "total" :  this.sumOfBadDebt.toString(), "updated" : currTime.toString(), "decimals" : "8", "users" : userWithBadDebt,
                        "tvl" : this.tvl.toString(), "deposits" : deposits.toString(), "borrows" : borrows.toString(),
                        "calculatedBorrows" : this.totalBorrows.toString()}

        console.log(JSON.stringify(this.output))

        // console.log("total bad debt", Number(this.sumOfBadDebt.toString())/1e8, {currTime})

        return this.sumOfBadDebt
    }

    async updateUsers(userAddresses) {
        // need to get: 1) getUserAccountData
        
        const getUserAccountCalls = []
        // console.log("preparing getUserAccountCalls")
        for(const user of userAddresses) {
            const call = {}
            call["target"] = this.lendingPool.options.address
            call["callData"] = this.lendingPool.methods.getUserAccountData(user).encodeABI()
            getUserAccountCalls.push(call)
        }

        // console.log("getting getUserAccountCalls")
        const getUserAccountResults = await this.multicall.methods.tryAggregate(false, getUserAccountCalls).call()

        for(let i = 0 ; i < userAddresses.length ; i++) {
            const user = userAddresses[i]
            const result = getUserAccountResults[i]

            /*
            uint256 totalCollateralBase, --> in USD with 8 decimals
            uint256 totalDebtBase, --> in USD with 8 decimals
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor*/

            const paramType = ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"]
            const parsedResult = this.web3.eth.abi.decodeParameters(paramType,result.returnData)
            
            const collateral = parsedResult["0"]
            const debt = parsedResult["1"]

            this.users[user] = {"collateral" : toBN(collateral), "debt" : toBN(debt)}

            // if(user === "0x4846AEe6d7C9f176F3F329E01A014c2794E21B92") console.log(collateral.toString(), debt.toString())
        }
    }
}

module.exports = AaveV3

// async function test() {
//     console.log('AaveV3Parser: start test');
//     let web3 = new Web3(process.env.AVAX_NODE_URL)
//     let aavev3 = new AaveV3(Addresses.aaveV3Configuration, "AVAX", web3)
//     await aavev3.init()
// }

// test()