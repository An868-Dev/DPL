import os
import cv2
import numpy as np
from tqdm import tqdm
import matplotlib.pyplot as plt
from PIL import Image, ImageEnhance

# ================= CONFIG =================
input_dir = "Data_split/train"      # thư mục chứa ảnh gốc
output_dir = "dataset_augmented"    # thư mục lưu ảnh sau khi augment
os.makedirs(output_dir, exist_ok=True)
IMG_SIZE = (224, 224)

# Thống kê augmentation
augment_count = {
    "original": 0,
    "flipH": 0,
    "flipV": 0,
    "rotate15": 0,
    "rotate-15": 0,
    "bright07": 0,
    "bright13": 0,
    "zoom": 0,
    "noise": 0,
}

# ================= AUGMENT FUNCTIONS =================
def flip_horizontal(img): return cv2.flip(img, 1)
def flip_vertical(img): return cv2.flip(img, 0)

def rotate(img, angle):
    h, w = img.shape[:2]
    M = cv2.getRotationMatrix2D((w/2, h/2), angle, 1)
    return cv2.warpAffine(img, M, (w, h))

def adjust_brightness(img, factor):
    pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    enhancer = ImageEnhance.Brightness(pil_img)
    bright_img = enhancer.enhance(factor)
    return cv2.cvtColor(np.array(bright_img), cv2.COLOR_RGB2BGR)

def random_zoom(img, zoom_factor=1.2):
    h, w = img.shape[:2]
    nh, nw = int(h / zoom_factor), int(w / zoom_factor)
    y1 = (h - nh)//2
    x1 = (w - nw)//2
    cropped = img[y1:y1+nh, x1:x1+nw]
    return cv2.resize(cropped, (w, h))

def add_noise(img):
    noise = np.random.normal(0, 15, img.shape).astype(np.int16)
    noisy = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    return noisy

# ================= PROCESS =================
for class_name in os.listdir(input_dir):
    class_path = os.path.join(input_dir, class_name)
    if not os.path.isdir(class_path):
        continue

    save_dir = os.path.join(output_dir, class_name)
    os.makedirs(save_dir, exist_ok=True)

    print(f"🚀 Đang augment lớp: {class_name}")

    for img_name in tqdm(os.listdir(class_path), desc=class_name):
        img_path = os.path.join(class_path, img_name)
        img = cv2.imread(img_path)
        if img is None:
            continue

        # Resize
        img = cv2.resize(img, IMG_SIZE)
        base_name = os.path.splitext(img_name)[0]

        # Lưu ảnh gốc
        cv2.imwrite(os.path.join(save_dir, f"{base_name}.jpg"), img)
        augment_count["original"] += 1

        # Flip
        cv2.imwrite(os.path.join(save_dir, f"{base_name}_flipH.jpg"), flip_horizontal(img))
        cv2.imwrite(os.path.join(save_dir, f"{base_name}_flipV.jpg"), flip_vertical(img))
        augment_count["flipH"] += 1
        augment_count["flipV"] += 1

        # Rotate
        cv2.imwrite(os.path.join(save_dir, f"{base_name}_rotate15.jpg"), rotate(img, 15))
        cv2.imwrite(os.path.join(save_dir, f"{base_name}_rotate-15.jpg"), rotate(img, -15))
        augment_count["rotate15"] += 1
        augment_count["rotate-15"] += 1

        # Brightness
        cv2.imwrite(os.path.join(save_dir, f"{base_name}_bright07.jpg"), adjust_brightness(img, 0.7))
        cv2.imwrite(os.path.join(save_dir, f"{base_name}_bright13.jpg"), adjust_brightness(img, 1.3))
        augment_count["bright07"] += 1
        augment_count["bright13"] += 1

        # Zoom
        cv2.imwrite(os.path.join(save_dir, f"{base_name}_zoom.jpg"), random_zoom(img))
        augment_count["zoom"] += 1

        # Noise
        cv2.imwrite(os.path.join(save_dir, f"{base_name}_noise.jpg"), add_noise(img))
        augment_count["noise"] += 1

# ================= HISTOGRAM + SUMMARY =================
total_images = sum(augment_count.values())

print("\n📊 THỐNG KÊ AUGMENTATION:")
for k, v in augment_count.items():
    print(f" - {k}: {v}")

print(f"\n📈 TỔNG SỐ ẢNH SAU AUGMENTATION: {total_images:,} ảnh")

# Lưu thống kê ra file
with open(os.path.join(output_dir, "augment_stats.txt"), "w") as f:
    f.write("AUGMENTATION SUMMARY\n")
    for k, v in augment_count.items():
        f.write(f"{k}: {v}\n")
    f.write(f"\nTotal: {total_images:,} images\n")

# Vẽ histogram
plt.figure(figsize=(10, 6))
plt.bar(augment_count.keys(), augment_count.values(), color="skyblue", edgecolor="black")
plt.title("Histogram - Data Augmentation Summary")
plt.xlabel("Augmentation Type")
plt.ylabel("Number of Images")
plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "histogram.png"))
plt.show()

print("\n✅ Hoàn tất Augmentation và lưu histogram + thống kê!")
