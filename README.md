<!-- HEADER STYLE: CLASSIC -->
<div align="center">

# <code>❯ Daily Knowledge Feeder</code>

<em>From Information Overload to Insight Distillation: A seamless workflow for long-form reading and linguistic mastery.</em>

<!-- BADGES -->
<!-- local repository, no metadata badges. -->

<em>Built with the tools and technologies:</em>

<img src="https://img.shields.io/badge/Express-000000.svg?style=default&logo=Express&logoColor=white" alt="Express">
<img src="https://img.shields.io/badge/JSON-000000.svg?style=default&logo=JSON&logoColor=white" alt="JSON">
<img src="https://img.shields.io/badge/Socket.io-010101.svg?style=default&logo=socketdotio&logoColor=white" alt="Socket.io">
<img src="https://img.shields.io/badge/npm-CB3837.svg?style=default&logo=npm&logoColor=white" alt="npm">
<img src="https://img.shields.io/badge/Mongoose-F04D35.svg?style=default&logo=Mongoose&logoColor=white" alt="Mongoose">
<img src="https://img.shields.io/badge/Cheerio-E88C1F.svg?style=default&logo=Cheerio&logoColor=white" alt="Cheerio">
<br>
<img src="https://img.shields.io/badge/.ENV-ECD53F.svg?style=default&logo=dotenv&logoColor=black" alt=".ENV">
<img src="https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=default&logo=JavaScript&logoColor=black" alt="JavaScript">
<img src="https://img.shields.io/badge/EJS-B4CA65.svg?style=default&logo=EJS&logoColor=black" alt="EJS">
<img src="https://img.shields.io/badge/Nodemon-76D04B.svg?style=default&logo=Nodemon&logoColor=white" alt="Nodemon">
<img src="https://img.shields.io/badge/Axios-5A29E4.svg?style=default&logo=Axios&logoColor=white" alt="Axios">
<img src="https://img.shields.io/badge/Socket-C93CD7.svg?style=default&logo=Socket&logoColor=white" alt="Socket">

</div>
<br>

