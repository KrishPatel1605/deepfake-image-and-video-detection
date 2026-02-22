import React, { useState } from "react";
import axios from "axios";

const UploadForm = () => {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await axios.post("http://localhost:8000/api/detect/", formData);
    setResult(res.data);
  };

  return (
    <div>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <br /><br />
      <button onClick={handleUpload}>Detect</button>

      {result && (
        <div style={{marginTop: "20px"}}>
          <h3>Prediction: {result.label}</h3>
          <p>Confidence: {result.prediction.toFixed(3)}</p>
        </div>
      )}
    </div>
  );
};

export default UploadForm;
