const state = {
  snapshot: null,
};

const elements = {
  status: document.querySelector("#data-status"),
  form: document.querySelector("#query-form"),
  latitude: document.querySelector("#latitude"),
  longitude: document.querySelector("#longitude"),
  currentLocationButton: document.querySelector("#current-location-button"),
  reloadDataButton: document.querySelector("#reload-data-button"),
  validationInstruction: document.querySelector("#validation-instruction"),
  validationDataStatus: document.querySelector("#validation-data-status"),
  validationQuerySource: document.querySelector("#validation-query-source"),
  validationWindow: document.querySelector("#validation-window"),
  validationRainfall: document.querySelector("#validation-rainfall"),
  error: document.querySelector("#form-error"),
  exampRainfallValue: document.querySelector("#examp-rainfall-value"),
  exampRainfallStatus: document.querySelector("#examp-rainfall-status"),
  exampReferenceTime: document.querySelector("#examp-reference-time"),
  exampGridSummary: document.querySelector("#examp-grid-summary"),
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
  debugExampDataset: document.querySelector("#debug-examp-dataset"),
  debugExampGrid: document.querySelector("#debug-examp-grid"),
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
  runQuery("manual");
});

elements.routeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runRouteQuery();
});

elements.currentLocationButton.addEventListener("click", useCurrentLocation);
elements.reloadDataButton.addEventListener("click", () => {
  window.location.reload();
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
    if (!state.snapshot.examp) {
      throw new Error("ExAMP snapshot is missing");
    }
    setStatus("ready", "CWA + ExAMP 資料已載入");
    populateMetadata();
    updateSnapshotFreshnessGuide();
    populateSamples();
    populateInitialCoordinate();
    runQuery("initial");
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
  elements.exampReferenceTime.textContent = formatDateTime(snapshot.examp.reference_time);
  elements.exampGridSummary.textContent =
    `${snapshot.examp.grid.width} × ${snapshot.examp.grid.height}, `
    + `${snapshot.examp.grid.resolution_degrees}°, ${snapshot.examp.unit}`;
  elements.debugDataset.textContent = snapshot.dataset_id;
  elements.debugGrid.textContent =
    `${grid.width} × ${grid.height}, ${grid.resolution_degrees}°, ${snapshot.unit}`;
  elements.debugGenerated.textContent = formatDateTime(snapshot.generated_at);
  elements.debugTransform.textContent =
    `靜態頁近似轉換；驗證最大誤差 ${snapshot.browser_transform.max_validation_error_m.toFixed(3)} m。核心 Python 仍使用 pyproj。`;
  elements.debugExampDataset.textContent = snapshot.examp.dataset_id;
  elements.debugExampGrid.textContent =
    `${snapshot.examp.grid.width} × ${snapshot.examp.grid.height}, `
    + `${snapshot.examp.grid.resolution_degrees}°；公開頁只含台灣本島驗證範圍。`;
  elements.attribution.textContent =
    `${snapshot.attribution}；ExAMP 資料來源：國家災害防救科技中心（NCDR）`;
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
      runQuery("sample");
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

function runQuery(source = "manual") {
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
    const coordinate = { latitude, longitude };
    const result = lookupCoordinate(coordinate);
    const exampResult = lookupExampCoordinate(coordinate, new Date());

    elements.exampRainfallValue.textContent = formatExampRainfall(exampResult.rainfall);
    elements.exampRainfallStatus.textContent =
      `${exampResult.field}（資料起始 +${exampResult.startMinute}–+${exampResult.endMinute} 分）`;
    updateValidationQueryGuide(exampResult, source);

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
    updateValidationErrorGuide(error.message, source);
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

      const exampLookup = lookupExampCoordinate(coordinate, expectedPassTime);

      rows.push({
        index: index + 1,
        coordinate,
        elapsedMinutes,
        expectedPassTime,
        exampLookup,
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
    tr.className =
      row.exampLookup.rainfall !== null && row.exampLookup.rainfall > 0
        ? "route-row-rain"
        : "route-row-dry";
    const values = [
      String(row.index),
      `+${row.elapsedMinutes.toFixed(0)} 分 · ${formatTime(row.expectedPassTime)}`,
      `${row.coordinate.latitude.toFixed(6)}, ${row.coordinate.longitude.toFixed(6)}`,
      `${row.exampLookup.field} · +${row.exampLookup.startMinute}–+${row.exampLookup.endMinute} 分`,
      formatExampRainfall(row.exampLookup.rainfall),
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
    `假設現在出發、總時間 ${durationMinutes.toFixed(0)} 分鐘；用 5 個等距點驗證「位置 + 預計經過時間 → 真實 ExAMP 時段雨量」。`;
  elements.routeExposureSummary.textContent = summarizeExampExposure(rows);
  elements.routeResult.hidden = false;
}

function summarizeExampExposure(rows) {
  const rainyRows = rows.filter(
    (row) => row.exampLookup.rainfall !== null && row.exampLookup.rainfall > 0,
  );
  const unknownRows = rows.filter((row) => row.exampLookup.rainfall === null);

  if (rainyRows.length === 0 && unknownRows.length === 0) {
    return "ExAMP 判斷：目前 5 個採樣點的對應時段都是 0 mm。";
  }

  const parts = [];
  if (rainyRows.length > 0) {
    parts.push(
      `有雨量 > 0：第 ${rainyRows.map((row) => row.index).join("、")} 點`,
    );
  }
  if (unknownRows.length > 0) {
    parts.push(
      `無有效值：第 ${unknownRows.map((row) => row.index).join("、")} 點`,
    );
  }
  return `ExAMP 判斷：${parts.join("；")}。只描述這 5 個採樣點。`;
}

function useCurrentLocation() {
  hideError();

  if (!navigator.geolocation) {
    showError("這個瀏覽器不支援定位功能。");
    return;
  }

  elements.currentLocationButton.disabled = true;
  elements.currentLocationButton.textContent = "取得位置中…";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      elements.latitude.value = latitude.toFixed(6);
      elements.longitude.value = longitude.toFixed(6);
      elements.routeStartLatitude.value = latitude.toFixed(6);
      elements.routeStartLongitude.value = longitude.toFixed(6);

      elements.currentLocationButton.disabled = false;
      elements.currentLocationButton.textContent = "使用目前位置";
      runQuery("current");
    },
    (error) => {
      console.error(error);
      elements.currentLocationButton.disabled = false;
      elements.currentLocationButton.textContent = "使用目前位置";
      showError("無法取得目前位置；請確認瀏覽器定位權限，或手動輸入座標。");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    },
  );
}

function updateSnapshotFreshnessGuide() {
  const referenceTime = new Date(state.snapshot.examp.reference_time);
  const ageMinutes = (Date.now() - referenceTime.getTime()) / 60000;

  if (!Number.isFinite(ageMinutes)) {
    elements.validationDataStatus.textContent = "❌ 無法解析 ExAMP 資料時間";
    return;
  }

  if (ageMinutes < -5) {
    elements.validationDataStatus.textContent = "⚠️ ExAMP 資料時間晚於目前時間";
  } else if (ageMinutes <= 30) {
    elements.validationDataStatus.textContent =
      `✅ 可用：ExAMP 約 ${Math.max(0, ageMinutes).toFixed(0)} 分鐘前`;
  } else if (ageMinutes < 120) {
    elements.validationDataStatus.textContent =
      `⚠️ 偏舊：ExAMP 約 ${ageMinutes.toFixed(0)} 分鐘前`;
  } else {
    elements.validationDataStatus.textContent =
      `❌ 已過期：ExAMP 約 ${ageMinutes.toFixed(0)} 分鐘前；重新載入仍可能是舊快照，代表後端尚未更新`;
  }
}

function updateValidationQueryGuide(exampResult, source) {
  const sourceLabels = {
    current: "✅ 目前位置",
    manual: "手動輸入座標",
    sample: "範例位置",
    initial: "預設範例位置",
  };
  elements.validationQuerySource.textContent = sourceLabels[source] ?? source;

  const referenceTime = new Date(state.snapshot.examp.reference_time);
  const windowStart = new Date(
    referenceTime.getTime() + exampResult.startMinute * 60 * 1000,
  );
  const windowEnd = new Date(
    referenceTime.getTime() + exampResult.endMinute * 60 * 1000,
  );

  elements.validationWindow.textContent =
    `${formatTime(windowStart)}–${formatTime(windowEnd)}`;
  elements.validationRainfall.textContent = formatExampRainfall(exampResult.rainfall);

  if (source !== "current") {
    elements.validationInstruction.textContent =
      "這次不是用目前位置查詢。定點實測請先按「使用目前位置」。";
    return;
  }

  if (exampResult.rainfall === null || exampResult.rainfall === undefined) {
    elements.validationInstruction.textContent =
      `請在 ${formatTime(windowStart)}–${formatTime(windowEnd)} 觀察現場；這一筆 ExAMP 無有效值，不拿來判斷有雨或沒雨。`;
    return;
  }

  elements.validationInstruction.textContent =
    `請在 ${formatTime(windowStart)}–${formatTime(windowEnd)} 觀察是否真的有雨正在落下。只有地面濕、但沒看到雨，先記「不確定」。`;
}

function updateValidationErrorGuide(message, source) {
  const sourceLabels = {
    current: "✅ 目前位置",
    manual: "手動輸入座標",
    sample: "範例位置",
    initial: "預設範例位置",
  };
  elements.validationQuerySource.textContent = sourceLabels[source] ?? source;
  elements.validationWindow.textContent = "—";
  elements.validationRainfall.textContent = "—";
  elements.validationInstruction.textContent = message;
  updateSnapshotFreshnessGuide();
}

function lookupExampCoordinate(coordinate, validAt) {
  const bounds = state.snapshot.wgs84_supported_bounds;
  if (!contains(bounds, coordinate)) {
    throw new Error(
      `ExAMP 公開驗證範圍目前只涵蓋台灣本島：lat ${bounds.south}–${bounds.north}, lon ${bounds.west}–${bounds.east}。`,
    );
  }

  const examp = state.snapshot.examp;
  const grid = examp.grid;
  const x = Math.floor(
    (coordinate.longitude - grid.start_wgs84_assumed.longitude)
      / grid.resolution_degrees
      + 0.5
      + 1e-9,
  );
  const y = Math.floor(
    (coordinate.latitude - grid.start_wgs84_assumed.latitude)
      / grid.resolution_degrees
      + 0.5
      + 1e-9,
  );

  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) {
    throw new Error("位置落在目前公開的 ExAMP 驗證格網範圍外。");
  }

  const bucket = exampBucketForValidTime(validAt);
  const values = grid.values_mm_by_field[bucket.field];
  const index = y * grid.width + x;

  return {
    ...bucket,
    rainfall: values[index],
    x,
    y,
    index,
    gridLatitude: grid.start_wgs84_assumed.latitude + y * grid.resolution_degrees,
    gridLongitude: grid.start_wgs84_assumed.longitude + x * grid.resolution_degrees,
  };
}

function exampBucketForValidTime(validAt) {
  const examp = state.snapshot.examp;
  const referenceTime = new Date(examp.reference_time);
  const elapsedMinutes = (validAt.getTime() - referenceTime.getTime()) / 60000;

  if (!Number.isFinite(elapsedMinutes)) {
    throw new Error("ExAMP 資料時間格式無法解析。");
  }
  if (elapsedMinutes < 0) {
    throw new Error("目前查詢時間早於 ExAMP 資料起始時間。");
  }
  if (elapsedMinutes >= 120) {
    throw new Error("ExAMP 快照已超過 120 分鐘預報範圍，請等待資料更新。");
  }

  const bucketIndex = Math.floor(elapsedMinutes / 10);
  const field = examp.forecast_fields[bucketIndex];
  if (!field) {
    throw new Error("找不到對應的 ExAMP 10 分鐘欄位。");
  }

  return {
    field,
    startMinute: bucketIndex * 10,
    endMinute: bucketIndex * 10 + 10,
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

function formatExampRainfall(value) {
  if (value === null || value === undefined) {
    return "無有效值";
  }
  return `${Number(value).toFixed(2)} mm`;
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
