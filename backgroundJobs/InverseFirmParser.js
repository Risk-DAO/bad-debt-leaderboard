const Web3 = require('web3')
const { toBN, toWei } = Web3.utils
const Addresses = require("./Addresses.js")
const { waitForCpuToGoBelowThreshold } = require("../machineResources.js")
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
        const res = await fn(...params)
        if (retries) {
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

class InverseFirmParse {
    constructor(InverseFirmInfo, network, web3, heavyUpdateInterval = 24) {
        this.web3 = web3
        this.network = network

        console.log(`Created inverse firm parser for network ${this.network}`)
        this.multicall = new web3.eth.Contract(Addresses.multicallAbi, Addresses.multicallAddress[network])
        this.deployBlock = InverseFirmInfo[network].deployBlock
        this.firstEventBlock = InverseFirmInfo[network].firstEventBlock
        this.blockStepInInit = InverseFirmInfo[network].blockStepInInit
        this.multicallSize = InverseFirmInfo[network].multicallSize

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

    async getMarkets() {
        const { DbrAddress, deployBlock } = Addresses.firmInfos[this.network];
        // DBR contract is the DOLA Borrowing Right contract, all FiRM markets are registered there
        const dbrContract = new this.web3.eth.Contract(Addresses.firmDBRAbi, DbrAddress);
        const marketsAddedEvents = await dbrContract.getPastEvents("AddMarket", { fromBlock: deployBlock, toBlock: 'latest' });

        // Array of market addresses
        return marketsAddedEvents.map(e => e.returnValues.market);        
    }

    async getMarketsEscrows(markets) {
        const { deployBlock } = Addresses.firmInfos[this.network];
        // on first deposit in a market, an Escrow is created for the user
        const createEscrowEvents = await Promise.all(
            markets.map(market => {
                const marketContract = new this.web3.eth.Contract(Addresses.firmMarketAbi, market);
                return marketContract.getPastEvents("CreateEscrow", { fromBlock: deployBlock, toBlock: 'latest' });
            })
        );
        // Array of escrow and users per markets: { escrow: string, user: string }[][]
        return createEscrowEvents.map(grouped => grouped.map(me => me.returnValues));     
    }

    async getMarketsCollaterals(markets) {
        const marketCollateralCalls = []
        markets.forEach(market => {
            const marketContract = new this.web3.eth.Contract(Addresses.firmMarketAbi, market);
            const call = {}
            call["target"] = market;
            call["callData"] = marketContract.methods.collateral().encodeABI();
            marketCollateralCalls.push(call);
        });

        return (await this.multicall.methods.tryAggregate(false, marketCollateralCalls).call())
            .map(d => this.web3.eth.abi.decodeParameters(['address'], d.returnData)[0]);
    }

    async getCollateralDecimals(collaterals) {
        const collateralsCalls = []
        collaterals.forEach(collateral => {
            const collateralContract = new this.web3.eth.Contract(Addresses.erc20Abi, collateral);
            const call = {}
            call["target"] = collateral;
            call["callData"] = collateralContract.methods.decimals().encodeABI();
            collateralsCalls.push(call);
        });

        return (await this.multicall.methods.tryAggregate(false, collateralsCalls).call())
            .map(d => this.web3.eth.abi.decodeParameters(['uint'], d.returnData)[0]);
    }

    async getMarketsOracles(markets) {
        const marketOracleCalls = []
        markets.forEach(market => {
            const marketContract = new this.web3.eth.Contract(Addresses.firmMarketAbi, market);
            const call = {}
            call["target"] = market;
            call["callData"] = marketContract.methods.oracle().encodeABI();
            marketOracleCalls.push(call);
        });

        return (await this.multicall.methods.tryAggregate(false, marketOracleCalls).call())
            .map(d => this.web3.eth.abi.decodeParameters(['address'], d.returnData)[0]);
    }

    async getMarketsCollateralFactorsBps(markets) {
        const marketCollateralFactorsCalls = []
        markets.forEach(market => {
            const marketContract = new this.web3.eth.Contract(Addresses.firmMarketAbi, market);
            const call = {}
            call["target"] = market;
            call["callData"] = marketContract.methods.collateralFactorBps().encodeABI();
            marketCollateralFactorsCalls.push(call);
        });

        return (await this.multicall.methods.tryAggregate(false, marketCollateralFactorsCalls).call())
            .map(d => this.web3.eth.abi.decodeParameters(['uint'], d.returnData)[0]);
    }

    async getMarketsCollateralPrices(marketOracles, marketCollaterals, marketCollateralFactorsBps) {
        const marketCollateralPricesCalls = []
        marketOracles.forEach((market, marketIndex) => {
            const oracleContract = new this.web3.eth.Contract(Addresses.firmOracleAbi, marketOracles[marketIndex]);
            const call = {}
            call["target"] = marketOracles[marketIndex];
            call["callData"] = oracleContract.methods.viewPrice(marketCollaterals[marketIndex], marketCollateralFactorsBps[marketIndex]).encodeABI();
            marketCollateralPricesCalls.push(call);
        });

        return (await this.multicall.methods.tryAggregate(false, marketCollateralPricesCalls).call())
            // Old INV feed is not compatible with the Oracle
            .map(d => !d.success ? '0' : this.web3.eth.abi.decodeParameters(['uint'], d.returnData)[0]);
    }

    async getUserBalances(marketsEscrowsAndUsers) {
        return (await Promise.all(
            marketsEscrowsAndUsers.map((escrowAndUsers) => {
                const calls = [];
                const bulkSize = this.multicallSize;
                const slices = [];
                for (let i = 0; i < escrowAndUsers.length; i = i + bulkSize) {
                    const to = i + bulkSize > escrowAndUsers.length ? escrowAndUsers.length : i + bulkSize
                    const slice = escrowAndUsers.slice(i, to);
                    slices.push(slice);
                }
                return Promise.all(
                    slices.map(bulkSlice => {
                        const fn = (bulkSlice) => {
                            bulkSlice.forEach(({ escrow }) => {
                                const call = {}
                                const escrowContract = new this.web3.eth.Contract(Addresses.firmEscrowAbi, escrow);
                                call["target"] = escrow
                                call["callData"] = escrowContract.methods.balance().encodeABI();
                                calls.push(call)
                            });
                            return this.multicall.methods.tryAggregate(false, calls).call();
                        }
                        return retry(fn, [bulkSlice])
                    })
                )
            })
        ))
            .map(r => r.flat()).map((marketResults, marketIndex) => {
                return marketResults.map(marketUserResult => {
                    return this.web3.eth.abi.decodeParameters(['uint'], marketUserResult.returnData)[0]
                })
            });
    }

    async getUserDebts(marketsEscrowsAndUsers, markets) {
        return (await Promise.all(
            marketsEscrowsAndUsers.map((escrowAndUsers, marketIndex) => {
                const calls = [];
                const marketAddress = markets[marketIndex];
                const marketContract = new this.web3.eth.Contract(Addresses.firmMarketAbi, marketAddress);

                const bulkSize = this.multicallSize;
                const slices = [];
                for (let i = 0; i < escrowAndUsers.length; i = i + bulkSize) {
                    const to = i + bulkSize > escrowAndUsers.length ? escrowAndUsers.length : i + bulkSize
                    const slice = escrowAndUsers.slice(i, to);
                    slices.push(slice);
                }
                return Promise.all(
                    slices.map(bulkSlice => {
                        const fn = (bulkSlice) => {
                            bulkSlice.forEach(({ user }) => {
                                const call = {}
                                call["target"] = marketAddress
                                call["callData"] = marketContract.methods.debts(user).encodeABI();
                                calls.push(call)
                            });
                            return this.multicall.methods.tryAggregate(false, calls).call();
                        }
                        return retry(fn, [bulkSlice])
                    })
                )
            })
        ))
            .map(r => r.flat()).map((marketResults, marketIndex) => {
                return marketResults.map(marketUserResult => {
                    if (!marketUserResult[0]) {
                        err++;
                    }
                    return this.web3.eth.abi.decodeParameters(['uint'], marketUserResult.returnData)[0]
                })
            });
    }

    async test() {
        console.log("InverseFirm: test")
        const currBlock = (await this.web3.eth.getBlockNumber()) - 10
        const currTime = (await this.web3.eth.getBlock(currBlock)).timestamp

        // Array of market addresses
        // All markets are isolated
        const markets = await this.getMarkets();
        // Array of escrow and users per markets: { escrow: string, user: string }[][]
        const marketsEscrowsAndUsers = await this.getMarketsEscrows(markets);
        const marketCollaterals = await this.getMarketsCollaterals(markets);
        const collateralsDecimals = await this.getCollateralDecimals(marketCollaterals);
        const marketOracles = await this.getMarketsOracles(markets);
        const marketCollateralFactorsBps = await this.getMarketsCollateralFactorsBps(markets);
        const marketCollateralPrices = await this.getMarketsCollateralPrices(marketOracles, marketCollaterals, marketCollateralFactorsBps);

        const userBalances = await this.getUserBalances(marketsEscrowsAndUsers);
        // all debts are in DOLA
        const userDebts = await this.getUserDebts(marketsEscrowsAndUsers, markets);

        this.calcBadDebt(currTime, userDebts, userBalances, marketsEscrowsAndUsers, marketCollateralPrices, collateralsDecimals);
    }

    async main() {
        try {
            // await waitForCpuToGoBelowThreshold()
            await this.test()

            // const currBlock = (await this.web3.eth.getBlockNumber()) - 10
            // const currTime = (await this.web3.eth.getBlock(currBlock)).timestamp

            // if(this.mainCntr % this.heavyUpdateInterval == 0) {
            //     console.log("heavyUpdate start")
            //     await this.heavyUpdate()
            //     console.log('heavyUpdate success')
            // } else {
            //     console.log("lightUpdate start")
            //     await this.lightUpdate()
            //     console.log('lightUpdate success')
            // }
            // console.log("calc bad debt")
            // await this.calcBadDebt(currTime)

            // this.lastUpdateBlock = currBlock

            // // don't  increase cntr, this way if heavy update is needed, it will be done again next time
            // console.log("this.mainCntr:", this.mainCntr++)
        }
        catch (err) {
            console.log("main failed", { err })
        }

        const sleepTime = 1000 * 60 * 60;
        console.log("sleeping sec", sleepTime / 1000)
        setTimeout(this.main.bind(this), sleepTime) // sleep for 1 hour
    }

    async calcBadDebt(currTime, userDebts, userBalances, marketsEscrowsAndUsers, marketCollateralPrices, collateralsDecimals) {        
        this.sumOfBadDebt = toBN("0")
        let deposits = toBN("0")
        let borrows = toBN("0")
        let tvl = toBN("0")

        const userWithBadDebt = []

        userDebts.forEach((marketResults, marketIndex) => {
            const price = toBN(marketCollateralPrices[marketIndex])
            marketResults.forEach((userDebt, userIndex) => {
                const userMarketDebt = toBN(userDebt)
                const normalizedBalance = toBN(userBalances[marketIndex][userIndex]).mul(toBN(10).pow(toBN(18 - parseInt(collateralsDecimals[marketIndex]))))
                const userDepositWorth = normalizedBalance.mul(price).div(toBN(toWei('1', 'ether')));
                borrows = borrows.add(userMarketDebt)
                deposits = deposits.add(userDepositWorth)
                const netValue = userDepositWorth.sub(userMarketDebt)
                tvl = tvl.add(netValue)
                if (userDepositWorth.lt(userMarketDebt)) {                    
                    this.sumOfBadDebt = this.sumOfBadDebt.add(netValue)
                    userWithBadDebt.push({
                        user: marketsEscrowsAndUsers[marketIndex][userIndex].user,
                        badDebt: netValue.toString(),
                    });
                }
            })
        });
        this.tvl = tvl

        this.output = {
            "total": this.sumOfBadDebt.toString(), "updated": currTime.toString(), "decimals": "18", "users": userWithBadDebt,
            "tvl": this.tvl.toString(), "deposits": deposits.toString(), "borrows": borrows.toString(),
            "calculatedBorrows": this.totalBorrows.toString()
        }

        console.log('output')
        console.log(JSON.stringify(this.output))

        // console.log("total bad debt", Number(this.sumOfBadDebt.toString())/1e8, {currTime})

        return this.sumOfBadDebt
    }

    async getPastEventsInSteps(contract, key, from, to) {
        let totalEvents = []
        console.log(`getPastEventsInSteps[${key}]: getting events from ${from} to ${to}`);
        for (let i = from; i < to; i = i + this.blockStepInInit) {
            const fromBlock = i
            const toBlock = i + this.blockStepInInit > to ? to : i + this.blockStepInInit
            const fn = (...args) => contract.getPastEvents(...args)
            const events = await retry(fn, [key, { fromBlock, toBlock }])
            totalEvents = totalEvents.concat(events)
        }
        console.log(`getPastEventsInSteps[${key}]: found ${totalEvents.length} events from ${from} to ${to}`);
        return totalEvents
    }
}

module.exports = InverseFirmParse
