import React, { Component, Fragment } from "react";
import {observer} from "mobx-react"
import PlatformName from './PlatformName'
import PlatformIcon from './PlatformIcon'
import mainStore from "../stores/main.store";
const platformDetails = require('../platform-details.json')

const detailsStyle = {
  minWidth: '160px',
  padding: 0,
  margin: 0,
  border: 'none'

}
const summaryStyle = {
  padding: 0,
  margin: 0,
}

class Platform extends Component {

  constructor(props) {
    super(props);
  }

  render () {
    const {name} = this.props
    const hasDetails = platformDetails[name]
    if(hasDetails){
      return (
        <details style={detailsStyle}><summary style={summaryStyle} onClick={()=> mainStore.openTableRowDetails(name)}><PlatformIcon name={name}/> <PlatformName name={name}/></summary></details>
      )
    }
    return (<Fragment>
      <PlatformIcon name={name}/> <PlatformName name={name}/>
    </Fragment>)
  }
}

export default observer(Platform);