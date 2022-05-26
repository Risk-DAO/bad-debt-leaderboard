import React, { Component } from "react";
import {observer} from "mobx-react"

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

class PlatformName extends Component {

  constructor(props) {
    super(props);
  }

  render () {
    const txt = this.props.name.split("-").map(capitalizeFirstLetter).join(" ")
    return (
      <span>{txt}</span>
    )
  }
}

export default PlatformName;