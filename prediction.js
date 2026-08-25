(function () {
  "use strict";

  var state = {
    product: "猪肉",
    city: "成都市",
    days: 7,
    view: "chart",
    result: null,
    loading: false
  };

  window.SITE_CONFIG = {
    page: "prediction",
    requiresAuth: true,
    requiresAdmin: false,
    render: initialize
  };

  function initialize() {
    state.city = NZX_APP.city() || "成都市";
    fillSelects();
    document.getElementById("prediction-range").value = String(state.days);
    updateDaysLabel();
    bindEvents();
    render();
  }

  function fillSelects() {
    var productSelect = document.getElementById("prediction-product");
    productSelect.innerHTML = NZX_APP.products().map(function (item) {
      return '<option value="' + item.name + '">' + item.name + "</option>";
    }).join("");
    productSelect.value = state.product;
    fillCitySelect(document.getElementById("prediction-city"));
  }

  function fillCitySelect(select) {
    var cities = NZX_APP.cities();
    if (!cities.length) {
      select.innerHTML = '<option value="' + state.city + '">' + state.city + "</option>";
      select.value = state.city;
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
    select.value = state.city;
  }

  function bindEvents() {
    document.getElementById("prediction-product").addEventListener("change", function () {
      state.product = this.value;
      render();
    });
    document.getElementById("prediction-city").addEventListener("change", function () {
      state.city = this.value;
      render();
    });
    var rangeInput = document.getElementById("prediction-range");
    rangeInput.addEventListener("input", function () {
      state.days = Number(this.value);
      updateDaysLabel();
    });
    rangeInput.addEventListener("change", function () {
      state.days = Number(this.value);
      updateDaysLabel();
      render();
    });
    document.getElementById("prediction-view-toggle").addEventListener("click", function (event) {
      var button = event.target.closest("[data-view]");
      if (!button || button.disabled) {
        return;
      }
      state.view = button.getAttribute("data-view");
      document.querySelectorAll("#prediction-view-toggle button").forEach(function (item) {
        item.classList.toggle("active", item === button);
      });
      renderView();
    });
    document.getElementById("favorite-button").addEventListener("click", function () {
      NZX_APP.showToast(state.product + " 已收藏", "success");
    });
  }

  function setLoading(loading) {
    state.loading = loading;
    var button = document.getElementById("favorite-button");
    if (button) {
      button.disabled = loading;
      button.textContent = loading ? "计算中…" : "收藏此品种";
    }
    document.getElementById("prediction-range").disabled = loading;
    document.querySelectorAll("#prediction-view-toggle button").forEach(function (item) {
      item.disabled = loading;
    });
  }

  function render() {
    if (state.loading) {
      return;
    }
    setLoading(true);
    NZX_DATA_API.forecast(state.product, state.city, state.days).then(function (result) {
      state.result = result;
      renderForecast(result);
    }).catch(function (error) {
      state.result = null;
      renderEmpty(error);
    }).finally(function () {
      setLoading(false);
    });
  }

  function renderForecast(result) {
    var price = result.price || {};
    var marketNote = price.mode === "national_fallback"
      ? "（当前城市暂无报价，使用全国中位价）"
      : price.mode === "category_fallback"
        ? "（当前城市暂无该品种报价，使用" + (price.fallbackCategory || "同分类") + "全国市场）"
        : " · " + (price.market || "实时批发市场");
    document.getElementById("prediction-subtitle").textContent =
      result.product + " · " + result.city + marketNote;
    document.getElementById("prediction-updated").textContent =
      "模型更新：" + NZX_DATA_API.formatDate(result.fetchedAtUtc);
    renderRisk(result);
    renderFactors(result);
    renderView();
  }

  function updateDaysLabel() {
    document.getElementById("prediction-days-label").textContent = state.days + " 天";
  }

  function renderView() {
    var chartPanel = document.getElementById("prediction-chart-panel");
    var tablePanel = document.getElementById("prediction-table-panel");
    chartPanel.hidden = state.view !== "chart";
    tablePanel.hidden = state.view !== "table";
    if (state.result) {
      renderChart(state.result);
      renderTable(state.result);
    }
  }

  function renderChart(result) {
    var price = result.price || {};
    var forecast = result.forecast || [];
    var anchorDate = price.pubDate || (forecast[0] && forecast[0].date) || new Date().toISOString().slice(0, 10);
    var anchorPoints = [{
      value: Number(price.current),
      date: anchorDate
    }];
    if (forecast[0]) {
      anchorPoints.push({
        value: Number(forecast[0].price),
        date: forecast[0].date
      });
    }

    NZX_CHARTS.lineChart(document.getElementById("prediction-chart"), {
      title: result.product + "预测走势",
      animatePath: true,
      animationDuration: 600,
      series: [
        {
          color: "#0f766e",
          points: anchorPoints
        },
        {
          color: "#ea580c",
          points: forecast.map(function (item) {
            return { value: Number(item.price), date: item.date };
          })
        }
      ]
    });
  }

  function renderRisk(result) {
    var risk = result.risk || {};
    var card = document.getElementById("risk-card");
    card.className = "panel risk-card " + risk.level;
    document.getElementById("risk-level").textContent = risk.levelText || "待评估";
    document.getElementById("risk-level").className = "risk-score-large risk-" + risk.level;
    document.getElementById("risk-score").textContent = "风险分 " + risk.score;
    document.getElementById("risk-score").className = "risk-score-large risk-" + risk.level;
    document.getElementById("risk-reason").textContent = risk.summary || "";
    document.getElementById("risk-factors").innerHTML = (risk.reasons || []).map(function (reason) {
      return '<span class="factor-chip">' + escapeHtml(reason) + "</span>";
    }).join("");
  }

  function renderFactors(result) {
    var weather = result.weather || {};
    var supply = result.supply || {};
    document.getElementById("model-name").textContent = result.model;
    document.getElementById("model-weather").textContent = (weather.score || 0) + " 分";
    document.getElementById("model-supply").textContent = supply.index + " / " + (supply.level || "");
    var note =
      "价格锚点：" + (result.price.current || "--") + " " + (result.price.unit || "") +
      "；跨市场波动率 " + (result.volatility || 0) + "%；" +
      (supply.yieldDataAvailable
        ? supply.yieldYear + " " + supply.yieldMetric + " " + signed(supply.yieldChange) + "%。"
        : "该品种暂无公开年度单项产量数据，产量因子使用实时批发价供给压力估算。");
    if (state.days > 7) {
      note += " 前7日使用天气预报，7日后仅使用价格趋势与供给压力，长期预测不确定性较高。";
    }
    note += " ARIMA 模型的品类趋势参数 μ 根据该品类近180天历史涨幅计算，每30天自动更新。";
    document.getElementById("factor-note").textContent = note;
  }

  function renderTable(result) {
    var current = Number(result.price.current) || 1;
    var forecast = result.forecast || [];
    var body = document.getElementById("forecast-body");
    body.innerHTML = forecast.map(function (item) {
      var change = (Number(item.price) - current) / current * 100;
      return [
        "<tr>",
        "<td>" + item.date + "</td>",
        "<td>" + Number(item.price).toFixed(2) + "</td>",
        "<td>" + Number(item.lower).toFixed(2) + "</td>",
        "<td>" + Number(item.upper).toFixed(2) + "</td>",
        '<td class="' + (change >= 0 ? "positive" : "negative") + '">' + signed(change.toFixed(1)) + "%</td>",
        "</tr>"
      ].join("");
    }).join("");
    document.getElementById("forecast-count").textContent = "共 " + forecast.length + " 条";
  }

  function renderEmpty(error) {
    document.getElementById("prediction-updated").textContent = "暂无可用数据";
    document.getElementById("prediction-chart").innerHTML = "";
    document.getElementById("risk-level").textContent = "数据不可用";
    document.getElementById("risk-level").className = "risk-score-large risk-medium";
    document.getElementById("risk-score").textContent = "--";
    document.getElementById("risk-reason").textContent =
      (error && error.message) || "实时价格或天气数据暂时不可用";
    document.getElementById("risk-factors").innerHTML = "";
    document.getElementById("forecast-body").innerHTML = "";
    document.getElementById("forecast-count").textContent = "共 0 条";
    NZX_APP.showToast("预测数据暂时不可用", "error");
  }

  function signed(value) {
    return Number(value) >= 0 ? "+" + value : String(value);
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
