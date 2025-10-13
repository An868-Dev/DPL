import os
import matplotlib.pyplot as plt

# Đường dẫn thư mục chứa dữ liệu
data_dir = r"D:\DPL\Dataset_Sampled"

# Đếm số ảnh trong mỗi thư mục con
counts = {}
for folder in os.listdir(data_dir):
    folder_path = os.path.join(data_dir, folder)
    if os.path.isdir(folder_path):
        counts[folder] = len([f for f in os.listdir(folder_path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))])

# Vẽ biểu đồ tròn
plt.figure(figsize=(8, 8))
plt.pie(counts.values(), labels=counts.keys(), autopct='%1.1f%%', startangle=90)
plt.title("Tỉ lệ ảnh trong từng thư mục")
plt.show()

print("Số lượng ảnh trong từng thư mục:")
for k, v in counts.items():
    print(f"{k}: {v}")

# 🔹 Vẽ biểu đồ histogram (dạng cột)
plt.figure(figsize=(8, 6))
plt.bar(counts.keys(), counts.values(), color='skyblue', edgecolor='black')
plt.xlabel("Tên thư mục (lớp)")
plt.ylabel("Số lượng ảnh")
plt.title("Biểu đồ số lượng ảnh trong từng thư mục")
plt.xticks(rotation=45)
plt.tight_layout()

plt.show()