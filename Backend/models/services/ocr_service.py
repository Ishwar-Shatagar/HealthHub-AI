import pytesseract
import re
from PIL import Image

def extract_values_from_image(image_path):
    text = pytesseract.image_to_string(Image.open(image_path))

    # Basic extraction (customize for report format)
    glucose = re.search(r'Glucose\s*(\d+)', text)
    bmi = re.search(r'BMI\s*(\d+\.?\d*)', text)
    age = re.search(r'Age\s*(\d+)', text)

    return {
        "Pregnancies": 0,
        "Glucose": int(glucose.group(1)) if glucose else 0,
        "BloodPressure": 70,
        "SkinThickness": 20,
        "Insulin": 85,
        "BMI": float(bmi.group(1)) if bmi else 25.0,
        "DiabetesPedigreeFunction": 0.5,
        "Age": int(age.group(1)) if age else 30
    }