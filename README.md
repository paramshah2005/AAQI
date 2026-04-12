# Apna AQI — Hyperlocal Air Quality Intelligence Platform

## Overview

**Apna AQI** is a next-generation, full-stack air quality intelligence platform designed to deliver **accurate, hyperlocal, and actionable air pollution insights**.

Traditional AQI systems often rely on **single-source data**, leading to inconsistencies and poor real-world representation. Apna AQI solves this by:

- Aggregating **multiple independent data sources**
- Applying **statistical validation techniques**
- Enhancing predictions using **machine learning**
- Incorporating **crowdsourced real-world signals**

> The result: **a smarter, more reliable AQI system that reflects what people actually experience.**

---

## Core Features

### Multi-Source Data Aggregation

Integrates **7+ environmental APIs** for redundancy and reliability:

| API | Description |
|-----|-------------|
| OpenWeather | Global weather & pollution data |
| WeatherAPI | Real-time weather conditions |
| Open-Meteo | Open-source meteorological data |
| WAQI | World Air Quality Index network |
| API-Ninjas | Multi-purpose environmental data |
| OpenAQ | Open-source air quality data |
| CPCB (India) | India's official pollution board data |

---

### Intelligent Validation Engine (Apna AQI Consensus)

A custom validation pipeline ensures data accuracy:

- **Outlier Removal** using *Interquartile Range (IQR)*
- **Pattern Validation** using *Cosine Similarity*
- Produces a **single, trusted AQI value**

> This avoids misleading spikes and inconsistent readings from unreliable sources.

---

### "Feels Like AQI" (ML-Powered)

A machine learning model predicts **real-world perceived pollution levels**:

- **Model:** Ordinary Least Squares (OLS) Linear Regression
- **Training Data:** Last 30 days of local environmental data
- **Features:** Wind speed · Humidity · Pressure · Temperature

**Output:** A more realistic AQI reflecting how pollution actually feels to humans.

---

### Crowdsourced Pollution Intelligence

Users can report local pollution events:

- Construction dust
- Traffic congestion
- Burning waste

Reports are clustered geographically and validated through consensus. Once validated, they influence AQI via **dynamic penalty adjustments**.

---

### Dynamic Health Advisory System

A rule-based engine analyzes **6 key pollutants**:

`PM2.5` · `PM10` · `CO` · `NO₂` · `O₃` · `SO₂`

Generates:

- Personalized health warnings
- Preventive recommendations
- Risk categorization (safe → hazardous)

---

### Modern Interactive UI

Built with **Tailwind CSS** and **Framer Motion**, featuring:

- Glassmorphism design
- Real-time data cards
- Historical trend graphs
- Interactive animated globe
- Fully responsive layout

---

## System Architecture

```
User → Frontend (Next.js UI)
     → API Layer (Serverless Functions)
     → Multi-Source Data Fetching
     → Validation Engine (IQR + Cosine Similarity)
     → ML Model (Feels Like AQI)
     → Database (Crowdsourced Reports)
     → Unified AQI Output
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS, Framer Motion |
| Backend | Next.js API Routes (Serverless) |
| Database | Prisma + SQLite |
| ML Model | Custom OLS Regression |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js (v20+)
- npm / yarn

### 1. Clone the Repository

```bash
git clone https://github.com/paramshah2005/aaqi_temp.git
cd aaqi_temp
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Create a `.env.local` file in the root directory:

```env
OPENWEATHER_API_KEY=
WEATHERAPI_API_KEY=
WAQI_TOKEN=
API_NINJAS_KEY=
DATA_GOV_IN_KEY=
OPENAQ_API_KEY=
```

> More APIs configured = better validation accuracy

### 4. Setup Database

```bash
npx prisma generate
npx prisma db push
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/data` | Fetch aggregated AQI data |
| `/api/history` | Last 24-hour trends |
| `/api/training-data` | 30-day ML dataset |
| `/api/crowdsource` | Submit pollution reports |
| `/api/suburbs` | Nearby locations (GeoSearch) |

---

## Roadmap

- Deep Learning-based AQI prediction
- Satellite data integration
- Indoor AQI tracking (IoT sensors)
- Mobile app (React Native)
- Community heatmaps

---

## Contributing

Contributions are welcome!

```bash
# 1. Fork the repo
# 2. Create a new branch
git checkout -b feature/your-feature-name

# 3. Make your changes and commit
git commit -m "Add: your feature description"

# 4. Push and submit a PR
git push origin feature/your-feature-name
```

---

## License

This project is licensed under the **MIT License**.

---

## Inspiration

Air pollution affects millions daily, yet most tools fail to provide **localized, actionable insights**.

Apna AQI bridges this gap by combining **data science**, **machine learning**, and **community intelligence** — making air quality understandable, reliable, and useful.

---

## Acknowledgements

- [OpenAQ](https://openaq.org)
- [CPCB India](https://cpcb.nic.in)
- [WAQI](https://waqi.info)
- [OpenWeather](https://openweathermap.org)
- [Open-Meteo](https://open-meteo.com)
