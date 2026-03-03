import io
import numpy as np
import warnings
warnings.filterwarnings('ignore')

from PIL import Image
import mediapipe as mp

mp_face_mesh = mp.solutions.face_mesh

# ── Geometry helpers ──────────────────────────────────────────────────────────

def _euclidean_3d(p1, p2):
    return np.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2 + (p2.z - p1.z)**2)

def _euclidean_2d(p1, p2):
    return np.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)

def _get_angle(p1, p2, p3):
    v1 = np.array([p1.x - p2.x, p1.y - p2.y])
    v2 = np.array([p3.x - p2.x, p3.y - p2.y])
    cosine = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
    return np.degrees(np.arccos(np.clip(cosine, -1, 1)))

def _symmetry_score(landmarks, left_indices, right_indices):
    left  = [[landmarks[i].x, landmarks[i].y] for i in left_indices]
    right = [[landmarks[i].x, landmarks[i].y] for i in right_indices]
    right_flipped = [[1 - x, y] for x, y in right]
    mse = np.mean(np.sum((np.array(left) - np.array(right_flipped))**2, axis=1))
    return float(np.exp(-10 * mse))

def _golden_ratio_score(m1, m2):
    if m2 == 0: return 0.0
    deviation = abs(m1 / m2 - 1.618) / 1.618
    return float(max(0, 1 - deviation))

def _smoothness(points):
    if len(points) < 3: return 0.5
    curvatures = []
    for i in range(1, len(points) - 1):
        p1, p2, p3 = points[i-1], points[i], points[i+1]
        area = abs((p1[0]*(p2[1]-p3[1]) + p2[0]*(p3[1]-p1[1]) + p3[0]*(p1[1]-p2[1])) / 2)
        base = _euclidean_2d(p1, p3)
        if base > 0:
            curvatures.append((2 * area) / (base ** 3 + 1e-6))
    if not curvatures: return 0.5
    variance = np.var(curvatures)
    return float(min(1.0, np.exp(-10 * variance) if variance > 0 else 1.0))

# ── Core analysis ─────────────────────────────────────────────────────────────

