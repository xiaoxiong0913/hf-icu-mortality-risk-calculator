let config = null;

function inputValue(feature) {
  const el = document.querySelector(`[name="${CSS.escape(feature.key)}"]`);
  return el ? el.value : feature.default;
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
    }
    input.name = feature.key;
    wrapper.appendChild(input);
    root.appendChild(wrapper);
  });
}

async function calculateRisk(event) {
  event.preventDefault();
  const payload = {};
  config.features.forEach((feature) => {
    payload[feature.key] = inputValue(feature);
  });
  const response = await fetch("/api/predict", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  document.getElementById("risk-value").textContent = `${result.risk_percent}%`;
  document.getElementById("risk-group").textContent = result.risk_group;
  document.getElementById("threshold-note").textContent = `Risk group uses the internal-validation Youden cutoff ${result.threshold}.`;
}

function resetDefaults() {
  config.features.forEach((feature) => {
    const el = document.querySelector(`[name="${CSS.escape(feature.key)}"]`);
    if (el) el.value = feature.default;
  });
}

async function init() {
  config = await fetch("/api/config").then((r) => r.json());
  renderInputs();
  document.getElementById("risk-form").addEventListener("submit", calculateRisk);
  document.getElementById("reset").addEventListener("click", resetDefaults);
}

init();
