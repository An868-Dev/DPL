import os
import matplotlib.pyplot as plt
import numpy as np

# === CHỈNH LẠI ĐƯỜNG DẪN GỐC ===
DATA_DIR = "Data_split"  # thư mục chứa train, val, test

sets = ['train', 'val', 'test']
class_counts = {s: {} for s in sets}

# --- Đếm ảnh theo từng class trong mỗi tập ---
for s in sets:
    set_path = os.path.join(DATA_DIR, s)
    if not os.path.exists(set_path):
        print(f"⚠️ Không tìm thấy thư mục {set_path}, bỏ qua...")
        continue

    for class_name in sorted(os.listdir(set_path)):
        class_path = os.path.join(set_path, class_name)
        if not os.path.isdir(class_path):
            continue

        num_images = len([
            f for f in os.listdir(class_path)
            if f.lower().endswith(('.png', '.jpg', '.jpeg'))
        ])
        class_counts[s][class_name] = num_images

# --- Lấy danh sách lớp chung ---
all_classes = sorted(set(
    c for s in sets for c in class_counts[s].keys()
))

# --- Gán 0 nếu lớp nào đó không có trong 1 tập ---
for s in sets:
    for c in all_classes:
        class_counts[s].setdefault(c, 0)

# --- Tạo mảng dữ liệu ---
train_counts = [class_counts['train'][c] for c in all_classes]
val_counts = [class_counts['val'][c] for c in all_classes]
test_counts = [class_counts['test'][c] for c in all_classes]

# --- Vẽ biểu đồ stacked bar ---
x = np.arange(len(all_classes))
bar_width = 0.6

plt.figure(figsize=(12, 6))
plt.bar(x, train_counts, color='steelblue', label='Train')
plt.bar(x, val_counts, bottom=train_counts, color='orange', label='Val')
plt.bar(x, test_counts, bottom=np.array(train_counts)+np.array(val_counts), color='green', label='Test')

plt.xticks(x, all_classes, rotation=45)
plt.ylabel('Số lượng ảnh')
plt.xlabel('Tên lớp')
plt.title('Số lượng ảnh theo từng lớp trong Train / Val / Test')
plt.legend()
plt.tight_layout()
plt.show()
