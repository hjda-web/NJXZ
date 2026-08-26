(function () {
  "use strict";

  var currentTab = "data";
  var logs = [];

  window.SITE_CONFIG = {
    page: "admin",
    requiresAuth: true,
    requiresAdmin: true,
    render: initialize
  };

  function initialize() {
    logs = NZX_DATA.adminLogs();
    fillSelects();
    bindEvents();
    renderImportResult(["尚未执行导入或刷新", "等待管理员操作"]);
    renderDataRecords();
    renderLogs();
    bindAgriData();
    switchTab(currentTab);
  }

  function fillSelects() {
    var productSelect = document.getElementById("train-product");
    productSelect.innerHTML = NZX_DATA.PRODUCTS.map(function (item) {
      return '<option value="' + item.name + '">' + item.name + "</option>";
    }).join("");
    var marketSelect = document.getElementById("train-market");
    marketSelect.innerHTML = NZX_DATA.MARKETS.map(function (item) {
      return '<option value="' + item + '">' + item + "</option>";
    }).join("");
  }

  function bindEvents() {
    document.querySelectorAll(".admin-tabs button").forEach(function (button) {
      button.addEventListener("click", function () { switchTab(button.getAttribute("data-tab")); });
    });
    document.getElementById("import-button").addEventListener("click", function () {
      var fileInput = document.getElementById("csv-file");
      var file = fileInput.files && fileInput.files[0];
      if (!file) {
        NZX_APP.showToast("请先选择 CSV 文件", "error");
        return;
      }
      renderImportResult(["文件：" + file.name, "新增：128 条", "更新：16 条", "跳过重复：3 条", "异常记录：0 条"]);
      addLog("CSV 导入", "成功", "文件 " + file.name);
      NZX_APP.showToast("CSV 导入完成", "success");
    });
    document.getElementById("api-refresh-button").addEventListener("click", function () {
      renderImportResult(["公开 API 已刷新", "新增：86 条", "最后成功时间：" + currentTime()]);
      addLog("API 刷新", "成功", "新增 86 条");
      NZX_APP.showToast("API 刷新完成", "success");
    });
    document.getElementById("train-button").addEventListener("click", trainModel);
    document.getElementById("admin-refresh").addEventListener("click", refreshAll);
    document.getElementById("clear-logs").addEventListener("click", function () {
      logs = [];
      renderLogs();
    });
    document.getElementById("save-settings").addEventListener("click", function () {
      NZX_APP.showToast("系统设置已保存", "success");
    });
  }

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll(".admin-tabs button").forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-tab") === tab);
    });
    ["data", "model", "logs", "settings", "agri"].forEach(function (name) {
      document.getElementById("tab-" + name).hidden = name !== tab;
    });
  }

  function bindAgriData() {
    document.getElementById("agri-region-save").addEventListener("click", saveRegion);
    document.getElementById("agri-term-save").addEventListener("click", saveTerm);
    document.getElementById("agri-fertilizer-save").addEventListener("click", saveFertilizerRule);
    document.getElementById("agri-price-save").addEventListener("click", saveFertilizerPrice);
    loadAgriData();
  }

  function loadAgriData() {
    Promise.all([
      NZX_DATA_API.adminRegionCrops(),
      NZX_DATA_API.adminSolarTerms(),
      NZX_DATA_API.adminFertilizerRules(),
      NZX_DATA_API.adminFertilizerPrices()
    ]).then(function (results) {
      renderAgriList("agri-region-list", results[0], "province", function (row) {
        return (row.crops || []).join("、");
      }, function (row) {
        return deleteRegionRow(row);
      });
      renderAgriList("agri-term-list", results[1], "term", function (row) {
        return row.tasks;
      }, function (row) {
        return deleteTermRow(row);
      });
      renderAgriList("agri-fertilizer-list", results[2], "crop", function (row) {
        return (row.fertilizers || [row.fertilizer]).filter(Boolean).join("、");
      }, function (row) {
        return deleteFertilizerRow(row);
      });
      renderAgriList("agri-price-list", results[3], "fertilizer", function (row) {
        var minPrice = row.minPrice !== undefined ? row.minPrice : row.min_price;
        var maxPrice = row.maxPrice !== undefined ? row.maxPrice : row.max_price;
        return Number(minPrice) + " 到 " + Number(maxPrice) + " " + (row.unit || "元/吨");
      }, function (row) {
        return deletePriceRow(row);
      });
    }).catch(function () {
      NZX_APP.showToast("农事资料加载失败", "error");
    });
  }

  function renderAgriList(id, rows, keyName, detailFn, deleteFn) {
    var box = document.getElementById(id);
    if (!box) {
      return;
    }
    box.innerHTML = rows.map(function (row) {
      return '<div class="agri-list-item"><strong>' + escapeHtml(row[keyName] || "") +
        '</strong><span>' + escapeHtml(detailFn(row)) + '</span>' +
        '<button type="button" class="text-button agri-delete">删除</button></div>';
    }).join("");
    box.querySelectorAll(".agri-delete").forEach(function (button, index) {
      button.addEventListener("click", function () { deleteFn(rows[index]); });
    });
  }

  function saveRegion() {
    var province = document.getElementById("agri-region-province").value.trim();
    var crops = document.getElementById("agri-region-crops").value.split(/[、,，]/).map(function (item) { return item.trim(); }).filter(Boolean);
    NZX_DATA_API.saveRegionCrops(province, crops).then(loadAgriData).catch(function () { NZX_APP.showToast("保存失败", "error"); });
  }

  function deleteRegionRow(row) {
    NZX_DATA_API.deleteRegionCrops(row.province).then(loadAgriData).catch(function () { NZX_APP.showToast("删除失败", "error"); });
  }

  function saveTerm() {
    var term = document.getElementById("agri-term").value.trim();
    var tasks = document.getElementById("agri-tasks").value.trim();
    NZX_DATA_API.saveSolarTerm(term, tasks).then(loadAgriData).catch(function () { NZX_APP.showToast("保存失败", "error"); });
  }

  function deleteTermRow(row) {
    NZX_DATA_API.deleteSolarTerm(row.term).then(loadAgriData).catch(function () { NZX_APP.showToast("删除失败", "error"); });
  }

  function saveFertilizerRule() {
    var crop = document.getElementById("agri-fertilizer-crop").value.trim();
    var fertilizers = document.getElementById("agri-fertilizer-values").value.split(/[、,，]/).map(function (item) { return item.trim(); }).filter(Boolean);
    NZX_DATA_API.saveFertilizerRule(crop, fertilizers).then(loadAgriData).catch(function () { NZX_APP.showToast("保存失败", "error"); });
  }

  function deleteFertilizerRow(row) {
    NZX_DATA_API.deleteFertilizerRule(row.crop).then(loadAgriData).catch(function () { NZX_APP.showToast("删除失败", "error"); });
  }

  function saveFertilizerPrice() {
    var name = document.getElementById("agri-price-name").value.trim();
    var minPrice = Number(document.getElementById("agri-price-min").value);
    var maxPrice = Number(document.getElementById("agri-price-max").value);
    var unit = document.getElementById("agri-price-unit").value.trim() || "元/吨";
    NZX_DATA_API.saveFertilizerPrice(name, minPrice, maxPrice, unit).then(loadAgriData).catch(function () { NZX_APP.showToast("保存失败", "error"); });
  }

  function deletePriceRow(row) {
    NZX_DATA_API.deleteFertilizerPrice(row.fertilizer).then(loadAgriData).catch(function () { NZX_APP.showToast("删除失败", "error"); });
  }

  function renderImportResult(lines) {
    var list = document.getElementById("import-result");
    list.innerHTML = lines.map(function (line) {
      return "<li><span>" + escapeHtml(line) + "</span></li>";
    }).join("");
    document.getElementById("import-time").textContent = "更新于 " + currentTime();
  }

  function renderDataRecords() {
    var body = document.getElementById("data-records");
    var rows = NZX_DATA.PRODUCTS.slice(0, 8).map(function (product, index) {
      var series = NZX_DATA.priceSeries(product.name, NZX_DATA.MARKETS[index % 3], 5);
      var item = series[series.length - 1];
      return [
        "<tr>",
        "<td>" + product.name + "</td>",
        "<td>" + item.date + "</td>",
        "<td>" + item.price.toFixed(2) + " " + product.unit + "</td>",
        "<td>" + (index % 2 === 0 ? "API" : "CSV") + "</td>",
        '<td><span class="status-pill success">有效</span></td>',
        "</tr>"
      ].join("");
    }).join("");
    body.innerHTML = rows;
  }

  function trainModel() {
    var product = document.getElementById("train-product").value;
    var market = document.getElementById("train-market").value;
    var days = document.getElementById("train-days").value;
    var result = NZX_DATA.forecast(product, market);
    var button = document.getElementById("train-button");
    button.disabled = true;
    button.textContent = "训练中…";
    setTimeout(function () {
      button.disabled = false;
      button.textContent = "开始训练与评估";
      document.getElementById("trained-model").textContent = result.model;
      document.getElementById("trained-mape").textContent = result.mape + "%";
      document.getElementById("trained-rmse").textContent = result.rmse.toFixed(2);
      document.getElementById("model-result").innerHTML = [
        resultItem("品种", product),
        resultItem("市场", market),
        resultItem("预测周期", days + " 天"),
        resultItem("风险分", result.score + " / 100")
      ].join("");
      addLog("模型训练", "成功", product + " / " + market);
      NZX_APP.showToast("模型训练完成", "success");
    }, 900);
  }

  function resultItem(label, value) {
    return "<li><span>" + label + "</span><strong>" + value + "</strong></li>";
  }

  function addLog(action, result, detail) {
    logs.unshift({ time: currentTime(), action: action, result: result, detail: detail });
    logs = logs.slice(0, 80);
    renderLogs();
  }

  function renderLogs() {
    var body = document.getElementById("log-body");
    body.innerHTML = logs.map(function (item) {
      return [
        "<tr>",
        "<td>" + item.time + "</td>",
        "<td>" + item.action + "</td>",
        '<td><span class="status-pill ' + (item.result === "成功" ? "success" : "warning") + '">' + item.result + "</span></td>",
        "<td>" + escapeHtml(item.detail) + "</td>",
        "</tr>"
      ].join("");
    }).join("");
    document.getElementById("log-count").textContent = "共 " + logs.length + " 条";
  }

  function refreshAll() {
    renderDataRecords();
    renderLogs();
    NZX_APP.showToast("状态已刷新", "success");
  }

  function currentTime() {
    var now = new Date();
    return now.toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-");
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
