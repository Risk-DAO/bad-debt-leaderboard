const { fork } = require('node:child_process');
require('dotenv').config()
const {waitForCpuToGoBelowThreshold} = require('./machineResources')
const {sleep} = require('./utils');

const jobs = [
  {
    file: 'ParseAave',
    name: 'ethereum_aave'
  },
  {
    file: 'ParseMaker',
    name: 'ethereum_maker'
  },
  {
    file: 'ParseCompound',
    name: 'ethereum_compound'
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
    file: 'ParseOvix',
    name: 'polygon_0vix'
  },  
  {
    file: 'ParseTraderJoe',
    name: 'avalanche_trader-joe'
  },  
  {
    file: 'ParseIronBank',
    name: 'ethereum_iron-bank'
  },  
  {
    file: 'ParseGranary',
    name: 'FTM_granary'
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
  {
    file: 'ParseAurigami',
    name: 'aurora_aurigami'
  },
  {
    file: 'ParseTectonic',
    name: 'CRO_tectonic'
  },
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
    file: 'ParseCream',
    name: 'BSC_cream'
  },
  {
    file: 'ParseMoonwell',
    name: 'MOONBEAM_Moonwell'
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
  console.log(`--> job start "node ./backgroundJobs/jobRuner.js -f ${job.file} -n ${job.name} -i ${job.i}"`)
  backgroundJob.stdout.on('data', (data) => {
    console.log(`${job.name} ${new Date().toLocaleString()} : ${data}`);
  });

  backgroundJob.stderr.on('data', (data) => {
    console.error(`err ${job.name} ${new Date().toLocaleString()} : ${data}`);
  });

  backgroundJob.on('exit', code => {
    console.error(new Error(job.name + ' background job exited'))
    console.log(`--X job died "node ./backgroundJobs/jobRuner.js -f ${job.file} -n ${job.name} -i ${job.i}"`)
  })
}

const init = async () => {
  for(let job of jobs) {
    await waitForCpuToGoBelowThreshold()
    if(job.multiple){    
      let {subJobs} = require(`./backgroundJobs/${job.file}`)
      console.log({'subJobs.length': subJobs.length})
      subJobs = subJobs.map((subJob, i) => Object.assign({}, job, { name: job.name + '_' + subJob.name, i }))
      subJobs.forEach(runJob);
    } else {
      runJob(job)
    }
    await sleep(5) // before running the next process
  }
}

init()