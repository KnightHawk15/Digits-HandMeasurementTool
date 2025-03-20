import "./Home.css";
import { Outlet, Link } from "react-router-dom";

const Home = () =>{
    return(
        <div className="home-container">
            <h1>Digits - Hand Measurement Tool</h1>
            <p>Powered by Google Media Pipe</p>
            <br></br>
            <Link className="simple-link" to='/hand-tracker'>App</Link>
            <a className="simple-link" target="_blank" rel="noreferrer nofollow" href="https://github.com/KnightHawk15/Digits-HandMeasurementTool">Github</a>
            <a className="simple-link" target="_blank" rel="noreferrer nofollow" href="https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker">Google Media Pipe Documentation</a>
            <br></br>
            <hr></hr>
            <Outlet />
            
        </div>
        
    );
}

export default Home;
