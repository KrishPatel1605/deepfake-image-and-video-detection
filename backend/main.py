import os
import cv2
import numpy as np
import tensorflow as tf
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tempfile
import shutil

app = FastAPI()

# Enable CORS so the React frontend can communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins, adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the Haar Cascade for face detection
# Using OpenCV's default pre-trained model for quick and robust frontal face detection
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

# Load the Keras Model
MODEL_PATH = 'deepfake_model.keras'
try:
    model = tf.keras.models.load_model(MODEL_PATH)
    print("✅ Model loaded successfully.")
    MODEL_LOADED = True
except Exception as e:
    print(f"⚠️ WARNING: Could not load {MODEL_PATH}. Using mock predictions for testing. Error: {e}")
    MODEL_LOADED = False

# --- CONFIGURATION ---
# Change this to match the input shape your model expects (e.g., 224, 256, etc.)
MODEL_INPUT_SIZE = (224, 224) 
PREDICTION_THRESHOLD = 0.453

def predict_face(face_image):
    """Preprocesses the cropped face and runs it through the model."""
    # Resize to the input size required by the model
    face_resized = cv2.resize(face_image, MODEL_INPUT_SIZE)
    
    # Normalize the image (assuming model expects values between 0 and 1)
    face_normalized = face_resized / 255.0
    
    # Expand dimensions to match batch size: (1, height, width, channels)
    face_expanded = np.expand_dims(face_normalized, axis=0)
    
    if MODEL_LOADED:
        # Get prediction from the loaded keras model
        prediction = model.predict(face_expanded)[0][0]
        return float(prediction)
    else:
        # Mock prediction for testing UI if model is missing
        return float(np.random.rand())

@app.post("/api/analyze")
async def analyze_media(file: UploadFile = File(...)):
    # Create a temporary file to save the uploaded media
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        shutil.copyfileobj(file.file, temp_file)
        temp_file_path = temp_file.name

    try:
        # --- IMAGE PROCESSING ---
        if file.content_type.startswith('image/'):
            # Read image using OpenCV
            img = cv2.imread(temp_file_path)
            if img is None:
                raise HTTPException(status_code=400, detail="Invalid image file.")
            
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
            
            if len(faces) == 0:
                return JSONResponse(content={"error": "No face detected in the image."})
            
            # Take the largest face found
            x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
            
            # Crop the face (removing excess)
            cropped_face = img[y:y+h, x:x+w]
            
            # Predict
            score = predict_face(cropped_face)
            is_fake = score > PREDICTION_THRESHOLD
            
            verdict_text = "🟥 Prediction: FAKE IMAGE" if is_fake else "🟩 Prediction: REAL IMAGE"
            print(f"{verdict_text} (Score: {score:.4f})")
            
            return {
                "type": "image",
                "score": score,
                "is_fake": is_fake,
                "verdict": verdict_text,
                "bbox": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)} # Send coordinates to draw green box
            }

        # --- VIDEO PROCESSING ---
        elif file.content_type.startswith('video/'):
            video_capture = cv2.VideoCapture(temp_file_path)
            
            fake_count = 0
            real_count = 0
            frame_count = 0
            first_face_bbox = None
            
            while True:
                ret, frame = video_capture.read()
                if not ret:
                    break
                
                # Process every 10th frame to speed up analysis
                if frame_count % 10 == 0:
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    faces = face_cascade.detectMultiScale(gray, 1.1, 4)
                    
                    if len(faces) > 0:
                        x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
                        
                        # Save the first detected face's bounding box for preview purposes
                        if first_face_bbox is None:
                            first_face_bbox = {"x": int(x), "y": int(y), "w": int(w), "h": int(h)}
                        
                        cropped_face = frame[y:y+h, x:x+w]
                        score = predict_face(cropped_face)
                        
                        if score > PREDICTION_THRESHOLD:
                            fake_count += 1
                        else:
                            real_count += 1
                
                frame_count += 1
            
            video_capture.release()
            
            total_faces_analyzed = fake_count + real_count
            if total_faces_analyzed == 0:
                return JSONResponse(content={"error": "No faces detected in the video frames."})
            
            # Maximum times detected logic (majority vote)
            is_fake = fake_count > real_count
            verdict_text = "🟥 Prediction: FAKE VIDEO" if is_fake else "🟩 Prediction: REAL VIDEO"
            
            print(f"Video Verdict: {verdict_text}. Fake Frames: {fake_count}, Real Frames: {real_count}")
            
            return {
                "type": "video",
                "is_fake": is_fake,
                "verdict": verdict_text,
                "fake_frames": fake_count,
                "real_frames": real_count,
                "bbox": first_face_bbox # Returns box for the first frame a face was detected
            }
            
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type.")
            
    finally:
        # Cleanup temporary file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)