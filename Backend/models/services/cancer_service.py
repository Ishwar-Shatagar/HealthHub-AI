import tensorflow as tf
import numpy as np
from tensorflow.keras.preprocessing import image

model = tf.keras.models.load_model("models/cancer_cnn_model.h5")

def preprocess_image(img_path):
    img = image.load_img(img_path, target_size=(224, 224))
    img_array = image.img_to_array(img)
    img_array = img_array / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

def predict_cancer(img_path):
    processed_img = preprocess_image(img_path)
    prediction = model.predict(processed_img)[0][0]

    return {
        "cancer_probability": round(float(prediction) * 100, 2),
        "status": "High Cancer Probability" if prediction > 0.7 else "Low Risk"
    }