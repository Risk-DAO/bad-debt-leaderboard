require('dotenv').config()
const Addresses = require("./Addresses.js")
const Web3 = require("web3")
const commandLineArgs = require('command-line-args')
const options = commandLineArgs([
  { name: 'file', alias: 'f', type: String },
  { name: 'name', alias: 'n', type: String },
])
const {uploadJsonFile} = require('../s3Client')
const every5Minutes = 1000 * 60 * 5

let comp
let lastUpdate

function run() {
    const { file, } = options
    const CompoundParser = require(`./${file}`)
    comp = new CompoundParser()
    comp.main()
    setInterval(writeOutput, every5Minutes)
}

function writeOutput (){
  if(comp && comp.output && comp.output.updated && comp.output.updated != lastUpdate){
    uploadJsonFile(JSON.stringify(comp.output), options.name + '.json')
    lastUpdate = comp.output.updated
    console.log('output uploaded to S3')
  } else {
    console.log('nothing to upload to S3')
  }
}

run()
