import React, { Component } from "react";
import {observer} from "mobx-react"
import mainStore from "../stores/main.store"

class Hero extends Component {

  constructor(props) {
    super(props);
  }

  render () {
    const color = mainStore.blackMode ? 'white' : 'black';
    return (
      <div className="container" style={{padding: '10vh 0 10vh 0', display: 'flex', justifyContent: 'center'}}>
        <img style={{maxHeight: '10vh', maxWidth: '66vw'}} src={`/images/${color}-wordmark.png`}/>
      </div>
    )
  }
}

export default observer(Hero)