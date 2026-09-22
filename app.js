const state = {
  snapshot: null,
};

const SYNTHETIC_TEN_MINUTE_RAIN_MM = [
  0.0, 0.2, 1.0, 3.0, 6.0, 2.5, 0.5, 0.0, 1.8, 4.2, 0.7, 0.0,
];

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
  routeForm: document.querySelector("#route-form"),
  routeStartLatitude: document.querySelector("#route-start-latitude"),
  routeStartLongitude: document.querySelector("#route-start-longitude"),
  routeEndLatitude: document.querySelector("#route-end-latitude"),
  routeEndLongitude: document.querySelector("#route-end-longitude"),
  routeDuration: document.querySelector("#route-duration"),
  routeError: document.querySelector("#route-error"),
  routeResult: document.querySelector("#route-result"),
  routeSummary: document.querySelector("#route-summary"),
  routeExposureSummary: document.querySelector("#route-exposure-summary"),
  routeTableBody: document.querySelector("#route-table-body"),
};

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runQuery();
});

elements.routeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runRouteQuery();
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
  const samples = state.snapshot.samples ?? [];
  const firstSample = samples[0];
  const secondSample = samples[1];

  if (firstSample) {
    elements.latitude.value = firstSample.wgs84.latitude.toFixed(6);
    elements.longitude.value = firstSample.wgs84.longitude.toFixed(6);
    elements.routeStartLatitude.value = firstSample.wgs84.latitude.toFixed(6);
    elements.routeStartLongitude.value = firstSample.wgs84.longitude.toFixed(6);
  } else {
    elements.latitude.value = "25.033968";
    elements.longitude.value = "121.564468";
    elements.routeStartLatitude.value = "25.033968";
    elements.routeStartLongitude.value = "121.564468";
  }

  if (secondSample) {
    elements.routeEndLatitude.value = secondSample.wgs84.latitude.toFixed(6);
    elements.routeEndLongitude.value = secondSample.wgs84.longitude.toFixed(6);
  } else {
    elements.routeEndLatitude.value = "25.047924";
    elements.routeEndLongitude.value = "121.517081";
  }
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

  try {
    const result = lookupCoordinate({ latitude, longitude });

    elements.inputCoordinate.textContent = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    elements.convertedCoordinate.textContent =
      `瀏覽器近似 TWD67：${result.twd67.latitude.toFixed(6)}, ${result.twd67.longitude.toFixed(6)}`;
    elements.gridCoordinate.textContent =
      `${result.gridLatitude.toFixed(6)}, ${result.gridLongitude.toFixed(6)}`;
    elements.gridIndex.textContent =
      `x=${result.x}, y=${result.y}, index=${result.index}`;

    if (result.rainfall === state.snapshot.no_data_value) {
      elements.rainfallValue.textContent = "無有效值";
      elements.rainfallStatus.textContent = "-99：只代表 no-data，不代表 0 mm 或不下雨。";
    } else {
      elements.rainfallValue.textContent = `${Number(result.rainfall).toFixed(1)} mm`;
      elements.rainfallStatus.textContent = "CWA 未來 1 小時雷達定量降雨預報";
    }
  } catch (error) {
    showError(error.message);
  }
}

function runRouteQuery() {
  if (!state.snapshot) {
    return;
  }

  elements.routeError.hidden = true;
  elements.routeError.textContent = "";
  elements.routeResult.hidden = true;

  const startCoordinate = {
    latitude: Number(elements.routeStartLatitude.value),
    longitude: Number(elements.routeStartLongitude.value),
  };
  const endCoordinate = {
    latitude: Number(elements.routeEndLatitude.value),
    longitude: Number(elements.routeEndLongitude.value),
  };
  const durationMinutes = Number(elements.routeDuration.value);

  if (
    !Number.isFinite(startCoordinate.latitude)
    || !Number.isFinite(startCoordinate.longitude)
    || !Number.isFinite(endCoordinate.latitude)
    || !Number.isFinite(endCoordinate.longitude)
  ) {
    showRouteError("請輸入有效的起點與終點座標。");
    return;
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    showRouteError("假設總時間必須大於 0 分鐘。");
    return;
  }

  const pointCount = 5;
  const departureTime = new Date();
  const rows = [];

  try {
    for (let index = 0; index < pointCount; index += 1) {
      const ratio = index / (pointCount - 1);
      const coordinate = {
        latitude:
          startCoordinate.latitude
          + (endCoordinate.latitude - startCoordinate.latitude) * ratio,
        longitude:
          startCoordinate.longitude
          + (endCoordinate.longitude - startCoordinate.longitude) * ratio,
      };
      const elapsedMinutes = durationMinutes * ratio;
      const expectedPassTime = new Date(
        departureTime.getTime() + elapsedMinutes * 60 * 1000,
      );
      const lookup = lookupCoordinate(coordinate);

      const syntheticBucket = syntheticTenMinuteBucket(elapsedMinutes);

      rows.push({
        index: index + 1,
        coordinate,
        elapsedMinutes,
        expectedPassTime,
        syntheticBucket,
        rainfall: lookup.rainfall,
      });
    }
  } catch (error) {
    showRouteError(error.message);
    return;
  }

  elements.routeTableBody.replaceChildren();

  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.className = row.syntheticBucket.rainfallMm > 0 ? "route-row-rain" : "route-row-dry";
    const values = [
      String(row.index),
      `+${row.elapsedMinutes.toFixed(0)} 分 · ${formatTime(row.expectedPassTime)}`,
      `${row.coordinate.latitude.toFixed(6)}, ${row.coordinate.longitude.toFixed(6)}`,
      row.syntheticBucket.label,
      `${row.syntheticBucket.rainfallMm.toFixed(1)} mm（假）`,
      formatRainfall(row.rainfall),
    ];

    for (const value of values) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }

    elements.routeTableBody.append(tr);
  }

  elements.routeSummary.textContent =
    `假設現在出發、總時間 ${durationMinutes.toFixed(0)} 分鐘；用 5 個等距點驗證「預計經過時間 → 10 分鐘時間桶」。`;
  elements.routeExposureSummary.textContent = summarizeSyntheticExposure(rows);
  elements.routeResult.hidden = false;
}

