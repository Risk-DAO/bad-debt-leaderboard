const { fork } = require('node:child_process');
require('dotenv').config()
const {waitForCpuToGoBelowThreshold} = require('./machineResources')
const {sleep} = require('./utils');


const jobs = [
  {
    file: 'ParseAgave',
    name: 'gnosis_agave'
  },  
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
  {
    file: 'ParseAaveV3_AVAX',
    name: 'avalanche_aave v3'
  },
  {
    file: 'ParseAaveV3_Arbitrum',
    name: 'arbitrum_aave v3'
  },
  {
    file: 'ParseAaveV3_Optimism',
    name: 'optimism_aave v3'
  },
  { 
    file: 'ParseAaveV3_MATIC',
    name: 'polygon_aave v3'
  },
  {
    file: 'ParseSonne',
    name: 'optimism_sonne'
  },
  // { 
  //   file: 'ParseAaveV3_FTM',
  //   name: 'fantom_aavev3'
  // },
  // { 
  //   file: 'ParseAaveV3_Harmony',
  //   name: 'harmony_aavev3'
  // }
]
const runJob = (job, retry = 0) => {
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
    if (retry < 100) { // preventing an infinite loop
      retry++
      console.log(`--> job restart #${retry} "node ./backgroundJobs/jobRuner.js -f ${job.file} -n ${job.name} -i ${job.i} "`)
      // recursion
      runJob(job, retry) // restarting the background job
    }
  })
}

const init = async () => {

  const jobsToStart = [];
  for(let i = 2; i < process.argv.length; i++) {
    jobsToStart.push(process.argv[i]);
  }

  if(jobsToStart.length > 0) {
    console.log(`Will only start following jobs: ${jobsToStart.join(', ')}`);
  }
  else {
    console.log(`Will start all jobs`);
  }

  for(let job of jobs) {
    console.log(job);

    if(jobsToStart.length > 0 && !jobsToStart.includes(job.file)) {
      console.log(`Will not start ${job.file}`);
      continue;
    }

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