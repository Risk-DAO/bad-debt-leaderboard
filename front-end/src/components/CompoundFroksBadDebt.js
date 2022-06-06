

import React, { Component } from "react";
import {observer} from "mobx-react"
import mainStore from "../stores/main.store"
import TableView from "./TableView";

class CompoundFroksBadDebt extends Component {

  constructor(props) {
    super(props);
  }

  render () {
    const theme = mainStore.blackMode ? 'dark' : 'light';
    return (
      <div>
        {mainStore.loading && <div>
          <article style={{minHeight: '80vh'}} aria-busy="true"></article>
        </div>}
        {!mainStore.loading &&  <article>
          <header>
            <h2>Compound Forks Bad Debt</h2>
          </header>
          <TableView data={mainStore.tableData}/>
          <footer style={{display: 'flex', justifyContent: 'center'}}>
            <a href="https://zapper.fi" target="_blank">
              <img src={`/images/power-zapper-${theme}.svg`}/>
            </a>
          </footer>
        </article>}
      </div>
    )
  }
}

export default observer(CompoundFroksBadDebt)