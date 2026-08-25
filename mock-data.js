(function () {
  "use strict";

  var PRODUCTS = [
    { name: "土豆", category: "蔬菜", unit: "元/公斤", base: 2.6, volatility: 0.08, season: 0.1 },
    { name: "番茄", category: "蔬菜", unit: "元/公斤", base: 4.2, volatility: 0.13, season: 0.4 },
    { name: "黄瓜", category: "蔬菜", unit: "元/公斤", base: 3.8, volatility: 0.12, season: 0.35 },
    { name: "大白菜", category: "蔬菜", unit: "元/公斤", base: 1.5, volatility: 0.09, season: 0.25 },
    { name: "小白菜", category: "蔬菜", unit: "元/公斤", base: 3.1, volatility: 0.1, season: 0.2 },
    { name: "菠菜", category: "蔬菜", unit: "元/公斤", base: 4.6, volatility: 0.11, season: 0.3 },
    { name: "生菜", category: "蔬菜", unit: "元/公斤", base: 3.4, volatility: 0.1, season: 0.18 },
    { name: "芹菜", category: "蔬菜", unit: "元/公斤", base: 3.7, volatility: 0.09, season: 0.22 },
    { name: "韭菜", category: "蔬菜", unit: "元/公斤", base: 4.1, volatility: 0.11, season: 0.26 },
    { name: "茄子", category: "蔬菜", unit: "元/公斤", base: 3.9, volatility: 0.12, season: 0.3 },
    { name: "青椒", category: "蔬菜", unit: "元/公斤", base: 5.2, volatility: 0.13, season: 0.35 },
    { name: "红椒", category: "蔬菜", unit: "元/公斤", base: 7.5, volatility: 0.16, season: 0.32 },
    { name: "白萝卜", category: "蔬菜", unit: "元/公斤", base: 1.8, volatility: 0.08, season: 0.2 },
    { name: "胡萝卜", category: "蔬菜", unit: "元/公斤", base: 3.2, volatility: 0.09, season: 0.15 },
    { name: "冬瓜", category: "蔬菜", unit: "元/公斤", base: 2.2, volatility: 0.08, season: 0.2 },
    { name: "南瓜", category: "蔬菜", unit: "元/公斤", base: 2.9, volatility: 0.08, season: 0.18 },
    { name: "西葫芦", category: "蔬菜", unit: "元/公斤", base: 3.5, volatility: 0.1, season: 0.28 },
    { name: "西兰花", category: "蔬菜", unit: "元/公斤", base: 5.8, volatility: 0.13, season: 0.3 },
    { name: "菜花", category: "蔬菜", unit: "元/公斤", base: 4.3, volatility: 0.11, season: 0.28 },
    { name: "豆角", category: "蔬菜", unit: "元/公斤", base: 6.4, volatility: 0.15, season: 0.38 },
    { name: "豇豆", category: "蔬菜", unit: "元/公斤", base: 5.6, volatility: 0.14, season: 0.36 },
    { name: "蒜薹", category: "蔬菜", unit: "元/公斤", base: 6.8, volatility: 0.16, season: 0.3 },
    { name: "洋葱", category: "蔬菜", unit: "元/公斤", base: 2.5, volatility: 0.09, season: 0.12 },
    { name: "大葱", category: "蔬菜", unit: "元/公斤", base: 3.8, volatility: 0.11, season: 0.22 },
    { name: "生姜", category: "蔬菜", unit: "元/公斤", base: 9.6, volatility: 0.17, season: 0.25 },
    { name: "大蒜", category: "蔬菜", unit: "元/公斤", base: 8.8, volatility: 0.16, season: 0.2 },
    { name: "山药", category: "蔬菜", unit: "元/公斤", base: 7.2, volatility: 0.1, season: 0.15 },
    { name: "莲藕", category: "蔬菜", unit: "元/公斤", base: 6.5, volatility: 0.11, season: 0.2 },
    { name: "莴笋", category: "蔬菜", unit: "元/公斤", base: 3.6, volatility: 0.1, season: 0.2 },
    { name: "娃娃菜", category: "蔬菜", unit: "元/公斤", base: 4.8, volatility: 0.1, season: 0.18 },
    { name: "豌豆苗", category: "蔬菜", unit: "元/公斤", base: 6.9, volatility: 0.14, season: 0.3 },
    { name: "香菇", category: "菌菇", unit: "元/公斤", base: 12.5, volatility: 0.12, season: 0.12 },
    { name: "平菇", category: "菌菇", unit: "元/公斤", base: 7.8, volatility: 0.11, season: 0.15 },
    { name: "金针菇", category: "菌菇", unit: "元/公斤", base: 5.7, volatility: 0.1, season: 0.12 },
    { name: "苹果", category: "水果", unit: "元/公斤", base: 6.8, volatility: 0.12, season: 0.18 },
    { name: "香蕉", category: "水果", unit: "元/公斤", base: 4.5, volatility: 0.1, season: 0.14 },
    { name: "橙子", category: "水果", unit: "元/公斤", base: 7.2, volatility: 0.12, season: 0.2 },
    { name: "梨", category: "水果", unit: "元/公斤", base: 5.6, volatility: 0.11, season: 0.2 },
    { name: "葡萄", category: "水果", unit: "元/公斤", base: 9.8, volatility: 0.16, season: 0.36 },
    { name: "西瓜", category: "水果", unit: "元/公斤", base: 3.4, volatility: 0.17, season: 0.45 },
    { name: "草莓", category: "水果", unit: "元/公斤", base: 20.0, volatility: 0.2, season: 0.45 },
    { name: "桃", category: "水果", unit: "元/公斤", base: 8.8, volatility: 0.16, season: 0.38 },
    { name: "李子", category: "水果", unit: "元/公斤", base: 7.5, volatility: 0.15, season: 0.38 },
    { name: "樱桃", category: "水果", unit: "元/公斤", base: 32.0, volatility: 0.22, season: 0.42 },
    { name: "猕猴桃", category: "水果", unit: "元/公斤", base: 8.2, volatility: 0.15, season: 0.3 },
    { name: "火龙果", category: "水果", unit: "元/公斤", base: 8.5, volatility: 0.14, season: 0.2 },
    { name: "芒果", category: "水果", unit: "元/公斤", base: 10.5, volatility: 0.18, season: 0.35 },
    { name: "菠萝", category: "水果", unit: "元/公斤", base: 6.2, volatility: 0.16, season: 0.3 },
    { name: "大米", category: "粮油", unit: "元/公斤", base: 4.8, volatility: 0.04, season: 0.02 },
    { name: "面粉", category: "粮油", unit: "元/公斤", base: 4.3, volatility: 0.04, season: 0.02 },
    { name: "玉米", category: "粮油", unit: "元/公斤", base: 2.9, volatility: 0.06, season: 0.08 },
    { name: "花生", category: "粮油", unit: "元/公斤", base: 8.8, volatility: 0.1, season: 0.12 },
    { name: "鸡蛋", category: "肉禽蛋", unit: "元/公斤", base: 9.2, volatility: 0.11, season: 0.1 },
    { name: "猪肉", category: "肉禽蛋", unit: "元/公斤", base: 24.0, volatility: 0.13, season: 0.15 },
    { name: "牛肉", category: "肉禽蛋", unit: "元/公斤", base: 72.0, volatility: 0.08, season: 0.05 },
    { name: "羊肉", category: "肉禽蛋", unit: "元/公斤", base: 66.0, volatility: 0.1, season: 0.12 },
    { name: "鸡肉", category: "肉禽蛋", unit: "元/公斤", base: 18.0, volatility: 0.1, season: 0.08 },
    { name: "鸭肉", category: "肉禽蛋", unit: "元/公斤", base: 17.0, volatility: 0.11, season: 0.09 },
    { name: "草鱼", category: "水产", unit: "元/公斤", base: 18.5, volatility: 0.12, season: 0.15 },
    { name: "鲫鱼", category: "水产", unit: "元/公斤", base: 19.8, volatility: 0.13, season: 0.15 },
    { name: "基围虾", category: "水产", unit: "元/公斤", base: 48.0, volatility: 0.18, season: 0.22 },
    { name: "牛奶", category: "副食", unit: "元/升", base: 10.0, volatility: 0.05, season: 0.02 }
  ];

  var MARKETS = ["成都某批发市场", "成都东区市场", "成都西区市场"];

  function hashString(value) {
    var hash = 2166136261;
    for (var i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    var state = seed >>> 0 || 1;
    return function () {
      state += 0x6D2B79F5;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dateKey(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function addDays(date, days) {
    var next = new Date(date.getTime());
    next.setDate(next.getDate() + days);
    return next;
  }

  function productById(name) {
    return PRODUCTS.find(function (item) { return item.name === name; }) || PRODUCTS[0];
  }

  function marketIndex(name) {
    var index = MARKETS.indexOf(name);
    return index < 0 ? 0 : index;
  }

  function priceFor(productName, marketName, date, index) {
    var product = productById(productName);
    var marketOffset = marketIndex(marketName) * 0.045;
    var dayIndex = Math.floor(date.getTime() / 86400000);
    var seed = hashString(product.name + "|" + marketName + "|" + dateKey(date));
    var random = seededRandom(seed);
    var cycle = Math.sin((dayIndex / 73) + product.season * 12) * product.base * product.season;
    var drift = Math.sin((dayIndex / 210) + (hashString(product.name) % 17)) * product.base * 0.08;
    var noise = (random() - 0.5) * product.base * product.volatility;
    var level = product.base * (1 + marketOffset) + cycle + drift + noise;
    if (typeof index === "number") {
      level += Math.sin(index / 7) * product.base * 0.012;
    }
    return Math.max(0.1, Math.round(level * 100) / 100);
  }

  function priceSeries(productName, marketName, days) {
    var result = [];
    var end = new Date();
    end.setHours(0, 0, 0, 0);
    var start = addDays(end, -(days - 1));
    for (var i = 0; i < days; i++) {
      var date = addDays(start, i);
      var price = priceFor(productName, marketName, date, i);
      var previous = i > 0 ? result[i - 1].price : null;
      result.push({
        date: dateKey(date),
        price: price,
        change: previous === null ? 0 : Math.round((price - previous) * 100) / 100
      });
    }
    return result;
  }

  function forecast(productName, marketName) {
    var historical = priceSeries(productName, marketName, 30);
    var product = productById(productName);
    var last = historical[historical.length - 1].price;
    var recentChange = historical[historical.length - 1].price - historical[historical.length - 8].price;
    var direction = recentChange > 0 ? 0.0035 : -0.0035;
    var forecast = [];
    var end = new Date();
    end.setHours(0, 0, 0, 0);
    for (var i = 1; i <= 14; i++) {
      var date = addDays(end, i);
      var seed = hashString(product.name + "|" + marketName + "|forecast|" + dateKey(date));
      var random = seededRandom(seed);
      var value = last + (direction * product.base * 0.08 * i) + (random() - 0.5) * product.base * product.volatility * 0.6;
      forecast.push({
        date: dateKey(date),
        price: Math.max(0.1, Math.round(value * 100) / 100),
        lower: Math.max(0.1, Math.round((value - product.base * product.volatility * (0.8 + i * 0.08)) * 100) / 100),
        upper: Math.round((value + product.base * product.volatility * (0.8 + i * 0.08)) * 100) / 100
      });
    }

    var predictedChange = (forecast[6].price - last) / last * 100;
    var volatilityScore = Math.min(35, Math.round(product.volatility * 180));
    var signalScore = predictedChange < -2 ? 25 : predictedChange < 0 ? 14 : predictedChange > 3 ? 8 : 5;
    var score = Math.max(5, Math.min(96, Math.round(Math.abs(Math.min(predictedChange, 0)) * 4) + volatilityScore + signalScore));
    var level = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
    return {
      product: product,
      market: marketName,
      historical: historical,
      forecast: forecast,
      lastPrice: last,
      predictedChange: Math.round(predictedChange * 10) / 10,
      score: score,
      level: level,
      mape: Math.round((6 + product.volatility * 65 + hashString(product.name) % 7) * 10) / 10,
      rmse: Math.round(product.base * (0.08 + product.volatility * 0.5) * 100) / 100,
      model: product.volatility > 0.17 ? "Prophet" : "ARIMA",
      updatedAt: dateKey(end) + " 10:20"
    };
  }

  function latestAlerts() {
    return PRODUCTS.slice(0, 12).map(function (product, index) {
      var market = MARKETS[index % MARKETS.length];
      var result = forecast(product.name, market);
      return {
        id: "AL-" + product.name + "-" + index,
        product: product.name,
        market: market,
        score: result.score,
        level: result.level,
        reason: result.predictedChange < -1
          ? "未来 7 日预测跌幅约 " + Math.abs(result.predictedChange) + "%，价格波动上升。"
          : "近期价格波动值得关注，暂未出现明显滞销风险。",
        updatedAt: result.updatedAt,
        predictedChange: result.predictedChange,
        prediction: result.forecast
      };
      }).sort(function (a, b) { return b.score - a.score; }).slice(0, 12);
  }

  function adminLogs() {
    var seed = hashString("admin-log");
    var random = seededRandom(seed);
    var logs = [];
    for (var i = 0; i < 12; i++) {
      logs.push({
        time: "2026-08-23 " + String(9 + Math.floor(random() * 5)).padStart(2, "0") + ":" + String(Math.floor(random() * 60)).padStart(2, "0"),
        action: i % 3 === 0 ? "API 刷新" : i % 3 === 1 ? "模型训练" : "CSV 导入",
        result: i % 5 === 0 ? "部分异常" : "成功",
        detail: "数据记录 " + (180 + i * 3) + " 条"
      });
    }
    return logs;
  }

  window.NZX_DATA = {
    PRODUCTS: PRODUCTS,
    MARKETS: MARKETS,
    priceSeries: priceSeries,
    forecast: forecast,
    latestAlerts: latestAlerts,
    adminLogs: adminLogs,
    productById: productById
  };
})();
