import React, { Component } from "react";
import {observer} from "mobx-react"

class ChainIcon extends Component {

  constructor(props) {
    super(props);
  }

  render () {
    const chains = this.props.chain.split(",").map(c => c.toLowerCase()).filter(c => c)
    return (
      <div>
        {chains.map(chain => <img key={chain} style={{borderRadius: '50%'}} src={`/images/chains/${chain}.webp`}/>)}
      </div>
    )
  }
}

export default ChainIcon;