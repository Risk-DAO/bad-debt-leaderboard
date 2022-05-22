const axios = require('axios');
const Addresses = require("./Addresses.js")
const Compound = require("./ParsePlatform.js")


async function test() {
    const Web3 = require("web3")
    const web3 = new Web3("https://polygon-rpc.com")    

    const comp = new Compound.Compound(Addresses.ovixAddress, "MATIC", web3)
    await comp.main()    
}

test()
