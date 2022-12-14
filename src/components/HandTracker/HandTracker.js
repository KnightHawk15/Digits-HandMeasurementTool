import React from 'react';
import './HandTracker.css';
import Webcam from 'react-webcam';
import {Hands} from '@mediapipe/hands'; 
import * as hands from '@mediapipe/hands';
import * as cam from '@mediapipe/camera_utils';
import {useRef, useEffect, useState} from 'react';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import diagram_left from './skeleton_left.png';
import diagram_right from './skeleton_right.png';
// import temp_upload from './testing_10sec.mp4';
import { diagram_map } from './map';
// import ReactPlayer from 'react-player'

const startTime = Date.now();

const LandMarkDataALL = [];
const LandMarkDataCoords = [];
const LandMarkDataAngles = [];
const file_names = [];
var mp_hands = null;
var current_file = "";
var file_attr = [];

function HandTracker(){

  // Display: 

  const webCamRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasRefDiagram = useRef(null);
  const [diagram, setDiagram] = useState(diagram_right);
  const [digit_z, setDigit_z] = useState(0);
  const [camRes1, setCamRes1] = useState(720);
  const [camRes2, setCamRes2] = useState(1280);
  const [res_height, setResHeight] = useState(720);
  const [res_width, setResWidth] = useState(1280);

  let camera = null;  

  // Model Config
  const [minDetectionConfidence, setminDetectionConfidence] = useState(0.75);
  const [minTrackingConfidence, setminTrackingConfidence] = useState(0.7);
  
  // Video:
  const [filesSrc, setFilesSrc] = useState(null); // array for the uploaded videos
  const videoRef = useRef();
  const [video_play, setVideoPlay] = useState(false);
  const [file_index, setFileIndex] = useState(0);
  const [input_mode, setinputMode] = useState(true); // true = webcam, false = upload
  
  const objectToCSVRow = (dataObject) => {
    let dataArray = [];
    for (let o in dataObject) {
        let innerValue = dataObject[o]===null? '' : dataObject[o].toString();
        let result = innerValue.replace(/"/g, ' ');
        result = ' ' + result + ', ';
        dataArray.push(result);
    }
    return dataArray.join(' ') + '\r\n';
  }

  const downloadCSV = (arrayOfObjects=[]) =>{
  console.log(arrayOfObjects);
  let measurements = arrayOfObjects;
    if (!measurements.length) {
      return alert('No data available for download.');
  }

  // Last measurement flagging
  let temp_file = measurements[0][18]; //get first file_name
  for(let i = 0; i < measurements.length; i++){
    if(temp_file !== measurements[i][18]){
      measurements[i-1][17] = true;
      temp_file = measurements[i][18];
    }
  }
  measurements[measurements.length - 1][17] = true;

  let csvContent = "data:text/csv;charset=utf-8,";
  measurements.forEach((item)=>{
      csvContent += objectToCSVRow(item);
  }); 
    let encodedUri = encodeURI(csvContent);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "landmarkData.csv");
    document.body.appendChild(link); 
    link.click();
    document.body.removeChild(link);
  }

  const collectData = (objArr) =>{
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
    
    const vectors = convertToVector(coordinates);
    const magnitudes =  calculateMagnitude(vectors);
    const angles = calculateAngle(vectors, magnitudes, deltaTime);
    
    
    
    // Diagram

    const canvasElementDiagram = canvasRefDiagram.current;
    const canvasCtxDia = canvasElementDiagram.getContext("2d");//.setTransform(2, 0, 0, 2, 0, 0);
    canvasElementDiagram.width = 361;
    canvasElementDiagram.height = 604;
    canvasCtxDia.imageSmoothingEnabled = false;

    var img = document.getElementById("diagram_preload");
    canvasCtxDia.save();
    canvasCtxDia.fillStyle = "#DB0E00";
    canvasCtxDia.font = "24px Arial";
    canvasCtxDia.clearRect(0,0,canvasElementDiagram.width,canvasElementDiagram.height);
    canvasCtxDia.drawImage(
      img,
      0,
      0,
      361,//canvasElementDiagram.height*0.9,
      604//canvasElementDiagram.height
    );
    if(objArr.multiHandedness[0].label === "Right"){
      setDiagram(diagram_left);
      for(let i=1; i<16; i++){
        canvasCtxDia.fillText(
          String(Math.round(angles[i])),
          361 - (diagram_map[i-1][0])*1,
          (diagram_map[i-1][1])*1
  
        )
      }
    }
    else {
        setDiagram(diagram_right);
        for(let i=1; i<16; i++){
          canvasCtxDia.fillText(
            String(Math.round(angles[i])),
            (diagram_map[i-1][0])*1,
            (diagram_map[i-1][1])*1
    
          )
        }
    }

    LandMarkDataCoords.push(coordinates);

    var temp_file = current_file.slice(7,-4);
    if(temp_file[0] === "C"){
          temp_file = temp_file.slice(2)
          temp_file = "true " + temp_file;
    }
    else {
      temp_file = "false " + temp_file;
    }
    // temp_file = temp_file.replace(" ","");
    if(!temp_file.includes("copy")){
      temp_file = temp_file.concat(" copy 1");
    }
    temp_file = temp_file.replace("copy ","");
    file_attr = temp_file.split(" ");
    if(file_attr.length !== 6){
      file_attr = ["INCORRECT FILENAME"];
    }
    
    angles.push(file_attr,false,current_file);
    LandMarkDataAngles.push(angles);
    // console.log(LandMarkDataAngles);
    LandMarkDataALL.push([coordinates,angles]);
  }



  //Checks out 
  const convertToVector = (coordinates) =>{
    //Landmark 0 --> Landmark 4
    const vectors1 = [];
    //Landmark 0 --> Landmark 8
    const vectors2 = [];
    //Landmark 0 --> Landmark 12
    const vectors3 = [];
    //Landmark 0 --> Landmark 16
    const vectors4 = [];
    //Landmark 0 --> Landmark 20
    const vectors5 = [];
    //Each set of vectors 
    const allVectors = [];
    //camRes1 => x,z camRes2 => y 
    //Split hand coordinates into 5 arrays (sections)
    //Section 1 - has 4 vectors 
    for(let i = 1; i<5; i++){
      const x1 = coordinates[i][0] * camRes1;
      const y1 = coordinates[i][1] * camRes2;
      const z1 = coordinates[i][2] * camRes1;
      const x2 = coordinates[i+1][0] * camRes1;
      const y2 = coordinates[i+1][1]* camRes2;
      const z2 = coordinates[i+1][2]* camRes1;
      let vx = (x2 - x1);
      let vy = (y2 - y1);
      let vz = (z2 - z1);
      vx=parseFloat(vx)
      vy=parseFloat(vy)
      vz=parseFloat(vz)
      vectors1.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
    }

    //Section 2
    for(let j = 1; j<5; j++){
      //initially add 4 after first increment 
      if(j===1){
        let vx = ((coordinates[j+5][0]* camRes1)-(coordinates[j][0]* camRes1));
        let vy = ((coordinates[j+5][1]* camRes2)-(coordinates[j][1]* camRes2));
        let vz = ((coordinates[j+5][2]* camRes1)-(coordinates[j][2]* camRes1));
        vx=parseFloat(vx)
        vy=parseFloat(vy)
        vz=parseFloat(vz)
        vectors2.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
      }
      else{
        const x1 = coordinates[j+4][0]* camRes1;
        const y1 = coordinates[j+4][1]* camRes2;
        const z1 = coordinates[j+4][2]* camRes1;
        const x2 = coordinates[j+5][0]* camRes1;
        const y2 = coordinates[j+5][1]* camRes2;
        const z2 = coordinates[j+5][2]* camRes1;
        let vx = (x2 - x1);
        let vy = (y2 - y1);
        let vz = (z2 - z1);
        vx=parseFloat(vx)
        vy=parseFloat(vy)
        vz=parseFloat(vz)
        vectors2.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
      }
    }

    //Section 3
    for(let k = 1; k<5; k++){
      //initially add 4 after first increment 
      if(k===1){
        let vx = ((coordinates[k+9][0]* camRes1)-(coordinates[k][0]* camRes1));
        let vy = ((coordinates[k+9][1]* camRes2)-(coordinates[k][1]* camRes2));
        let vz = ((coordinates[k+9][2]* camRes1)-(coordinates[k][2]* camRes1));
        vx=parseFloat(vx)
        vy=parseFloat(vy)
        vz=parseFloat(vz)
        vectors3.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
      }
      else{
        const x1 = coordinates[k+8][0]* camRes1;
        const y1 = coordinates[k+8][1]* camRes2;
        const z1 = coordinates[k+8][2]* camRes1;
        const x2 = coordinates[k+9][0]* camRes1;
        const y2 = coordinates[k+9][1]* camRes2;
        const z2 = coordinates[k+9][2]* camRes1;
        //1. 10, 1  2. 11, 10 3. 12, 11 4. 13, 12
        let vx = (x2 - x1);
        let vy = (y2 - y1);
        let vz = (z2 - z1);
        vx=parseFloat(vx)
        vy=parseFloat(vy)
        vz=parseFloat(vz)
        vectors3.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
      }
    }

    //Section 4
    for(let u = 1; u<5; u++){
      //initially add 4 after first increment 
      if(u===1){
        let vx = ((coordinates[u+13][0]* camRes1)-(coordinates[u][0]* camRes1));
        let vy = ((coordinates[u+13][1]* camRes2)-(coordinates[u][1]* camRes2));
        let vz = ((coordinates[u+13][2]* camRes1)-(coordinates[u][2]* camRes1));
        vx=parseFloat(vx)
        vy=parseFloat(vy)
        vz=parseFloat(vz)
        vectors4.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
      }
      else{
        const x1 = coordinates[u+12][0]* camRes1;
        const y1 = coordinates[u+12][1]* camRes2;
        const z1 = coordinates[u+12][2]* camRes1;
        const x2 = coordinates[u+13][0]* camRes1;
        const y2 = coordinates[u+13][1]* camRes2;
        const z2 = coordinates[u+13][2]* camRes1;
        //1.  14, 1   2. 15, 14   3. 16, 15   4. 17, 16
        let vx = (x2 - x1);
        let vy = (y2 - y1);
        let vz = (z2 - z1);
        
        vectors4.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
      }
    }

    //Section 5
    for(let v = 1; v<5; v++){
      //initially add 4 after first increment 
      if(v===1){
        let vx = ((coordinates[v+17][0]* camRes1)-(coordinates[v][0]* camRes1));
        let vy = ((coordinates[v+17][1]* camRes2)-(coordinates[v][1]* camRes2));
        let vz = ((coordinates[v+17][2]* camRes1)-(coordinates[v][2]* camRes1));
        
        vectors5.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
      }
      else{
        const x1 = coordinates[v+16][0]* camRes1;
        const y1 = coordinates[v+16][1]* camRes2;
        const z1 = coordinates[v+16][2]* camRes1;
        const x2 = coordinates[v+17][0]* camRes1;
        const y2 = coordinates[v+17][1]* camRes2;
        const z2 = coordinates[v+17][2]* camRes1;
        //1. 18, 1   2. 19, 18  3. 20, 19 4. 21, 20
        let vx = (x2 - x1);
        let vy = (y2 - y1);
        let vz = (z2 - z1);
        
        vectors5.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
      }
    }

    allVectors.push(vectors1, vectors2, vectors3, vectors4, vectors5)
    // console.log(allVectors);
    return allVectors;
  }

  //Checks out 
  const calculateMagnitude = (vectors) =>{
    const magnitudes = [];
    for(let i = 0; i<vectors.length; i++){
      const magnitudeSet = [];
      for(let j = 0; j<vectors.length-1; j++){
        let x = vectors[i][j][0];
        let y = vectors[i][j][1];
        let z = vectors[i][j][2];
        let absVal = abs(x,y,z);
        parseFloat(absVal);
        magnitudeSet.push(absVal);
      }
      magnitudes.push(magnitudeSet);
    }
    return magnitudes;
  }

  //Check 
  const calculateAngle = (vectors, magnitudes, time) => {
    const angles = [time];
    
  //theta = arccos((v1 dot v2)/(|v1||v2|))
  for(let set = 0; set<5; set++){
    angles.push(angle(vectors[set][0], vectors[set][1], magnitudes[set][0], magnitudes[set][1]));
    angles.push(angle(vectors[set][1], vectors[set][2], magnitudes[set][1], magnitudes[set][2]));
    angles.push(angle(vectors[set][2], vectors[set][3], magnitudes[set][2], magnitudes[set][3]));
  }

  /*
  //Vector 
   let ThumbCMC	= angle(vectors[0][0], vectors[0][1], magnitudes[0], magnitudes[1]);
   let ThumbMCP	= angle(vectors[0][1], vectors[0][2], magnitudes[1], magnitudes[2]);
   let ThumbIP = angle(vectors[0][2], vectors[0][3], magnitudes[0], magnitudes[1]);
   let IndexMCP	= angle(vectors[0][0], vectors[0][1], magnitudes[0], magnitudes[1]);
   let IndexPIP	= angle(vectors[0][0], vectors[0][1], magnitudes[0], magnitudes[1]);
   let IndexDIP	= angle(vectors[0][0], vectors[0][1], magnitudes[0], magnitudes[1]);
   let LongMCP = angle(vectors[0][0], vectors[0][1], magnitudes[0], magnitudes[1]);
   let LongPIP = angle(vectors[0][0], vectors[0][1], magnitudes[0], magnitudes[1]);
   let LongDIP = angle(vectors[0][0], vectors[0][1], magnitudes[0], magnitudes[1]);
   let RingMCP = angle(vectors[0][0], vectors[0][1], magnitudes[0], magnitudes[1]);
   let RingPIP = angle(vectors[0][0], vectors[0][1], magnitudes[0], magnitudes[1]);
   let RingDIP = angle(vectors[0][0], vectors[0][1], magnitudes[0], magnitudes[1]);
   let SmallMCP	= angle(vectors[0][0], vectors[0][1], magnitudes[0], magnitudes[1]);
   let SmallPIP = angle(vectors[0][0], vectors[0][1], magnitudes[0], magnitudes[1]);
   let SmallDIP = angle(vectors[0][0], vectors[0][1], magnitudes[0], magnitudes[1]);
   */
  return angles;
  }

  const angle = (vectorOne, vectorTwo, magnitudeOne, magnitudeTwo) => {
    let dotProductResult = dotProduct(vectorOne, vectorTwo);
    // let crossProductResult = crossProduct(vectorOne,vectorTwo);
    let innerCalculation = dotProductResult/(magnitudeOne*magnitudeTwo);
    let angleResult = Math.acos(innerCalculation);
    angleResult = parseFloat(angleResult) * (180/Math.PI);
    angleResult = angleResult.toFixed(2);
    return angleResult;
  }

  const dotProduct = (v1, v2) =>{
    let result = (v1[0]*v2[0])+(v1[1]*v2[1])+(v1[2]*v2[2]);
    return result; 
  }

  const crossProduct = (v1, v2) => {
    let result = []
    result.push(
      (v1[1]*v2[2]-v2[1]*v1[2]),
      -1*(v1[0]*v2[2]-v2[0]*v1[2]),
      (v1[0]*v2[1]-v2[0]*v1[1])
    )
    return result
  }

  const abs = (x,y,z) =>{
    const squareSum = Math.pow(x,2) + Math.pow(y,2) + Math.pow(z,2);
    const absolute = Math.sqrt(squareSum); 
    return absolute;
  }

  const countData = (array) =>{
    const size = array.length;
    return size;
  };


  const onResults = (results)=>{
    let videoWidth = 200;
    let videoHeight = 200;
    if(input_mode){
      videoWidth = webCamRef.current.video.videoWidth;
      videoHeight = webCamRef.current.video.videoHeight;
    } else {
      videoWidth = 168;
      videoHeight = 300;
    }



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
      
      const z = results.multiHandLandmarks[0][0].z;
      setDigit_z(z);

      collectData(results);
    }
    canvasCtx.restore();
  }

  useEffect(()=>{

    // Load MP Hands
    camera = null;

    const mdc = minDetectionConfidence;
    const mtc = minTrackingConfidence;
    


    //const mp_hands = new Hands({
    mp_hands = new Hands({
      locateFile:(file)=>{
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.3.1626903359/${file}`;
      },
    });
    // Configure
    mp_hands.setOptions({
      maxNumHands: 1,
      minDetectionConfidence: mdc,
      minTrackingConfidence: mtc
    });
    // Collect/Display
    mp_hands.onResults(onResults);
    
    // Manage inputs    
    console.log(input_mode);
    console.log(videoRef.current instanceof HTMLVideoElement);

    if(input_mode && webCamRef.current.video !== null && typeof webCamRef.current !== 'undefined' && webCamRef.current !== null){
        camera = new cam.Camera(webCamRef.current.video,{
        onFrame: async()=>{
          await mp_hands.send({image:webCamRef.current.video})
        }
        });
        camera.start();
        console.log("input mode: Webcam")

    }
    else if(videoRef.current !== null){
        async function detectionFrame(){
          await mp_hands.send({image: videoRef.current});
          videoRef.current.requestVideoFrameCallback(detectionFrame);
        }
        videoRef.current.requestVideoFrameCallback(detectionFrame);
        console.log("input mode: Upload")
      }
    
    console.log("New Model Loaded:");
    console.log("mdc",mdc);
    console.log("mtc",mtc);

  }, [input_mode,minDetectionConfidence,minTrackingConfidence]);

    // EVENT HANDLERS

  // UPLOADS

  const onChangeUpload = (e) => {
    setFileIndex(0);
    const files = e.target.files;
    file_names.length = 0;
    
    const srcs = [];
    for(let i = 0; i < files.length; i++){
      srcs.push(URL.createObjectURL(files[i]));
      file_names.push(files[i].name);
    }
    setFilesSrc(srcs);
    console.log(file_names);
    current_file = file_names[0]
  };

  const incrFileIndex = () => {
    setFileIndex((file_index) => file_index + 1);
    setVideoPlay(true);
    if(file_index < file_names.length){
      current_file = file_names[file_index+1];
    }
    // console.log("file name: ",current_file,"file index: ", file_index);
  }

  function eventPlaybackChange(e){
    videoRef.current.defaultPlaybackRate = parseFloat(e.target.value)
  };

  // DOWNLOADS
  function eventDownloadCoords(){
    downloadCSV(LandMarkDataCoords);
  };
  function eventDownloadAngles(){
    downloadCSV(LandMarkDataAngles);
  };
  function eventDownloadAll(){
    downloadCSV(LandMarkDataALL);
  };



  // CONFIG

  //RES
  function onChangeResHeight(e){
    setResHeight(e.target.value);
  }
  function onChangeResWidth(e){
    setResWidth(e.target.value);
  }
  function setResolution(e){
    e.preventDefault();
    setCamRes1(parseInt(res_height));
    setResHeight("");
    setCamRes2(parseInt(res_width));
    setResWidth("");
    console.log(res_height, res_width);
  }
  function onChangeInputMode(){
    setinputMode(!input_mode);

  }

  //HANDS
  function resetCollection(e){
    LandMarkDataALL.length = 0;
    LandMarkDataCoords.length = 0;
    LandMarkDataAngles.length = 0;
  }

  
  return(
    <div className="container-hand-tracker">
      <div className="panel-row">

        <div className="panel-controls">
          
          <h1>CONTROLS</h1>
          <div className="container-controls">
          <h2>Model Config</h2>
          <form className="control-form">
          <label className="field-label">Min. Detection Conf.</label>
          <input className="input-box" type="text" onChange={(e)=>setminDetectionConfidence(parseFloat(e.target.value))} placeholder="0.7" />
          <label className="field-label">Min. Tracking Conf.</label>
          <input className="input-box" type="text" onChange={(e)=>setminTrackingConfidence(parseFloat(e.target.value))} placeholder="0.75" />
          {/* <button className="button-form" onClick={configHands}>Set</button> */}
          </form>
          <hr className="container-sep"/>
          <h2>Capture Mode</h2>
          <div className='button-switch'>
            <button className='button-webcam' onClick={onChangeInputMode} style = {{ backgroundColor: input_mode ? "#5DA85B" : "#FFF", color: input_mode ? "#fff" : "#000"}}>Webcam</button>
            <button className='button-upload' onClick={onChangeInputMode} style = {{ backgroundColor: !input_mode ? "#5DA85B" : "#FFF", color: !input_mode ? "#fff" : "#000"}}>Upload</button>
          </div>
          <hr className="container-sep"/>
          <h2>Upload</h2>
          <form className="container-upload">
          <input className="input-file" type='file' multiple onChange={(e)=>onChangeUpload(e)}/>
          <p>Current file: {current_file}</p>
          
          <p>Please note the video file names <b>must</b> follow the below naming convention <br/><i>DIGITS &lt;C indicating a control, blank otherwise&gt; &lt;Patient No.&gt; &lt;Hand: lt|rt&gt; &lt;View&gt; &lt;Pose&gt; &lt;Trial: copy # or blank for the first trial&gt;</i><br/> Ex. <i>DIGITS C 79 Lt Palmar Ext copy 3.mov</i> or <i>DIGITS 79 Lt Palmar Ext.mov</i></p>
          {/* <label className="field-label">Video Playback Rate:</label>
          <input className="input-box" type="text" onChange={(e)=>eventPlaybackChange(e)} placeholder="1" /> */}
          </form>
          <hr className="container-sep"/>
          <h2>Download</h2>
          <form className="container-download">
            <button className="button-form" onClick={eventDownloadCoords}>Coords</button>
            <button className="button-form" onClick={eventDownloadAngles}>Angles</button>
            <button className="button-form" onClick={eventDownloadAll}>All</button>
          </form>
          <hr className="container-sep"/>
          <button className="button-form" onClick={resetCollection}>Reset Collection</button>
          </div>
        </div>

    
        <div className="panel-display">
          <h1>DISPLAY</h1>
          <div className="container-display">
            {/* Inputs */}
            <Webcam ref={webCamRef} className="webcam"/>
            {filesSrc && (
            <video 
              ref={videoRef} 
              className="output-video" 
              src={filesSrc[file_index]} 
              autoPlay = {video_play}
              onEnded = {incrFileIndex}
              controls
              muted
            >Video is not support in this browser</video>
            )}
            {/* Outputs */}
            <canvas ref={canvasRef} className="output-canvas"/>
            <p>Number of records: {countData(LandMarkDataAngles)}</p>
            
            
            <hr className="container-sep"/>
            <div className="resolution-config">
            <label className="field-label">Camera Resolution:</label>
              <input className="input-box" type="text" value={res_height} onChange={(e)=>onChangeResHeight(e)} placeholder="720p" />
              <input className="input-box" type="text" value={res_width} onChange={(e)=>onChangeResWidth(e)} placeholder="1280p" />
              <button className="button-form" onClick={setResolution}>Set</button>
            </div>
            
          </div>

          
        </div>

        <div className="panel-data">
          <h1>DATA</h1>
          <div className="container-data">
              <h2>Diagram</h2>
              <canvas ref={canvasRefDiagram} id ="diagram_out" className="diagram"/> 
              <img id="diagram_preload" src={diagram} alt="hand diagram" className="diagrams_src"/>
              <hr className="container-sep"/>
              <h2>Read Outs</h2>
              {/* <p>res height: {camRes1}</p>
              <p>res width: {camRes2}</p>
              <h2>Landmark_0</h2>
              <p>X: {digit_x}</p>
              <p>Y: {digit_y}</p>
              <p>Z: {digit_z}</p> */}
              <p>Number of records: {countData(LandMarkDataAngles)}</p>
            
          </div>
        </div>
      </div>
    </div>
  )
}

export default HandTracker;