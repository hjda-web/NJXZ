(function () {
  "use strict";

  var SITE = {
    user: null,
    ready: false,
    config: null,
    loginMode: "login",
    pendingPhone: "",
    cities: [],
    catalog: [],
    products: [],
    productMap: {},
    guestCity: localStorage.getItem("nzx_guest_city") || "成都市"
  };

  var SHELL_ID = "site-header";
  var LOGIN_DIALOG_ID = "login-dialog";
  var PROFILE_DIALOG_ID = "profile-dialog";
  var TOAST_ID = "toast-region";
  var API_BASE = "https://nzx-api.REPLACE_WITH_SUBDOMAIN.workers.dev";
  var IDENTITIES = [
    { value: "individual", label: "个体户（普通农户）" },
    { value: "consumer", label: "消费者" },
    { value: "village_head", label: "村支书" },
    { value: "cooperative_leader", label: "合作社负责人" }
  ];

  document.addEventListener("DOMContentLoaded", function () {
    document.body.classList.add("page-transition-in");
    window.setTimeout(function () {
      document.body.classList.remove("page-transition-in");
    }, 360);
    injectShell();
    injectLoginDialog();
    injectProfileDialog();
    bindGlobalEvents();
    bootstrap();
  });

  function bootstrap() {
    var config = window.SITE_CONFIG || {
      page: "home",
      requiresAuth: false,
      requiresAdmin: false,
      render: function () {}
    };
    SITE.config = config;
    setActiveNav(config.page);
    Promise.all([loadCities(), checkSession(), loadCatalog()]).then(function () {
      if (config.requiresAdmin && (!SITE.user || SITE.user.role !== "admin")) {
        openLogin(true);
        return;
      }
      if (config.requiresAuth && !SITE.user) {
        openLogin(true);
        return;
      }
      SITE.ready = true;
      if (typeof config.render === "function") {
        config.render();
      }
    }).catch(function () {
      if (config.requiresAuth || config.requiresAdmin) {
        openLogin(true);
      } else {
        SITE.ready = true;
        if (typeof config.render === "function") {
          config.render();
        }
      }
    });
  }

  function injectShell() {
    var header = document.getElementById(SHELL_ID);
    if (!header) {
      header = document.createElement("header");
      header.id = SHELL_ID;
      header.className = "app-header";
      document.body.insertBefore(header, document.body.firstChild);
    }
    header.className = "app-header";
    header.innerHTML = [
      '<div class="brand">',
      '<span class="brand-mark">农</span>',
      '<span class="brand-name">农价先知</span>',
      '<span class="brand-tag">农产品价格预测平台</span>',
      '</div>',
      '<nav class="main-nav" aria-label="主导航">',
      '<a class="nav-link" data-nav="home" href="/NJXZ/home.html">首页</a>',
      '<a class="nav-link" data-nav="query" href="/NJXZ/query.html">价格查询</a>',
      '<a class="nav-link" data-nav="prediction" href="/NJXZ/prediction.html">价格预测</a>',
      '<a class="nav-link" data-nav="alerts" href="/NJXZ/alerts.html">风险预警</a>',
      '<a class="nav-link group-only" data-nav="group" href="/NJXZ/group.html">组队合作</a>',
      '<a class="nav-link admin-only" data-nav="admin" href="/NJXZ/admin.html">管理后台</a>',
      '</nav>',
      '<div class="account-area" id="account-area"></div>'
    ].join("");
    renderAccountArea();
  }

  function renderAccountArea() {
    var area = document.getElementById("account-area");
    if (!area) {
      return;
    }

    var adminLink = document.querySelector('.nav-link[data-nav="admin"]');
    if (adminLink) {
      adminLink.style.display = SITE.user && SITE.user.role === "admin" ? "" : "none";
    }
    var groupLink = document.querySelector('.nav-link[data-nav="group"]');
    if (groupLink) {
      groupLink.style.display = SITE.user && (
        SITE.user.identity === "village_head" ||
        SITE.user.identity === "cooperative_leader" ||
        SITE.user.groupAdmin
      ) ? "" : "none";
    }
    applyFontMode();

    if (SITE.user) {
      var avatar = SITE.user.role === "admin" ? "管" : identityShort(SITE.user.identity);
      area.innerHTML = [
        '<button class="account-chip account-profile-button" id="account-profile" type="button">',
        '<span class="account-avatar">' + avatar + "</span>",
        '<span class="account-meta">',
        "<strong>" + escapeHtml(SITE.user.nickname || (SITE.user.role === "admin" ? "管理员" : "用户" + SITE.user.maskedPhone.slice(-4))) + "</strong>",
        "<small>" + escapeHtml(SITE.user.city || "成都市") + " · " + escapeHtml(identityLabel(SITE.user.identity)) + "</small>",
        "</span>",
        "</button>",
        '<button class="icon-button" id="logout-button" type="button">退出</button>'
      ].join("");
      document.getElementById("account-profile").addEventListener("click", openProfile);
      var logout = document.getElementById("logout-button");
      if (logout) {
        logout.addEventListener("click", logoutAction);
      }
    } else {
      area.innerHTML = [
        '<button class="account-chip account-profile-button" id="account-profile" type="button">',
        '<span class="account-avatar">游</span>',
        '<span class="account-meta"><strong>游客</strong><small>' + escapeHtml(SITE.guestCity) + '</small></span>',
        "</button>",
        '<button class="login-button" id="header-login" type="button">登录 / 注册</button>'
      ].join("");
      document.getElementById("account-profile").addEventListener("click", openProfile);
      var loginButton = document.getElementById("header-login");
      if (loginButton) {
        loginButton.addEventListener("click", function () { openLogin(false); });
      }
    }
  }

  function injectLoginDialog() {
    if (document.getElementById(LOGIN_DIALOG_ID)) {
      return;
    }
    var dialog = document.createElement("dialog");
    dialog.className = "login-dialog";
    dialog.id = LOGIN_DIALOG_ID;
    dialog.innerHTML = [
      '<form id="login-form" novalidate>',
      '<div class="dialog-head">',
      '<div><p class="eyebrow">账号入口</p><h2 id="login-title">手机号登录</h2></div>',
      '<button class="dialog-close" id="login-close" type="button" aria-label="关闭">×</button>',
      "</div>",
      '<label class="login-field">',
      "<span>手机号</span>",
      '<div class="phone-wrap"><span class="phone-prefix">+86</span><input id="login-phone" name="phone" type="tel" inputmode="numeric" maxlength="11" autocomplete="username" placeholder="11 位手机号"></div>',
      '<small class="field-error" id="phone-error"></small>',
      "</label>",
      '<label class="login-field">',
      "<span>所在城市</span>",
      '<select id="login-city"></select>',
      '<small class="field-error" id="city-error"></small>',
      "</label>",
      '<label class="login-field">',
      "<span>身份选择</span>",
      '<select id="login-identity"></select>',
      '<small class="field-error" id="identity-error"></small>',
      "</label>",
      '<label class="login-field">',
      "<span>密码</span>",
      '<input id="login-password" name="password" type="password" maxlength="20" autocomplete="current-password" placeholder="请输入密码">',
      '<small class="field-error" id="password-error"></small>',
      "</label>",
      '<label class="login-field register-only" id="confirm-field">',
      "<span>确认密码</span>",
      '<input id="login-confirm" name="confirm" type="password" maxlength="6" autocomplete="new-password" placeholder="再次输入 6 位密码">',
      '<small class="field-error" id="confirm-error"></small>',
      "</label>",
      '<p class="login-error" id="login-error" role="alert"></p>',
      '<button class="primary-button login-submit" id="login-submit" type="submit">登录</button>',
      '<p class="login-foot" id="login-foot">未注册手机号将在首次登录时设置 6 位数字密码</p>',
      "</form>"
    ].join("");
    document.body.appendChild(dialog);

    document.getElementById("login-identity").innerHTML = IDENTITIES.map(function (identity) {
      return '<option value="' + identity.value + '">' + identity.label + "</option>";
    }).join("");

    var form = document.getElementById("login-form");
    form.addEventListener("submit", handleLogin);
    document.getElementById("login-close").addEventListener("click", function () {
      if (!SITE.config || (!SITE.config.requiresAuth && !SITE.config.requiresAdmin)) {
        closeLogin();
      }
    });
    document.getElementById("login-phone").addEventListener("input", function () {
      this.value = this.value.replace(/\D/g, "").slice(0, 11);
      clearLoginErrors();
    });
    document.getElementById("login-password").addEventListener("input", clearLoginErrors);
    document.getElementById("login-confirm").addEventListener("input", clearLoginErrors);
  }

  function injectProfileDialog() {
    if (document.getElementById(PROFILE_DIALOG_ID)) {
      return;
    }
    var dialog = document.createElement("dialog");
    dialog.className = "login-dialog";
    dialog.id = PROFILE_DIALOG_ID;
    dialog.innerHTML = [
      '<form id="profile-form" novalidate>',
      '<div class="dialog-head"><div><p class="eyebrow">个人中心</p><h2 id="profile-title">游客</h2></div>',
      '<button class="dialog-close" id="profile-close" type="button" aria-label="关闭">×</button></div>',
      '<label class="login-field profile-nickname-field"><span>昵称</span>',
      '<input id="profile-nickname" type="text" maxlength="20" autocomplete="nickname" placeholder="2 至 20 个字符">',
      '<small class="field-error" id="profile-nickname-error"></small></label>',
      '<label class="login-field"><span>所在城市</span><select id="profile-city"></select>',
      '<small class="field-error" id="profile-city-error"></small></label>',
      '<label class="login-field profile-font-field"><span>字体大小</span><select id="profile-font">',
      '<option value="normal">普通字号</option><option value="large">老年大字号</option>',
      '</select></label>',
      '<p class="login-error" id="profile-error" role="alert"></p>',
      '<button class="primary-button login-submit" id="profile-save" type="submit">保存设置</button>',
      '<button class="secondary-button login-submit profile-login-button" id="profile-login" type="button" style="display:none;width:100%;margin-top:8px;">登录 / 注册</button>',
      "</form>"
    ].join("");
    document.body.appendChild(dialog);
    document.getElementById("profile-form").addEventListener("submit", saveProfile);
    document.getElementById("profile-close").addEventListener("click", closeProfile);
    document.getElementById("profile-login").addEventListener("click", function () {
      closeProfile();
      openLogin(false);
    });
  }

  function bindGlobalEvents() {
    window.addEventListener("click", function (event) {
      if (event.target && event.target.matches && event.target.matches('[data-nav="admin"]') && SITE.user && SITE.user.role !== "admin") {
        event.preventDefault();
        showToast("该页面仅管理员可用", "error");
      }
    });
    document.addEventListener("click", function (event) {
      var link = event.target.closest('.nav-link[data-nav][href]');
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
      }
      if (link.hostname !== location.hostname || link.port !== location.port) {
        return;
      }
      event.preventDefault();
      document.body.classList.add("page-transition-out");
      window.setTimeout(function () {
        location.href = link.href;
      }, 170);
    });
  }

  function setActiveNav(page) {
    document.querySelectorAll(".nav-link[data-nav]").forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("data-nav") === page);
    });
  }

  function checkSession() {
    return api("/api/session").then(function (data) {
      SITE.user = data.user || data;
      renderAccountArea();
      applyFontMode();
      return SITE.user;
    }).catch(function () {
      SITE.user = null;
      renderAccountArea();
      return null;
    });
  }

  function loadCities() {
    if (SITE.cities.length) {
      fillCitySelects();
      return Promise.resolve(SITE.cities);
    }
    return api("/api/cities").then(function (cities) {
      SITE.cities = cities || [];
      fillCitySelects();
      return SITE.cities;
    }).catch(function () {
      return SITE.cities;
    });
  }

  function loadCatalog() {
    if (SITE.catalog.length) {
      indexCatalog();
      return Promise.resolve(SITE.catalog);
    }
    return api("/api/catalog").then(function (data) {
      SITE.catalog = (data && data.catalog && data.catalog.categories) || [];
      indexCatalog();
      return SITE.catalog;
    }).catch(function () {
      SITE.catalog = [];
      indexCatalog();
      return SITE.catalog;
    });
  }

  function indexCatalog() {
    SITE.products = [];
    SITE.productMap = {};
    SITE.catalog.forEach(function (category) {
      (category.children || []).forEach(function (subcategory) {
        (subcategory.products || []).forEach(function (name) {
          if (SITE.productMap[name]) {
            return;
          }
          var product = {
            name: name,
            category: category.name,
            subcategory: subcategory.name,
            unit: unitForProduct(category.name, name)
          };
          SITE.products.push(product);
          SITE.productMap[name] = product;
        });
      });
    });
  }

  function unitForProduct(category, name) {
    if (name === "牛奶") {
      return "元/升";
    }
    return "元/公斤";
  }

  function identityLabel(identity) {
    var item = IDENTITIES.find(function (option) { return option.value === identity; });
    return item ? item.label : (identity || "未设置身份");
  }

  function identityShort(identity) {
    if (identity === "village_head") return "村";
    if (identity === "cooperative_leader") return "社";
    if (identity === "consumer") return "消";
    return "农";
  }

  function applyFontMode() {
    document.body.classList.toggle("large-font", Boolean(
      SITE.user && SITE.user.identity === "individual" && SITE.user.largeFont
    ));
  }

  function fillCitySelects() {
    var citySelects = [document.getElementById("login-city"), document.getElementById("profile-city")];
    citySelects.forEach(function (select) {
      if (!select || select.options.length) {
        return;
      }
      var byProvince = {};
      SITE.cities.forEach(function (city) {
        if (!byProvince[city.province]) {
          byProvince[city.province] = [];
        }
        byProvince[city.province].push(city);
      });
      var html = "";
      Object.keys(byProvince).sort().forEach(function (province) {
        html += '<optgroup label="' + escapeHtml(province) + '">';
        byProvince[province].forEach(function (city) {
          html += '<option value="' + escapeHtml(city.name) + '">' + escapeHtml(city.name) + "</option>";
        });
        html += "</optgroup>";
      });
      select.innerHTML = html;
    });
    var currentCity = SITE.user && SITE.user.city ? SITE.user.city : SITE.guestCity;
    if (document.getElementById("login-city")) {
      document.getElementById("login-city").value = currentCity;
    }
    if (document.getElementById("profile-city")) {
      document.getElementById("profile-city").value = currentCity;
    }
  }

  function handleLogin(event) {
    event.preventDefault();
    clearLoginErrors();
    var phone = document.getElementById("login-phone").value.trim();
    var password = document.getElementById("login-password").value;
    var confirm = document.getElementById("login-confirm").value;
    var city = document.getElementById("login-city").value;
    var identity = document.getElementById("login-identity").value;
    var valid = true;

    if (!/^[0-9]{11}$/.test(phone)) {
      document.getElementById("phone-error").textContent = "请输入 11 位手机号";
      valid = false;
    }
    if (!password) {
      document.getElementById("password-error").textContent = "请输入密码";
      valid = false;
    }
    if (!city) {
      document.getElementById("city-error").textContent = "请选择所在城市";
      valid = false;
    }
    if (!identity) {
      document.getElementById("identity-error").textContent = "请选择身份";
      valid = false;
    }
    if (SITE.loginMode === "register") {
      if (!/^[0-9]{6}$/.test(password)) {
        document.getElementById("password-error").textContent = "密码必须是 6 位数字";
        valid = false;
      }
      if (password !== confirm) {
        document.getElementById("confirm-error").textContent = "两次密码不一致";
        valid = false;
      }
    }
    if (!valid) {
      return;
    }

    var submit = document.querySelector(".login-submit");
    submit.disabled = true;
    submit.textContent = "处理中…";
    api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone, password: password, city: city, identity: identity })
    }).then(function (data) {
      SITE.user = data.user;
      SITE.guestCity = data.user.city || city;
      localStorage.setItem("nzx_guest_city", SITE.guestCity);
      renderAccountArea();
      closeLogin();
      showToast("登录成功", "success");
      if (SITE.config && typeof SITE.config.render === "function") {
        SITE.config.render();
      } else {
        setTimeout(function () { location.reload(); }, 250);
      }
    }).catch(function (error) {
      submit.disabled = false;
      submit.textContent = SITE.loginMode === "register" ? "设置并登录" : "登录";
      if (error.code === 422 && error.data && error.data.message === "invalid_registration_password") {
        SITE.loginMode = "register";
        document.getElementById("login-title").textContent = "设置登录密码";
        document.getElementById("login-password").setAttribute("maxlength", "6");
        document.getElementById("login-password").placeholder = "设置 6 位数字密码";
        document.getElementById("confirm-field").classList.remove("register-only");
        document.getElementById("login-submit").textContent = "设置并登录";
        document.getElementById("login-foot").textContent = "首次登录将创建游客账号";
        document.getElementById("password-error").textContent = "请设置 6 位数字密码";
      } else if (error.code === 422) {
        document.getElementById("identity-error").textContent = "请选择身份";
      } else if (error.code === 400) {
        document.getElementById("phone-error").textContent = "手机号或城市信息不正确";
      } else if (error.code === 401) {
        document.getElementById("password-error").textContent = "密码不正确";
      } else {
        document.getElementById("login-error").textContent = error.message || "登录失败，请稍后重试";
      }
    });
  }

  function logoutAction() {
    api("/api/logout", { method: "POST" }).catch(function () {}).finally(function () {
      SITE.user = null;
      renderAccountArea();
      location.href = "/NJXZ/home.html";
    });
  }

  function openLogin(required) {
    var dialog = document.getElementById(LOGIN_DIALOG_ID);
    if (!dialog) {
      return;
    }
    if (SITE.user && (!required || SITE.user.role === "admin")) {
      return;
    }
    resetLoginForm();
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    setTimeout(function () {
      document.getElementById("login-phone").focus();
    }, 80);
  }

  function closeLogin() {
    var dialog = document.getElementById(LOGIN_DIALOG_ID);
    if (dialog && typeof dialog.close === "function") {
      dialog.close();
    } else if (dialog) {
      dialog.removeAttribute("open");
    }
  }

  function resetLoginForm() {
    SITE.loginMode = "login";
    document.getElementById("login-title").textContent = "手机号登录";
    document.getElementById("login-phone").value = "";
    document.getElementById("login-password").value = "";
    document.getElementById("login-password").removeAttribute("maxlength");
    document.getElementById("login-password").placeholder = "请输入密码";
    document.getElementById("login-confirm").value = "";
    document.getElementById("login-city").value = SITE.user && SITE.user.city ? SITE.user.city : SITE.guestCity;
    document.getElementById("login-identity").value = SITE.user && SITE.user.identity ? SITE.user.identity : "individual";
    document.getElementById("confirm-field").classList.add("register-only");
    document.getElementById("login-submit").textContent = "登录";
    document.getElementById("login-foot").textContent = "未注册手机号将在首次登录时设置 6 位数字密码";
    clearLoginErrors();
  }

  function clearLoginErrors() {
    document.getElementById("phone-error").textContent = "";
    document.getElementById("password-error").textContent = "";
    document.getElementById("confirm-error").textContent = "";
    document.getElementById("city-error").textContent = "";
    document.getElementById("identity-error").textContent = "";
    document.getElementById("login-error").textContent = "";
  }

  function openProfile() {
    var dialog = document.getElementById(PROFILE_DIALOG_ID);
    if (!dialog) {
      return;
    }
    var nicknameField = document.getElementById("profile-nickname");
    var citySelect = document.getElementById("profile-city");
    var fontField = document.querySelector(".profile-font-field");
    var fontSelect = document.getElementById("profile-font");
    document.getElementById("profile-title").textContent = SITE.user
      ? (SITE.user.nickname || (SITE.user.role === "admin" ? "管理员" : "用户" + SITE.user.maskedPhone.slice(-4)))
      : "游客";
    nicknameField.value = SITE.user ? (SITE.user.nickname || "") : "";
    nicknameField.disabled = !SITE.user || SITE.user.role === "admin";
    nicknameField.closest(".profile-nickname-field").style.display = SITE.user ? "" : "none";
    citySelect.value = SITE.user && SITE.user.city ? SITE.user.city : SITE.guestCity;
    if (fontField) {
      fontField.style.display = SITE.user && SITE.user.identity === "individual" ? "" : "none";
    }
    if (fontSelect) {
      fontSelect.value = SITE.user && SITE.user.largeFont ? "large" : "normal";
    }
    document.getElementById("profile-login").style.display = SITE.user ? "none" : "";
    document.getElementById("profile-error").textContent = "";
    document.getElementById("profile-nickname-error").textContent = "";
    document.getElementById("profile-city-error").textContent = "";
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeProfile() {
    var dialog = document.getElementById(PROFILE_DIALOG_ID);
    if (dialog && typeof dialog.close === "function") {
      dialog.close();
    } else if (dialog) {
      dialog.removeAttribute("open");
    }
  }

  function saveProfile(event) {
    event.preventDefault();
    var city = document.getElementById("profile-city").value;
    if (!city) {
      document.getElementById("profile-city-error").textContent = "请选择所在城市";
      return;
    }
    if (!SITE.user) {
      SITE.guestCity = city;
      localStorage.setItem("nzx_guest_city", city);
      renderAccountArea();
      closeProfile();
      showToast("城市设置已保存", "success");
      return;
    }

    var nickname = document.getElementById("profile-nickname").value.trim();
    var largeFont = document.getElementById("profile-font").value === "large";
    if (SITE.user.role !== "admin" && (nickname.length < 2 || nickname.length > 20)) {
      document.getElementById("profile-nickname-error").textContent = "昵称需为 2 至 20 个字符";
      return;
    }
    api("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: nickname, city: city, largeFont: largeFont })
    }).then(function (data) {
      SITE.user = data.user;
      renderAccountArea();
      closeProfile();
      showToast("个人设置已保存", "success");
    }).catch(function (error) {
      document.getElementById("profile-error").textContent = error.message || "保存失败";
    });
  }

  function api(path, options) {
    options = Object.assign({ credentials: "include" }, options || {});
    return fetch(API_BASE + path, options).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (data) {
        if (!response.ok) {
          var error = new Error(data.message || "request_failed");
          error.code = response.status;
          error.data = data;
          throw error;
        }
        return data;
      });
    });
  }

  function showToast(message, type) {
    var region = document.getElementById(TOAST_ID);
    if (!region) {
      region = document.createElement("div");
      region.id = TOAST_ID;
      region.className = "toast-region";
      document.body.appendChild(region);
    }
    var toast = document.createElement("div");
    toast.className = "toast " + (type || "");
    toast.textContent = message;
    region.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 2600);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.NZX_APP = {
    showToast: showToast,
    openLogin: openLogin,
    closeLogin: closeLogin,
    user: function () { return SITE.user; },
    ready: function () { return SITE.ready; },
    cities: function () { return SITE.cities; },
    catalog: function () { return SITE.catalog; },
    products: function () { return SITE.products; },
    product: function (name) { return SITE.productMap[name] || { name: name, category: "", subcategory: "", unit: "元/公斤" }; },
    city: function () { return SITE.user && SITE.user.city ? SITE.user.city : SITE.guestCity; },
    setCity: function (city) {
      SITE.guestCity = city;
      localStorage.setItem("nzx_guest_city", city);
      renderAccountArea();
    }
  };
})();
