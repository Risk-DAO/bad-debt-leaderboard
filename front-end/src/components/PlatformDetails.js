import React, { Component } from "react";
import {observer} from "mobx-react"
import mainStore from "../stores/main.store";
const platformDetails = require('../platform-details.json')

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
    debugger
    return (
      <div style={{padding: '5px'}}>
        {content.map((item)=> {
          const {title, subtitle, text} = item

          if(title){
            return (<h5>{title}</h5>)
          }          
          if(subtitle){
            return (<h6>{subtitle}</h6>)
          }          
          if(text){
            return (<p>{text}</p>)
          }

        })}
      </div>
    )
  }
}

export default observer(PlatformDetails)