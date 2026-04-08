import joblib
import numpy as np

model = joblib.load("models/diabetes_model.pkl")

def predict_diabetes(data: dict):
    features = np.array([[
        data["Pregnancies"],
        data["Glucose"],
        data["BloodPressure"],
        data["SkinThickness"],
        data["Insulin"],
        data["BMI"],
        data["DiabetesPedigreeFunction"],
        data["Age"]
    ]])

    prediction = model.predict(features)[0]
    probability = model.predict_proba(features)[0][1]

    return {
        "risk": "High" if prediction == 1 else "Low",
        "probability": round(float(probability) * 100, 2)
    }