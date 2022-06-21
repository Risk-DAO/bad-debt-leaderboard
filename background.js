const { fork } = require('node:child_process');
require('dotenv').config()

const jobs = [
  {
    file: 'ParseMim',
    name: 'ethereum_MIM',
    multiple: true
  },  
  {
    file: 'ParseMim_BSC',
    name: 'BSC_MIM',
    multiple: true
  },  
  {
    file: 'ParseMim_FTM',
    name: 'FTM_MIM',
    multiple: true
  },  
  {
    file: 'ParseMim_Arbitrum',
    name: 'arbitrum_MIM',
    multiple: true
  },  
  {
    file: 'ParseMim_AVAX',
    name: 'avalanche_MIM',
    multiple: true
  },
  {
    file: 'ParseAurigami',
    name: 'aurora_aurigami'
  },
]

const runJob = (job) => {
  const backgroundJob = fork('./backgroundJobs/jobRuner.js', [
      '-f', job.file, 
      '-n', job.name,
      '-i', job.i,
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

for(let job of jobs) {
  if(job.multiple){    
    console.log(`./backgroundJobs/${job.file}`)
    let {subJobs} = require(`./backgroundJobs/${job.file}`)
    subJobs = subJobs.map((subJob, i) => Object.assign({}, job, { name: job.name + '_' + subJob.name, i }))
    subJobs.forEach(runJob);
  } else {
    runJob(job)
  }
}
