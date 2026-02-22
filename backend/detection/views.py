from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import UploadSerializer

import tensorflow as tf
import numpy as np
from PIL import Image
import os
from django.conf import settings

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_PATH = os.path.join(BASE_DIR, 'model', 'deepfake_model.keras')

model = tf.keras.models.load_model(MODEL_PATH, compile=False)


class DeepfakeDetectView(APIView):
    def post(self, request):
        serializer = UploadSerializer(data=request.data)

        if serializer.is_valid():
            file = serializer.validated_data['file']

            # ✅ Create upload folder inside project
            upload_dir = os.path.join(settings.BASE_DIR, "temp_uploads")
            os.makedirs(upload_dir, exist_ok=True)

            file_path = os.path.join(upload_dir, file.name)

            # Save file
            with open(file_path, "wb") as f:
                for chunk in file.chunks():
                    f.write(chunk)

            try:
                # Process image
                img = Image.open(file_path).convert('RGB')
                img = img.resize((224, 224))
                arr = np.array(img) / 255.0
                arr = np.expand_dims(arr, axis=0)

                # Prediction
                pred = model.predict(arr)[0][0]
                label = "Fake" if pred > 0.453 else "Real"

                return Response({
                    "prediction": float(pred),
                    "label": label
                })

            except Exception as e:
                return Response(
                    {"error": str(e)},
                    status=500
                )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)