let config = null;
const DEFAULT_SUBMIT_LABEL = "Calculate risk";

function fieldElement(feature) {
  return document.querySelector(`[name="${CSS.escape(feature.key)}"]`);
}

function inputValue(feature) {
  const el = fieldElement(feature);
  return el ? el.value : feature.default;
}

function setStatus(message, kind = "info") {
  const el = document.getElementById("form-status");
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    el.dataset.kind = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.dataset.kind = kind;
}

function clearFieldErrors() {
  if (!config) return;
  config.features.forEach((feature) => {
    const el = fieldElement(feature);
    if (el) el.setCustomValidity("");
  });
}

function normalizeValue(feature, rawValue) {
  const text = String(rawValue ?? "").trim();
  if (feature.type === "select") {
    return Number(text);
  }
  if (!text) {
    throw new Error(`${feature.label} is required.`);
  }
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${feature.label} must be numeric.`);
  }
  if (feature.integer_only && !Number.isInteger(numeric)) {
    throw new Error(`${feature.label} must use a whole number.`);
  }
  const precision = Number(feature.precision ?? 2);
  return Number.isFinite(precision) ? Number(numeric.toFixed(precision)) : numeric;
}

function showFieldError(message) {
  const feature = config.features.find((item) => message.startsWith(item.label));
  if (!feature) return;
  const el = fieldElement(feature);
  if (!el) return;
  el.setCustomValidity(message);
  el.reportValidity();
  el.focus();
}

function renderInputs() {
  const root = document.getElementById("inputs");
  root.innerHTML = "";
  config.features.forEach((feature) => {
    const wrapper = document.createElement("label");
    const unit = feature.unit ? ` <span class="unit">(${feature.unit})</span>` : "";
    wrapper.innerHTML = `${feature.label}${unit}`;
    let input;
    if (feature.type === "select") {
      input = document.createElement("select");
      feature.options.forEach((option) => {
        const opt = document.createElement("option");
        opt.value = option.value;
        opt.textContent = option.label;
        if (Number(option.value) === Number(feature.default)) opt.selected = true;
        input.appendChild(opt);
      });
    } else {
      input = document.createElement("input");
      input.type = "number";
      input.step = feature.step;
      input.value = feature.default;
      input.required = true;
      input.inputMode = feature.integer_only ? "numeric" : "decimal";
    }
    input.name = feature.key;
    input.addEventListener("input", () => {
      input.setCustomValidity("");
      setStatus("");
    });
    wrapper.appendChild(input);
    root.appendChild(wrapper);
  });
}

async function calculateRisk(event) {
  event.preventDefault();
  clearFieldErrors();
  const submitButton = document.getElementById("calculate-button");
  const payload = {};
  try {
    config.features.forEach((feature) => {
      payload[feature.key] = normalizeValue(feature, inputValue(feature));
    });
    submitButton.disabled = true;
    submitButton.textContent = "Calculating...";
    setStatus("Calculating risk...", "info");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 45000);
    const response = await fetch("/api/predict", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    window.clearTimeout(timeoutId);
    const rawText = await response.text();
    const result = rawText ? JSON.parse(rawText) : {};
    if (!response.ok) {
      throw new Error(result.error || "Risk calculation failed.");
    }
    document.getElementById("risk-value").textContent = `${result.risk_percent}%`;
    document.getElementById("risk-group").textContent = result.risk_group;
    document.getElementById("threshold-note").textContent = `Risk group uses the internal-validation Youden cutoff ${result.threshold}.`;
    setStatus(`Risk updated with the ${result.model} model.`, "success");
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("The request timed out. Please try again in a few seconds.", "error");
    } else {
      const message = error.message || "Risk calculation failed.";
      showFieldError(message);
      setStatus(message, "error");
    }
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = DEFAULT_SUBMIT_LABEL;
  }
}

function resetDefaults() {
  config.features.forEach((feature) => {
    const el = fieldElement(feature);
    if (el) el.value = feature.default;
  });
  clearFieldErrors();
  document.getElementById("risk-value").textContent = "--";
  document.getElementById("risk-group").textContent = "Awaiting input";
  document.getElementById("threshold-note").textContent = "Risk group uses the internal-validation Youden cutoff.";
  setStatus("Defaults restored.", "info");
}

async function init() {
  try {
    config = await fetch("/api/config").then((r) => r.json());
    renderInputs();
    document.getElementById("risk-form").addEventListener("submit", calculateRisk);
    document.getElementById("reset").addEventListener("click", resetDefaults);
  } catch (error) {
    setStatus("Calculator configuration could not be loaded.", "error");
  }
}

init();
