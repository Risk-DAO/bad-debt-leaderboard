const fs = require('fs').promises

const saveJsonFile = async (jsonString, fileName)=> {
  await fs.writeFile(`${fileName}`, jsonString)
}

const listJsonFiles = async () => {
  return fs.readdir('./bad-debt')
}

const getJsonFile = async (fileName) => {
  try{
    return require(`./bad-debt/${fileName}`)
  } catch (err) {
    return null
  }
}

module.exports = {
  saveJsonFile, 
  listJsonFiles,
  getJsonFile
}