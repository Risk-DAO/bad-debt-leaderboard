import React, { Component } from "react";
import {observer} from "mobx-react"

const tenth = 100
class WhaleFriendly extends Component {

  constructor(props) {
    super(props);
  }

  render () {
    let wfn
    if(!this.props.num){
      wfn = 'N/A'
    }else if(this.props.num  <= tenth) {
      wfn = Number(this.props.num.toFixed(2))
    }else if(this.props.num / 1000 <= tenth) {
      wfn = Number((this.props.num / 1000).toFixed(2)) + 'K'
    } else if(this.props.num / 1000000 <= tenth) {
      wfn = Number((this.props.num / 1000000).toFixed(2)) + 'M'
    } else {
      wfn = Number((this.props.num / 1000000000).toFixed(2)) + 'B'
    }
    return (
      <span>
        {wfn}
      </span>
    )
  }
}

export default observer(WhaleFriendly);