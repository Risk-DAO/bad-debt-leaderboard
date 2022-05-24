import React, { Component } from "react";
import {observer} from "mobx-react"
import ChainIcon from "./ChainIcon";
import PlatformIcon from "./PlatformIcon";
import LastUpdate from "./LastUpdate";
import WhaleFriendly from "./WhaleFriendly";
import BadDebtUsers from "./BadDebtUsers";

class TableView extends Component {

  constructor(props) {
    super(props);
  }

  render() {
    const data = this.props.data
    const head = ['Name', 'Blockchains', 'TVL', 'Bad Debt (USD)', 'Last Update', 'Details']
    const body = data
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
              if (k === 'platform'){
                return (<td><PlatformIcon name={v}c/> {v}</td>)
              }
              if (k === 'chain'){
                return (<td><ChainIcon chain={v}/></td>)
              }
              if (k === 'tvl'){
                return (<td><WhaleFriendly num={v}/></td>)
              }                   
              if (k === 'total'){
                return (<td><WhaleFriendly num={v}/></td>)
              }                  
              if (k === 'updated'){
                return (<td><LastUpdate timestamp={v}/></td>)
              }               
              if (k === 'users'){
                return (<td><BadDebtUsers data={row}/></td>)
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