function summarizeSyntheticExposure(rows) {
  const runs = [];
  let startIndex = null;

  for (let index = 0; index <= rows.length; index += 1) {
    const hasRain =
      index < rows.length && rows[index].syntheticBucket.rainfallMm > 0;

    if (hasRain && startIndex === null) {
      startIndex = index;
    } else if (!hasRain && startIndex !== null) {
      const endIndex = index - 1;
      const start = rows[startIndex];
      const end = rows[endIndex];
      runs.push({
        startPoint: start.index,
        endPoint: end.index,
        startMinutes: start.elapsedMinutes,
        endMinutes: end.elapsedMinutes,
      });
      startIndex = null;
    }
  }

  if (runs.length === 0) {
    return "假資料判斷：目前 5 個採樣點都沒有正雨量。";
  }

  const descriptions = runs.map((run) => {
    const points =
      run.startPoint === run.endPoint
        ? `第 ${run.startPoint} 個採樣點`
        : `第 ${run.startPoint}～${run.endPoint} 個採樣點`;
    return `${points}（約 +${run.startMinutes.toFixed(0)}～+${run.endMinutes.toFixed(0)} 分）`;
  });

  return `假資料判斷：${descriptions.join("、")}的對應時間桶有雨量 > 0。`;
}

function syntheticTenMinuteBucket(elapsedMinutes) {
  const bucketIndex = Math.floor(elapsedMinutes / 10);
  const rainfallMm = SYNTHETIC_TEN_MINUTE_RAIN_MM[bucketIndex];

  if (rainfallMm === undefined) {
    throw new Error("假 10 分鐘資料只準備到 120 分鐘內，請縮短假設總時間。");
  }

  const startMinute = bucketIndex * 10;
  const endMinute = startMinute + 10;
  return {
    rainfallMm,
    label: `+${startMinute}–${endMinute} 分`,
  };
}

function lookupCoordinate(coordinate) {
  const bounds = state.snapshot.wgs84_supported_bounds;

  if (!contains(bounds, coordinate)) {
    throw new Error(
      `目前座標轉換只驗證台灣本島範圍：lat ${bounds.south}–${bounds.north}, lon ${bounds.west}–${bounds.east}。`,
    );
  }

  const twd67 = applyBrowserTransform(coordinate, state.snapshot.browser_transform);
  const grid = state.snapshot.grid;
  const x = Math.floor(
    (twd67.longitude - grid.start_twd67.longitude) / grid.resolution_degrees + 0.5,
  );
  const y = Math.floor(
    (twd67.latitude - grid.start_twd67.latitude) / grid.resolution_degrees + 0.5,
  );

  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) {
    throw new Error("轉換後位置落在目前 QPESUMS 格點範圍外。");
  }

  const index = y * grid.width + x;
  return {
    twd67,
    x,
    y,
    index,
    rainfall: grid.values_mm[index],
    gridLatitude: grid.start_twd67.latitude + y * grid.resolution_degrees,
    gridLongitude: grid.start_twd67.longitude + x * grid.resolution_degrees,
  };
}

function formatRainfall(value) {
  if (value === state.snapshot.no_data_value) {
    return "無有效值";
  }
  return `${Number(value).toFixed(1)} mm`;
}

function formatTime(date) {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei",
  }).format(date);
}

function showRouteError(message) {
  elements.routeError.hidden = false;
  elements.routeError.textContent = message;
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
