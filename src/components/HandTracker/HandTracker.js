import React from 'react';
import './HandTracker.css';
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

const startTime = Date.now();

const LandMarkDataALL = [];
const LandMarkDataCoords = [];
const LandMarkDataAngles = [];
const LandMarkDataDistances = [];

const file_names = [];
var mp_hands = null;
var current_file = "";

function HandTracker(){

  // Display: 

  const webCamRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasRefDiagram = useRef(null);
  const canvasRefTips = useRef(null);
  const canvasRefTipsAngles = useRef(null);
  const canvasRefIPDist = useRef(null);
  const [diagram, setDiagram] = useState(diagram_right);
  const [digit_x, setDigit_x] = useState(0);
  const [digit_y, setDigit_y] = useState(0);
  const [digit_z, setDigit_z] = useState(0);
  const [camRes1, setCamRes1] = useState(720);
  const [camRes2, setCamRes2] = useState(1280);
  const [res_height, setResHeight] = useState(720);
  const [res_width, setResWidth] = useState(1280);
  let camera = null;  

  // Model Config
  const [minDetectionConfidence, setminDetectionConfidence] = useState(0.75);
  const [minTrackingConfidence, setminTrackingConfidence] = useState(0.7);
  const [index_input, setIndexInput] = useState(9);
  const [indexLength, setIndexLength] = useState(9);
  
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
  // console.log(arrayOfObjects);
  let measurements = arrayOfObjects;
    if (!measurements.length) {
      return alert('No data available for download.');
  }

  // Last measurement flagging
  let temp_file = measurements[0][17]; //get first file_name
  for(let i = 0; i < measurements.length; i++){
    if(temp_file !== measurements[i][17]){
      temp_file = measurements[i][17];
    }
  }

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
    setDigit_x(Math.round(coordinates[21][0]*camRes1));
    setDigit_y(Math.round(coordinates[21][1]*camRes2));

    const vectors = convertToVector(coordinates);
    const magnitudes =  calculateMagnitude(vectors);

    //Full Finger Angles:
    const coordinatesFF = [coordinates[1],coordinates[5],coordinates[9],coordinates[13],coordinates[17],coordinates[21]];
    const [vectorsFF, magnitudeFF] = convertToVectorFullFinger(coordinatesFF);
    const anglesFF = calculateAngleFullFinger(vectorsFF,magnitudeFF,deltaTime);

    const angles = calculateAngle(vectors, magnitudes, deltaTime);
    const distances = calculateDistances(coordinates)

    setDigit_z(Math.round(distances[5]));
    
    // console.log("Index coords:" + coordinates[9][0]*camRes1 + "," + coordinates[9][1]*camRes2 + "," + coordinates[9][2]*camRes1)
    // console.log("Pinky coords:" + coordinates[21][0]*camRes1 + "," + coordinates[21][1]*camRes2 + "," + coordinates[21][2]*camRes1)
    
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
        
      
    // Push landmark data
    LandMarkDataCoords.push(coordinates);
    angles.push(current_file);
    LandMarkDataAngles.push(angles);
    // console.log(LandMarkDataAngles);
    LandMarkDataALL.push([coordinates,angles]);
  }

  const convertToVectorFullFinger = (coordinates) => {
    const vectors = [];
    for(let i = 1; i<coordinates.length; i++){
      const vx = (coordinates[i][0] - coordinates[0][0])*camRes1;
      const vy = (coordinates[i][1] - coordinates[0][1])*camRes2;
      const vz = (coordinates[i][2] - coordinates[0][2])*camRes1;
      vectors.push([parseFloat(vx),parseFloat(vy),parseFloat(vz)])
    }
    const magnitudes = [];
    for(let j = 0; j < vectors.length; j++){
      magnitudes.push(
        parseFloat(abs(vectors[j][0],vectors[j][1],vectors[j][2]))
      );
    }
    return [vectors, magnitudes];
  }

  //Checks out 
  const convertToVector = (coordinates) =>{
    //console.log(coordinates[8][1]);
    //Landmark 0 --> Landmark 4 (0,1,2,3,4)
    const vectors1 = [];
    //Landmark 0 --> Landmark 8 (0,5,6,7,8)
    const vectors2 = [];
    //Landmark 0 --> Landmark 12 (0,9,10,11,12)
    const vectors3 = [];
    //Landmark 0 --> Landmark 16 (0,13,14,15,16)
    const vectors4 = [];
    //Landmark 0 --> Landmark 20 (0,17,18,19,20)
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
    // console.log(normalize(vectors2[0]));
    // console.log(normalize(vectors2[1]));
    // console.log(normalize(vectors2[2]));
    // console.log(normalize(vectors2[3]));
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
  
  // Helper Func: Distance between two 3D points
  const dbP = (p1,p2) => {
    return parseFloat(Math.sqrt(
        Math.pow((p2[0]-p1[0]),2)+
        Math.pow((p2[1]-p1[1]),2)+
        Math.pow((p2[2]-p1[2]),2)
      ));
    // return Math.sqrt((p2[0]-p1[0])^2+(p2[2]-p1[2])^2+(p2[1]-p1[1])^2);
  }

  const calculateDistances = (coordinates) => {
    const distances = []; 
    const pixelScale = indexLength/dbP(coordinates[6],coordinates[9]);

    distances.push(dbP(coordinates[5],coordinates[9]));
    distances.push(dbP(coordinates[9],coordinates[13]));
    distances.push(dbP(coordinates[13],coordinates[17]));
    distances.push(dbP(coordinates[17],coordinates[21]));
    distances.push(dbP(coordinates[9],coordinates[21])); //index -> pinky
    distances.push(dbP(coordinates[6],coordinates[9])); //index check

    for(let i = 0; i < distances.length; i++){
      distances[i] = distances[i]*pixelScale;
    }

    return distances;
  }

  const normalize = (vector) => {
    const magnitude = Math.sqrt(vector[0]^2 + vector[1]^2 + vector[2]^2);
    return [vector[0]/magnitude,vector[1]/magnitude,vector[2]/magnitude];
  }
  

  const calculateAngle = (vectors, magnitudes, time) => {
    const angles = [time];
    
  //theta = arccos((v1 dot v2)/(|v1||v2|))
  for(let set = 0; set<5; set++){
    angles.push(angle(vectors[set][0], vectors[set][1], magnitudes[set][0], magnitudes[set][1]));
    angles.push(angle(vectors[set][1], vectors[set][2], magnitudes[set][1], magnitudes[set][2]));
    angles.push(angle(vectors[set][2], vectors[set][3], magnitudes[set][2], magnitudes[set][3]));
  }
  // console.log(angles);
  return angles;
  }

  const calculateAngleFullFinger = (vectors, magnitudes, time) => {
    const angles = [time];

    angles.push(angle(vectors[0],vectors[1],magnitudes[0],magnitudes[1]));
    angles.push(angle(vectors[1],vectors[2],magnitudes[1],magnitudes[2]));
    angles.push(angle(vectors[2],vectors[3],magnitudes[2],magnitudes[3]));
    angles.push(angle(vectors[3],vectors[4],magnitudes[3],magnitudes[4]));

    return angles
  }

  const angle = (vectorOne, vectorTwo, magnitudeOne, magnitudeTwo) => {
    let dotProductResult = dotProduct(vectorOne, vectorTwo);
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
    // Autoplay through the uploaded videos
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
  //INPUT MODE
  function onChangeInputMode(){
    setinputMode(!input_mode);

  }

  //Index Length
  function onChangeIndexLength(e){
    e.preventDefault();
    setIndexLength(parseInt(index_input));
    setIndexInput("");

  }

  //DATA RESET
  function resetCollection(e){
    LandMarkDataALL.length = 0;
    LandMarkDataCoords.length = 0;
    LandMarkDataAngles.length = 0;
  }

  
  return(
    <div className="container-hand-tracker">
      <div className="panel-row">

    
        <div className="panel-display">
          <h1>DISPLAY/CONTROLS</h1>
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

            <div className="controls">
              <div className="controls-cell">
                <h2>Camera Resolution</h2>
                <form className="control-form">
                  <input className="input-box" type="text" value={res_height} onChange={(e)=>onChangeResHeight(e)} placeholder="720p" />
                  <input className="input-box" type="text" value={res_width} onChange={(e)=>onChangeResWidth(e)} placeholder="1280p" />
                  <button className="button-form" onClick={setResolution}>Set</button>
                </form>
              </div>
              <div className='controls-cell'>
                <h2>Model Config</h2>
                <form className="control-form">
                  <div className='formItem'>
                    <label className="field-label">Min. Detection Conf.</label>
                    <input className="input-box" type="text" onChange={(e)=>setminDetectionConfidence(parseFloat(e.target.value))} placeholder="0.7" />
                  </div>
                  <div className='formItem'>
                    <label className="field-label">Min. Tracking Conf.</label>
                    <input className="input-box" type="text" onChange={(e)=>setminTrackingConfidence(parseFloat(e.target.value))} placeholder="0.75" />
                  </div>
                  <div className='formItem'>
                    <label className="field-label">Index Finger MCT - TIP</label>
                    <input className="input-box" type="text" value = {index_input} onChange={(e)=>onChangeIndexLength(e)} placeholder="9" />
                    {/* <button className="button-form" onClick={configHands}>Set</button> */}
                  </div>
                </form>
              </div>
              <div className='controls-cell'>
                <h2>Capture Mode</h2>
                <div className='button-switch'>
                  <button className='button-webcam' onClick={onChangeInputMode} style = {{ backgroundColor: input_mode ? "#5DA85B" : "#FFF", color: input_mode ? "#fff" : "#000"}}>Webcam</button>
                  <button className='button-upload' onClick={onChangeInputMode} style = {{ backgroundColor: !input_mode ? "#5DA85B" : "#FFF", color: !input_mode ? "#fff" : "#000"}}>Upload</button>
                </div>
              </div>
              <div className='controls-cell'>
                <h2>Upload</h2>
                <form className="container-upload">
                  <input className="input-file" type='file' multiple onChange={(e)=>onChangeUpload(e)}/>
                  <p>Current file: {current_file}</p>
                </form>
              </div>
              <div className='controls-cell'>
                <h2>Download</h2>
                <form className="container-download">
                  <button className="button-form margin-push" onClick={eventDownloadCoords}>Coords</button>
                  <button className="button-form margin-push" onClick={eventDownloadAngles}>Angles</button>
                  <button className="button-form margin-push" onClick={eventDownloadAll}>All</button>
                  <button className="button-form margin-push" onClick={resetCollection}>Reset Collection</button>
                  {digit_x}, {digit_y}, {digit_z}
                </form>
                
              </div>
          
          </div>
          </div>
          
        </div>

        <div className="panel-data">
          <h1>DIAGRAMS</h1>
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
              
              {/* <hr className="container-sep"/>
              <h2>Read Outs</h2>
              <p><b>Resolution: </b>height: {camRes1}, width: {camRes2}</p>
              <p><b>Landmark_8, Index Tip:</b>X: {digit_x} Y: {digit_y} Z: {digit_z}</p>
              <p>Number of records: {countData(LandMarkDataAngles)}</p>
              <p>Length of Index: {indexLength}</p> */}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HandTracker;