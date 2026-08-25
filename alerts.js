(function () {
  "use strict";

  var filters = { level: "", product: "", status: "", keyword: "", city: "成都市" };
  var alerts = [];
  var loading = false;

  window.SITE_CONFIG = {
    page: "alerts",
    requiresAuth: true,
    requiresAdmin: false,
    render: initialize
  };

  function initialize() {
    filters.city = NZX_APP.city() || "成都市";
    fillCitySelect();
    var productSelect = document.getElementById("filter-product");
    productSelect.innerHTML = '<option value="">全部品种</option>' + NZX_APP.products().map(function (item) {
      return '<option value="' + item.name + '">' + item.name + "</option>";
    }).join("");
    bindEvents();
    refreshData();
  }

  function fillCitySelect() {
    var select = document.getElementById("filter-city");
    var cities = NZX_APP.cities();
    if (!cities.length) {
      select.innerHTML = '<option value="' + filters.city + '">' + filters.city + "</option>";
      select.value = filters.city;
      return;
    }
    var byProvince = {};
    cities.forEach(function (city) {
      if (!byProvince[city.province]) {
        byProvince[city.province] = [];
      }
      byProvince[city.province].push(city);
    });
    var html = "";
    Object.keys(byProvince).sort().forEach(function (province) {
      html += '<optgroup label="' + province + '">';
      byProvince[province].forEach(function (city) {
        html += '<option value="' + city.name + '">' + city.name + "</option>";
      });
      html += "</optgroup>";
    });
    select.innerHTML = html;
    select.value = filters.city;
  }

  function bindEvents() {
    document.getElementById("refresh-button").addEventListener("click", refreshData);
    document.getElementById("filter-city").addEventListener("change", function () {
      filters.city = this.value;
      refreshData();
    });
    document.getElementById("filter-level").addEventListener("change", updateFilters);
    document.getElementById("filter-product").addEventListener("change", updateFilters);
    document.getElementById("filter-status").addEventListener("change", updateFilters);
    document.getElementById("search-input").addEventListener("input", updateFilters);
    document.getElementById("reset-button").addEventListener("click", resetFilters);
    document.getElementById("mark-all-button").addEventListener("click", markAllRead);
    document.getElementById("alerts-body").addEventListener("click", handleTableAction);
  }

  function updateFilters() {
    filters.level = document.getElementById("filter-level").value;
    filters.product = document.getElementById("filter-product").value;
    filters.status = document.getElementById("filter-status").value;
    filters.keyword = document.getElementById("search-input").value.trim().toLowerCase();
    render();
  }

  function resetFilters() {
    document.getElementById("filter-level").value = "";
    document.getElementById("filter-product").value = "";
    document.getElementById("filter-status").value = "";
    document.getElementById("search-input").value = "";
    filters = { level: "", product: "", status: "", keyword: "", city: filters.city };
    render();
  }

  function readIds() {
    try {
      var user = NZX_APP.user() || {};
      var key = "nzx_alerts_read_" + (user.phone || "guest");
      return JSON.parse(localStorage.getItem(key) || "{}");
    } catch (error) {
      return {};
    }
  }

  function saveReadIds(readMap) {
    var user = NZX_APP.user() || {};
    localStorage.setItem("nzx_alerts_read_" + (user.phone || "guest"), JSON.stringify(readMap));
  }

  function getFilteredAlerts() {
    var readMap = readIds();
    return alerts.map(function (item) {
      return Object.assign({}, item, { status: readMap[item.id] ? "read" : "unread" });
    }).filter(function (item) {
      var matchesLevel = !filters.level || item.level === filters.level;
      var matchesProduct = !filters.product || item.product === filters.product;
      var matchesStatus = !filters.status || item.status === filters.status;
      var haystack = [item.product, item.market, item.reason, item.level].join(" ").toLowerCase();
      var matchesKeyword = !filters.keyword || haystack.indexOf(filters.keyword) >= 0;
      return matchesLevel && matchesProduct && matchesStatus && matchesKeyword;
    });
  }

  function render() {
    var filtered = getFilteredAlerts();
    var body = document.getElementById("alerts-body");
    body.innerHTML = filtered.map(function (item) {
      var levelText = item.level === "high" ? "高风险" : item.level === "medium" ? "中风险" : "低风险";
      var statusText = item.status === "unread" ? "未读" : "已读";
      var readAction = item.status === "unread"
        ? '<button type="button" data-action="read" data-id="' + item.id + '">标记已读</button>'
        : "";
      return [
        "<tr>",
        '<td><span class="level-badge level-' + item.level + '">' + levelText + "</span></td>",
        "<td><strong>" + escapeHtml(item.product) + "</strong></td>",
        "<td>" + escapeHtml(item.market) + "</td>",
        '<td class="risk-score">' + item.score + "</td>",
        '<td class="reason-cell">' + escapeHtml(item.reason) + "</td>",
        "<td>" + escapeHtml(item.updatedAt) + "</td>",
        '<td><span class="status-badge status-' + item.status + '">' + statusText + "</span></td>",
        '<td class="row-actions"><button type="button" data-action="detail" data-id="' + item.id + '">查看详情</button>' + readAction + "</td>",
        "</tr>"
      ].join("");
    }).join("");
    document.getElementById("result-count").textContent = "共 " + filtered.length + " 条";
    document.getElementById("empty-state").hidden = filtered.length !== 0;
    document.getElementById("last-updated").textContent = alerts[0] ? alerts[0].updatedAt : "--";
    renderStats();
  }

  function renderStats() {
    document.getElementById("high-count").textContent = alerts.filter(function (item) { return item.level === "high"; }).length;
    document.getElementById("medium-count").textContent = alerts.filter(function (item) { return item.level === "medium"; }).length;
    document.getElementById("low-count").textContent = alerts.filter(function (item) { return item.level === "low"; }).length;
    document.getElementById("unread-count").textContent = alerts.filter(function (item) { return !readIds()[item.id]; }).length;
  }

  function handleTableAction(event) {
    var button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    var id = button.getAttribute("data-id");
    if (button.getAttribute("data-action") === "read") {
      markRead(id);
    } else {
      showDetail(id);
    }
  }

  function markRead(id) {
    var readMap = readIds();
    if (!readMap[id]) {
      readMap[id] = true;
      saveReadIds(readMap);
      render();
      NZX_APP.showToast("已标记为已读", "success");
    }
  }

  function markAllRead() {
    var readMap = readIds();
    var changed = false;
    alerts.forEach(function (item) {
      if (!readMap[item.id]) {
        readMap[item.id] = true;
        changed = true;
      }
    });
    saveReadIds(readMap);
    render();
    NZX_APP.showToast(changed ? "全部提醒已标记为已读" : "当前没有未读提醒", "success");
  }

  function showDetail(id) {
    var item = alerts.find(function (alert) { return alert.id === id; });
    if (!item) {
      return;
    }
    var reasons = (item.reasons || []).map(function (reason) { return "• " + reason; }).join("\n");
    NZX_APP.showToast(item.product + "：" + (reasons || item.reason), "");
  }

  function refreshData() {
    if (loading) {
      return;
    }
    loading = true;
    var button = document.getElementById("refresh-button");
    button.disabled = true;
    button.textContent = "刷新中…";
    NZX_DATA_API.risks(filters.city, 18).then(function (result) {
      alerts = (result.items || []).map(function (item) {
        return Object.assign({}, item, {
          reason: item.reason || item.summary || "",
          updatedAt: item.updatedAt || new Date().toLocaleString("zh-CN", { hour12: false })
        });
      });
      render();
      NZX_APP.showToast("预警数据已刷新", "success");
    }).catch(function () {
      alerts = [];
      render();
      NZX_APP.showToast("预警数据暂时不可用", "error");
    }).finally(function () {
      loading = false;
      button.disabled = false;
      button.textContent = "刷新数据";
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
})();
