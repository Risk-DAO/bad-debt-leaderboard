require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.SERVER_PORT
const {version} = require('./package.json')
const badDebtCache = require('./badDebtCache')

const everyHour = 1000 * 60 * 60

app.get('/bad-debt', (req, res) => {
  try{
    const bd = badDebtCache.getBadDebt()
    res.json(bd)
  } catch(e){
    res.send(500)
  }
})

app.get('/health', (req, res) => {
  res.json({version})
})

app.use(express.static('public'))

const startServer = async ()=> {
  await badDebtCache.init()
  setInterval(badDebtCache.init, everyHour)

  app.listen(port, () => {
    console.log(`listening on port ${port}`)
  })
}

startServer()

require('./background')