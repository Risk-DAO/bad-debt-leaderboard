const os = require('os-utils');
const {sleep} = require('./utils');
const cpuThreshold = 0.85

const checkCPU = async () => {
  return new Promise(resolve => os.cpuUsage(resolve))
}

const waitForCpuToGoBelowThreshold = async () => {
  let cpuUsage = await checkCPU() 
  console.log({cpuUsage})
  while (cpuUsage > cpuThreshold) {
    console.log('cpu is above ' + cpuThreshold)
    await sleep(60)
    cpuUsage = await checkCPU()
  }
  console.log('cpu is below ' + cpuThreshold)
  return true
}

module.exports = { 
  waitForCpuToGoBelowThreshold,
}