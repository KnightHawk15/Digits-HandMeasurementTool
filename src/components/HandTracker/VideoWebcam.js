import React from 'react';
import './HandTracking.css';
import Webcam from 'react-webcam';
import {Hands} from '@mediapipe/hands'; 
import * as hands from '@mediapipe/hands';
import * as cam from '@mediapipe/camera_utils';
import {useRef, useEffect, useState} from 'react';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import diagram_left from './Images/joints-angles-left.png';
import diagram_right from './Images/joints-angles-right.png';
import diagram_tips_distance from "./Images/tips-distance.png";
import diagram_wrist_tips_angles from "./Images/wrist-tips-angles.png";
import diagram_pinky_index_distance from "./Images/pinky-index-distance.png";
import { joints_angles, tips_distance, tips_angles } from './diagram-map';
import {
  convertToVector,
  convertToVectorFullFinger,
  calculateMagnitude,
  calculateAngle,
  calculateAngleFullFinger,
  calculateDistances,
  calculateDistances2d,
  downloadCSV,
} from './handTrackingUtils';

const startTime = Date.now();

function VideoWebcam(){

  const mpHandsRef = useRef(null);
  const webCamRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasRefDiagram = useRef(null);
  const canvasRefTips = useRef(null);
  const canvasRefTipsAngles = useRef(null);
  const canvasRefIPDist = useRef(null);
  const [diagram, setDiagram] = useState(diagram_right);
  const camRes1 = useRef(720);
  const camRes2 = useRef(1280);
  

  // Model Config
  const minDetectionConfidence = useRef(0.75);
  const minTrackingConfidence = useRef(0.7);
  const indexLength = useRef(9);
  const dimension = useRef(3);
  const sampleFps = useRef(10);

  // Data
  const DataIn = useRef([]);
  const DataOut = useRef([]);

  //CONTROL FORM SUBMIT
  function handleControlSubmit(e){
    //Prevent browser refresh
    e.preventDefault();
 

    // Read inputs
    const form = e.target;
    const formData = new FormData(form);

    const formJson = Object.fromEntries(formData.entries());
    console.log(formJson);

    if (formJson.camRes1  && formJson.camRes2 !== ""){
      camRes1.current = formJson.camRes1;
      camRes2.current = formJson.camRes2;
    }
    if(formJson.minDetectionConfidence !== ""){
      minDetectionConfidence.current = formJson.minDetectionConfidence;
    } 
    if(formJson.minTrackingConfidence !== "") {
      minTrackingConfidence.current  = formJson.minTrackingConfidence;
    } 
    if(formJson.sampleFps !== "") {
      sampleFps.current = Number(formJson.sampleFps);
    }
    if(formJson.IndexLength !== "")  {
      indexLength.current = formJson.IndexLength;
    }
    if(formJson.dimension !== "") {
      dimension.current = formJson.dimension;
    }


  }

  const collectData = (objArr) =>{
    if(objArr.multiHandLandmarks.length === 0){
      return;
    }
    const coordinates=[];
    //Determines the time stamp of each dataset 
    const endTime = Date.now();
    const deltaTime = endTime - startTime;
    coordinates.push(deltaTime);

    //Iterate through the array of landmarks which contain 21 distinct sets of points
    
    for(let i=0; i<21; i++){
      //Retrieve the x, y, z points of each landmark 
      const xVal = objArr.multiHandLandmarks[0][i].x;
      const yVal = objArr.multiHandLandmarks[0][i].y;
      const zVal = objArr.multiHandLandmarks[0][i].z;
      //Push the points to an array reducing to 6 decimal points 
      coordinates.push([parseFloat(xVal), parseFloat(yVal), parseFloat(zVal)]);
    }
    

    const vectors = convertToVector(coordinates,camRes1.current,camRes2.current);
    const magnitudes =  calculateMagnitude(vectors);

    //Full Finger Angles:
    const coordinatesFF = [coordinates[1],coordinates[5],coordinates[9],coordinates[13],coordinates[17],coordinates[21]];
    const [vectorsFF, magnitudeFF] = convertToVectorFullFinger(coordinatesFF,camRes1.current,camRes2.current);
    const anglesFF = calculateAngleFullFinger(vectorsFF,magnitudeFF,deltaTime);

    const angles = calculateAngle(vectors, magnitudes, deltaTime);
    
    var distances = [];
    if(dimension.current === 3){
      distances = calculateDistances(coordinates, indexLength.current);
    } else {
      distances = calculateDistances2d(coordinates, indexLength.current);
    }

    DataIn.current.push(['Webcam',angles.slice(1),distances.slice(0,4),distances[4],anglesFF.slice(1)]);

    // Diagrams
    const canvasElementDiagram = canvasRefDiagram.current;
    const canvasCtxDia = canvasElementDiagram.getContext("2d");//.setTransform(2, 0, 0, 2, 0, 0);
    canvasElementDiagram.width = 296.5;
    canvasElementDiagram.height = 351;
    canvasCtxDia.imageSmoothingEnabled = false;

    var img = document.getElementById("diagram_preload");
    canvasCtxDia.save();
    canvasCtxDia.fillStyle = "#fff";
    canvasCtxDia.font = "9px Arial";
    canvasCtxDia.textAlign = "center";
    canvasCtxDia.clearRect(0,0,canvasElementDiagram.width,canvasElementDiagram.height);
    canvasCtxDia.drawImage(
      img,
      0,
      0,
      296.5,//canvasElementDiagram.height*0.9,
      351//canvasElementDiagram.height
    );
    if(objArr.multiHandedness[0].label === "Right"){
      setDiagram(diagram_right);
      for(let i=1; i<16; i++){
        canvasCtxDia.fillText(
          String(Math.round(angles[i])),
          296.5 - (joints_angles[i-1][0]),
          (joints_angles[i-1][1])
  
        )
      }
    }
    else {
        setDiagram(diagram_left);
        for(let i=1; i<16; i++){
          canvasCtxDia.fillText(
            String(Math.round(angles[i])),
            (joints_angles[i-1][0]),
            (joints_angles[i-1][1])
    
          )
        }
    }

    const canvasElementTips = canvasRefTips.current;
    const canvasCtxTips = canvasElementTips.getContext("2d");//.setTransform(2, 0, 0, 2, 0, 0);
    canvasElementTips.width = 296.5;
    canvasElementTips.height = 351;
    canvasCtxTips.imageSmoothingEnabled = false;

    img = document.getElementById("diagram_preload_tips");
    canvasCtxTips.save();
    canvasCtxTips.fillStyle = "#000";
    canvasCtxTips.font = "12px Arial";
    canvasCtxTips.textAlign = "center";
    canvasCtxTips.clearRect(0,0,canvasElementTips.width,canvasElementTips.height);
    canvasCtxTips.drawImage(
      img,
      0,
      0,
      296.5,
      351
    );
    for(let i=0; i<tips_distance.length; i++){
      canvasCtxTips.fillText(
        distances[i].toFixed(1),
        (tips_distance[i][0]),
        (tips_distance[i][1])

      )
      }

      const canvasElementTipsAngles = canvasRefTipsAngles.current;
      const canvasCtxTipsAngles = canvasElementTipsAngles.getContext("2d");//.setTransform(2, 0, 0, 2, 0, 0);
      canvasElementTipsAngles.width = 296.5;
      canvasElementTipsAngles.height = 351;
      canvasCtxTipsAngles.imageSmoothingEnabled = false;
  
      img = document.getElementById("diagram_preload_tips_angles");
      canvasCtxTipsAngles.save();
      canvasCtxTipsAngles.fillStyle = "#000";
      canvasCtxTipsAngles.font = "12px Arial";
      canvasCtxTipsAngles.textAlign = "center";
      canvasCtxTipsAngles.clearRect(0,0,canvasElementTipsAngles.width,canvasElementTipsAngles.height);
      canvasCtxTipsAngles.drawImage(
        img,
        0,
        0,
        296.5,
        351
      );


      for(let i=0; i<tips_angles.length; i++){
        canvasCtxTipsAngles.fillText(
          String(Math.round(anglesFF[i+1])),
          (tips_angles[i][0]),
          (tips_angles[i][1])
  
        )
        }
      
        const canvasElementIPDist = canvasRefIPDist.current;
        const canvasCtxIPDist = canvasElementIPDist.getContext("2d");//.setTransform(2, 0, 0, 2, 0, 0);
        canvasElementIPDist.width = 296.5;
        canvasElementIPDist.height = 351;
        canvasCtxIPDist.imageSmoothingEnabled = false;
    
        img = document.getElementById("diagram_preload_IPDist");
        canvasCtxIPDist.save();
        canvasCtxIPDist.fillStyle = "#000";
        canvasCtxIPDist.font = "12px Arial";
        canvasCtxIPDist.textAlign = "center";
        canvasCtxIPDist.clearRect(0,0,canvasElementIPDist.width,canvasElementIPDist.height);
        canvasCtxIPDist.drawImage(
          img,
          0,
          0,
          296.5,
          351
        );
        canvasCtxIPDist.fillText(
          distances[4].toFixed(1),
          122,
          54
        )
        
  }

  const onResults = (results)=>{
  if (!canvasRef.current) return;
  if (!results || !results.image) return;
  if (!webCamRef.current || !webCamRef.current.video) return;

    let videoWidth = 200;
    let videoHeight = 200;
    videoWidth = webCamRef.current.video.videoWidth;
    videoHeight = webCamRef.current.video.videoHeight;

    //Sets height and width of canvas 
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    const canvasElement =  canvasRef.current;
    const canvasCtx = canvasElement.getContext("2d");

    canvasCtx.save();
    canvasCtx.clearRect(0,0,canvasElement.width,canvasElement.height);
    canvasCtx.drawImage(
      results.image,
      0,
      0,
      canvasElement.width,
      canvasElement.height
    );

    if(results.multiHandLandmarks){
      
      for(const landmarks of results.multiHandLandmarks) {
        drawConnectors(canvasCtx, landmarks, hands.HAND_CONNECTIONS,
          {color: "#00FF00", lineWidth: 2});
        drawLandmarks(canvasCtx, landmarks, {color: "#00ffd0", lineWidth: 1});//#5d0db8 purple
      
      }

      collectData(results);
      // console.log(results)
    }
    canvasCtx.restore();
  }

  useEffect(()=>{
    let camera = null;
    // Load MP Hands
    const mdc = minDetectionConfidence.current;
    const mtc = minTrackingConfidence.current;

    if(!mpHandsRef.current){
      mpHandsRef.current = new Hands({
        locateFile:(file)=>{
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        },
      });
    // Configure
    mpHandsRef.current.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: mdc,
      minTrackingConfidence: mtc
    });
    }
    // Collect/Display
    mpHandsRef.current.onResults(onResults);
    // Initialize
    if(mpHandsRef.current !== null && webCamRef.current.video !== null && (typeof webCamRef.current !== 'undefined') && webCamRef.current !== null){
      camera = new cam.Camera(webCamRef.current.video, {
        onFrame: async () => {
        if(webCamRef.current && webCamRef.current.video.readyState === 4){
          await mpHandsRef.current.send({image: webCamRef.current.video});
        }
      }
      });
      camera.start();
    }

    return () => {
    if (camera) camera.stop();
  };

  });

