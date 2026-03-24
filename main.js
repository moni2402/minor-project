/* ============================================
   VitaCheck — AI Health Risk Predictor
   app.js
   ============================================ */

"use strict";

/* ── Toggle Button Selection ───────────────── */
/**
 * Selects a toggle button within its group.
 * @param {HTMLElement} btn       - The clicked button element
 * @param {string}      groupId  - ID of the parent toggle group
 */
function selectToggle(btn, groupId) {
  document.querySelectorAll(`#${groupId} .toggle-btn`)
    .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateProgress();
}

/* ── Progress Bar ──────────────────────────── */
/**
 * Calculates how many required fields are filled and
 * updates the progress bar width accordingly.
 */
function updateProgress() {
  const textFields   = ['age', 'sex', 'height', 'weight', 'bp', 'glucose', 'cholesterol'];
  const toggleGroups = ['activityGroup', 'dietGroup', 'smokingGroup', 'alcoholGroup'];

  let filled = 0;
  const total = textFields.length + toggleGroups.length;

  textFields.forEach(id => {
    if (document.getElementById(id).value) filled++;
  });

  toggleGroups.forEach(id => {
    if (document.querySelector(`#${id} .active`)) filled++;
  });

  const pct = Math.round((filled / total) * 100);
  document.getElementById('progressFill').style.width = pct + '%';
}

// Attach live progress tracking to all text/select inputs
document.querySelectorAll('input[type=number], select')
  .forEach(el => el.addEventListener('input', updateProgress));

/* ── Risk Scoring Engine ───────────────────── */
/**
 * Computes disease risk scores (0–100) from user data.
 * Uses a weighted clinical-guideline-based model.
 *
 * @param   {Object} data  - Collected form data
 * @returns {Object}       - { diabetes, heart, hypertension, bmi }
 */
function computeRisk(data) {
  let diabetesScore  = 0;
  let heartScore     = 0;
  let hypertScore    = 0;

  // ── BMI ────────────────────────────────────
  const bmi = data.weight / Math.pow(data.height / 100, 2);

  if (bmi >= 30) {
    diabetesScore += 25; heartScore += 20; hypertScore += 20;
  } else if (bmi >= 25) {
    diabetesScore += 12; heartScore += 10; hypertScore += 10;
  }

  // ── Age ────────────────────────────────────
  if (data.age >= 60) {
    diabetesScore += 20; heartScore += 25; hypertScore += 25;
  } else if (data.age >= 45) {
    diabetesScore += 12; heartScore += 15; hypertScore += 15;
  } else if (data.age >= 30) {
    diabetesScore += 5;  heartScore += 5;  hypertScore += 5;
  }

  // ── Fasting Glucose ─────────────────────────
  if (data.glucose >= 126) {
    diabetesScore += 30; heartScore += 10;
  } else if (data.glucose >= 100) {
    diabetesScore += 15; heartScore += 5;
  }

  // ── Blood Pressure ──────────────────────────
  const bpPoints = { normal: 0, elevated: 5, high1: 15, high2: 25 }[data.bp] || 0;
  hypertScore    += bpPoints * 2;
  heartScore     += bpPoints;
  diabetesScore  += bpPoints * 0.5;

  // ── Cholesterol ──────────────────────────────
  const cholPoints = { optimal: 0, borderline: 12, high: 25 }[data.cholesterol] || 0;
  heartScore += cholPoints;

  // ── Physical Activity ─────────────────────────
  const activityMap = {
    'Sedentary':       20,
    'Light':           10,
    'Moderate':         2,
    'Vigorous':         0,
  };
  const activityKey = Object.keys(activityMap)
    .find(k => (data.activity || '').includes(k));
  const actPoints = activityKey ? activityMap[activityKey] : 10;
  diabetesScore += actPoints;
  heartScore    += actPoints;
  hypertScore   += actPoints * 0.5;

  // ── Diet Quality ──────────────────────────────
  const dietMap = { 'Poor': 20, 'Average': 10, 'Good': 4, 'Excellent': 0 };
  // Strip emoji characters before matching
  const dietLabel = (data.diet || '').replace(/\p{Emoji}/gu, '').trim();
  const dietPoints = dietMap[dietLabel] !== undefined ? dietMap[dietLabel] : 10;
  diabetesScore += dietPoints;
  heartScore    += dietPoints * 0.8;

  // ── Sleep Duration ─────────────────────────────
  const sleepHrs = parseInt(data.sleep, 10);
  if (sleepHrs <= 5) {
    diabetesScore += 12; heartScore += 10;
  } else if (sleepHrs >= 9) {
    diabetesScore += 5;  heartScore += 5;
  }

  // ── Stress Level ───────────────────────────────
  if (data.stress >= 8) {
    diabetesScore += 10; heartScore += 12; hypertScore += 15;
  } else if (data.stress >= 5) {
    diabetesScore += 5;  heartScore += 6;  hypertScore += 8;
  }

  // ── Smoking ────────────────────────────────────
  if ((data.smoking || '').includes('Current')) {
    heartScore    += 30;
    diabetesScore += 10;
    hypertScore   += 15;
  } else if ((data.smoking || '').includes('Former')) {
    heartScore += 12;
  }

  // ── Alcohol ────────────────────────────────────
  if ((data.alcohol || '').includes('Heavy')) {
    heartScore    += 20;
    hypertScore   += 15;
    diabetesScore += 8;
  } else if ((data.alcohol || '').includes('Moderate')) {
    heartScore += 8;
  }

  // ── Family History ──────────────────────────────
  if (data.famDiabetes) diabetesScore += 20;
  if (data.famHeart)    heartScore    += 20;
  if (data.famHypert)   hypertScore   += 20;
  if (data.prevCond)  { diabetesScore += 15; heartScore += 8; hypertScore += 8; }

  // ── Sex Adjustment ──────────────────────────────
  if (data.sex === 'male' && data.age >= 40) heartScore += 10;

  // Clamp all scores to 0–100
  const clamp = v => Math.min(100, Math.max(0, Math.round(v)));

  return {
    diabetes:     clamp(diabetesScore),
    heart:        clamp(heartScore),
    hypertension: clamp(hypertScore),
    bmi:          Math.round(bmi * 10) / 10,
  };
}

