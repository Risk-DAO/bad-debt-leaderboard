import React, { Component } from "react";
import {observer} from "mobx-react"

class ChainIcon extends Component {

  constructor(props) {
    super(props);
  }

  render () {
    const paltform = this.props.name.toLowerCase()
    return (
      <img style={{borderRadius: '50%'}} src={`/images/platforms/${paltform}.webp`}/>
    )
  }
}

export default ChainIcon;