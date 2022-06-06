import React from "react";
 
const IronBank = ()=> {
  return (
    <div>
      <h5>Iron Bank</h5>
      <blockquote>
        "Alpha's exploit portion under 0x5f5Cd91070960D13ee549C9CC47e7a4Cd00457bb, <br/>
        we prefer to label this as undercollateralized loan given that Bad Debt is debt that cannot be recovered. <br/>
        
        0xcDDBA405f8129e5bAe101045aa45aCa11C03b1c8 will be bad debt, <br/>
        once liquidation takes place, <br/>
        and we are recovering that bad debt with protocol fees. <br/>

        Given that:<br/>
        <ol>
          <li> Alpha is regularly servicing the debt with payments, </li> 
          <li> there continues to be a strong partnership to launch on new chains, </li> 
          <li> new product development is ongoing to grow protocol fees, </li> 
          <li> and additional collateral top off given the recent valuation pullback is taking place, we consider this undercollateralized."</li>
        </ol>
        <footer>
          <cite>- The Iron Bank Team</cite>
        </footer>
      </blockquote>
    </div>
  )
}

export default IronBank