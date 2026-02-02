import React, { useRef, useEffect, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import './HandTracking.css';
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
import diagram_left from './Images/joints-angles-left.png';
import diagram_right from './Images/joints-angles-right.png';
import diagram_tips_distance from './Images/tips-distance.png';
import diagram_wrist_tips_angles from './Images/wrist-tips-angles.png';
import diagram_pinky_index_distance from './Images/pinky-index-distance.png';
import { joints_angles, tips_distance, tips_angles } from './diagram-map';

function VideoUpload() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [videos, setVideos] = useState([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState('');
  const currentFileName = useRef('');
  
  // Model Config
  const mpHandsRef = useRef(null);
  const minDetectionConfidence = useRef(0.75);
  const minTrackingConfidence = useRef(0.7);
  const camRes1 = useRef(720);
  const camRes2 = useRef(1280);
  const dimension = useRef(3);
  const sampleFps = useRef(20);
  const indexLength = useRef(9); // cm
  
  // Data
  const DataIn = useRef([]);
  const allVideoData = useRef({});
  
  // Canvas refs for diagrams
  const canvasRefDiagram = useRef(null);
  const canvasRefTips = useRef(null);
  const canvasRefTipsAngles = useRef(null);
  const canvasRefIPDist = useRef(null);
  const [diagram, setDiagram] = useState(diagram_right);

  const handleVideoFiles = (e) => {
    const files = Array.from(e.target.files);
    const videoFiles = files.filter(file => file.type.startsWith('video/'));
    if (videoFiles.length > 0) {
      console.log('Video files uploaded:', videoFiles);
      setVideos(videoFiles);
      setCurrentVideoIndex(0);
      DataIn.current = [];
      allVideoData.current = {};
    }
  };

  const onResults = (results) => {
    if (!canvasRef.current) return;
    if (!results || !results.image) return;
    
    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks) {
      for (const landmarks of results.multiHandLandmarks) {
        drawConnectors(canvasCtx, landmarks, Hands.HAND_CONNECTIONS, {
          color: '#00ff00',
          lineWidth: 2,
        });
        drawLandmarks(canvasCtx, landmarks, {color: "#00ffd0", lineWidth: 1});
      }
      
      // Collect data
      collectData(results);
    }
    canvasCtx.restore();
  };

  const collectData = (objArr) => {
    if (objArr.multiHandLandmarks.length === 0) {
      return;
    }

    const coordinates = [];
    const startTime = allVideoData.current[videos[currentVideoIndex].name]?.startTime || Date.now();
    const endTime = Date.now();
    const deltaTime = endTime - startTime;
    coordinates.push(deltaTime);

    // Get landmarks
    for (let i = 0; i < 21; i++) {
      const xVal = objArr.multiHandLandmarks[0][i].x;
      const yVal = objArr.multiHandLandmarks[0][i].y;
      const zVal = objArr.multiHandLandmarks[0][i].z;
      coordinates.push([parseFloat(xVal), parseFloat(yVal), parseFloat(zVal)]);
    }

    const vectors = convertToVector(coordinates, camRes1.current, camRes2.current);
    const magnitudes = calculateMagnitude(vectors);

    // Full Finger Angles
    const coordinatesFF = [coordinates[1], coordinates[5], coordinates[9], coordinates[13], coordinates[17], coordinates[21]];
    const [vectorsFF, magnitudeFF] = convertToVectorFullFinger(coordinatesFF, camRes1.current, camRes2.current);
    const anglesFF = calculateAngleFullFinger(vectorsFF, magnitudeFF, deltaTime);

    const angles = calculateAngle(vectors, magnitudes, deltaTime);

    var distances = [];
    if (dimension.current === 3) {
      distances = calculateDistances(coordinates, indexLength.current);
    } else {
      distances = calculateDistances2d(coordinates, indexLength.current);
    }
    DataIn.current.push([currentFileName.current, angles.slice(1), distances.slice(0, 4), distances[4], anglesFF.slice(1)]);

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


  };

  const processVideo = async (videoFile) => {
    return new Promise((resolve) => {
      if (!mpHandsRef.current) {
        mpHandsRef.current = new Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          },
        });
        mpHandsRef.current.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: minDetectionConfidence.current,
          minTrackingConfidence: minTrackingConfidence.current,
        });
        mpHandsRef.current.onResults(onResults);
      }

      const video = document.createElement('video');
      const url = URL.createObjectURL(videoFile);
      video.src = url;
      currentFileName.current = videoFile.name;

      video.onloadedmetadata = async () => {
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Use a configurable sample FPS to reduce number of frames processed (faster)
        const frameRate = sampleFps.current || 10;
        const totalFrames = Math.ceil(video.duration * frameRate);
        let frameCount = 0;

        const processFrame = async () => {
          if (frameCount < totalFrames) {
            video.currentTime = frameCount / frameRate;
            frameCount++;
            setProcessingProgress(`${videoFile.name} - Sample ${frameCount}/${totalFrames}`);
            if (mpHandsRef.current) {
              await mpHandsRef.current.send({ image: video });
            }
            // Process next frame as soon as possible (sampling controls overall speed)
            setTimeout(processFrame, 0);
          } else {
            allVideoData.current[videoFile.name] = DataIn.current.slice();
            URL.revokeObjectURL(url);
            resolve();
          }
        };

        // Wait for first frame to load
        setTimeout(processFrame, 500);
      };
      video.load();
    });
  };

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (mpHandsRef.current) {
        try { mpHandsRef.current.close(); } catch (e) {}
        mpHandsRef.current = null;
      }
    };
  }, []);

  const startProcessing = async () => {
    if (videos.length === 0) {
      alert('Please select videos first');
      return;
    }

    setIsProcessing(true);
    DataIn.current = [];
    allVideoData.current = {};

    for (let i = 0; i < videos.length; i++) {
      setCurrentVideoIndex(i);
      await processVideo(videos[i]);
    }

    setIsProcessing(false);
    setProcessingProgress('Processing complete!');
  };

  const downloadAllData = () => {
    if (DataIn.current.length === 0) {
      alert('No data to download. Process videos first.');
      return;
    }
    downloadCSV(DataIn.current);
  };

  const handleControlSubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const formJson = Object.fromEntries(formData.entries());

    if (formJson.camRes1 && formJson.camRes2 !== '') {
      camRes1.current = formJson.camRes1;
      camRes2.current = formJson.camRes2;
    }
    if (formJson.minDetectionConfidence !== '') {
      minDetectionConfidence.current = formJson.minDetectionConfidence;
    }
    if (formJson.minTrackingConfidence !== '') {
      minTrackingConfidence.current = formJson.minTrackingConfidence;
    }
    if (formJson.sampleFps !== '') {
      sampleFps.current = Number(formJson.sampleFps);
    }
    if (formJson.indexLength !== '') {
      indexLength.current = formJson.indexLength;
    }
    if (formJson.dimension !== '') {
      dimension.current = formJson.dimension;
    }
  };

  return (
    <div className="container-video-upload">
      <div className="panel-row">
        <div className="panel-display">
          <h1>Video Upload</h1>
          <div className="container-display">
            {/* Video Display */}
            <div className="video-container">
              <canvas ref={canvasRef} className="output-canvas" />
            </div>

            <div className="controls-files">
              <div className="controls-cell">
                <h2>Upload Videos</h2>
                <form className="container-upload">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="video/*"
                    onChange={handleVideoFiles}
                    className="file-input"
                  />
                  <div className="video-list">
                    {videos.length > 0 && (
                      <div>
                        <p>Selected Videos ({videos.length}):</p>
                        <ul>
                          {videos.map((video, index) => (
                            <li key={index}>{video.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="button-form margin-push"
                    onClick={startProcessing}
                    disabled={isProcessing || videos.length === 0}
                  >
                    {isProcessing ? 'Processing...' : 'Process Videos'}
                  </button>
                  {processingProgress && (
                    <p className="progress-text">{processingProgress}</p>
                  )}
                </form>
              </div>

              

              <div className="controls-cell">
                <h2>Download</h2>
                <form className="container-download">
                  <button
                    type="button"
                    className="button-form margin-push"
                    onClick={downloadAllData}
                    disabled={DataIn.current.length === 0}
                  >
                    CSV Export
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div className="panel-data">
          <h1>Diagrams & Config</h1>
          <div className="container-data">
            <div className="diagram-grid">
              <div className="grid-cell">
                <h2>Joint Angles (degrees)</h2>
                <canvas ref={canvasRefDiagram} id="diagram_out" className="diagram" />
                <img id="diagram_preload" src={diagram} alt="hand diagram" className="diagrams_src" />
              </div>
              <div className="grid-cell">
                <h2>Tips Distances (cm)</h2>
                <canvas ref={canvasRefTips} id="diagram_out" className="diagram" />
                <img id="diagram_preload_tips" src={diagram_tips_distance} alt="hand diagram" className="diagrams_src" />
              </div>
              <div className="grid-cell">
                <h2>Tips-Wrist Angles (degrees)</h2>
                <canvas ref={canvasRefTipsAngles} id="diagram_out" className="diagram" />
                <img id="diagram_preload_tips_angles" src={diagram_wrist_tips_angles} alt="hand diagram" className="diagrams_src" />
              </div>
              <div className="grid-cell">
                <h2>Index-Middle TIP (cm)</h2>
                <canvas ref={canvasRefIPDist} id="diagram_out" className="diagram" />
                <img id="diagram_preload_IPDist" src={diagram_pinky_index_distance} alt="hand diagram" className="diagrams_src" />
              </div>
            </div>
            <form method="post" onSubmit={handleControlSubmit} className="control-form">
                <div className="controls-cell">
                  <h2>Model Config</h2>
                  <div className="control-form-child">
                    <div className="formItem">
                      <label className="field-label">Camera Res. Width</label>
                      <input
                        name="camRes1"
                        className="input-box"
                        type="number"
                        placeholder={camRes1.current}
                      />
                    </div>
                    <div className="formItem">
                      <label className="field-label">Camera Res. Height</label>
                      <input
                        name="camRes2"
                        className="input-box"
                        type="number"
                        placeholder={camRes2.current}
                      />
                    </div>
                    <div className="formItem">
                      <label className="field-label">Sample FPS</label>
                      <input
                        name="sampleFps"
                        className="input-box"
                        type="number"
                        step="1"
                        placeholder={sampleFps.current}
                      />
                    </div>
                    <div className="formItem">
                      <label className="field-label">Min. Detection Conf.</label>
                      <input
                        name="minDetectionConfidence"
                        className="input-box"
                        type="number"
                        step="0.01"
                        placeholder={minDetectionConfidence.current}
                      />
                    </div>
                    <div className="formItem">
                      <label className="field-label">Min. Tracking Conf.</label>
                      <input
                        name="minTrackingConfidence"
                        className="input-box"
                        type="number"
                        step="0.01"
                        placeholder={minTrackingConfidence.current}
                      />
                    </div>
                    
                    <div className="formItem">
                      <label className="field-label">Dist. Calc. Dimension</label>
                      <select name="dimension" className="dropdown">
                        <option value="3">3D</option>
                        <option value="2">2D</option>
                      </select>
                    </div>
                    <div className="formItem">
                      <label className="field-label">Index Finger MCT - TIP (cm)</label>
                      <input
                        name="indexLength"
                        className="input-box"
                        type="number"
                        step="1"
                        placeholder={indexLength.current}
                      />
                    </div>
                  </div>
                </div>
                <button type="submit" className="button-form margin-push">
                  Submit Config
                </button>
              </form>
          </div>
          
        </div>
      </div>
    </div>
  );
}

export default VideoUpload;
