from django.urls import path
from .views import DeepfakeDetectView

urlpatterns = [
    path('detect/', DeepfakeDetectView.as_view(), name='detect'),
]
