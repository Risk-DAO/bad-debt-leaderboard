require('dotenv').config()
const Addresses = require("./Addresses.js")
const Web3 = require("web3")
const commandLineArgs = require('command-line-args')
const options = commandLineArgs([
  { name: 'file', alias: 'f', type: String },
  { name: 'name', alias: 'n', type: String },
  { name: 'index', alias: 'i', type: Number },
])
const isSubJob = options.index === 0 || !!options.index

const {uploadJsonFile} = require('../s3Client')
const every5Minutes = 1000 * 60 * 5

let comp
let lastUpdate

function run() {
    const { file, index } = options
    const {Parser} = require(`./${file}`)
    comp = new Parser(index)
    comp.main()
    setInterval(writeOutput, every5Minutes)
}

function writeOutput (){
  if(comp && comp.output && comp.output.updated && comp.output.updated != lastUpdate){
    const s3FileName = isSubJob ? 'subjob' + options.name + '.json' : options.name + '.json'
    uploadJsonFile(JSON.stringify(comp.output), s3FileName)
    lastUpdate = comp.output.updated
    console.log('output uploaded to S3')
  } else {
    console.log('nothing to upload to S3')
  }
}

run()
