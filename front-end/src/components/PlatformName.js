import React, { Component } from "react";
import {observer} from "mobx-react"

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const nameMaps = {
  "rari-capital": "Rari (tetra node pool)"
}

class PlatformName extends Component {

  constructor(props) {
    super(props);
  }

  render () {
    const displayName = nameMaps[this.props.name]
    const txt = !displayName ? this.props.name.split("-").map(capitalizeFirstLetter).join(" ") : displayName
    return (
      <span>{txt}</span>
    )
  }
}

export default PlatformName;