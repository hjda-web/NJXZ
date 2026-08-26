(function () {
  "use strict";

  var API_BASE = "https://dtmgzhiojlhrlqwczhxs.supabase.co/functions/v1/nzx-api";

  function request(url, options) {
    options = Object.assign({ credentials: "include" }, options || {});
    return fetch(API_BASE + url, options).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (data) {
        if (!response.ok) {
          var error = new Error(data.message || "request_failed");
          error.code = response.status;
          throw error;
        }
        return data;
      });
    });
  }

  function weather(city) {
    return request("/api/weather?city=" + encodeURIComponent(city || "成都市"));
  }

  function prices(keyword, limit, city) {
    var query = "/api/prices?keyword=" + encodeURIComponent(keyword || "");
    if (limit) {
      query += "&limit=" + Number(limit);
    }
    if (city) {
      query += "&city=" + encodeURIComponent(city);
    }
    return request(query);
  }

  function forecast(product, city, days) {
    return request("/api/forecast?product=" + encodeURIComponent(product || "") +
      "&city=" + encodeURIComponent(city || "成都市") +
      "&days=" + Number(days || 7));
  }

  function catalog() {
    return request("/api/catalog");
  }

  function post(url, body) {
    return request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
  }

  function groups() {
    return request("/api/groups");
  }

  function createGroup(name) {
    return post("/api/groups", { name: name });
  }

  function deleteGroup(groupId) {
    return post("/api/groups/delete", { groupId: groupId });
  }

  function addGroupMember(groupId, phone) {
    return post("/api/groups/members/add", { groupId: groupId, phone: phone });
  }

  function removeGroupMember(groupId, phone) {
    return post("/api/groups/members/remove", { groupId: groupId, phone: phone });
  }

  function setGroupAdmin(groupId, phone) {
    return post("/api/groups/admin", { groupId: groupId, phone: phone });
  }

  function leaveGroup(groupId) {
    return post("/api/groups/leave", { groupId: groupId });
  }

  function setGroupRecommendations(groupId, phone, products) {
    return post("/api/groups/recommendations", {
      groupId: groupId,
      phone: phone,
      products: products
    });
  }

  function myGroup() {
    return request("/api/my-group");
  }

  function groupRecommendProducts(city) {
    return request("/api/group-recommend-products?city=" + encodeURIComponent(city || "成都市"));
  }

  function risks(city, limit) {
    return request("/api/risks?city=" + encodeURIComponent(city || "成都市") +
      "&limit=" + Number(limit || 12));
  }

  function regionCrops(province) {
    return request("/api/region-crops?province=" + encodeURIComponent(province || ""));
  }

  function solarTerm(date) {
    return request("/api/solar-term?date=" + encodeURIComponent(date || ""));
  }

  function fertilizerRules() {
    return request("/api/fertilizer-rules");
  }

  function fertilizerPrices() {
    return request("/api/fertilizer-prices");
  }

  function groupMessages() {
    return request("/api/group-messages");
  }

  function createGroupMessage(content) {
    return post("/api/group-messages", { content: content });
  }

  function deleteGroupMessage(id) {
    return post("/api/group-messages/delete", { id: id });
  }

  function adminRegionCrops() {
    return request("/api/admin/region-crops");
  }

  function saveRegionCrops(province, crops) {
    return post("/api/admin/region-crops", { province: province, crops: crops });
  }

  function deleteRegionCrops(province) {
    return request("/api/admin/region-crops", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ province: province })
    });
  }

  function adminSolarTerms() {
    return request("/api/admin/solar-terms");
  }

  function saveSolarTerm(term, tasks) {
    return post("/api/admin/solar-terms", { term: term, tasks: tasks });
  }

  function deleteSolarTerm(term) {
    return request("/api/admin/solar-terms", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: term })
    });
  }

  function adminFertilizerRules() {
    return request("/api/admin/fertilizer-rules");
  }

  function saveFertilizerRule(crop, fertilizers) {
    return post("/api/admin/fertilizer-rules", { crop: crop, fertilizers: fertilizers });
  }

  function deleteFertilizerRule(crop) {
    return request("/api/admin/fertilizer-rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crop: crop })
    });
  }

  function adminFertilizerPrices() {
    return request("/api/admin/fertilizer-prices");
  }

  function saveFertilizerPrice(fertilizer, minPrice, maxPrice, unit) {
    return post("/api/admin/fertilizer-prices", {
      fertilizer: fertilizer,
      minPrice: minPrice,
      maxPrice: maxPrice,
      unit: unit
    });
  }

  function deleteFertilizerPrice(fertilizer) {
    return request("/api/admin/fertilizer-prices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fertilizer: fertilizer })
    });
  }

  function formatDate(value) {
    if (value === null || value === undefined || value === "") {
      return "--";
    }
    if (typeof value === "number") {
      value = new Date(value);
    } else if (typeof value === "string") {
      var dotNetDate = /^\/Date\((\d+)(?:[+-]\d{4})?\)\/$/.exec(value);
      value = dotNetDate ? new Date(Number(dotNetDate[1])) : new Date(value);
    }
    if (!(value instanceof Date) || isNaN(value.getTime())) {
      return "--";
    }
    return value.toLocaleString("zh-CN", { hour12: false });
  }

  window.NZX_DATA_API = {
    weather: weather,
    prices: prices,
    forecast: forecast,
    risks: risks,
    catalog: catalog,
    groups: groups,
    createGroup: createGroup,
    deleteGroup: deleteGroup,
    addGroupMember: addGroupMember,
    removeGroupMember: removeGroupMember,
    setGroupAdmin: setGroupAdmin,
    leaveGroup: leaveGroup,
    setGroupRecommendations: setGroupRecommendations,
    myGroup: myGroup,
    groupRecommendProducts: groupRecommendProducts,
    regionCrops: regionCrops,
    solarTerm: solarTerm,
    fertilizerRules: fertilizerRules,
    fertilizerPrices: fertilizerPrices,
    groupMessages: groupMessages,
    createGroupMessage: createGroupMessage,
    deleteGroupMessage: deleteGroupMessage,
    adminRegionCrops: adminRegionCrops,
    saveRegionCrops: saveRegionCrops,
    deleteRegionCrops: deleteRegionCrops,
    adminSolarTerms: adminSolarTerms,
    saveSolarTerm: saveSolarTerm,
    deleteSolarTerm: deleteSolarTerm,
    adminFertilizerRules: adminFertilizerRules,
    saveFertilizerRule: saveFertilizerRule,
    deleteFertilizerRule: deleteFertilizerRule,
    adminFertilizerPrices: adminFertilizerPrices,
    saveFertilizerPrice: saveFertilizerPrice,
    deleteFertilizerPrice: deleteFertilizerPrice,
    formatDate: formatDate
  };
})();
