import "./Home.css";
import { Outlet, Link } from "react-router-dom";

const Home = () =>{

    return(
        <div className="home-container">
            <h1>Digits - Hand Measurement Tool</h1>
            <p>Powered by Google Media Pipe</p>
            <div className="links-container">
                
                <Link 
                            to='/video-webcam'
                            className="simple-link"
                        >Webcam Mode</Link>
                <Link 
                            to='/video-upload'
                            className="simple-link"
                        >Video Upload Mode</Link>

                <Link className="simple-link" target="_blank" rel="noreferrer nofollow" to="https://github.com/KnightHawk15/Digits-HandMeasurementTool">Github</Link>
                <Link className="simple-link" target="_blank" rel="noreferrer nofollow" to="https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker">Google Media Pipe Documentation</Link>
            </div>
            <hr></hr>
            <Outlet />
        </div>
    );
}

export default Home;
