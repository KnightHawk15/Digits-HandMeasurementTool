import HandTracker from './components/HandTracker/HandTracker';
import Home from './components/Home/Home';
import ErrorPage from './components/ErrorPage/ErrorPage';
import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route
} from 'react-router-dom';

function App() {
  return (
    <Router>
      <Routes>
        <Route exact path='/' element={<Home />}>
          <Route path='/hand-tracker' element={<HandTracker />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
