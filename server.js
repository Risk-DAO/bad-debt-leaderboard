require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.SERVER_PORT
const {version} = require('./package.json')
const badDebtCache = require('./badDebtCache')
const cors = require('cors')


const everyHour = 1000 * 60 * 60

app.use(cors())

app.get('/bad-debt', (req, res) => {
  try{
    const platform = req.query.platform
    let bd
    if(platform){
      bd = badDebtCache.getBadDebtBy(platform)
    } else {
      bd = badDebtCache.getBadDebt()
    }
    if(!bd){
      res.send(404)
    }
    res.json(bd)
  } catch(e){
    res.send(500)
  }
})

app.get('/bad-debt-sub-jobs', (req, res) => {
  try{
    const { platform, market} = req.query
    let bd
    if(market){
      bd = badDebtCache.getBadDebtSubJobsByMarket(market)
    } else if(platform){
      bd = badDebtCache.getBadDebtSubJobsBy(platform)
    } else {
      bd = badDebtCache.getBadDebtSubJobs()
    }
    if(!bd){
      res.send(404)
    }
    res.json(bd)
  } catch(e){
    res.send(500)
  }
})

app.get('/health', (req, res) => {
  res.json({version})
})
app.get('/', (req, res) => {
  res.json({version})
})


const startServer = async ()=> {
  await badDebtCache.init()
  setInterval(badDebtCache.init, everyHour)  

  app.listen(port, () => {
    console.log(`listening on port ${port}`)
  })
}

startServer()

require('./background')