import os
import cv2
import numpy as np
import tensorflow as tf
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tempfile
import shutil
import base64
import json
import os
from dotenv import load_dotenv
import google.generativeai as genai
from PIL import Image

# Load environment variables and configure Gemini
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

MODEL_PATH = 'model.keras'
try:
    model = tf.keras.models.load_model(MODEL_PATH)
    print("✅ Model loaded successfully.")
    MODEL_LOADED = True
except Exception as e:
    print(f"⚠️ WARNING: Could not load {MODEL_PATH}. Using mock predictions for testing. Error: {e}")
    MODEL_LOADED = False

MODEL_INPUT_SIZE = (224, 224) 
PREDICTION_THRESHOLD = 0.453

def get_source_info(frame):
    """
    Sends the full, uncropped frame to Gemini to predict location and 
    generate a plausible regional IP address.
    """
    try:
        # Convert OpenCV frame (BGR) to RGB for Gemini
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb_frame)
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = """Analyze this image. Predict the geographical location (city, country) where this person might be from or where the photo was taken based on the environment or physical traits. 
        Provide a plausible random IPv4 address that belongs to that predicted region, along with approximate latitude and longitude coordinates. 
        Return ONLY a valid JSON object with EXACTLY these keys: "latitude", "longitude", "location_name", "ip_address". Do not include markdown formatting."""
        
        response = model.generate_content([prompt, pil_img])
        
        # Clean up the response to ensure it's parseable JSON
        text = response.text.replace('```json', '').replace('```', '').strip()
        data = json.loads(text)
        return data
    except Exception as e:
        print(f"Gemini Location Error: {e}")
        return {
            "latitude": "Unknown",
            "longitude": "Unknown",
            "location_name": "Prediction Failed",
            "ip_address": "0.0.0.0"
        }

def predict_face(face_image):
    face_resized = cv2.resize(face_image, MODEL_INPUT_SIZE)
    face_normalized = face_resized / 255.0
    face_expanded = np.expand_dims(face_normalized, axis=0)
    
    if MODEL_LOADED:
        prediction = model.predict(face_expanded)[0][0]
        return float(prediction)
    else:
        return float(np.random.rand())

@app.post("/api/analyze")
async def analyze_media(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        shutil.copyfileobj(file.file, temp_file)
        temp_file_path = temp_file.name

    try:
        if file.content_type.startswith('image/'):
            img = cv2.imread(temp_file_path)
            if img is None:
                raise HTTPException(status_code=400, detail="Invalid image file.")
            
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
            
            if len(faces) == 0:
                return JSONResponse(content={"error": "No face detected in the image."})
            
            # Get location prediction using the FULL unaltered image BEFORE cropping
            source_info = get_source_info(img)

            x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
            cropped_face = img[y:y+h, x:x+w]
            
            score = predict_face(cropped_face)
            is_fake = score > PREDICTION_THRESHOLD
            verdict_text = "🟥 Prediction: FAKE IMAGE" if is_fake else "🟩 Prediction: REAL IMAGE"
            
            return {
                "type": "image",
                "score": score,
                "is_fake": is_fake,
                "verdict": verdict_text,
                "bbox": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
                "source_info": source_info
            }

        elif file.content_type.startswith('video/'):
            video_capture = cv2.VideoCapture(temp_file_path)
            
            fake_count = 0
            real_count = 0
            frame_count = 0
            first_face_bbox = None
            sample_frames = [] # Store up to 5 extracted frames
            source_info = None
            
            while True:
                ret, frame = video_capture.read()
                if not ret:
                    break
                
                if frame_count % 10 == 0:
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    faces = face_cascade.detectMultiScale(gray, 1.1, 4)
                    
                    if len(faces) > 0:
                        x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
                        
                        if first_face_bbox is None:
                            first_face_bbox = {"x": int(x), "y": int(y), "w": int(w), "h": int(h)}
                            
                            # Grab source info from the very first valid frame (unaltered)
                            source_info = get_source_info(frame)
                        
                        cropped_face = frame[y:y+h, x:x+w]
                        score = predict_face(cropped_face)
                        
                        # --- Extract Frame for Frontend (Max 5) ---
                        if len(sample_frames) < 5:
                            # Draw a green box on the frame so users see what the AI saw
                            frame_with_box = frame.copy()
                            cv2.rectangle(frame_with_box, (x, y), (x+w, y+h), (0, 255, 0), 3)
                            
                            # Resize to a smaller width to keep the JSON payload fast & lightweight
                            h_orig, w_orig = frame_with_box.shape[:2]
                            scale = 320.0 / w_orig
                            resized = cv2.resize(frame_with_box, (320, int(h_orig * scale)))
                            
                            # Convert to Base64
                            _, buffer = cv2.imencode('.jpg', resized, [cv2.IMWRITE_JPEG_QUALITY, 70])
                            b64_str = base64.b64encode(buffer).decode('utf-8')
                            sample_frames.append(f"data:image/jpeg;base64,{b64_str}")
                        
                        if score > PREDICTION_THRESHOLD:
                            fake_count += 1
                        else:
                            real_count += 1
                
                frame_count += 1
            
            video_capture.release()
            
            total_faces_analyzed = fake_count + real_count
            if total_faces_analyzed == 0:
                return JSONResponse(content={"error": "No faces detected in the video frames."})
            
            is_fake = fake_count > real_count
            verdict_text = "🟥 Prediction: FAKE VIDEO" if is_fake else "🟩 Prediction: REAL VIDEO"
            
            return {
                "type": "video",
                "is_fake": is_fake,
                "verdict": verdict_text,
                "fake_frames": fake_count,
                "real_frames": real_count,
                "bbox": first_face_bbox,
                "sample_frames": sample_frames,
                "source_info": source_info
            }
            
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type.")
            
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)