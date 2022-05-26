import React, { Component } from "react";
import {observer} from "mobx-react"

class PlatformIcon extends Component {

  constructor(props) {
    super(props);
  }

  render () {
    const platform = this.props.name.toLowerCase()
    return (
      <img style={{borderRadius: '50%'}} src={`/images/platforms/${platform}.webp`}/>
    )
  }
}

export default PlatformIcon;