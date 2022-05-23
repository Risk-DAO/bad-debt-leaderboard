const {listJsonFiles, getJsonFile} = require('./s3Client')

const badDebtCache = {}

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
      badDebtCache[obj.Key.replace('.json', '')] = JSON.parse(file.Body.toString())
    }
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

const getBadDebt = () => { 
  return badDebtCache
}

module.exports = {
  init,
  getBadDebt,
}