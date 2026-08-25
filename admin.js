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
    ["data", "model", "logs", "settings"].forEach(function (name) {
      document.getElementById("tab-" + name).hidden = name !== tab;
    });
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
