import { makeAutoObservable, runInAction } from "mobx"

class MainStore {

  tableData = []
  loading = true

  constructor () {
    makeAutoObservable(this)
    this.init()
  }

  init = () => {
    setTimeout(() =>{
      runInAction(() => {
        this.tableData = [
          { 
            name: "Name",
            blockChains: "Blockchains",
            badDebt: "Bad Debt (USD)"
          },        
          { 
            name: "Compound",
            blockChains: "Ethereum",
            badDebt: "1000000"
          },        
          { 
            name: "Rari-Capital",
            blockChains: "Ethereum,Polygon",
            badDebt: "1000000"
          },          
          { 
            name: "Iron-Bank",
            blockChains: "Ethereum,Polygon,Arbitrum",
            badDebt: "1000000"
          },
        ]
        this.loading = false
      })
    }, 3000)
  }
}

export default new MainStore()