(function () {
  "use strict";

  window.SITE_CONFIG = {
    page: "home",
    requiresAuth: false,
    requiresAdmin: false,
    render: renderHome
  };

  function renderHome() {
    renderCitySelect();
    renderStats();
    renderChart();
    renderAlerts();
    renderProducts();
    renderWeather();
    renderLivePrices();
    renderGroupStatus();
    document.getElementById("hero-search").addEventListener("submit", function (event) {
      event.preventDefault();
      var keyword = encodeURIComponent(document.getElementById("hero-keyword").value.trim());
      location.href = "/NJXZ/query.html?q=" + keyword;
    });
    document.getElementById("home-city").addEventListener("change", function () {
      NZX_APP.setCity(this.value);
      renderWeather();
      renderLivePrices();
      renderChart();
      renderAlerts();
    });
  }

  function renderCitySelect() {
    var select = document.getElementById("home-city");
    if (!select) {
      return;
    }
    var cities = NZX_APP.cities();
    if (!cities.length) {
      select.innerHTML = '<option value="成都市">成都市</option>';
      select.value = NZX_APP.city();
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
    select.value = NZX_APP.city();
  }

  function renderStats() {
    var stats = document.getElementById("home-stat-grid");
    var products = NZX_APP.products();
    var cityCount = NZX_APP.cities().length || 340;
    stats.innerHTML = [
      statItem(String(products.length), "农产品品种", "var(--brand)"),
      statItem("实时", "批发价数据", "var(--navy)"),
      statItem("0", "高风险预警", "var(--red)"),
      statItem(String(cityCount), "支持城市", "var(--green)")
    ].join("");
  }

  function statItem(value, label, color) {
    return '<article class="stat-tile"><span class="stat-value" style="color:' + color + ';">' + value + '</span><span class="stat-label">' + label + "</span></article>";
  }

  function renderChart() {
    var products = ["猪肉", "鸡蛋", "土豆", "大白菜", "黄瓜"];
    Promise.all(products.map(function (product) {
      return NZX_DATA_API.prices(product, 1, NZX_APP.city());
    })).then(function (results) {
      var points = [];
      results.forEach(function (result, index) {
        var item = result.items && result.items[0];
        if (item) {
          points.push({
            value: Number(item.avgPrice),
            date: products[index]
          });
        }
      });
      var container = document.getElementById("home-chart");
      if (!points.length) {
        container.innerHTML = '<div class="empty-state">当前城市暂无实时报价</div>';
        return;
      }
      NZX_CHARTS.lineChart(container, {
        title: "重点品种今日实时均价",
        series: [{ color: "#0f766e", points: points }]
      });
    }).catch(function () {
      document.getElementById("home-chart").innerHTML = '<div class="empty-state">实时价格暂时不可用</div>';
    });
  }

  function renderAlerts() {
    var list = document.getElementById("home-alerts");
    list.innerHTML = '<li class="empty-state">风险预警加载中…</li>';
    NZX_DATA_API.risks(NZX_APP.city(), 8).then(function (result) {
      var alerts = result.items || [];
      updateRiskStat(alerts);
      list.innerHTML = alerts.map(function (item) {
        var levelText = item.level === "high" ? "高风险" : item.level === "medium" ? "中风险" : "低风险";
        return [
          "<li>",
          '<div><div class="trend-name">' + escapeHtml(item.product) + '</div><div class="trend-meta">' + escapeHtml(item.market) + " · " + escapeHtml(item.reason) + "</div></div>",
          '<div class="trend-value ' + (item.level === "high" ? "negative" : item.level === "medium" ? "negative" : "positive") + '">' + item.score + " · " + levelText + "</div>",
          "</li>"
        ].join("");
      }).join("");
    }).catch(function () {
      list.innerHTML = '<li class="empty-state">风险预警暂时不可用</li>';
    });
  }

  function updateRiskStat(alerts) {
    var highCount = alerts.filter(function (item) { return item.level === "high"; }).length;
    var tiles = document.querySelectorAll("#home-stat-grid .stat-tile");
    var value = tiles[2] && tiles[2].querySelector(".stat-value");
    if (value) {
      value.textContent = String(highCount);
    }
  }

  function renderProducts() {
    var catalog = NZX_APP.catalog();
    if (!catalog.length) {
      return;
    }

    var selectedCategory = catalog[0];
    var selectedSubcategory = selectedCategory.children[0];
    var topTabs = document.getElementById("product-category-tabs");
    var subTabs = document.getElementById("product-subcategory-tabs");
    var cloud = document.getElementById("product-cloud");

    function renderSubcategories() {
      subTabs.innerHTML = selectedCategory.children.map(function (subcategory, index) {
        return '<button class="catalog-tab' + (subcategory === selectedSubcategory ? " active" : "") +
          '" type="button" data-subcategory-index="' + index + '">' + subcategory.name + "</button>";
      }).join("");
    }

    function renderProducts() {
      cloud.innerHTML = selectedSubcategory.products.map(function (product) {
        return '<button class="quick-chip" type="button" data-product="' + product + '">' + product + "</button>";
      }).join("");
    }

    topTabs.innerHTML = catalog.map(function (category, index) {
      return '<button class="catalog-tab catalog-top-tab' + (category === selectedCategory ? " active" : "") +
        '" type="button" data-category-index="' + index + '">' + category.name + "</button>";
    }).join("");
    renderSubcategories();
    renderProducts();

    topTabs.addEventListener("click", function (event) {
      var button = event.target.closest("[data-category-index]");
      if (!button) {
        return;
      }
      selectedCategory = catalog[Number(button.getAttribute("data-category-index"))];
      selectedSubcategory = selectedCategory.children[0];
      topTabs.querySelectorAll(".catalog-tab").forEach(function (item) {
        item.classList.toggle("active", item === button);
      });
      renderSubcategories();
      renderProducts();
    });
    subTabs.addEventListener("click", function (event) {
      var button = event.target.closest("[data-subcategory-index]");
      if (!button) {
        return;
      }
      selectedSubcategory = selectedCategory.children[Number(button.getAttribute("data-subcategory-index"))];
      subTabs.querySelectorAll(".catalog-tab").forEach(function (item) {
        item.classList.toggle("active", item === button);
      });
      renderProducts();
    });
    cloud.addEventListener("click", function (event) {
      var button = event.target.closest("[data-product]");
      if (button) {
        location.href = "/NJXZ/query.html?q=" + encodeURIComponent(button.getAttribute("data-product"));
      }
    });
    document.getElementById("product-count").textContent = "共 " + NZX_APP.products().length + " 种";
  }

  function renderWeather() {
    var city = NZX_APP.city();
    document.getElementById("weather-city-label").textContent = city;
    NZX_DATA_API.weather(city).then(function (result) {
      var current = result.data && result.data.current || {};
      var daily = result.data && result.data.daily || {};
      var codeMap = {
        0: "晴", 1: "基本晴朗", 2: "多云", 3: "阴",
        45: "雾", 48: "雾凇", 51: "小毛毛雨", 53: "毛毛雨", 55: "强毛毛雨",
        61: "小雨", 63: "中雨", 65: "大雨", 71: "小雪", 73: "中雪", 75: "大雪",
        80: "阵雨", 81: "中等阵雨", 82: "强阵雨", 95: "雷雨", 96: "雷雨伴冰雹", 99: "强雷雨伴冰雹"
      };
      var html = [
        metric("当前温度", current.temperature_2m + "°C"),
        metric("相对湿度", current.relative_humidity_2m + "%"),
        metric("风速", current.wind_speed_10m + " km/h"),
        metric("降水", current.precipitation + " mm"),
        metric("天气", codeMap[current.weather_code] || "—")
      ].join("");
      if (daily.time && daily.time.length) {
        html += '<div class="weather-daily">';
        daily.time.slice(0, 7).forEach(function (date, index) {
          html += [
            '<div class="weather-day">',
            "<span>" + date.slice(5).replace("-", "/") + "</span>",
            "<strong>" + (daily.temperature_2m_max[index] || "—") + "° / " + (daily.temperature_2m_min[index] || "—") + "°</strong>",
            "<small>" + (daily.precipitation_sum[index] || 0) + " mm</small>",
            "</div>"
          ].join("");
        });
        html += "</div>";
      }
      document.getElementById("weather-content").innerHTML = html;
      document.getElementById("weather-updated").textContent = "更新于 " + NZX_DATA_API.formatDate(result.fetchedAtUtc);
    }).catch(function () {
      document.getElementById("weather-content").innerHTML = '<div class="empty-state">实时天气暂时不可用</div>';
      document.getElementById("weather-updated").textContent = "暂无数据";
    });
  }

  function metric(label, value) {
    return '<div class="weather-metric"><span>' + label + "</span><strong>" + value + "</strong></div>";
  }

  function renderLivePrices() {
    NZX_DATA_API.prices("", 8, NZX_APP.city()).then(function (result) {
      var list = document.getElementById("live-price-list");
      list.innerHTML = result.items.map(function (item) {
        return [
          "<li>",
          '<div><div class="trend-name">' + escapeHtml(item.name) + '</div><div class="trend-meta">' + escapeHtml(item.place || result.source) + " · " + escapeHtml(item.specInfo || item.unit) + "</div></div>",
          '<div class="trend-value positive">' + escapeHtml(item.avgPrice) + "</div>",
          "</li>"
        ].join("");
      }).join("");
      document.getElementById("price-source-label").textContent = result.source || "北京新发地";
      document.getElementById("price-updated").textContent = "更新于 " + NZX_DATA_API.formatDate(result.fetchedAtUtc);
    }).catch(function () {
      document.getElementById("live-price-list").innerHTML = '<li class="empty-state">实时行情暂时不可用</li>';
      document.getElementById("price-updated").textContent = "暂无数据";
    });
  }

  function renderGroupStatus() {
    var panel = document.getElementById("home-group-panel");
    var content = document.getElementById("home-group-content");
    var user = NZX_APP.user();
    if (!panel || !user || user.identity !== "individual") {
      if (panel) {
        panel.hidden = true;
      }
      return;
    }
    panel.hidden = false;
    document.getElementById("home-group-subtitle").textContent = "个体户（普通农户）";
    NZX_DATA_API.myGroup().then(function (result) {
      if (!result.myGroup) {
        content.innerHTML = '<div class="group-status-empty">当前未加入小组</div>';
        return;
      }
      var recommendations = result.member && result.member.recommendations || [];
      document.getElementById("home-group-subtitle").textContent = result.myGroup.name;
      if (!recommendations.length) {
        content.innerHTML = '<div class="group-status-empty">无</div>';
        return;
      }
      content.innerHTML = '<div class="group-recommendation-list">' +
        recommendations.map(function (product) {
          return '<button class="quick-chip" type="button" data-product="' + product + '">' + product + "</button>";
        }).join("") + "</div>";
      content.querySelectorAll("[data-product]").forEach(function (button) {
        button.addEventListener("click", function () {
          location.href = "/NJXZ/query.html?q=" + encodeURIComponent(button.getAttribute("data-product"));
        });
      });
    }).catch(function () {
      content.innerHTML = '<div class="group-status-empty">小组信息暂时不可用</div>';
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
