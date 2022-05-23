const { fork } = require('node:child_process');
require('dotenv').config()

const jobs = [
  {
    file: 'ParseOvix',
    name: 'polygon_0vix'
  },  
  {
    file: 'ParseVenus',
    name: 'BSC_venus'
  },  
  {
    file: 'ParseRari',
    name: 'ethereum_rari-capital'
  },  
  {
    file: 'ParseTraderJoe',
    name: 'avalanche_trader-joe'
  },  
  {
    file: 'ParseCompound',
    name: 'ethereum_compound'
  },  
  {
    file: 'ParseIronBank',
    name: 'ethereum_iron-bank'
  },  
  {
    file: 'ParseBenqi',
    name: 'avalanche_benqi'
  },
]

for(let job of jobs) {
  const backgroundJobs = fork('./backgroundJobs/jobRuner.js', [
    '-f', job.file, 
    '-n', job.name,
  ]);
  backgroundJobs.on('error', err => console.error)
  backgroundJobs.on('data', err => console.log)
  backgroundJobs.on('exit', code => {
    console.err(new Error('background jobs exited'))
    process.exit(code)
  })
}
