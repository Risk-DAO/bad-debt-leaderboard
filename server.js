require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.SERVER_PORT
const {version} = require('./package.json')
const badDebtCache = require('./badDebtCache')
const { fork } = require('node:child_process');

const every10Minutes = 1000 * 60 * 10

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
  setInterval(badDebtCache.init, every10Minutes)

  app.listen(port, () => {
    console.log(`listening on port ${port}`)
  })
}

startServer()

const backgroundJobs = fork('background.js');
backgroundJobs.on('error', err => console.error)
backgroundJobs.on('data', err => console.log)
backgroundJobs.on('exit', code => {
  console.err(new Error('background jobs exited'))
  process.exit(code)
})