// Common hand tracking utilities used by both webcam and video upload modes

export const abs = (x, y, z) => {
  return Math.sqrt(x ** 2 + y ** 2 + z ** 2);
};

export  const calculateAngle = (vectors, magnitudes, time) => {
    const angles = [time];

  for(let set = 0; set<5; set++){
    angles.push(angle(vectors[set][0], vectors[set][1], magnitudes[set][0], magnitudes[set][1]));
    angles.push(angle(vectors[set][1], vectors[set][2], magnitudes[set][1], magnitudes[set][2]));
    angles.push(angle(vectors[set][2], vectors[set][3], magnitudes[set][2], magnitudes[set][3]));
  }
  return angles;
  }

export const calculateAngleFullFinger = (vectors, magnitudes, deltaTime) => {
    const angles = [deltaTime];

    angles.push(angle(vectors[0],vectors[1],magnitudes[0],magnitudes[1]));
    angles.push(angle(vectors[1],vectors[2],magnitudes[1],magnitudes[2]));
    angles.push(angle(vectors[2],vectors[3],magnitudes[2],magnitudes[3]));
    angles.push(angle(vectors[3],vectors[4],magnitudes[3],magnitudes[4]));

    return angles
};

export const angle = (vectorOne, vectorTwo, magnitudeOne, magnitudeTwo) => {
    let dotProductResult = dotProduct(vectorOne, vectorTwo);
    let innerCalculation = dotProductResult/(magnitudeOne*magnitudeTwo);
    let angleResult = Math.acos(innerCalculation);
    angleResult = parseFloat(angleResult) * (180/Math.PI);
    angleResult = angleResult.toFixed(2);
    return angleResult;
  }

export const dotProduct = (v1, v2) =>{
    let result = (v1[0]*v2[0])+(v1[1]*v2[1])+(v1[2]*v2[2]);
    return result; 
  }

