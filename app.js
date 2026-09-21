const state = {
  snapshot: null,
};

const elements = {
  status: document.querySelector("#data-status"),
  form: document.querySelector("#query-form"),
  latitude: document.querySelector("#latitude"),
  longitude: document.querySelector("#longitude"),
  error: document.querySelector("#form-error"),
  sampleArea: document.querySelector("#sample-area"),
  sampleButtons: document.querySelector("#sample-buttons"),
  rainfallValue: document.querySelector("#rainfall-value"),
  rainfallStatus: document.querySelector("#rainfall-status"),
  referenceTime: document.querySelector("#reference-time"),
  snapshotAge: document.querySelector("#snapshot-age"),
  gridCoordinate: document.querySelector("#grid-coordinate"),
  gridIndex: document.querySelector("#grid-index"),
  inputCoordinate: document.querySelector("#input-coordinate"),
  convertedCoordinate: document.querySelector("#converted-coordinate"),
  debugDataset: document.querySelector("#debug-dataset"),
  debugGrid: document.querySelector("#debug-grid"),
  debugGenerated: document.querySelector("#debug-generated"),
  debugTransform: document.querySelector("#debug-transform"),
  attribution: document.querySelector("#attribution"),
};

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runQuery();
});

loadSnapshot();

async function loadSnapshot() {
  setStatus("loading", "載入資料中…");

  try {
    const response = await fetch("./data/latest.json", {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    state.snapshot = await response.json();
    setStatus("ready", "最新資料已載入");
    populateMetadata();
    populateSamples();
    populateInitialCoordinate();
    runQuery();
  } catch (error) {
    console.error(error);
    setStatus("error", "資料載入失敗");
    showError("latest.json 尚未產生或無法載入。請查看 GitHub Actions 部署狀態。");
  }
}

function populateMetadata() {
  const { snapshot } = state;
  const grid = snapshot.grid;

  elements.referenceTime.textContent = formatDateTime(snapshot.reference_time);
  elements.snapshotAge.textContent = `頁面資料產生：${formatDateTime(snapshot.generated_at)}`;
  elements.debugDataset.textContent = snapshot.dataset_id;
  elements.debugGrid.textContent =
    `${grid.width} × ${grid.height}, ${grid.resolution_degrees}°, ${snapshot.unit}`;
  elements.debugGenerated.textContent = formatDateTime(snapshot.generated_at);
  elements.debugTransform.textContent =
    `靜態頁近似轉換；驗證最大誤差 ${snapshot.browser_transform.max_validation_error_m.toFixed(3)} m。核心 Python 仍使用 pyproj。`;
  elements.attribution.textContent = snapshot.attribution;
}

function populateSamples() {
  const samples = state.snapshot.samples ?? [];
  elements.sampleButtons.replaceChildren();

  if (samples.length === 0) {
    elements.sampleArea.hidden = true;
    return;
  }

  for (const sample of samples) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${sample.station_name} · ${sample.forecast_mm.toFixed(1)} mm`;
    button.addEventListener("click", () => {
      elements.latitude.value = sample.wgs84.latitude.toFixed(6);
      elements.longitude.value = sample.wgs84.longitude.toFixed(6);
      runQuery();
    });
    elements.sampleButtons.append(button);
  }

  elements.sampleArea.hidden = false;
}

function populateInitialCoordinate() {
  const firstSample = state.snapshot.samples?.[0];
  if (firstSample) {
    elements.latitude.value = firstSample.wgs84.latitude.toFixed(6);
    elements.longitude.value = firstSample.wgs84.longitude.toFixed(6);
    return;
  }

  elements.latitude.value = "25.033968";
  elements.longitude.value = "121.564468";
}

function runQuery() {
  if (!state.snapshot) {
    return;
  }

  hideError();

  const latitude = Number(elements.latitude.value);
  const longitude = Number(elements.longitude.value);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    showError("請輸入有效的 latitude / longitude。");
    return;
  }

  const input = { latitude, longitude };
  const bounds = state.snapshot.wgs84_supported_bounds;

  if (!contains(bounds, input)) {
    showError(
      `目前 Phase 1 座標轉換只驗證台灣本島範圍：lat ${bounds.south}–${bounds.north}, lon ${bounds.west}–${bounds.east}。`,
    );
    return;
  }

  const twd67 = applyBrowserTransform(input, state.snapshot.browser_transform);
  const grid = state.snapshot.grid;
  const x = Math.floor((twd67.longitude - grid.start_twd67.longitude) / grid.resolution_degrees + 0.5);
  const y = Math.floor((twd67.latitude - grid.start_twd67.latitude) / grid.resolution_degrees + 0.5);

  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) {
    showError("轉換後位置落在目前 QPESUMS 格點範圍外。");
    return;
  }

  const index = y * grid.width + x;
  const rainfall = grid.values_mm[index];
  const gridLatitude = grid.start_twd67.latitude + y * grid.resolution_degrees;
  const gridLongitude = grid.start_twd67.longitude + x * grid.resolution_degrees;

  elements.inputCoordinate.textContent = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  elements.convertedCoordinate.textContent =
    `瀏覽器近似 TWD67：${twd67.latitude.toFixed(6)}, ${twd67.longitude.toFixed(6)}`;
  elements.gridCoordinate.textContent =
    `${gridLatitude.toFixed(6)}, ${gridLongitude.toFixed(6)}`;
  elements.gridIndex.textContent = `x=${x}, y=${y}, index=${index}`;

  if (rainfall === state.snapshot.no_data_value) {
    elements.rainfallValue.textContent = "無有效值";
    elements.rainfallStatus.textContent = "-99：只代表 no-data，不代表 0 mm 或不下雨。";
  } else {
    elements.rainfallValue.textContent = `${Number(rainfall).toFixed(1)} mm`;
    elements.rainfallStatus.textContent = "CWA 未來 1 小時雷達定量降雨預報";
  }

}

function applyBrowserTransform(coordinate, transform) {
  return {
    latitude: applyAffine(transform.latitude_coefficients, coordinate),
    longitude: applyAffine(transform.longitude_coefficients, coordinate),
  };
}

function applyAffine(coefficients, coordinate) {
  const [constant, latitudeFactor, longitudeFactor] = coefficients;
  return (
    constant
    + latitudeFactor * coordinate.latitude
    + longitudeFactor * coordinate.longitude
  );
}

function contains(bounds, coordinate) {
  return (
    coordinate.longitude >= bounds.west
    && coordinate.longitude <= bounds.east
    && coordinate.latitude >= bounds.south
    && coordinate.latitude <= bounds.north
  );
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Taipei",
  }).format(date);
}

function setStatus(kind, text) {
  elements.status.className = `status-pill status-${kind}`;
  elements.status.textContent = text;
}

function showError(message) {
  elements.error.hidden = false;
  elements.error.textContent = message;
}

function hideError() {
  elements.error.hidden = true;
  elements.error.textContent = "";
}
