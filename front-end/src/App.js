import '@picocss/pico'
import {observer} from "mobx-react"

import TableView from './components/TableView'
import mainStore from './stores/main.store'

function App() {
  return (
    <div className="App">
      <div className="container">
        <article>
          <h1>Compound Forks Bad Debt</h1>
          <p>
            this risk table was made by the Risk DAO

          </p>
        </article>
        {mainStore.loading && <div>
          <article aria-busy="true"></article>
        </div>}
        {!mainStore.loading &&  <article>
          <TableView data={mainStore.tableData}/>
        </article>}
      </div>
    </div>
  );
}

export default observer(App);
