const {listJsonFiles, getJsonFile} = require('./s3Client')

const badDebtCache = {}
const badDebtSubJobsCache = {}

/**
 * reads bad debt from disk or s3 
 * stores it in ram
 */
const init = async () => {
  try{

    // fetching from S3
    const { Contents: fileNames } = await listJsonFiles()
    for(obj of fileNames){
      const file = await getJsonFile(obj.Key)
      if(obj.Key.indexOf('subjob') === -1){
        badDebtCache[obj.Key.replace('.json', '')] = JSON.parse(file.Body.toString())
      } else {
        const key = obj.Key.replace('.json', '').replace('subjob', '')
        const platform = key.split('_')[1]
        const platformSubJobs = badDebtSubJobsCache[platfrom] = badDebtSubJobsCache[platform] || {}
        platformSubJobs[key] = JSON.parse(file.Body.toString())
      }
    }
    console.log('badDebtCache done')
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

const getBadDebtBy = (platfrom) => { 
  return badDebtCache[platfrom]
}

const getBadDebt = () => { 
  return badDebtCache
}

const getBadDebtSubJobsBy = (platfrom) => { 
  return badDebtSubJobsCache[platfrom]
}

const getBadDebtSubJobs = () => { 
  return badDebtSubJobsCache
}

module.exports = {
  init,
  getBadDebt,
  getBadDebtBy,
  getBadDebtSubJobsBy,
  getBadDebtSubJobs
}