def _analyse_landmarks(landmarks):
    scores = {}

    # 1. Facial Symmetry
    sym_bilateral = _symmetry_score(landmarks,
        [33, 133, 172, 50, 70, 234], [362, 263, 397, 280, 300, 454])
    top_cx = np.mean([landmarks[i].x for i in [10, 151, 9]])
    bot_cx = np.mean([landmarks[i].x for i in [152, 378, 379]])
    sym_h  = float(max(0, min(1, 1 - abs(top_cx - bot_cx))))
    scores["Facial_Symmetry"] = float(np.mean([sym_bilateral, sym_h]))

    # 2. Golden Ratio
    golden = []
    fw = _euclidean_3d(landmarks[234], landmarks[454])
    fh = _euclidean_3d(landmarks[10],  landmarks[152])
    if fh > 0:
        golden.append(_golden_ratio_score(fw, fh))
    inter_eye = _euclidean_3d(landmarks[133], landmarks[362])
    if fw > 0:
        ratio = inter_eye / fw
        golden.append(float(max(0, 1 - abs(ratio - 0.46) / 0.46)))
    mw = _euclidean_3d(landmarks[61], landmarks[291])
    nw = _euclidean_3d(landmarks[98], landmarks[327])
    if nw > 0:
        golden.append(_golden_ratio_score(mw, nw))
    forehead_h = _euclidean_3d(landmarks[10],  landmarks[168])
    nose_h     = _euclidean_3d(landmarks[168], landmarks[2])
    chin_h     = _euclidean_3d(landmarks[2],   landmarks[152])
    total_h    = forehead_h + nose_h + chin_h
    if total_h > 0:
        thirds = [forehead_h/total_h, nose_h/total_h, chin_h/total_h]
        ideal  = [0.33, 0.33, 0.34]
        thirds_score = 1 - np.mean([abs(thirds[i]-ideal[i]) for i in range(3)])
        golden.append(float(max(0, thirds_score)))
    scores["Golden_Ratio_Alignment"] = float(np.mean(golden)) if golden else 0.5

    # 3. Eyes
    lew = _euclidean_3d(landmarks[33],  landmarks[133])
    leh = _euclidean_3d(landmarks[159], landmarks[145])
    rew = _euclidean_3d(landmarks[362], landmarks[263])
    reh = _euclidean_3d(landmarks[386], landmarks[374])
    if lew > 0 and rew > 0:
        ideal_r = 0.35
        eye_score = float(max(0, 1 - np.mean([
            abs(leh/lew - ideal_r)/ideal_r,
            abs(reh/rew - ideal_r)/ideal_r
        ])))
    else:
        eye_score = 0.5
    scores["Eye_Aesthetics"] = eye_score

    # 4. Nose
    nose_w  = _euclidean_3d(landmarks[98], landmarks[327])
    nose_h2 = _euclidean_3d(landmarks[168], landmarks[2])
    ns = _golden_ratio_score(nose_h2, nose_w) if nose_w > 0 else 0.5
    nasal   = _get_angle(landmarks[2], landmarks[1], landmarks[0])
    nasal_s = float(max(0, 1 - abs(nasal - 100) / 50))
    scores["Nose_Aesthetics"] = float(0.6 * ns + 0.4 * nasal_s)

    # 5. Lips
    mw2 = _euclidean_3d(landmarks[61], landmarks[291])
    ulh = _euclidean_3d(landmarks[0],  landmarks[13])
    llh = _euclidean_3d(landmarks[14], landmarks[17])
    lip_r = float(max(0, 1 - abs(ulh/llh - 0.5) / 0.5)) if llh > 0 else 0.5
    if mw2 > 0:
        cupid = float(max(0, 1 - abs(
            _euclidean_3d(landmarks[61], landmarks[62]) -
            _euclidean_3d(landmarks[291], landmarks[292])
        ) / (mw2 + 1e-6)))
    else:
        cupid = 0.5
    scores["Lip_Aesthetics"] = float(0.5 * lip_r + 0.5 * cupid)

    # 6. Jawline
    jaw_angle   = _get_angle(landmarks[172], landmarks[152], landmarks[397])
    jaw_a_score = float(max(0, 1 - abs(jaw_angle - 120) / 60))
    jaw_idx = [172, 136, 150, 149, 148, 152, 377, 400, 378, 379, 397]
    jaw_pts = [[landmarks[i].x, landmarks[i].y] for i in jaw_idx if i < len(landmarks)]
    jaw_smooth = _smoothness(jaw_pts) if len(jaw_pts) >= 3 else 0.5
    scores["Jawline_Aesthetics"] = float(0.6 * jaw_a_score + 0.4 * jaw_smooth)

    # 7. Skin Quality (placeholder)
    scores["Skin_Quality"] = 0.70

    # 8. Facial Harmony
    feature_vals = [scores[k] for k in scores if k != "Skin_Quality"]
    std = float(np.std(feature_vals)) if len(feature_vals) > 1 else 0.0
    scores["Facial_Harmony"] = float(max(0, min(1, 1 - std)))

    for k in scores:
        scores[k] = float(max(0.0, min(1.0, scores[k])))
    return scores

WEIGHTS = {
    "Facial_Symmetry":        0.25,
    "Golden_Ratio_Alignment": 0.20,
    "Facial_Harmony":         0.15,
    "Eye_Aesthetics":         0.12,
    "Lip_Aesthetics":         0.10,
    "Jawline_Aesthetics":     0.08,
    "Nose_Aesthetics":        0.07,
    "Skin_Quality":           0.03,
}

def analyze_face(image_bytes: bytes) -> dict | None:
    """
    Accepts raw image bytes, runs MediaPipe face mesh, returns score dict.
    Uses Pillow for decoding — no OpenCV / libGL dependency.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        rgb = np.array(img)
    except Exception:
        return None

    with mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
    ) as face_mesh:
        results = face_mesh.process(rgb)

    if not results.multi_face_landmarks:
        return None

    landmarks = results.multi_face_landmarks[0].landmark
    scores    = _analyse_landmarks(landmarks)

    total = sum(scores[k] * WEIGHTS.get(k, 0) for k in scores)
    total = float(max(0.0, min(1.0, total)))

    return {
        "total_score": round(total * 100, 2),
        "scores": {k: round(v * 100, 2) for k, v in scores.items()},
    }
