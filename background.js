const { fork } = require('node:child_process');
require('dotenv').config()

const jobs = [
  {
    file: 'CompoundParser',
    addresses: 'ovixAddress',
    chain: 'MATIC',
    name: 'polygon_ovix'
  },  
  {
    file: 'ParseVenus',
    addresses: 'venusAddress',
    chain: 'BSC',
    name: 'BSC_venus'
  },
]

for(let job of jobs) {
  const backgroundJobs = fork('./backgroundJobs/jobRuner.js', [
    '-f', job.file, 
    '-a', job.addresses, 
    '-c', job.chain,
    '-n', job.name,
  ]);
  backgroundJobs.on('error', err => console.error)
  backgroundJobs.on('data', err => console.log)
  backgroundJobs.on('exit', code => {
    console.err(new Error('background jobs exited'))
    process.exit(code)
  })
}
