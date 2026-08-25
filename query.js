(function () {
  "use strict";

  var page = {
    product: "猪肉",
    city: "成都市",
    limit: 20,
    rows: [],
    chartRows: [],
    chartSupplement: false,
    source: "",
    nationalFallback: false,
    fallbackCategory: "",
    referenceProduct: ""
  };

  window.SITE_CONFIG = {
    page: "query",
    requiresAuth: true,
    requiresAdmin: false,
    render: initialize
  };

  function initialize() {
    var params = new URLSearchParams(location.search);
    var queryProduct = params.get("q") || params.get("product");
    if (queryProduct && NZX_APP.products().some(function (item) { return item.name === queryProduct; })) {
      page.product = queryProduct;
    }
    page.city = NZX_APP.city() || "成都市";
    fillSelects();
    bindEvents();
    render();
  }

  function fillSelects() {
    fillCategorySelect();
    fillCitySelect(document.getElementById("query-city"));
    document.getElementById("query-range").value = String(page.limit);
  }

  function fillCategorySelect() {
    var catalog = NZX_APP.catalog();
    var categorySelect = document.getElementById("query-category");
    categorySelect.innerHTML = catalog.map(function (category) {
      return '<option value="' + category.name + '">' + category.name + "</option>";
    }).join("");

    var selectedCategory = findCategoryForProduct(page.product) || catalog[0];
    if (selectedCategory) {
      categorySelect.value = selectedCategory.name;
    }
    fillSubcategorySelect(selectedCategory);
  }

  function findCategoryForProduct(productName) {
    var catalog = NZX_APP.catalog();
    for (var i = 0; i < catalog.length; i++) {
      var category = catalog[i];
      for (var j = 0; j < category.children.length; j++) {
        var subcategory = category.children[j];
        if (subcategory.products.indexOf(productName) >= 0) {
          return category;
        }
      }
    }
    return null;
  }

  function findSubcategoryForProduct(category, productName) {
    for (var i = 0; i < category.children.length; i++) {
      if (category.children[i].products.indexOf(productName) >= 0) {
        return category.children[i];
      }
    }
    return category.children[0];
  }

  function fillSubcategorySelect(category) {
    var subcategorySelect = document.getElementById("query-subcategory");
    subcategorySelect.innerHTML = category.children.map(function (subcategory) {
      return '<option value="' + subcategory.name + '">' + subcategory.name + "</option>";
    }).join("");
    var selectedSubcategory = findSubcategoryForProduct(category, page.product);
    subcategorySelect.value = selectedSubcategory.name;
    fillProductSelect(selectedSubcategory);
  }

  function fillProductSelect(subcategory) {
    var productSelect = document.getElementById("query-product");
    productSelect.innerHTML = subcategory.products.map(function (product) {
      return '<option value="' + product + '">' + product + "</option>";
    }).join("");
    if (subcategory.products.indexOf(page.product) < 0) {
      page.product = subcategory.products[0];
    }
    productSelect.value = page.product;
  }

  function fillCitySelect(select) {
    var cities = NZX_APP.cities();
    if (!cities.length) {
      select.innerHTML = '<option value="' + page.city + '">' + page.city + "</option>";
      select.value = page.city;
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
    select.value = page.city;
  }

  function bindEvents() {
    document.getElementById("query-category").addEventListener("change", function () {
      var category = NZX_APP.catalog().find(function (item) {
        return item.name === this.value;
      }.bind(this)) || NZX_APP.catalog()[0];
      fillSubcategorySelect(category);
      render();
    });
    document.getElementById("query-subcategory").addEventListener("change", function () {
      var category = NZX_APP.catalog().find(function (item) {
        return item.name === document.getElementById("query-category").value;
      }) || NZX_APP.catalog()[0];
      var subcategory = category.children.find(function (item) {
        return item.name === this.value;
      }.bind(this)) || category.children[0];
      fillProductSelect(subcategory);
      render();
    });
    document.getElementById("query-product").addEventListener("change", function () {
      page.product = this.value;
      render();
    });
    document.getElementById("query-button").addEventListener("click", function () {
      page.city = document.getElementById("query-city").value;
      page.limit = Number(document.getElementById("query-range").value);
      render();
    });
    document.getElementById("download-button").addEventListener("click", downloadCsv);
  }

  function setLoading(loading) {
    var button = document.getElementById("query-button");
    button.disabled = loading;
    button.textContent = loading ? "查询中…" : "查询";
  }

  function render() {
    setLoading(true);
    NZX_DATA_API.prices(page.product, page.limit, page.city).then(function (result) {
      if (!result.items || !result.items.length) {
        return NZX_DATA_API.prices(page.product, Math.max(page.limit, 20), "").then(function (national) {
          page.rows = national.items || [];
          page.chartRows = page.rows;
          page.chartSupplement = false;
          return national;
        });
      }

      page.rows = result.items || [];
      page.chartRows = page.rows;
      page.chartSupplement = false;
      if (page.rows.length < 2 && !result.fallback) {
        return NZX_DATA_API.prices(page.product, Math.max(page.limit, 20), "").then(function (national) {
          page.chartRows = (national.items || []).slice(0, Math.max(page.limit, 20));
          page.chartSupplement = page.chartRows.length > 1;
          return result;
        });
      }
      return result;
    }).then(function (result) {
      page.source = result.source || "全国农产品批发市场价格信息系统";
      page.fallback = result.fallback;
      page.fallbackCategory = result.fallbackCategory || "";
      page.referenceProduct = result.referenceProduct || "";
      page.nationalFallback = page.fallback || !page.rows.every(function (item) {
        return containsCity(item.place || item.sourceMarket || "", page.city);
      });
      renderResult();
    }).catch(function () {
      page.rows = [];
      page.chartRows = [];
      page.chartSupplement = false;
      page.source = "";
      renderResult();
      NZX_APP.showToast("实时行情暂时不可用", "error");
    }).finally(function () {
      setLoading(false);
    });
  }

  function renderResult() {
    document.getElementById("range-label").textContent = String(page.limit);
    document.getElementById("chart-subtitle").textContent = page.product + " · " +
      (page.chartSupplement
        ? page.city + "本地行情不足，曲线已补充全国市场"
        : page.fallbackCategory
        ? page.city + "暂无该品种本地报价，显示" + page.fallbackCategory + "全国市场"
        : page.nationalFallback
          ? page.city + "暂无本地报价，显示全国市场"
          : page.city + "实时行情");
    renderChart();
    renderSummary();
    renderTable();
  }

  function renderChart() {
    var container = document.getElementById("query-chart");
    if (!page.rows.length) {
      container.innerHTML = '<div class="empty-state">当前没有可用报价</div>';
      return;
    }
    var chartRows = page.chartRows.length ? page.chartRows : page.rows;
    var points = chartRows.map(function (item, index) {
      return {
        value: Number(item.avgPrice),
        date: shortMarket(item.place || item.sourceMarket || "市场" + (index + 1))
      };
    });
    NZX_CHARTS.lineChart(container, {
      title: page.product + "实时批发价对比",
      series: [{ color: "#0f766e", points: points }]
    });
  }

  function renderSummary() {
    var values = page.rows.map(function (item) { return Number(item.avgPrice); });
    if (!values.length) {
      document.getElementById("query-latest").textContent = "--";
      document.getElementById("query-min").textContent = "--";
      document.getElementById("query-max").textContent = "--";
      document.getElementById("query-insights").innerHTML = "";
      return;
    }
    var latest = values[0];
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var first = page.rows[0] || {};
    document.getElementById("query-latest").textContent = latest.toFixed(2);
    document.getElementById("query-min").textContent = min.toFixed(2);
    document.getElementById("query-max").textContent = max.toFixed(2);
    document.getElementById("query-insights").innerHTML = [
      insight("价格单位", first.unit || NZX_APP.product(page.product).unit),
      insight("报价市场数", String(page.rows.length)),
      insight("价差幅度", ((max - min) / Math.max(min, 0.01) * 100).toFixed(1) + "%"),
      insight("数据来源", page.source)
    ].join("");
  }

  function renderTable() {
    var body = document.getElementById("query-body");
    body.innerHTML = page.rows.map(function (item) {
      var low = Number(item.lowPrice);
      var high = Number(item.highPrice);
      var range = low > 0 && high > 0 ? low.toFixed(2) + " - " + high.toFixed(2) : "—";
      return [
        "<tr>",
        "<td>" + escapeHtml(item.name || page.product) +
          (page.fallbackCategory
            ? ' <span class="fallback-tag">同分类回退' +
              (page.referenceProduct ? " · 参考" + page.referenceProduct : "") + "</span>"
            : page.nationalFallback ? ' <span class="fallback-tag">全国回退</span>' : "") + "</td>",
        "<td>" + escapeHtml(item.place || item.sourceMarket || page.source) + "</td>",
        "<td>" + escapeHtml(item.avgPrice) + "</td>",
        "<td>" + escapeHtml(item.unit || NZX_APP.product(page.product).unit) + "</td>",
        "<td>" + escapeHtml(range) + "</td>",
        '<td class="positive">实时</td>',
        "</tr>"
      ].join("");
    }).join("");
    document.getElementById("query-count").textContent = "共 " + page.rows.length + " 条实时报价";
    document.getElementById("query-empty").hidden = page.rows.length > 0;
    document.getElementById("query-pager").innerHTML = "";
  }

  function downloadCsv() {
    var rows = ["产品,市场,均价,单位,价格区间,发布日期"];
    page.rows.forEach(function (item) {
      rows.push([
        item.name || page.product,
        item.place || item.sourceMarket || "",
        item.avgPrice || "",
        item.unit || NZX_APP.product(page.product).unit,
        (item.lowPrice && item.highPrice ? item.lowPrice + "-" + item.highPrice : ""),
        item.pubDate || ""
      ].join(","));
    });
    var blob = new Blob(["\ufeff" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = page.product + "-" + page.city + "-实时行情.csv";
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 500);
  }

  function shortMarket(market) {
    return String(market)
      .replace("有限公司", "")
      .replace("批发市场", "")
      .replace("农产品", "")
      .replace("市场经营管理", "")
      .slice(0, 12);
  }

  function containsCity(text, city) {
    var normalized = String(city).replace(/(省|市|自治区)$/, "");
    return String(text).indexOf(String(city)) >= 0 || String(text).indexOf(normalized) >= 0;
  }

  function insight(label, value) {
    return "<li><span>" + label + "</span><strong>" + escapeHtml(value) + "</strong></li>";
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
