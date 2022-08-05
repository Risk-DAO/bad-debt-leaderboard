const axios = require('axios');
const Addresses = require("./Addresses.js")
const Compound = require("./CompoundParser")
const Web3 = require("web3")
require('dotenv').config()


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

class BSCParser extends Compound {
    async collectAllUsers() {
        const currBlock = await this.web3.eth.getBlockNumber() - 10
        const comptrollerAddress = this.comptroller.options.address
        console.log({currBlock})
        for(let startBlock = this.deployBlock ; startBlock < currBlock ; startBlock += this.blockStepInInit) {
            console.log({startBlock}, this.userList.length, this.blockStepInInit)
            const endBlock = (startBlock + this.blockStepInInit > currBlock) ? currBlock : startBlock + this.blockStepInInit

            let hasMore = true
            for(let pageNumber = 0 ; hasMore ; pageNumber++) {
                console.log("query")
                const url = "https://api.covalenthq.com/v1/56/events/topics/0x3ab23ab0d51cccc0c3085aec51f99228625aa1a922b3a8ca89a26b0f2027a1a5/?quote-currency=USD&format=JSON&"
                +
                "starting-block=" + startBlock.toString() + "&ending-block=" + endBlock.toString() +
                "&sender-address=" + comptrollerAddress + "&page-number="
                    + pageNumber.toString() + 
                    "&key=ckey_2d9319e5566c4c63b7b62ccf862"
                    
                const fn = (...args) => axios.get(...args)
                const result = await retry(fn, [url])                    
                //const result = await axios.get(url)
                const data = result.data.data
                for(const item of data.items) {
                    const user = this.web3.utils.toChecksumAddress("0x" + item.raw_log_data.slice(-40))
                    // TODO - adjust checksum
        
                    if(! this.userList.includes(user)) this.userList.push(user)
                    //console.log(user)            
                }
        
                //console.log(result.data)
                hasMore = data.pagination.has_more        
            }
            console.log(this.userList.length)            
        }
    }
}

module.exports = BSCParser