/* ── Risk Level Helpers ─────────────────────── */
/**
 * Returns 'low' | 'medium' | 'high' for a given score.
 * @param {number} score
 */
function getRiskLevel(score) {
  if (score < 35) return 'low';
  if (score < 65) return 'medium';
  return 'high';
}

/**
 * Returns a human-readable label for a risk level.
 * @param {number} score
 */
function getRiskLabel(score) {
  if (score < 35) return 'Low';
  if (score < 65) return 'Medium';
  return 'High';
}

/* ── SVG Circular Meter ─────────────────────── */
/**
 * Builds an SVG arc-based circular progress indicator.
 *
 * @param {number} score  - 0–100
 * @param {string} level  - 'low' | 'medium' | 'high'
 * @returns {string}      - HTML string
 */
function buildCircle(score, level) {
  const colorMap = { low: '#00d4aa', medium: '#f59e0b', high: '#ef4444' };
  const color    = colorMap[level];
  const radius   = 34;
  const circ     = 2 * Math.PI * radius;
  const dash     = (score / 100) * circ;

  return `
    <div class="meter-circle" style="color:${color}">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle
          cx="40" cy="40" r="${radius}"
          fill="none" stroke="#1a2235" stroke-width="6"/>
        <circle
          cx="40" cy="40" r="${radius}"
          fill="none" stroke="${color}" stroke-width="6"
          stroke-dasharray="${dash} ${circ}"
          stroke-linecap="round"/>
      </svg>
      <span class="meter-num">${score}%</span>
    </div>`;
}

/* ── Recommendation Engine ──────────────────── */
/**
 * Generates personalised health recommendations based
 * on user inputs and computed risk scores.
 *
 * @param {Object} data    - Raw form data
 * @param {Object} scores  - Computed { bmi, diabetes, heart, hypertension }
 * @returns {Array}        - Array of { icon, title, text } objects (max 6)
 */
function getRecommendations(data, scores) {
  const recs = [];

  if (scores.bmi >= 25) {
    recs.push({
      icon:  '⚖️',
      title: 'Manage Body Weight',
      text:  `Your BMI is ${scores.bmi}. Losing 5–10% of body weight significantly lowers diabetes and heart disease risk.`,
    });
  }

  const activityLow =
    (data.activity || '').includes('Sedentary') ||
    (data.activity || '').includes('Light');
  if (activityLow) {
    recs.push({
      icon:  '🏃',
      title: 'Increase Physical Activity',
      text:  'Aim for 150 min/week of moderate cardio. Even daily 30-min walks reduce risk substantially.',
    });
  }

  if (parseInt(data.sleep, 10) <= 5) {
    recs.push({
      icon:  '😴',
      title: 'Improve Sleep Quality',
      text:  'Poor sleep disrupts insulin sensitivity and raises blood pressure. Target 7–9 hours nightly.',
    });
  }

  if (parseInt(data.stress, 10) >= 7) {
    recs.push({
      icon:  '🧘',
      title: 'Stress Management',
      text:  'Chronic stress raises cortisol, causing blood sugar spikes and hypertension. Try mindfulness or yoga.',
    });
  }

  if ((data.smoking || '').includes('Current')) {
    recs.push({
      icon:  '🚭',
      title: 'Quit Smoking',
      text:  'Smoking is the #1 preventable cause of heart disease. Seek nicotine-replacement therapy or cessation counselling.',
    });
  }

  const dietPoor =
    (data.diet || '').includes('Poor') ||
    (data.diet || '').includes('Average');
  if (dietPoor) {
    recs.push({
      icon:  '🥗',
      title: 'Improve Dietary Habits',
      text:  'Prioritise whole grains, vegetables, and lean proteins. Reduce processed foods, sugar, and saturated fat.',
    });
  }

  if (data.glucose >= 100) {
    recs.push({
      icon:  '🩸',
      title: 'Monitor Blood Sugar',
      text:  'Pre-diabetic range detected. Work with your doctor to prevent progression to full Type 2 diabetes.',
    });
  }

  if (data.bp === 'high1' || data.bp === 'high2') {
    recs.push({
      icon:  '❤️',
      title: 'Control Blood Pressure',
      text:  'Reduce sodium intake, exercise regularly, and consult your physician about medication options.',
    });
  }

  if (data.famDiabetes || data.famHeart) {
    recs.push({
      icon:  '🧬',
      title: 'Regular Screenings',
      text:  'With your family history, schedule annual blood panels including HbA1c, lipid profile, and BP checks.',
    });
  }

  // Always include a general advice card
  recs.push({
    icon:  '🩺',
    title: 'Annual Health Check',
    text:  'Visit your primary care physician yearly for comprehensive metabolic panels and preventive assessment.',
  });

  return recs.slice(0, 6);
}

