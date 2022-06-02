import React, { Component } from "react";
import {observer} from "mobx-react"
import mainStore from '../stores/main.store'

class BadDebtUsers extends Component {

  constructor(props) {
    super(props);
  }

  render () {
    const { chain, platform, users } = this.props.data
    const amountOfUsers = users.length
    const name = chain + '_' + platform
    return (
      <a target="_blank" href={`${mainStore.apiUrl}/bad-debt?platform=${name}`}>{amountOfUsers} insolvent accounts</a>
    )
  }
}

export default observer(BadDebtUsers)