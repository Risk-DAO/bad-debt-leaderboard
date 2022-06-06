import { makeAutoObservable, runInAction } from "mobx"
import axios from "axios"
import web3Utils from "web3-utils"

const {fromWei} = web3Utils

const deciamlNameMap = Object.assign({}, ...Object.entries(web3Utils.unitMap).map(([a,b]) => ({ [b]: a })))

class MainStore {

  tableData = []
  tableRowDetails = null
  loading = true
  isLocalHost = window.location.hostname === 'localhost'
  apiUrl = 'https://api.riskdao.org'
  blackMode =  null

  constructor () {
    makeAutoObservable(this)
    this.init()
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      // dark mode
      this.blackMode = true
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      this.blackMode = !!e.matches
    });
  }

  init = async () => {

    const {data: badDebt} = await axios.get(this.apiUrl + '/bad-debt')
    
    const promises = Object.entries(badDebt).map(async ([k, v])=> {
      const [chain, platform] = k.split('_')
      const {total, updated, users, decimals, tvl} = v

      const decimalName = deciamlNameMap[Math.pow(10, decimals).toString()]
      const totalDebt = Math.abs(parseFloat(fromWei(total, decimalName)))
      return {
        platform,
        chain,
        tvl: fromWei(tvl),
        total: totalDebt,
        updated,
        users,
      }
    })

    const results = (await Promise.all(promises)).sort((a, b) => {
      return Number(b.tvl) - Number(a.tvl)
     })
    
    runInAction(() => {
      this.tableData = results
      this.loading = false
    })
  }

  openTableRowDetails = (name)=> {
    if(this.tableRowDetails === name){
      this.tableRowDetails = null
      return
    }
    this.tableRowDetails = name
  }
}

export default new MainStore()
