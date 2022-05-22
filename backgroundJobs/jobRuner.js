require('dotenv').config()
const Addresses = require("./Addresses.js")
const Web3 = require("web3")
const commandLineArgs = require('command-line-args')
const options = commandLineArgs([
  { name: 'file', alias: 'f', type: String },
  { name: 'addresses', alias: 'a', type: String },
  { name: 'chain', alias: 'c', type: String },
  { name: 'name', alias: 'n', type: String },
])
const {uploadJsonFile} = require('../s3Client')
const everyHour = 1000 * 60 * 60

let comp

function run() {
    const { addresses, file, chain, name } = options
    console.log({ addresses, file, chain, name })
    const nodeUrl = process.env[`${chain}_NODE_URL`]
    if(!nodeUrl) throw new Error('failed to find nodeUrl env var for ' + `${chain}_NODE_URL`)
    const web3 = new Web3(nodeUrl)
    const CompoundParser = require(`./${file}`)
    comp = new CompoundParser(Addresses[addresses], chain, web3)
    comp.main() 
}

function writeOutput (){
  if(comp && comp.output && comp.output.updated){
    uploadJsonFile(JSON.stringify(comp.output), options.name + '.json')
  }
}

run()
setInterval(writeOutput, everyHour)
