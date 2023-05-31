require('dotenv').config();
const commandLineArgs = require('command-line-args');
const options = commandLineArgs([
  { name: 'file', alias: 'f', type: String },
  { name: 'name', alias: 'n', type: String },
  { name: 'index', alias: 'i', type: Number },
]);
const isSubJob = options.index === 0 || !!options.index;

const { uploadJsonFile } = require('../githubClient');
const every5Minutes = 1000 * 60 * 5;

let comp;
let lastUpdate;

function run() {
  const { file, index } = options;
  const { Parser } = require(`./${file}.js`);
  comp = isSubJob ? new Parser(index) : new Parser();
  comp.main();
  setInterval(writeOutput, every5Minutes);
}

async function writeOutput() {
  if (comp && comp.output && comp.output.updated && comp.output.updated != lastUpdate) {
    const ghFileName = isSubJob ? 'subjob' + options.name + '.json' : options.name + '.json';
    await uploadJsonFile(JSON.stringify(comp.output), ghFileName);
    lastUpdate = comp.output.updated;
    console.log('output uploaded to Github');
  } else {
    console.log('nothing to upload to Github');
  }
}

run();