export const calculateDistances = (coordinates, indexLength) => {

    const distances = []; 
    const pixelScale = indexLength/dbP(coordinates[9],coordinates[13]); // coordinates[6],coordinates[9]

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

export const calculateDistances2d = (coordinates,indexLength) => {
    
    const distances = []; 
    const pixelScale = indexLength/dbP_2d(coordinates[6],coordinates[9]); // Could be an issue when measuring the full finger as when it's bent the distance will shorten.

    distances.push(dbP_2d(coordinates[5],coordinates[9]));
    distances.push(dbP_2d(coordinates[9],coordinates[13]));
    distances.push(dbP_2d(coordinates[13],coordinates[17]));
    distances.push(dbP_2d(coordinates[17],coordinates[21]));
    distances.push(dbP_2d(coordinates[9],coordinates[21])); //index -> pinky
    distances.push(dbP_2d(coordinates[6],coordinates[9])); //index check

    for(let i = 0; i < distances.length; i++){
      distances[i] = distances[i]*pixelScale;
    }

    return distances;
  }

  // Helper Func: Distance between two 3D points
  export const dbP = (p1,p2) => {
    return parseFloat(Math.sqrt(
        Math.pow((p2[0]-p1[0]),2)+
        Math.pow((p2[1]-p1[1]),2)+
        Math.pow((p2[2]-p1[2]),2)
      ));
    // return Math.sqrt((p2[0]-p1[0])^2+(p2[2]-p1[2])^2+(p2[1]-p1[1])^2);
  }
  // Helper Func: Distance between two 3D points
  export const dbP_2d = (p1,p2) => {
    return parseFloat(Math.sqrt(
        Math.pow((p2[0]-p1[0]),2)+
        Math.pow((p2[1]-p1[1]),2)+
        0
      ));
    // return Math.sqrt((p2[0]-p1[0])^2+(p2[2]-p1[2])^2+(p2[1]-p1[1])^2);
  }

export const objectToCSVRow = (dataObject) => {
  let dataArray = [];
  for (let o in dataObject) {
    let innerValue = dataObject[o] === null ? '' : dataObject[o].toString();
    let result = innerValue.replace(/"/g, ' ');
    result = ' ' + result + ', ';
    dataArray.push(result);
  }
  return dataArray.join(' ') + '\r\n';
};

export const downloadCSV = (arrayOfObjects = []) => {
  let measurements = arrayOfObjects;
  if (!measurements.length) {
    return alert('No data available for download.');
  }
  // Build CSV header and rows. Each measurement item is expected to be an array:
  // [ fileName, anglesArray(15), distancesArray(4), distance5(single), anglesFFArray(4) ]
  const header = [
    'file_name',
    'an_index_dip','an_index_mcp','an_index_pip',
    'an_middle_dip','an_middle_mcp','an_middle_pip',
    'an_pinky_dip','an_pinky_mcp','an_pinky_pip',
    'an_ring_dip','an_ring_mcp','an_ring_pip',
    'an_thumb_cmc','an_thumb_ip','an_thumb_mcp',
    'di_thumb_index','di_index_middle','di_middle_ring','di_ring_pinky','di_index_pinky',
    'an_thumb_index','an_index_middle','an_middle_ring','an_ring_pinky'
  ];

  let csvLines = [];
  csvLines.push(header.join(','));

  measurements.forEach((item) => {
    const fileName = item[0] || '';
    const angles = Array.isArray(item[1]) ? item[1] : [];
    const dists = Array.isArray(item[2]) ? item[2] : [];
    const d5 = item[3] !== undefined ? item[3] : '';
    const anglesFF = Array.isArray(item[4]) ? item[4] : [];

    const row = [fileName, ...angles, ...dists, d5, ...anglesFF];
    // Ensure each value is a plain string without commas/quotes
    const sanitized = row.map(v => (v === null || v === undefined) ? '' : String(v).replace(/"/g, ''));
    csvLines.push(sanitized.join(','));
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + csvLines.join('\r\n') + '\r\n';
  let encodedUri = encodeURI(csvContent);
  let link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "landmarkData.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const convertToVectorFullFinger = (coordinates, camRes1, camRes2) => {
  const vectors = [];
  for (let i = 1; i < coordinates.length; i++) {
    const vx = (coordinates[i][0] - coordinates[0][0]) * camRes1;
    const vy = (coordinates[i][1] - coordinates[0][1]) * camRes2;
    const vz = (coordinates[i][2] - coordinates[0][2]) * camRes1;
    vectors.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
  }
  const magnitudes = [];
  for (let j = 0; j < vectors.length; j++) {
    magnitudes.push(
      parseFloat(abs(vectors[j][0], vectors[j][1], vectors[j][2]))
    );
  }
  return [vectors, magnitudes];
};

export const convertToVector = (coordinates, camRes1, camRes2) => {
  const vectors1 = [];
  const vectors2 = [];
  const vectors3 = [];
  const vectors4 = [];
  const vectors5 = [];

  const allVectors = [];

  // Section 1 - has 4 vectors
  for (let i = 1; i < 5; i++) {
    const x1 = coordinates[i][0] * camRes1;
    const y1 = coordinates[i][1] * camRes2;
    const z1 = coordinates[i][2] * camRes1;
    const x2 = coordinates[i + 1][0] * camRes1;
    const y2 = coordinates[i + 1][1] * camRes2;
    const z2 = coordinates[i + 1][2] * camRes1;
    let vx = (x2 - x1);
    let vy = (y2 - y1);
    let vz = (z2 - z1);
    vx = parseFloat(vx);
    vy = parseFloat(vy);
    vz = parseFloat(vz);
    vectors1.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
  }

  // Section 2
  for (let j = 1; j < 5; j++) {
    if (j === 1) {
      let vx = ((coordinates[j + 5][0] * camRes1) - (coordinates[j][0] * camRes1));
      let vy = ((coordinates[j + 5][1] * camRes2) - (coordinates[j][1] * camRes2));
      let vz = ((coordinates[j + 5][2] * camRes1) - (coordinates[j][2] * camRes1));
      vx = parseFloat(vx);
      vy = parseFloat(vy);
      vz = parseFloat(vz);
      vectors2.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
    }
    else {
      const x1 = coordinates[j + 4][0] * camRes1;
      const y1 = coordinates[j + 4][1] * camRes2;
      const z1 = coordinates[j + 4][2] * camRes1;
      const x2 = coordinates[j + 5][0] * camRes1;
      const y2 = coordinates[j + 5][1] * camRes2;
      const z2 = coordinates[j + 5][2] * camRes1;
      let vx = (x2 - x1);
      let vy = (y2 - y1);
      let vz = (z2 - z1);
      vx = parseFloat(vx);
      vy = parseFloat(vy);
      vz = parseFloat(vz);
      vectors2.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
    }
  }

  // Section 3
  for (let k = 1; k < 5; k++) {
    if (k === 1) {
      let vx = ((coordinates[k + 9][0] * camRes1) - (coordinates[k][0] * camRes1));
      let vy = ((coordinates[k + 9][1] * camRes2) - (coordinates[k][1] * camRes2));
      let vz = ((coordinates[k + 9][2] * camRes1) - (coordinates[k][2] * camRes1));
      vx = parseFloat(vx);
      vy = parseFloat(vy);
      vz = parseFloat(vz);
      vectors3.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
    }
    else {
      const x1 = coordinates[k + 8][0] * camRes1;
      const y1 = coordinates[k + 8][1] * camRes2;
      const z1 = coordinates[k + 8][2] * camRes1;
      const x2 = coordinates[k + 9][0] * camRes1;
      const y2 = coordinates[k + 9][1] * camRes2;
      const z2 = coordinates[k + 9][2] * camRes1;
      let vx = (x2 - x1);
      let vy = (y2 - y1);
      let vz = (z2 - z1);
      vx = parseFloat(vx);
      vy = parseFloat(vy);
      vz = parseFloat(vz);
      vectors3.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
    }
  }

  // Section 4
  for (let u = 1; u < 5; u++) {
    if (u === 1) {
      let vx = ((coordinates[u + 13][0] * camRes1) - (coordinates[u][0] * camRes1));
      let vy = ((coordinates[u + 13][1] * camRes2) - (coordinates[u][1] * camRes2));
      let vz = ((coordinates[u + 13][2] * camRes1) - (coordinates[u][2] * camRes1));
      vx = parseFloat(vx);
      vy = parseFloat(vy);
      vz = parseFloat(vz);
      vectors4.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
    }
    else {
      const x1 = coordinates[u + 12][0] * camRes1;
      const y1 = coordinates[u + 12][1] * camRes2;
      const z1 = coordinates[u + 12][2] * camRes1;
      const x2 = coordinates[u + 13][0] * camRes1;
      const y2 = coordinates[u + 13][1] * camRes2;
      const z2 = coordinates[u + 13][2] * camRes1;
      let vx = (x2 - x1);
      let vy = (y2 - y1);
      let vz = (z2 - z1);
      vx = parseFloat(vx);
      vy = parseFloat(vy);
      vz = parseFloat(vz);
      vectors4.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
    }
  }

  // Section 5
  for (let v = 1; v < 5; v++) {
    if (v === 1) {
      let vx = ((coordinates[v + 17][0] * camRes1) - (coordinates[v][0] * camRes1));
      let vy = ((coordinates[v + 17][1] * camRes2) - (coordinates[v][1] * camRes2));
      let vz = ((coordinates[v + 17][2] * camRes1) - (coordinates[v][2] * camRes1));

      vectors5.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
    }
    else {
      const x1 = coordinates[v + 16][0] * camRes1;
      const y1 = coordinates[v + 16][1] * camRes2;
      const z1 = coordinates[v + 16][2] * camRes1;
      const x2 = coordinates[v + 17][0] * camRes1;
      const y2 = coordinates[v + 17][1] * camRes2;
      const z2 = coordinates[v + 17][2] * camRes1;
      let vx = (x2 - x1);
      let vy = (y2 - y1);
      let vz = (z2 - z1);
      vx = parseFloat(vx);
      vy = parseFloat(vy);
      vz = parseFloat(vz);
      vectors5.push([parseFloat(vx), parseFloat(vy), parseFloat(vz)]);
    }
  }

  allVectors.push(vectors1, vectors2, vectors3, vectors4, vectors5);

  return allVectors;
}

export const calculateMagnitude = (vectors) =>{
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
