import VideoWebcam from './components/HandTracker/VideoWebcam';
import VideoUpload from './components/HandTracker/VideoUpload';
import Home from './components/Home/Home';
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
          <Route path='/video-webcam' element={<VideoWebcam />} />
          <Route path='/video-upload' element={<VideoUpload />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
