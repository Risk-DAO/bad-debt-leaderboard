

import React, { Component } from "react";
import {observer} from "mobx-react"
import mainStore from "../stores/main.store"
import TableView from "./TableView";

class CompoundFroksBadDebt extends Component {

  constructor(props) {
    super(props);
  }

  render () {
    return (
      <div>
        {mainStore.loading && <div>
          <article style={{minHeight: '80vh'}} aria-busy="true"></article>
        </div>}
        {!mainStore.loading &&  <article>
          <h2>Compound Forks Bad Debt</h2>
          <TableView data={mainStore.tableData}/>
        </article>}
      </div>
    )
  }
}

export default observer(CompoundFroksBadDebt)