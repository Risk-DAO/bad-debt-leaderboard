import React, { Component } from "react";
import {observer} from "mobx-react"
import ChainIcon from "./ChainIcon";
import PlatformIcon from "./PlatformIcon";

class TableView extends Component {

  constructor(props) {
    super(props);
  }

  render() {
    const data = this.props.data
    debugger
    const head = Object.values(data[0])
    const body = data.slice(1)
    return (
      <div>
        <table role="grid">
        <thead>
          <tr>
            {head.map(v=> <td>{v}</td> )}
          </tr>
        </thead>
        <tbody>
          {body.map(row=> <tr>
            {Object.entries(row).map(([k, v])=> {
              if (k === 'blockChains'){
                return (<td><ChainIcon chain={v}/></td>)
              }              
              if (k === 'badDebt'){
                return (<td>${v}</td>)
              }              
              if (k === 'name'){
                return (<td><PlatformIcon name={v}c/> {v}</td>)
              }
            })}
          </tr>)}
        </tbody>
        </table>
      </div>
    )
  }
}

export default observer(TableView)