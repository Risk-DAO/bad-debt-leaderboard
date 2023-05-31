require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.SERVER_PORT
const {version} = require('./package.json')
const cors = require('cors')

app.use(cors())

app.get('/health', (req, res) => {
  res.json({version})
})
app.get('/', (req, res) => {
  res.json({version})
})

const startServer = async ()=> {
  app.listen(port, () => {
    console.log(`listening on port ${port}`)
  })
}

startServer()

require('./background')