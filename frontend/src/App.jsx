import React, { useState, useRef } from 'react';
import { UploadCloud, AlertCircle, CheckCircle, Video, Image as ImageIcon, Loader2 } from 'lucide-react';

export default function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // To track the actual rendered size of the image/video to properly scale the bounding box
  const [mediaSize, setMediaSize] = useState({ w: 0, h: 0 });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setResult(null);
      setError(null);
      setMediaSize({ w: 0, h: 0 });
    }
  };

  const handleMediaLoad = (e) => {
    // Get the natural dimensions of the media once it loads to calculate the green box percentages
    if (file?.type.startsWith('image/')) {
      setMediaSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
    } else if (file?.type.startsWith('video/')) {
      setMediaSize({ w: e.target.videoWidth, h: e.target.videoHeight });
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Assuming the FastAPI backend is running on localhost:8000
      const response = await fetch('http://localhost:8000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to analyze media');
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6 flex flex-col items-center">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden mt-10">
        <div className="bg-slate-900 p-6 text-white text-center">
          <h1 className="text-3xl font-bold tracking-tight">Deepfake Detector</h1>
          <p className="text-slate-400 mt-2">Upload an image or video to analyze authenticity.</p>
        </div>

        <div className="p-8">
          {/* Upload Area */}
          <div className="flex flex-col items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className="w-12 h-12 text-slate-400 mb-4" />
                <p className="mb-2 text-sm text-slate-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-slate-400">MP4, AVI, JPG, PNG, WEBP</p>
              </div>
              <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
            </label>
          </div>

          {/* Preview & Results Area */}
          {previewUrl && (
            <div className="mt-8 flex flex-col items-center">
              
              <div className="relative inline-block rounded-lg overflow-hidden shadow-md bg-black">
                {file?.type.startsWith('video/') ? (
                  <video 
                    src={previewUrl} 
                    controls 
                    className="max-h-[500px] w-auto"
                    onLoadedMetadata={handleMediaLoad}
                  />
                ) : (
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="max-h-[500px] w-auto object-contain"
                    onLoad={handleMediaLoad}
                  />
                )}

                {/* Green Bounding Box Overlay */}
                {result?.bbox && mediaSize.w > 0 && (
                  <div
                    className="absolute border-4 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)] z-10 transition-all duration-500"
                    style={{
                      left: `${(result.bbox.x / mediaSize.w) * 100}%`,
                      top: `${(result.bbox.y / mediaSize.h) * 100}%`,
                      width: `${(result.bbox.w / mediaSize.w) * 100}%`,
                      height: `${(result.bbox.h / mediaSize.h) * 100}%`,
                    }}
                  >
                    <div className="absolute -top-6 left-[-4px] bg-green-500 text-white text-xs font-bold px-2 py-1 whitespace-nowrap">
                      Face Detected
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className={`mt-6 w-full max-w-md py-3 px-4 rounded-lg font-semibold text-white flex justify-center items-center transition-all ${
                  loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                    Analyzing Media...
                  </>
                ) : (
                  'Analyze Media'
                )}
              </button>
            </div>
          )}

          {/* Results Output */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          )}

          {result && (
            <div className={`mt-6 p-6 rounded-xl border-2 flex flex-col items-center text-center transition-all ${
              result.is_fake ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center justify-center space-x-3 mb-2">
                {result.is_fake ? (
                  <AlertCircle className="w-8 h-8 text-red-600" />
                ) : (
                  <CheckCircle className="w-8 h-8 text-green-600" />
                )}
                <h2 className={`text-2xl font-bold ${result.is_fake ? 'text-red-700' : 'text-green-700'}`}>
                  {result.verdict}
                </h2>
              </div>
              
              {result.type === 'image' && (
                <p className="text-gray-600 font-medium mt-2">
                  Confidence Score: <span className="font-bold">{(result.score * 100).toFixed(2)}%</span>
                </p>
              )}

              {result.type === 'video' && (
                <div className="mt-4 flex space-x-6">
                  <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                    <p className="text-sm text-gray-500">Fake Frames</p>
                    <p className="text-xl font-bold text-red-600">{result.fake_frames}</p>
                  </div>
                  <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                    <p className="text-sm text-gray-500">Real Frames</p>
                    <p className="text-xl font-bold text-green-600">{result.real_frames}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}