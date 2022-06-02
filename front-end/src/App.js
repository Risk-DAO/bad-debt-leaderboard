import '@picocss/pico'
import {observer} from "mobx-react"
import CompoundFroksBadDebt from "./components/CompoundFroksBadDebt"
import ComingSoon from "./components/ComingSoon"
import Hero from './components/Hero'
import Footer from './components/Footer'

function App() {
  return (
    <div className="App">
      <Hero/>
      <div className="container page">
        {!process.env.REACT_APP_COMING_SOON && <CompoundFroksBadDebt/>}
        {process.env.REACT_APP_COMING_SOON && <ComingSoon/>}
      </div>
      <Footer/>
    </div>
  );
}

export default observer(App);
