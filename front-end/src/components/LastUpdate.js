import React, { Component } from "react";
import {observer} from "mobx-react"
import moment from 'moment'

class LastUpdate extends Component {

  constructor(props) {
    super(props);
  }

  render () {
    const text = moment(this.props.timestamp * 1000).fromNow()
    return (
      <span>{text}</span>
    )
  }
}

export default LastUpdate;