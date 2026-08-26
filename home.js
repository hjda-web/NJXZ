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
    renderAlerts();
    renderProducts();
    renderRegionCrops();
    renderSolarTerm();
    renderFertilizerBoard();
    renderLivePrices();
    renderGroupStatus();
    document.getElementById("hero-search").addEventListener("submit", function (event) {
      event.preventDefault();
      var keyword = encodeURIComponent(document.getElementById("hero-keyword").value.trim());
      location.href = "/NJXZ/query.html?q=" + keyword;
    });
    document.getElementById("home-city").addEventListener("change", function () {
      NZX_APP.setCity(this.value);
      renderLivePrices();
      renderAlerts();
      renderRegionCrops();
      renderSolarTerm();
      renderFertilizerBoard();
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

  function renderRegionCrops() {
    var city = NZX_APP.city();
    var province = provinceForCity(city);
    document.getElementById("region-province-label").textContent = province || city;
    var content = document.getElementById("region-crops-content");
    content.innerHTML = '<div class="empty-state">加载中…</div>';
    NZX_DATA_API.regionCrops(province).then(function (result) {
      if (!result.available || !result.crops || !result.crops.length) {
        content.innerHTML = '<div class="empty-state">暂无该省推荐数据</div>';
        return;
      }
      content.innerHTML = '<div class="crop-chip-list">' +
        result.crops.map(function (crop) {
          return '<span class="crop-chip">' + escapeHtml(crop) + "</span>";
        }).join("") + "</div>";
    }).catch(function () {
      content.innerHTML = '<div class="empty-state">地区推荐数据不可用</div>';
    });
  }

  function renderSolarTerm() {
    var today = new Date();
    var date = today.getFullYear() + "-" +
      String(today.getMonth() + 1).padStart(2, "0") + "-" +
      String(today.getDate()).padStart(2, "0");
    NZX_DATA_API.solarTerm(date).then(function (result) {
      document.getElementById("solar-term-label").textContent = result.term || "—";
      document.getElementById("solar-term-content").innerHTML = result.tasks
        ? '<p class="solar-term-tasks">' + escapeHtml(result.tasks) + "</p>"
        : '<div class="empty-state">暂无节气农事数据</div>';
    }).catch(function () {
      document.getElementById("solar-term-content").innerHTML = '<div class="empty-state">节气数据不可用</div>';
    });
  }

  function renderFertilizerBoard() {
    var city = NZX_APP.city();
    var province = provinceForCity(city);
    var user = NZX_APP.user() || {};
    var regionCrops = [];
    var commonCrops = user.commonCrops || [];
    var groupCrops = [];
    var riskItems = [];

    var requests = [];
    requests.push(NZX_DATA_API.regionCrops(province).then(function (result) {
      regionCrops = result.crops || [];
    }).catch(function () {}));
    requests.push(NZX_DATA_API.fertilizerRules().then(function (rules) {
      window.__nzxFertilizerRules = rules;
    }).catch(function () {}));
    requests.push(NZX_DATA_API.fertilizerPrices().then(function (prices) {
      window.__nzxFertilizerPrices = prices;
    }).catch(function () {}));
    requests.push(NZX_DATA_API.risks(city, 30).then(function (result) {
      riskItems = result.items || [];
    }).catch(function () {}));
    if (user.identity === "individual") {
      requests.push(NZX_DATA_API.myGroup().then(function (result) {
        if (result.member && result.member.recommendations) {
          groupCrops = result.member.recommendations;
        }
      }).catch(function () {}));
    }

    Promise.all(requests).then(function () {
      var crops = Array.from(new Set(regionCrops.concat(commonCrops, groupCrops))).filter(Boolean);
      var rules = window.__nzxFertilizerRules || [];
      var prices = window.__nzxFertilizerPrices || [];
      var board = document.getElementById("fertilizer-board");
      var priceBox = document.getElementById("fertilizer-prices");
      if (!crops.length) {
        board.innerHTML = '<div class="empty-state">暂无农产品数据</div>';
        priceBox.innerHTML = "";
        return;
      }
      var cropsWithFertilizer = crops.map(function (crop) {
        var sources = [];
        if (regionCrops.indexOf(crop) >= 0) {
          sources.push("地区推荐");
        }
        if (commonCrops.indexOf(crop) >= 0) {
          sources.push("常种作物");
        }
        if (groupCrops.indexOf(crop) >= 0) {
          sources.push("小组推荐");
        }
        var risk = riskItems.find(function (item) { return item.product === crop; });
        var riskScore = risk && risk.score !== undefined ? risk.score : "--";
        var fertilizers = fertilizersForCrop(crop, rules);
        return {
          crop: crop,
          source: sources.join("、") || "—",
          riskScore: riskScore,
          fertilizers: fertilizers
        };
      });
      board.innerHTML = '<div class="crop-table">' +
        '<div class="crop-table-row crop-table-header">' +
          '<span>农作物名称</span><span>来源</span><span>风险分</span><span>要用到的肥料</span>' +
        '</div>' +
        cropsWithFertilizer.map(function (item) {
          var text = item.fertilizers.length ? item.fertilizers.join("、") : "不适用";
          return '<div class="crop-table-row">' +
            '<span><strong>' + escapeHtml(item.crop) + '</strong></span>' +
            '<span>' + escapeHtml(item.source) + '</span>' +
            '<span>' + escapeHtml(String(item.riskScore)) + '</span>' +
            '<span>' + escapeHtml(text) + '</span>' +
            '</div>';
        }).join("") + "</div>";
      var visiblePrices = prices.filter(function (item) {
        return item.fertilizer !== "不适用";
      });
      priceBox.innerHTML = visiblePrices.map(function (item) {
        var minPrice = item.minPrice !== undefined ? item.minPrice : item.min_price;
        var maxPrice = item.maxPrice !== undefined ? item.maxPrice : item.max_price;
        return '<div class="fertilizer-price-item"><strong>' + escapeHtml(item.fertilizer) +
          '</strong><span>' + Number(minPrice) + " 到 " + Number(maxPrice) +
          " " + escapeHtml(item.unit || "元/吨") + "</span></div>";
      }).join("");
    }).catch(function () {
      document.getElementById("fertilizer-board").innerHTML = '<div class="empty-state">农产品数据不可用</div>';
      document.getElementById("fertilizer-prices").innerHTML = "";
    });
  }

  function provinceForCity(cityName) {
    var city = NZX_APP.cities().find(function (item) { return item.name === cityName; });
    return city ? city.province : "";
  }

  function fertilizersForCrop(crop, rules) {
    var lookupCrop = fertilizerAliasMap[crop] || crop;
    var item = NZX_APP.product(lookupCrop);
    var set = {};
    var rule = rules.find(function (entry) { return entry.crop === crop || entry.crop === lookupCrop; });
    if (rule) {
      (rule.fertilizers || [rule.fertilizer]).filter(Boolean).forEach(function (name) {
        if (name !== "不适用") {
          set[name] = true;
        }
      });
    }
    var subcategory = item.subcategory;
    if (["叶菜类", "葱蒜类", "芽苗类", "粮油类", "藻类"].indexOf(subcategory) >= 0) {
      set["氮肥"] = true;
    }
    if (["瓜茄类", "鲜豆类", "干豆类"].indexOf(subcategory) >= 0) {
      set["磷肥"] = true;
    }
    if (subcategory === "根茎类" || highSugarCrops.indexOf(lookupCrop) >= 0) {
      set["钾肥"] = true;
    }
    return Object.keys(set);
  }

  var highSugarCrops = [
    "苹果", "香蕉", "橙子", "梨", "葡萄", "草莓", "西瓜", "哈密瓜", "菠萝",
    "猕猴桃", "牛油果", "柠檬", "桃", "李子", "樱桃", "火龙果", "芒果",
    "红薯", "山药", "芋头", "莲藕", "马蹄", "胡萝卜"
  ];

  var fertilizerAliasMap = {
    "水稻": "大米",
    "粳稻": "大米",
    "小麦": "面粉",
    "春小麦": "面粉",
    "冬小麦": "面粉",
    "大豆": "黄豆",
    "马铃薯": "土豆",
    "谷子": "小米"
  };

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
      var recommendationHtml = recommendations.length
        ? '<div class="group-recommendation-list">' +
          recommendations.map(function (product) {
          return '<button class="quick-chip" type="button" data-product="' + product + '">' + product + "</button>";
          }).join("") + "</div>"
        : '<div class="group-status-empty">无</div>';
      content.innerHTML =
        '<div class="group-recommend-title">组长推荐种植</div>' +
        recommendationHtml +
        '<div class="group-message-section">' +
          '<h3>种植心得分享</h3>' +
          '<form id="group-message-form" class="group-message-form">' +
            '<input id="group-message-input" type="text" maxlength="500" placeholder="写下你的种植心得">' +
            '<button class="primary-button" type="submit">发送</button>' +
          '</form>' +
          '<ul class="group-message-list" id="group-message-list"></ul>' +
        '</div>';
      content.querySelectorAll("[data-product]").forEach(function (button) {
        button.addEventListener("click", function () {
          location.href = "/NJXZ/query.html?q=" + encodeURIComponent(button.getAttribute("data-product"));
        });
      });
      document.getElementById("group-message-form").addEventListener("submit", function (event) {
        event.preventDefault();
        var input = document.getElementById("group-message-input");
        var text = input.value.trim();
        if (!text) {
          return;
        }
        NZX_DATA_API.createGroupMessage(text).then(function () {
          input.value = "";
          loadGroupMessages();
        }).catch(function () {
          NZX_APP.showToast("发送失败", "error");
        });
      });
      document.getElementById("group-message-list").addEventListener("click", function (event) {
        var button = event.target.closest("[data-delete-message]");
        if (!button) {
          return;
        }
        if (window.confirm("确定删除这条心得吗？")) {
          NZX_DATA_API.deleteGroupMessage(button.getAttribute("data-delete-message")).then(loadGroupMessages).catch(function () {
            NZX_APP.showToast("删除失败", "error");
          });
        }
      });
      NZX_DATA_API.groups().then(function (groupData) {
        window.__homeGroupAdmin = Boolean(groupData.user && groupData.user.groupAdmin);
        loadGroupMessages();
      }).catch(function () {
        window.__homeGroupAdmin = false;
        loadGroupMessages();
      });
    }).catch(function () {
      content.innerHTML = '<div class="group-status-empty">小组信息暂时不可用</div>';
    });
  }

  function loadGroupMessages() {
    var list = document.getElementById("group-message-list");
    if (!list) {
      return;
    }
    NZX_DATA_API.groupMessages().then(function (result) {
      var user = NZX_APP.user() || {};
      var groupAdmin = window.__homeGroupAdmin === true;
      list.innerHTML = (result.items || []).map(function (item) {
        var canDelete = item.sender_phone === user.phone || groupAdmin;
        return [
          "<li>",
          '<div class="group-message-meta"><strong>' + escapeHtml(item.nickname || "") + "</strong>" +
            '<span>' + escapeHtml(NZX_DATA_API.formatDate(item.created_at)) + "</span></div>",
          '<div class="group-message-content">' + escapeHtml(item.content) + "</div>",
          canDelete ? '<button class="text-button" type="button" data-delete-message="' + item.id + '">删除</button>' : "",
          "</li>"
        ].join("");
      }).join("");
    }).catch(function () {
      list.innerHTML = '<li class="empty-state">心得加载失败</li>';
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
