import { makeAutoObservable, runInAction } from "mobx"
import axios from "axios"

class MainStore {

  tableData = []
  loading = true

  constructor () {
    makeAutoObservable(this)
    this.init()
  }

  init = async () => {
    const {data: badDebt} = await axios.get('http://localhost:8000/bad-debt')
    debugger
    const promises = Object.entries(badDebt).map(async ([k, v])=> {
      const [chain, platform] = k.split('_')
      const {total, updated, users} = v
      // ['Name', 'Blockchains', 'TVL', 'Bad Debt (USD)', 'last update', 'Details']
      let tvl;
      try{
        tvl = (await axios.get('https://api.llama.fi/tvl/' + platform)).data
      } catch (e) {
        console.error(e)
      }
      return {
        platform,
        chain,
        tvl,
        total,
        updated,
        users,
      }
    })

    const results = await Promise.all(promises)
    
    runInAction(() => {
      this.tableData = results
      this.loading = false
    })
  }
}

export default new MainStore()