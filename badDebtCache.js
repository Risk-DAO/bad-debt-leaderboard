const {listJsonFiles, getJsonFile} = require('./githubClient')

const badDebtCache = {}
const badDebtSubJobsCache = {}

/**
 * reads bad debt from disk or s3 
 * stores it in ram
 */
const init = async () => {
  try{
    // fetching from S3
    const fileNames = await listJsonFiles()
    for(let fileName of fileNames){
      const file = await getJsonFile(fileName)
      if(fileName.indexOf('subjob') === -1){
        badDebtCache[fileName.replace('.json', '')] = file
      } else {
        const key = fileName.replace('.json', '').replace('subjob', '')
        const platform = key.split('_')[1]
        const platformSubJobs = badDebtSubJobsCache[platform] = badDebtSubJobsCache[platform] || {}
        platformSubJobs[key] = file
      }
    }
    console.log('badDebtCache done')
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

const getBadDebtBy = (platform) => { 
  return badDebtCache[platform]
}

const getBadDebt = () => { 
  return badDebtCache
}

const getBadDebtSubJobsBy = (platform) => { 
  return badDebtSubJobsCache[platform]
}


const getBadDebtSubJobsByMarket = (market) => { 
  const [,platform,] = market.split('_')
  const cached = badDebtSubJobsCache[platform] || {}
  return cached[market]
}

const getBadDebtSubJobs = () => { 
  return badDebtSubJobsCache
}

module.exports = {
  init,
  getBadDebt,
  getBadDebtBy,
  getBadDebtSubJobsBy,
  getBadDebtSubJobsByMarket,
  getBadDebtSubJobs
}