const MAX_RETRIES = 10

const sleep = async seconds => {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000))
}

const halfHour = 1000 * 60 * 30

/**
 * a small retry wrapper with an incrameting 5s sleep delay
 * @param {*} fn 
 * @param {*} params 
 * @param {*} retries 
 * @returns 
 */
 const retry = async (fn, params, retries = 0) => {
  try {
      if (retries > MAX_RETRIES) {
        console.log(`retry exit ${retries} retries` , fn.name)
        process.exit(0)
      }
      const res = await  fn(...params)
      if(retries){
          console.log(`retry success after ${retries} retries` , fn.name)
      } else {
          console.log(`success on first try`, fn.name)
      }
      return res
  } catch (e) {
      console.error(e)
      retries++
      console.log(`retry #${retries}`)
      const ms = (1000 * 5 * retries) > halfHour ? halfHour : (1000 * 5 * retries)
      await new Promise(resolve => setTimeout(resolve, ms))
      return retry(fn, params, retries)
  }
}

module.exports = { 
  sleep,
  retry
}