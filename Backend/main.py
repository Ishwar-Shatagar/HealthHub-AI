from fastapi import FastAPI, UploadFile, File
from services.diabetes_service import predict_diabetes
from services.cancer_service import predict_cancer
from services.ocr_service import extract_values_from_image
import shutil

app = FastAPI(title="Health Hub AI Backend")

# -------------------------
# Diabetes Structured Input
# -------------------------
@app.post("/api/diabetes-predict")
def diabetes_predict(data: dict):
    result = predict_diabetes(data)
    return result


# -------------------------
# Diabetes Image Input (OCR + ML)
# -------------------------
@app.post("/api/diabetes-image-extract")
async def diabetes_image_predict(file: UploadFile = File(...)):
    file_path = f"temp_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    extracted_values = extract_values_from_image(file_path)
    result = predict_diabetes(extracted_values)

    return {
        "extracted_values": extracted_values,
        "prediction": result
    }


# -------------------------
# Cancer Detection (CNN)
# -------------------------
@app.post("/api/cancer-detect")
async def cancer_detect(file: UploadFile = File(...)):
    file_path = f"temp_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = predict_cancer(file_path)
    return result