/* ── Collect Form Data ──────────────────────── */
/**
 * Reads all form inputs and returns a structured data object.
 * @returns {Object}
 */
function collectFormData() {
  return {
    age:         parseInt(document.getElementById('age').value,    10) || 35,
    sex:         document.getElementById('sex').value,
    height:      parseFloat(document.getElementById('height').value) || 165,
    weight:      parseFloat(document.getElementById('weight').value) || 70,
    bp:          document.getElementById('bp').value,
    glucose:     parseFloat(document.getElementById('glucose').value) || 90,
    cholesterol: document.getElementById('cholesterol').value,
    sleep:       document.getElementById('sleep').value,
    stress:      parseInt(document.getElementById('stress').value, 10),
    activity:    document.querySelector('#activityGroup .active')?.textContent.trim() || '',
    diet:        document.querySelector('#dietGroup    .active')?.textContent.trim() || '',
    smoking:     document.querySelector('#smokingGroup .active')?.textContent.trim() || '',
    alcohol:     document.querySelector('#alcoholGroup .active')?.textContent.trim() || '',
    famDiabetes: document.getElementById('famDiabetes').checked,
    famHeart:    document.getElementById('famHeart').checked,
    famHypert:   document.getElementById('famHypert').checked,
    prevCond:    document.getElementById('prevCond').checked,
  };
}

/* ── Render Results ─────────────────────────── */
/**
 * Populates the result card with scores and recommendations.
 * @param {Object} data    - Raw form data
 * @param {Object} scores  - Computed risk scores
 */
function renderResults(data, scores) {
  const overall      = Math.round(scores.diabetes * 0.4 + scores.heart * 0.4 + scores.hypertension * 0.2);
  const overallLevel = getRiskLevel(overall);
  const overallLabel = getRiskLabel(overall);

  // Header
  document.getElementById('resultTitle').textContent =
    `Your Overall Risk Score: ${overall}%`;

  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  document.getElementById('resultSub').textContent =
    `BMI: ${scores.bmi} kg/m² · Analysed ${dateStr}`;

  const badge = document.getElementById('overallBadge');
  badge.textContent = `${overallLabel} Risk`;
  badge.className   = `risk-badge ${overallLevel}`;

  // ── Disease Meters ──────────────────────────
  const colorMap = { low: '#00d4aa', medium: '#f59e0b', high: '#ef4444' };

  const meters = [
    { label: 'Diabetes Risk',     score: scores.diabetes     },
    { label: 'Heart Disease Risk', score: scores.heart        },
    { label: 'Hypertension Risk',  score: scores.hypertension },
  ];

  document.getElementById('riskMeters').innerHTML = meters.map(m => {
    const lv  = getRiskLevel(m.score);
    const lbl = getRiskLabel(m.score);
    return `
      <div class="meter-card">
        <div class="meter-label">${m.label}</div>
        ${buildCircle(m.score, lv)}
        <div class="meter-risk" style="color:${colorMap[lv]}">${lbl} Risk</div>
      </div>`;
  }).join('');

  // ── Recommendations ─────────────────────────
  const recs = getRecommendations(data, scores);
  document.getElementById('recsGrid').innerHTML = recs.map(r => `
    <div class="rec-item">
      <div class="rec-icon">${r.icon}</div>
      <div class="rec-text">
        <strong>${r.title}</strong>
        <span>${r.text}</span>
      </div>
    </div>`).join('');
}

/* ── Run Prediction ─────────────────────────── */
/**
 * Main entry point triggered by the Analyse button.
 * Shows a loading overlay, computes risk, then renders results.
 */
function runPrediction() {
  const data    = collectFormData();
  const overlay = document.getElementById('loadingOverlay');

  overlay.classList.add('active');

  // Simulate async model inference delay (2 s)
  setTimeout(() => {
    const scores = computeRisk(data);
    renderResults(data, scores);

    overlay.classList.remove('active');
    document.getElementById('formCard').style.display   = 'none';
    document.getElementById('resultCard').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 2000);
}

/* ── Reset Form ─────────────────────────────── */
/**
 * Hides the result card and shows the form again.
 */
function resetForm() {
  document.getElementById('resultCard').style.display = 'none';
  document.getElementById('formCard').style.display   = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
