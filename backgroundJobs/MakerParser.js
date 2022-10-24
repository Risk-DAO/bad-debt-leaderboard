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

class MakerParser {
    constructor(web3, heavyUpdateInterval = 5) {
      this.web3 = web3
      this.heavyUpdateInterval = heavyUpdateInterval
      this.ilks = []
      this.ilkData = {}
      this.userList = []
      this.urnData = {}

      this.tvl = toBN("0")
      this.totalBorrows = toBN("0")

      this.vat = new web3.eth.Contract(Addresses.vatAbi, Addresses.vatEthAddress["ETH"].address)
      this.spotter = new web3.eth.Contract(Addresses.spotterAbi, Addresses.vatEthAddress["ETH"].spotterAddress)
      this.lastUpdateBlock = this.deployBlock = Addresses.vatEthAddress["ETH"].deployBlock
      this.multicallSize = Addresses.vatEthAddress["ETH"].multicallSize
      this.multicall = new web3.eth.Contract(Addresses.multicallAbi, Addresses.multicallAddress["ETH"])
      this.blockStepInInit = Addresses.vatEthAddress["ETH"].blockStepInInit

      this.mainCntr = 0

      this.output = {}
    }

    async heavyUpdate() {
        await this.collectAllUsers()
        await this.updateAllUsers()
        await this.initPrices()
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
        for(const ilk of this.ilks) {
            this.ilkData[ilk] = await this.vat.methods.ilks(ilk).call()
            const pipData = await this.spotter.methods.ilks(ilk).call()
            const mat = pipData.mat
            console.log({mat},{ilk})
            const ray = toBN("10").pow(toBN("27"))
            this.ilkData[ilk].spot = toBN(this.ilkData[ilk].spot).mul(toBN(mat)).div(ray)
        }
    }

    async collectAllUsers() {
        let chainId = 1
        
        const sig0 = this.web3.utils.keccak256('fork(bytes32,address,address,int256,int256)').slice(0, "0x00112233".length)
        const topic0 = sig0 + "00000000000000000000000000000000000000000000000000000000"

        console.log({topic0}, {sig0})

        const urnIndices0 = [2,3]
        const ilkIndex0 = 1
        await this.collectAllUsersFromEvents(chainId, topic0, ilkIndex0, urnIndices0)


        const sig1 = this.web3.utils.keccak256('frob(bytes32,address,address,address,int256,int256)').slice(0, "0x00112233".length)
        const topic1 = sig1 + "00000000000000000000000000000000000000000000000000000000"

        console.log({topic1}, {sig1})

        const urnIndices1 = [2]
        const ilkIndex1 = 1
        await this.collectAllUsersFromEvents(chainId, topic1, ilkIndex1, urnIndices1)
    }

    async collectAllUsersFromEvents(chainId, eventTopic, ilkIndex, urnIndices) { 
        const currBlock = /*this.deployBlock + 50000 //*/  await this.web3.eth.getBlockNumber() - 10
        console.log({currBlock})
        for(let startBlock = this.lastUpdateBlock ; startBlock < currBlock ; startBlock += this.blockStepInInit) {
            const endBlock = (startBlock + this.blockStepInInit > currBlock) ? currBlock : startBlock + this.blockStepInInit
            console.log({startBlock}, this.userList.length, this.blockStepInInit, endBlock)

            const allEvents = await this.vat.getPastEvents("allEvents", {topics: [eventTopic], fromBlock: startBlock, toBlock : endBlock})
            for(const e of allEvents){
                const topics = e.raw.topics
                const ilk = topics[ilkIndex]
                for(const urnIndex of urnIndices) {
                    const urn = this.web3.utils.toChecksumAddress("0x" + topics[urnIndex].slice(-40))
                    const user = JSON.stringify({"ilk" : ilk, "urn" : urn})
                    //console.log({user})
                    if(! this.userList.includes(user)) this.userList.push(user)
                    if(! this.ilks.includes(ilk)) this.ilks.push(ilk)
                }
            }
            //console.log(this.userList.length)                
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

    async calcBadDebt(currTime) {
        this.sumOfBadDebt = this.web3.utils.toBN("0")
        let deposits = this.web3.utils.toBN("0")
        let borrows = this.web3.utils.toBN("0")
        let tvl = this.web3.utils.toBN("0")

        const userWithBadDebt = []

        //console.log(this.users)
        for(const user of this.userList) {
            //console.log({user})
            const userObj = JSON.parse(user)
            const ilk = userObj.ilk
            const ilkData = this.ilkData[ilk]
            const urnData = this.urnData[user]

            const debt = toBN(urnData.art).mul(toBN(ilkData.rate))
            const collateralValue = toBN(urnData.ink).mul(toBN(ilkData.spot))

            if(collateralValue.lt(debt)) {
                this.sumOfBadDebt = this.sumOfBadDebt.add(collateralValue.sub(debt))
                userWithBadDebt.push({"user" : user, "badDebt" : (collateralValue.sub(debt)).toString()})
            }
            
            tvl = tvl.add(collateralValue)
            deposits = deposits.add(collateralValue)
            borrows = borrows.add(debt)
        }

        this.tvl = tvl

        this.output = { "total" :  this.sumOfBadDebt.toString(), "updated" : currTime.toString(), "decimals" : "45", "users" : userWithBadDebt,
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
        const urnCalls = []
        for(const user of users) {
            const call = {}
            const userObj = JSON.parse(user)
            call["target"] = this.vat.options.address
            call["callData"] = this.vat.methods.urns(userObj.ilk, userObj.urn).encodeABI()

            urnCalls.push(call)
        }

        console.log("getting urn data")

        const urnCallResults = await this.multicall.methods.tryAggregate(false, urnCalls).call()
        for(let i = 0 ; i < users.length ; i++) {
            const result = this.web3.eth.abi.decodeParameters(["uint256","uint256"], urnCallResults[i].returnData)
            //console.log(users[i], {result})
            const urnData = {"ink" : result["0"], "art" : result["1"]}
            //console.log({urnData})
            //console.log(users[i])
            this.urnData[users[i]] = urnData
        }
    }
  }

module.exports = MakerParser

async function test() {
    //ckey_2d9319e5566c4c63b7b62ccf862"

    const web3 = new Web3("https://cloudflare-eth.com")
    const maker = new MakerParser(web3)
    await maker.main()
 }

//test()