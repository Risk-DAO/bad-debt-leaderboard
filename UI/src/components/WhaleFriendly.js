import React, { Component } from "react";
import {observer} from "mobx-react"

class WhaleFriendly extends Component {

  constructor(props) {
    super(props);
  }

  render () {
    let wfn
    if(!this.props.num){
      wfn = 'N/A'
    }else if(this.props.num  <= 500) {
      wfn = this.props.num.toFixed(2)
    }else if(this.props.num / 1000 <= 500) {
      wfn = (this.props.num / 1000).toFixed(2) + 'K'
    } else if(this.props.num / 1000000 <= 500) {
      wfn = (this.props.num / 1000000).toFixed(2) + 'M'
    } else {
      wfn = (this.props.num / 1000000000).toFixed(2) + 'B'
    }
    return (
      <div>
        {wfn}
      </div>
    )
  }
}

export default observer(WhaleFriendly);