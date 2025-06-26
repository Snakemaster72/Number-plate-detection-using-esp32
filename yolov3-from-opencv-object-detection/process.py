import os
import cv2
import numpy as np
import easyocr
import sys
import util
import json

results = []

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_cfg_path = os.path.join(BASE_DIR, 'model', 'cfg', 'darknet-yolov3.cfg')
model_weights_path = os.path.join(BASE_DIR, 'model', 'weights', 'model.weights')
class_names_path = os.path.join(BASE_DIR, 'model', 'classes.names')

img_path = sys.argv[1]

# Load class names
with open(class_names_path, 'r') as f:
    class_names = [line.strip() for line in f if line.strip()]

# Load model
net = cv2.dnn.readNetFromDarknet(model_cfg_path, model_weights_path)

# Load image
img = cv2.imread(img_path)
if img is None:
    # print(json.dumps({"status": "error", "message": "Image not found or invalid"}))
    sys.exit(1)

H, W, _ = img.shape

# Convert image for YOLO
blob = cv2.dnn.blobFromImage(img, 1 / 255, (416, 416), (0, 0, 0), True)
net.setInput(blob)
detections = util.get_outputs(net)

bboxes, class_ids, scores = [], [], []

for detection in detections:
    bbox = detection[:4]
    xc, yc, w, h = bbox
    bbox = [int(xc * W), int(yc * H), int(w * W), int(h * H)]
    class_id = np.argmax(detection[5:])
    score = np.amax(detection[5:])

    bboxes.append(bbox)
    class_ids.append(class_id)
    scores.append(score)

# print("Class IDs Detected:", class_ids)
# print("Class Names Detected:", [class_names[i] for i in class_ids] if class_ids else "None")

# Apply NMS
bboxes, class_ids, scores = util.NMS(bboxes, class_ids, scores)

reader = easyocr.Reader(['en'])

if len(bboxes) == 0:
    # print(json.dumps({"timestamp": util.timestamp_now(), "text": "License plate not detected"}))
    sys.exit(0)

for i, bbox in enumerate(bboxes):
    xc, yc, w, h = bbox
    license_plate = img[int(yc - (h / 2)):int(yc + (h / 2)), int(xc - (w / 2)):int(xc + (w / 2))].copy()

    # Save cropped image for manual verification
    debug_path = os.path.join(BASE_DIR, f"debug_plate_{i}.jpg")
    cv2.imwrite(debug_path, license_plate)

    license_plate_gray = cv2.cvtColor(license_plate, cv2.COLOR_BGR2GRAY)
    _, license_plate_thresh = cv2.threshold(license_plate_gray, 64, 255, cv2.THRESH_BINARY_INV)

    output = reader.readtext(license_plate_thresh)
    # print("OCR Output:", output)

    for out in output:
        text_bbox, text, text_score = out
        # print(f"OCR Detected Text: '{text}' with score {text_score}")
        if text_score > 0.3:
            results.append({'text': text, 'score': float(text_score)})

# Final output
if not results:
    print(json.dumps({"timestamp": util.timestamp_now(), "text": "License plate not detected"}))
else:
    final_result = {
        "timestamp": util.timestamp_now(),
        "text": results[0]['text'],
        "score": results[0]['score']
    }
    print(json.dumps(final_result))

sys.exit(0)
