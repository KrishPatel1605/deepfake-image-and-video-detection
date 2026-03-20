import React, { useState } from 'react';
import { UploadCloud, AlertCircle, CheckCircle, Loader2, Image as ImageIcon, MapPin } from 'lucide-react';

export default function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
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
    <div className="min-h-screen bg-slate-50 text-gray-900 font-sans p-4 md:p-6 flex flex-col items-center">
      <div className="w-full max-w-[98%] xl:max-w-[1400px] bg-white rounded-2xl shadow-xl overflow-hidden mt-2 mb-8 flex flex-col min-h-[85vh]">
        
        {/* Header */}
        <div className="bg-slate-900 p-6 text-white text-center shrink-0">
          <h1 className="text-3xl font-bold tracking-tight">Deepfake Detector</h1>
          <p className="text-slate-400 mt-2">Upload an image or video to analyze authenticity.</p>
        </div>

        {/* Main Content Area */}
        <div className="p-6 md:p-8 flex flex-col lg:flex-row gap-8 items-stretch flex-grow">
          
          {/* ================= LEFT SIDE: INPUT & PREVIEW ================= */}
          <div className="w-full lg:w-[40%] xl:w-[35%] shrink-0 flex flex-col gap-6">
            
            {/* Upload Area */}
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
                <p className="mb-1 text-sm text-slate-600">
                  <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-slate-400">MP4, AVI, JPG, PNG, WEBP</p>
              </div>
              <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
            </label>

            {/* Preview & Action Button */}
            {previewUrl && (
              <div className="flex flex-col items-center bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm w-full flex-grow">
                <div className="relative inline-block rounded-lg overflow-hidden shadow-md bg-black max-w-full flex justify-center border border-slate-800">
                  {file?.type.startsWith('video/') ? (
                    <video 
                      src={previewUrl} 
                      controls 
                      className="max-h-[400px] w-auto"
                      onLoadedMetadata={handleMediaLoad}
                    />
                  ) : (
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="max-h-[400px] w-auto object-contain"
                      onLoad={handleMediaLoad}
                    />
                  )}

                  {/* Green Bounding Box Overlay */}
                  {result?.bbox && mediaSize.w > 0 && (
                    <div
                      className="absolute border-4 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)] z-10 transition-all duration-500 pointer-events-none"
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

                <button
                  onClick={handleAnalyze}
                  disabled={loading}
                  className={`mt-6 w-full py-3 px-4 rounded-lg font-semibold text-white flex justify-center items-center transition-all ${
                    loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-indigo-500/30'
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
          </div>

          {/* ================= RIGHT SIDE: RESULTS ================= */}
          <div className="w-full lg:w-[60%] xl:w-[65%] flex flex-col gap-6">
            
            {/* Placeholder state before analysis */}
            {!result && !error && (
              <div className="w-full h-full min-h-[400px] border-2 border-slate-200 border-dashed rounded-2xl flex flex-col items-center justify-center bg-slate-50/50 text-slate-400 p-8 text-center">
                <ImageIcon className="w-12 h-12 mb-3 text-slate-300" />
                <h3 className="text-xl font-semibold text-slate-500 mb-2">Awaiting Analysis</h3>
                <p className="text-sm text-slate-400 max-w-sm">
                  Upload an image or video and click "Analyze Media" to view the authenticity verdict.
                </p>
              </div>
            )}

            {/* Error Output */}
            {error && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start shadow-sm">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                <p className="text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Verdict Output */}
            {result && (
              <div className="flex flex-col gap-6 h-full">
                
                {/* Main Verdict Card */}
                <div className={`p-8 rounded-2xl border-2 flex flex-col items-center text-center transition-all shadow-sm ${
                  result.is_fake ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-center justify-center space-x-3 mb-3">
                    {result.is_fake ? (
                      <AlertCircle className="w-8 h-8 text-red-600" />
                    ) : (
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    )}
                    <h2 className={`text-2xl md:text-3xl font-bold ${result.is_fake ? 'text-red-700' : 'text-green-700'}`}>
                      {result.verdict}
                    </h2>
                  </div>
                  
                  {/* {result.type === 'image' && (
                    <p className="text-gray-600 font-medium mt-2">
                      Confidence Score: <span className="font-bold text-lg">{(result.score * 100).toFixed(2)}%</span>
                    </p>
                  )} */}

                  {/* Source Information / Location Tracing */}
                  {result.source_info && (
                    <div className="mt-6 w-full bg-white p-5 rounded-xl shadow-sm border border-slate-100 text-left">
                      <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center">
                        <MapPin className="w-4 h-4 mr-2 text-indigo-500" />
                        Source & Location Metadata
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Location Guess</p>
                          <p className="font-semibold text-sm text-slate-700">{result.source_info.location_name}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">IP Address</p>
                          <p className="font-mono text-sm font-semibold text-slate-700">{result.source_info.ip_address}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Latitude</p>
                          <p className="font-mono text-xs text-slate-700">{result.source_info.latitude}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Longitude</p>
                          <p className="font-mono text-xs text-slate-700">{result.source_info.longitude}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Extracted Video Frames Gallery */}
                {result.type === 'video' && result.sample_frames && result.sample_frames.length > 0 && (
                  <div className="w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex-grow">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                      <div className="w-1.5 h-5 bg-indigo-500 rounded-full mr-2"></div>
                      Example extracted frames from the video
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                      {result.sample_frames.map((frameSrc, idx) => (
                        <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-200 shadow-sm aspect-video bg-black flex items-center justify-center group hover:border-indigo-400 transition-colors">
                          <img 
                            src={frameSrc} 
                            alt={`Sample ${idx + 1}`} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-md">
                            Frame {idx + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}