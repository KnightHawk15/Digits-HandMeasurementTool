import "./Home.css";
import { Outlet, Link } from "react-router-dom";

const Home = () =>{
    return(
        <div className="home-container">
            <h1>Welcome to Digits!</h1>
            <br></br>
            <Link className="button" to='/hand-tracker'>HandTracker - App</Link>
            <Outlet />
        </div>
        
    );
}

export default Home;