import { makeAutoObservable, runInAction } from "mobx"
import axios from "axios"
import web3Utils from "web3-utils"

const deciamlNameMap = Object.assign({}, ...Object.entries(web3Utils.unitMap).map(([a,b]) => ({ [b]: a })))


class MainStore {

  tableData = []
  loading = true
  isLocalHost = window.location.hostname === 'localhost'
  apiUrl = 'http://localhost:8000'

  constructor () {
    makeAutoObservable(this)
    this.init()
  }

  init = async () => {

    const {data: badDebt} = await axios.get(this.apiUrl + '/bad-debt')
    
    const promises = Object.entries(badDebt).map(async ([k, v])=> {
      const [chain, platform] = k.split('_')
      const {total, updated, users, decimals} = v

      // ['Name', 'Blockchains', 'TVL', 'Bad Debt (USD)', 'last update', 'Details']
      let tvl;
      try{
        tvl = (await axios.get('https://api.llama.fi/tvl/' + platform)).data
      } catch (e) {
        console.error(e)
      }
      const decimalName = deciamlNameMap[Math.pow(10, decimals).toString()]
      const totalDebt = Math.abs(parseFloat(web3Utils.fromWei(total, decimalName)))
      return {
        platform,
        chain,
        tvl,
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
}

export default new MainStore()
