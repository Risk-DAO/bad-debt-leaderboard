const { fork } = require('node:child_process');
require('dotenv').config()
const {waitForCpuToGoBelowThreshold} = require('./machineResources')
const {sleep} = require('./utils');

const jobs = [
  {
    file: 'ParseAaveV3_AVAX',
    name: 'avalanche_aave'
  },
  {
    file: 'ParseAaveV3_Arbitrum',
    name: 'arbitrum_aave'
  },
  {
    file: 'ParseAaveV3_Optimism',
    name: 'optimism_aave'
  }
]

/*
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
    file: 'ParseMaker',
    name: 'ethereum_maker'
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
    file: 'ParseAave',
    name: 'ethereum_aave'
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
*/
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

const init = async () => {
  for(let job of jobs) {
    await waitForCpuToGoBelowThreshold()
    if(job.multiple){    
      console.log(`./backgroundJobs/${job.file}`)
      let {subJobs} = require(`./backgroundJobs/${job.file}`)
      subJobs = subJobs.map((subJob, i) => Object.assign({}, job, { name: job.name + '_' + subJob.name, i }))
      subJobs.forEach(runJob);
    } else {
      runJob(job)
    }
    await sleep(60) // before running the next process
  }
}

init()