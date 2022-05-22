require('dotenv').config()
const Addresses = require("./Addresses.js")
const Web3 = require("web3")
const commandLineArgs = require('command-line-args')
const options = commandLineArgs([
  { name: 'file', alias: 'f', type: String },
  { name: 'name', alias: 'n', type: String },
])
const {uploadJsonFile} = require('../s3Client')
const everyHour = 1000 * 60 * 60

let comp

function run() {
    const { file, } = options
    const CompoundParser = require(`./${file}`)
    comp = new CompoundParser()
    comp.main() 
}

function writeOutput (){
  if(comp && comp.output && comp.output.updated){
    uploadJsonFile(JSON.stringify(comp.output), options.name + '.json')
  }
}

run()
setInterval(writeOutput, everyHour)