---

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Overview](#overview)
- [Features](#key-features)
- [ScreenShot](#screenshot)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Usage](#usage)
- [Acknowledgments](#acknowledgments)

---

## Overview

Daily Knowledge Feeder is an automated information ingestion and processing system built on Node.js. It integrating authoritative content sourcing with advanced linguistic augmentation, providing a one-stop solution for high-quality knowledge acquisition.

**Why KnowledgeFeederBot?**
In an era of information explosion, we are often overwhelmed by low-quality content while professional literature remains inaccessible due to language barriers. I developed this system to achieve:

Efficiency: Automating the tedious process of manual formatting and organization.

Quantifiable Progress: Turning passive reading into active vocabulary accumulation through automated annotations.

Structural Integrity: Ensuring every piece of information becomes a "searchable and linkable" asset within a personal knowledge base.

## Key Features

### 🕸️ Intelligent Scraping & Automation Engine

Multi-Mode Ingestion Logic: Supports both Incremental updates for daily news and Historical Backfill for bulk data retrieval. It handles complex pagination and API-based scraping seamlessly.

Robust & Ethical Crawling: Built with Axios and Cheerio, the engine strictly adheres to robots.txt protocols, supports Crawl-Delay parsing, and features a sophisticated Retry Mechanism to handle network instability.

Automated Scheduling: Integrated with node-cron for daily synchronization. It includes a Global Task Lock and anti-duplication logic to prevent redundant execution and optimize system resources.

High-Efficiency Data Cleaning: Implements O(1) complexity URL deduplication and cross-category overlap detection, ensuring a pristine database free of advertisements and redundant HTML tags.

### 🧠 AI-Driven Semantic Augmentation

Gemini AI Integration: Leverages Google’s Gemini API for deep contextual analysis, providing high-precision grammatical breakdowns and nuanced semantic explanations in Traditional Chinese.

Linguistic Tiering & Annotation: Powered by the StarDict architecture and ECDICT (760k+ entries), the system performs Lemmatization and automatically highlights vocabulary based on difficulty levels (e.g., Collins, Oxford 3000, TOEFL, GRE, IELTS).

Immersive Language Tools: Includes smart boundary detection for word/sentence selection, paired with Google Cloud TTS for natural-sounding auditory learning and a dual-mode floating translation window.

### 📝 Modern Reading & PKM Workflow

All-in-One Dashboard: A centralized management hub with dynamic multi-column sorting (Title, Status, Saved Date) and full-text search capabilities.

Comprehensive State Tracking: Features a Floating Action Button (FAB) to quickly toggle article states: Unread, Reading, Read, Read Later, and Archived.

Seamless PKM Export: Automatically converts web content into clean Markdown. It generates rich YAML Frontmatter (tags, source, date), ensuring 100% compatibility with Obsidian (optimized for Dataview), Notion, and other personal knowledge management tools.

Distraction-Free Editing: Deep integration with the Vditor editor, featuring a "Clean Mode" that hides system boundary markers for a fluid reading and writing experience.

---

## ScreenShot
### Dashboard
<img alt="螢幕擷取畫面 2026-04-16 175047" src="https://github.com/user-attachments/assets/c67b109a-a29a-47dc-9972-a8295550860e" />

### Article List
<img alt="螢幕擷取畫面 2026-04-16 211614" src="https://github.com/user-attachments/assets/a1ff859f-6c8d-4d6c-852a-901849f20a04" />

### Source List
<img alt="螢幕擷取畫面 2026-04-16 212638" src="https://github.com/user-attachments/assets/c2743859-38ee-483c-a757-611b2b4780b4" />

### Manual Deep Dive
<img alt="螢幕擷取畫面 2026-04-16 212656" src="https://github.com/user-attachments/assets/5a91c43f-a891-424a-8bf6-63fca30cb2ad" />

### Task Log
<img alt="螢幕擷取畫面 2026-04-12 181434" src="https://github.com/user-attachments/assets/d6449675-8129-4ec6-b0cd-e321158b6cf7" />

### Article
<img alt="螢幕擷取畫面 2026-04-16 212037" src="https://github.com/user-attachments/assets/2e853677-b7bf-430b-8fc8-db447233b18c" />
<img alt="螢幕擷取畫面 2026-04-16 212050" src="https://github.com/user-attachments/assets/e2c24f47-c6e3-45fb-810d-7c9d195a70f2" />
<img alt="螢幕擷取畫面 2026-04-16 212408" src="https://github.com/user-attachments/assets/0f9fdd9f-f9cc-48a3-86dd-3bbff4ff5ec7" />
<img alt="螢幕擷取畫面 2026-04-16 212808" src="https://github.com/user-attachments/assets/c8698507-fef8-44f2-8f65-f97357abc0de" />
<img alt="螢幕擷取畫面 2026-04-16 213010" src="https://github.com/user-attachments/assets/33691e4e-4b15-4dc1-91fe-ab63afef59da" />
<img alt="螢幕擷取畫面 2026-04-16 212023" src="https://github.com/user-attachments/assets/59ca506b-d4ff-4ec3-806c-b9320efc6cff" />

---
## Project Structure

```sh
└── /
	├── .env
    ├── node_modules
    ├── package-lock.json
    ├── package.json
    ├── public
    │   └── js
    ├── scripts
    │   └── seed.js
    └── src
        ├── data
			└── stardict.db
        ├── app.js
        ├── config
        ├── lib
        ├── models
        ├── routes
        ├── services
        ├── strategies
        ├── utils
        └── views
```

## Getting Started

### Prerequisites

🛠️ Technical Stack Highlights

- **Runtime:** Node.js
- **Scraping:** Axios, Cheerio
- **AI/NLP:** Gemini Pro API, StarDict, Google TTS
- **Frontend:** Vditor, Socket.io (Client)
- **Storage:** Markdown + YAML, O(1) Deduplication Logic

### Installation

Build from the source and install dependencies:

1. **Clone the repository:**
   ```sh
   ❯ git clone https://github.com/Lynn112325/Daily_Knowledge_Feeder
   ```

2. **Navigate to the project directory:**
   ```sh
   ❯ cd Daily_Knowledge_Feeder
   ```

3. **Install the dependencies:**
   ```sh
   ❯ npm install
   ```

4. **Download the Dictionary Data:**
   You need the `stardict.db` file from the [ECDICT project](https://github.com/skywind3000/ECDICT). Place the database file in the designated data directory (e.g., `./data/`).

5. **Initialize the Database & Sources:**
   Run the seeding script to synchronize categories and initialize the collection with high-authority sources like ScienceDaily.
   ```sh
   ❯ node scripts/seed.js
   ```

6. **Set .env**
   Create a `.env` file in the root directory and configure your environment variables as follows:
   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/knowledge_feeder
   PORT=3000
   TIMEZONE="Asia/Hong_Kong"
   CRAWLER_BATCH_SIZE=10
   # Get your API Key from [https://aistudio.google.com/](https://aistudio.google.com/)
   API_KEY=""
   ```

### Usage

Run the project with:
```sh
❯ node src/app.js
```

---
## Acknowledgments

- Credits
ECDICT: This project leverages the Free English to Chinese Dictionary Database developed by skywind3000. The extensive SQLite database provided by ECDICT is the backbone of our vocabulary filtering system, allowing for high-performance, offline linguistic analysis and difficulty categorization.

Vditor / B3log: This project utilizes the open-source editor components provided by B3log. Their robust Markdown editor ecosystem contributes significantly to the content creation and preview experience within this tool.
<div align="right">

[![][back-to-top]](#top)

</div>

[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-151515?style=flat-square

---
