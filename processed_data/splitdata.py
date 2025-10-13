import os
import random
import shutil
import matplotlib.pyplot as plt

# ==============================
# 🔧 Cấu hình
# ==============================
DATA_DIR = r"D:\DPL\Dataset_Sampled"   # 🔹 Thư mục dữ liệu gốc
OUTPUT_DIR = r"D:\DPL\Data_split"  # 🔹 Thư mục lưu dữ liệu đã chia
TRAIN_RATIO = 0.7
VAL_RATIO = 0.15
TEST_RATIO = 0.15
RANDOM_SEED = 42  # Giữ chia ngẫu nhiên ổn định giữa các lần chạy

# ==============================
# 🚀 Bắt đầu chia dữ liệu
# ==============================
random.seed(RANDOM_SEED)

# Tạo thư mục train / val / test
for subset in ["train", "val", "test"]:
    os.makedirs(os.path.join(OUTPUT_DIR, subset), exist_ok=True)

# Lưu thống kê
split_counts = {"train": {}, "val": {}, "test": {}}

# Duyệt từng lớp ảnh (thư mục con)
for class_name in os.listdir(DATA_DIR):
    class_path = os.path.join(DATA_DIR, class_name)
    if not os.path.isdir(class_path):
        continue

    # Tạo thư mục lớp trong train/val/test
    for subset in ["train", "val", "test"]:
        os.makedirs(os.path.join(OUTPUT_DIR, subset, class_name), exist_ok=True)

    # Lấy toàn bộ ảnh
    images = [f for f in os.listdir(class_path)
              if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    random.shuffle(images)

    total = len(images)
    train_end = int(total * TRAIN_RATIO)
    val_end = train_end + int(total * VAL_RATIO)

    train_files = images[:train_end]
    val_files = images[train_end:val_end]
    test_files = images[val_end:]

    # Copy ảnh
    def copy_images(file_list, subset):
        for f in file_list:
            src = os.path.join(class_path, f)
            dst = os.path.join(OUTPUT_DIR, subset, class_name, f)
            shutil.copy2(src, dst)

    copy_images(train_files, "train")
    copy_images(val_files, "val")
    copy_images(test_files, "test")

    # Lưu thống kê
    split_counts["train"][class_name] = len(train_files)
    split_counts["val"][class_name] = len(val_files)
    split_counts["test"][class_name] = len(test_files)

    print(f"✅ {class_name}: {len(train_files)} train, {len(val_files)} val, {len(test_files)} test")

# ==============================
# 📊 Tổng kết dữ liệu
# ==============================
def count_files_in_folder(folder):
    count = 0
    for root, _, files in os.walk(folder):
        count += len([f for f in files if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
    return count

train_total = count_files_in_folder(os.path.join(OUTPUT_DIR, "train"))
val_total = count_files_in_folder(os.path.join(OUTPUT_DIR, "val"))
test_total = count_files_in_folder(os.path.join(OUTPUT_DIR, "test"))

print("\n📊 Tổng kết:")
print(f"Training set: {train_total} ảnh")
print(f"Validation set: {val_total} ảnh")
print(f"Test set: {test_total} ảnh")

# ==============================
# 🎨 Vẽ biểu đồ
# ==============================
plt.figure(figsize=(10, 5))

# Histogram tổng thể từng lớp trong 3 tập
for subset, color in zip(["train", "val", "test"], ["skyblue", "lightgreen", "salmon"]):
    plt.bar(split_counts[subset].keys(), split_counts[subset].values(),
            label=subset.capitalize(), alpha=0.7)

plt.xlabel("Tên lớp")
plt.ylabel("Số lượng ảnh")
plt.title("Số lượng ảnh theo từng lớp trong Train / Val / Test")
plt.legend()
plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "dataset_histogram.png"), dpi=300)
plt.show()

# Pie chart tỷ lệ giữa 3 tập
plt.figure(figsize=(6, 6))
plt.pie([train_total, val_total, test_total],
        labels=["Train", "Validation", "Test"],
        autopct='%1.1f%%', colors=["skyblue", "lightgreen", "salmon"])
plt.title("Tỷ lệ tổng thể Train / Validation / Test")
plt.savefig(os.path.join(OUTPUT_DIR, "dataset_piechart.png"), dpi=300)
plt.show()

print("\n📈 Đã lưu biểu đồ: dataset_histogram.png & dataset_piechart.png")
print("🎯 Hoàn tất chia và trực quan hóa dữ liệu!")
