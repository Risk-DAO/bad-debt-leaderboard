import React, { Component } from "react";
import {observer} from "mobx-react"
import platformDetails from "../lending-platfroms-details/index"


function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

class PlatformDetails extends Component {

  constructor(props) {
    super(props);
  }

  render () {
    const { name } = this.props
    const content = platformDetails[name]
    return (
      <div style={{padding: '5px'}}>
        {content()}
      </div>
    )
  }
}

export default observer(PlatformDetails)