const { fork } = require('node:child_process');
require('dotenv').config()

const jobs = [
  {
    file: 'ParseCream',
    name: 'BSC_cream'
  },  
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
  {
    file: 'ParseBastion',
    name: 'aurora_bastion'
  },  
  {
    file: 'ParseRikki',
    name: 'BSC_rikki'
  },  
  {
    file: 'ParseApeswap',
    name: 'BSC_apeswap'
  },
  {
    file: 'ParseInverse',
    name: 'ethereum_inverse'
  },
]

for(let job of jobs) {
  const backgroundJob = fork('./backgroundJobs/jobRuner.js', [
      '-f', job.file, 
      '-n', job.name,
    ],
    { silent: true }
  );
  backgroundJob.stdout.on('data', (data) => {
    console.log(`${job.name} ${new Date().toLocaleString()} : ${data}`);
  });
  
  backgroundJob.stderr.on('data', (data) => {
    console.error(`err ${job.name} ${new Date().toLocaleString()} : ${data}`);
  });
  
  backgroundJob.on('exit', code => {
    console.error(new Error(job.name + ' background job exited'))
    process.exit(code)
  })
}
