import React, { Component } from "react";
import {observer} from "mobx-react"
import mainStore from "../stores/main.store"

const styles = {
  article: { minHeight: '340px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  a: {}
}

class ComingSoon extends Component {

  constructor(props) {
    super(props);
  }

  render () {
    const color = mainStore.blackMode ? 'white' : 'black';
    return (
      <div>
        <h2 style={{textAlign: 'center'}}>
          Research & risk analysis <br/> for DeFi landing protocols
        </h2>
        <div className="grid">
          <a style={styles.a}href="https://medium.com/risk-dao/introducing-risk-dao-75a241115c95" target="_blank">
            <article style={styles.article}>
              <img src={`/images/cs/intro.png`}/>
                Introducing Risk DAO
            </article>
          </a>
          <a style={styles.a}href="https://medium.com/risk-dao/using-the-riskdao-simulation-gui-2aaffd6c5792" target="_blank">
            <article style={styles.article}>
              <img src={`/images/cs/Ts.png`}/>
                Using the RiskDAO simulation GUI
            </article>
          </a>
          <a style={styles.a}href="https://medium.com/risk-dao/vesta-finance-system-parameterization-risk-analysis-b52aaf7b56e5" target="_blank">
            <article style={styles.article}>
            <img src={`/images/cs/vesta.png`}/>
                Vesta Finance: System Parameterization Risk Analysis
            </article>
          </a>
        </div>
      </div>
    )
  }
}

export default observer(ComingSoon)