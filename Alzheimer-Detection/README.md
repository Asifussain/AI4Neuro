# 🧠 AI4NEURO: AI-Powered Alzheimer's Pattern Detection

---

## 📝 Project Overview

**AI4NEURO** is a user-friendly web app that helps spot early signs of Alzheimer's using EEG brainwave data. With the help of our custom deep learning model called **ADFormer**, the system analyzes uploaded EEG files and returns predictions — either Normal or potentially Alzheimer's-related.

What you can do:


* Upload EEG data (secure and anonymous)
* Get quick predictions from our AI
* Download detailed reports based on your role (patient, clinician, or technician)

---

## 📽 Demo Video

[![Watch the demo](https://img.youtube.com/vi/_IDGvKWi0TQ/0.jpg)](https://youtu.be/_IDGvKWi0TQ)

> 🎥 Click the image above to see the platform in action.

---

## 🖼 Screenshots

### EEG Upload Page

![Upload Page](https://github.com/user-attachments/assets/f361be73-ddd2-4123-972e-33c5065104d5)
  
### Results and Reports Page
![Report Page](https://github.com/user-attachments/assets/0898a307-309d-4645-a8aa-da70d557b313)

### Visualization Example
![Visualizations](https://github.com/user-attachments/assets/1bb9ac30-a532-4c46-b726-9fd5c107c20f)


---

## 🎯 Mission

We're on a mission to make early pattern detection of Alzheimer's more accessible using AI and EEG signals. The goal is simple: help people take the first step toward medical support earlier.

---

## 🚀 Key Features

### ✅ Easy to Use

* Clean upload flow for EEG data
* Supabase ensures secure storage and logins

### ✅ Smart AI Behind the Scenes

* **ADFormer** — our homegrown deep learning model made just for EEG classification

### ✅ Role-Based Dashboards

* Patients see simple results
* Clinicians get detailed patterns and scores
* Technicians access advanced metrics and signal insights

### ✅ Downloadable Reports

* Patient, Clinician, and Technical versions — each tailored to the user's needs

### ✅ EEG Plots & Metrics

* View time-series signals, power spectral density plots, and waveform comparisons

### ✅ Consistency Check

* Internal checks on multiple segments to ensure the AI result is stable and trustworthy

### ✅ DTW Similarity Comparison

* Compares your EEG with known Normal and Alzheimer's-like brainwave shapes

### ✅ No Wait Times

* Processing happens in the background using Celery + Redis

---

## 🧱 Tech Stack

### 🔹 Frontend

* **Next.js**, **React**, Supabase JS, Axios, React Icons

### 🔹 Backend

* **Flask**, **Gunicorn**, Celery, Redis
* Supabase Python client for database and storage interaction

### 🔹 ML & Analysis

* **PyTorch** with our own ADFormer model
* Scikit-learn, Scipy, Matplotlib for metrics & plots
* fpdf2 for report creation, Dtaidistance for DTW

---

## 🧰 Getting Started

### 🛠 Prerequisites

* Python 3.9+
* Node.js + npm/yarn
* Supabase project & credentials
* Redis server (local or cloud)

---

## ⚙️ Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### .env Example

```env
SUPABASE_URL="your-supabase-url"
SUPABASE_SERVICE_ROLE_KEY="your-role-key"
REDIS_URL="redis://localhost:6379/0"
FRONTEND_URL="http://localhost:3000"
PORT=5000
```

### Run Server

```bash
gunicorn app:app -b 0.0.0.0:5000
# OR (for development)
python app.py
```

---

## 🧵 Celery Setup

```bash
celery -A celery_utils.celery_app worker --loglevel=info -P solo
```

---

## 🌐 Frontend Setup

```bash
cd frontend
npm install
```

### .env.local Example

```env
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
NEXT_PUBLIC_API_URL="http://127.0.0.1:5000"
```

### Run the Frontend

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🗂 Project Layout

```
.
├── backend/
│   ├── SIDDHI/         # ML logic and model code
│   ├── pdf_generation/ # Report templates
│   ├── routes/, app.py, celery_utils.py, etc.
│
├── frontend/
│   ├── components/, pages/, styles/
│   └── lib/, public/, config
│
└── render.yaml
```

---

## 🧪 How It Works

1. Login via Google
2. Pick your role
3. Upload a `.npy` EEG file
4. Wait while the backend processes it
5. View results — prediction + visualizations
6. Download your role-specific PDF report
7. Go to the "Previous Predictions" page to view history

---

## 📄 Report Types

### 👤 Patient Report

* Simple summary and result

### 👨‍⚕️ Clinician Report

* Prediction + confidence + pattern description

### 🧑‍🔬 Technical Report

* Metrics (Accuracy, F1, Confusion Matrix)
* DTW scores, PSD plots, and band analysis

---


## ⚠️ Note

> **AI4NEURO is not a diagnostic tool.** It provides patterns and signals based on trained data. For any health concerns, always consult your doctor.

---

## 🤝 Want to Contribute or Collaborate?

Open an issue, fork the repo, or just reach out. We'd love to hear from you!