useEffect(() => {
  return () => {
    if (mpHandsRef.current) {
      try { 
        mpHandsRef.current.close(); 
      } catch (e) {}
      mpHandsRef.current = null;
    }
  };
  }, []);

    // EVENT HANDLERS

  // CONFIG

  //DATA
  function eventDownloadAll(e){
    e.preventDefault();
    downloadCSV(DataIn.current);
  };
  function eventDownloadCapture(e){
    e.preventDefault();
    downloadCSV(DataOut.current);
  }

  function resetCollection(e){
    e.preventDefault();
    DataIn.current.length = 0;
    DataOut.current.length = 0;
  }

  function capture(e){
    e.preventDefault();
    DataOut.current.push(DataIn.current[DataIn.current.length-1]);
    console.log(DataIn.current[DataIn.current.length-1]);
  }

  return(
    <div className="container-hand-tracker">
      <div className="panel-row">

    
        <div className="panel-display-webcam">
          <h1>Display & Controls</h1>
          <div className="container-display-webcam">
            {/* Inputs */}
            <Webcam ref={webCamRef} className="webcam"/>

            {/* Outputs */}
            <canvas ref={canvasRef} className="output-webcam"/>            

            <div className="controls">
            
              <div className='controls-cell'>
                <h2>Download</h2>
                <form className="container-download">
                  <button className="button-form margin-push" onClick={capture}>Measure</button>
                  <button className="button-form margin-push" onClick={eventDownloadAll}>CSV Export</button>
                  <button className="button-form margin-push" onClick={eventDownloadCapture}>CSV Measure</button>
                  <button className="button-form margin-push" onClick={resetCollection}>Reset</button>
                </form>
                
              </div>
          
          </div>
          </div>
          
        </div>

        <div className="panel-data">
          <h1>Diagrams & Measurements</h1>
          <div className="container-data">
              <div className='diagram-grid'>
                <div className='grid-cell'>
                  <h2>Joint Angles (degrees)</h2>
                  <canvas ref={canvasRefDiagram} id ="diagram_out" className="diagram"/> 
                  <img id="diagram_preload" src={diagram} alt="hand diagram" className="diagrams_src"/>
                </div>
                <div className='grid-cell'>
                  <h2>Tips Distances (cm)</h2>
                  <canvas ref={canvasRefTips} id ="diagram_out" className="diagram"/> 
                  <img id="diagram_preload_tips" src={diagram_tips_distance} alt="hand diagram" className="diagrams_src"/>
                </div>
                <div className='grid-cell'>
                  <h2>Tips-Wrist Angles (degrees)</h2>
                  <canvas ref={canvasRefTipsAngles} id ="diagram_out" className="diagram"/> 
                  <img id="diagram_preload_tips_angles" src={diagram_wrist_tips_angles} alt="hand diagram" className="diagrams_src"/>
                </div>
                <div className='grid-cell'>
                  <h2>Index-Pinky Distance (cm)</h2>
                  <canvas ref={canvasRefIPDist} id ="diagram_out" className="diagram"/> 
                  <img id="diagram_preload_IPDist" src={diagram_pinky_index_distance} alt="hand diagram" className="diagrams_src"/>
                </div>
              </div>
              <div className="controls">
            <form method="post" onSubmit={handleControlSubmit} className="control-form">
                <div className='controls-cell'>
                  <h2>Model Config</h2>
                  <div className="control-form-child">
                    <div className='formItem'>
                      <label className="field-label">Camera Res. Width</label>
                      <input name="camRes1.current" className="input-box" type="number" placeholder={camRes1.current} />
                    </div>
                    <div className='formItem'>
                      <label className="field-label">Camera Res. Height</label>
                      <input name="camRes2.current" className="input-box" type="number" placeholder={camRes2.current}/>
                    </div>
                    <div className='formItem'>
                      <label className="field-label">Min. Detection Conf.</label>
                      <input name="minDetectionConfidence" className="input-box" type="number" step="0.01" placeholder={minDetectionConfidence.current}/>
                    </div>
                    <div className='formItem'>
                      <label className="field-label">Min. Tracking Conf.</label>
                      <input name="minTrackingConfidence" className="input-box" type="number" step="0.01" placeholder={minTrackingConfidence.current}/>
                    </div>
                    <div className='formItem'>
                      <label className="field-label">Sample FPS</label>
                      <input name="sampleFps" className="input-box" type="number" step="1" placeholder={sampleFps.current}/>
                    </div>
                    <div className='formItem'>
                      <label className="field-label">Index Finger MCT - TIP</label>
                      <input name="IndexLength" className="input-box" type="number" step="0.01" placeholder={indexLength.current} />
                    </div>
                    <div className='formItem'>
                      <label className="field-label">Dist. Calc. Dimension</label>
                      <select name="dimension" className='dropdown'>
                        <option value="3">3D</option>
                        <option value="2">2D</option>
                      </select>
                    </div>
                  </div>
                </div>
                <button type='submit' className="button-form margin-push">Submit Config</button>
              
            </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoWebcam;