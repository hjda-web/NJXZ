(function () {
  "use strict";

  var state = {
    data: null,
    selectedGroupId: "",
    recommendMember: null,
    selectedRecommendations: []
  };

  window.SITE_CONFIG = {
    page: "group",
    requiresAuth: true,
    requiresAdmin: false,
    render: initialize
  };

  function initialize() {
    var user = NZX_APP.user();
    if (!user || (user.identity === "consumer" && !user.groupAdmin) || user.role === "admin") {
      document.getElementById("group-role-label").textContent = "当前身份无组队权限";
      document.getElementById("group-member-panel").innerHTML =
        '<div class="panel-body empty-state">当前身份不参与组队合作</div>';
      document.getElementById("group-member-panel").hidden = false;
      return;
    }

    document.getElementById("group-role-label").textContent = identityLabel(user.identity) +
      (user.groupAdmin ? " · 小组管理员" : "");
    fillProductSelect();
    bindEvents();
    loadGroupData();
  }

  function identityLabel(identity) {
    if (identity === "village_head") return "村支书";
    if (identity === "cooperative_leader") return "合作社负责人";
    if (identity === "consumer") return "消费者";
    return "个体户（普通农户）";
  }

  function isManager(user) {
    return user.identity === "village_head" ||
      user.identity === "cooperative_leader" ||
      user.groupAdmin;
  }

  function fillProductSelect() {
    var select = document.getElementById("recommend-product-select");
    select.innerHTML = NZX_APP.products().map(function (product) {
      return '<option value="' + product.name + '">' + product.name + "</option>";
    }).join("");
  }

  function bindEvents() {
    document.getElementById("group-select").addEventListener("change", function () {
      state.selectedGroupId = this.value;
      renderMembers();
    });
    document.getElementById("group-create-button").addEventListener("click", createGroup);
    document.getElementById("group-delete-button").addEventListener("click", deleteGroup);
    document.getElementById("member-add-button").addEventListener("click", addMember);
    document.getElementById("group-members-body").addEventListener("click", handleMemberAction);
    document.getElementById("recommend-candidates").addEventListener("click", toggleCandidate);
    document.getElementById("recommend-selected").addEventListener("click", removeSelected);
    document.getElementById("recommend-add-button").addEventListener("click", addManualProduct);
    document.getElementById("recommend-save-button").addEventListener("click", saveRecommendations);
    document.getElementById("recommend-close").addEventListener("click", closeRecommendDialog);
  }

  function loadGroupData() {
    NZX_DATA_API.groups().then(function (result) {
      state.data = result;
      renderMemberPanel();
      renderManagerPanel();
    }).catch(function () {
      NZX_APP.showToast("小组数据加载失败", "error");
    });
  }

  function renderMemberPanel() {
    var panel = document.getElementById("group-member-panel");
    var user = NZX_APP.user();
    if (user.identity !== "individual") {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    var myGroup = state.data && state.data.myGroup;
    if (!myGroup) {
      panel.innerHTML = panelHtml("我的小组", '<div class="group-status-empty">当前未加入小组</div>');
      return;
    }
    var member = myGroup.members.find(function (item) { return item.phone === user.phone; }) || {};
    var recommendations = member.recommendations || [];
    var body = '<div class="group-member-summary"><strong>' + escapeHtml(myGroup.name) + '</strong>' +
      '<span>组长手机号尾号 ' + escapeHtml(String(myGroup.leaderPhone).slice(-4)) + "</span></div>";
    body += '<h3 class="group-recommend-title">组长为我推荐的种植</h3>';
    body += recommendations.length
      ? '<div class="group-recommendation-list">' + recommendations.map(function (product) {
        return '<button class="quick-chip" type="button" data-product="' + product + '">' + product + "</button>";
      }).join("") + "</div>"
      : '<div class="group-status-empty">无</div>';
    body += '<div class="group-leave-actions"><button class="secondary-button danger-button" id="group-leave-button" type="button">退出小组</button></div>';
    panel.innerHTML = panelHtml("我的小组", body);
    panel.querySelectorAll("[data-product]").forEach(function (button) {
      button.addEventListener("click", function () {
        location.href = "/NJXZ/query.html?q=" + encodeURIComponent(button.getAttribute("data-product"));
      });
    });
    document.getElementById("group-leave-button").addEventListener("click", leaveGroup);
  }

  function renderManagerPanel() {
    var user = NZX_APP.user();
    if (!isManager(user)) {
      document.getElementById("group-manager-panel").hidden = true;
      return;
    }
    document.getElementById("group-manager-panel").hidden = false;
    var groups = state.data.managedGroups || [];
    if (!groups.length) {
      state.selectedGroupId = "";
    } else if (!groups.some(function (group) { return group.id === state.selectedGroupId; })) {
      state.selectedGroupId = groups[0].id;
    }
    document.getElementById("group-count-label").textContent = "共 " + groups.length + " 个小组";
    document.getElementById("group-select").innerHTML = groups.map(function (group) {
      return '<option value="' + group.id + '">' + group.name + "</option>";
    }).join("");
    document.getElementById("group-select").value = state.selectedGroupId;
    renderMembers();
  }

  function renderMembers() {
    var body = document.getElementById("group-members-body");
    var group = currentGroup();
    if (!group) {
      body.innerHTML = "";
      document.getElementById("member-count").textContent = "共 0 人";
      document.getElementById("group-members-empty").hidden = false;
      return;
    }
    var members = group.members || [];
    document.getElementById("member-count").textContent = "共 " + members.length + " 人";
    document.getElementById("group-members-empty").hidden = members.length > 0;
    body.innerHTML = members.map(function (member) {
      var recommendationText = member.recommendations && member.recommendations.length
        ? member.recommendations.join("、")
        : "无";
      var adminAction = member.role === "admin"
        ? '<button type="button" data-action="unadmin" data-phone="' + member.phone + '">取消管理员</button>'
        : '<button type="button" data-action="admin" data-phone="' + member.phone + '">设为管理员</button>';
      return [
        "<tr>",
        '<td><strong>' + escapeHtml(member.nickname) + '</strong><br><span class="small">' + escapeHtml(member.phone) + "</span></td>",
        "<td>" + escapeHtml(member.city || "--") + "</td>",
        "<td>" + (member.role === "admin" ? "小组管理员" : "组员") + "</td>",
        '<td class="reason-cell">' + escapeHtml(recommendationText) + "</td>",
        '<td class="row-actions"><button type="button" data-action="recommend" data-phone="' + member.phone + '">设置推荐</button>' +
          adminAction +
          '<button type="button" data-action="remove" data-phone="' + member.phone + '">移除</button></td>',
        "</tr>"
      ].join("");
    }).join("");
  }

  function currentGroup() {
    return (state.data.managedGroups || []).find(function (group) {
      return group.id === state.selectedGroupId;
    });
  }

  function currentMember(phone) {
    var group = currentGroup();
    return group && (group.members || []).find(function (member) {
      return member.phone === phone;
    });
  }

  function handleMemberAction(event) {
    var button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    var action = button.getAttribute("data-action");
    var phone = button.getAttribute("data-phone");
    var group = currentGroup();
    if (!group) {
      return;
    }
    if (action === "recommend") {
      openRecommendDialog(currentMember(phone));
    } else if (action === "admin" || action === "unadmin") {
      NZX_DATA_API.setGroupAdmin(group.id, phone).then(loadGroupData).catch(showError);
    } else if (action === "remove") {
      if (window.confirm("确定将该组员移出小组吗？")) {
        NZX_DATA_API.removeGroupMember(group.id, phone).then(loadGroupData).catch(showError);
      }
    }
  }

  function createGroup() {
    var name = document.getElementById("group-name-input").value.trim();
    if (name.length < 2) {
      NZX_APP.showToast("小组名称至少 2 个字符", "error");
      return;
    }
    NZX_DATA_API.createGroup(name).then(function () {
      document.getElementById("group-name-input").value = "";
      loadGroupData();
      NZX_APP.showToast("小组已创建", "success");
    }).catch(showError);
  }

  function deleteGroup() {
    var group = currentGroup();
    if (!group || !window.confirm("确定解散当前小组吗？")) {
      return;
    }
    NZX_DATA_API.deleteGroup(group.id).then(loadGroupData).catch(showError);
  }

  function addMember() {
    var group = currentGroup();
    var phone = document.getElementById("member-phone-input").value.trim();
    if (!group || !/^[0-9]{11}$/.test(phone)) {
      NZX_APP.showToast("请输入正确的 11 位手机号", "error");
      return;
    }
    NZX_DATA_API.addGroupMember(group.id, phone).then(function () {
      document.getElementById("member-phone-input").value = "";
      loadGroupData();
      NZX_APP.showToast("组员已添加", "success");
    }).catch(function (error) {
      if (error.data && error.data.message === "account_not_found") {
        NZX_APP.showToast("账号不存在", "error");
      } else if (error.data && error.data.message === "member_already_in_group") {
        NZX_APP.showToast("该账号已加入其他小组", "error");
      } else if (error.data && error.data.message === "member_must_be_individual") {
        NZX_APP.showToast("只能添加个体户账号", "error");
      } else {
        showError(error);
      }
    });
  }

  function leaveGroup() {
    var myGroup = state.data && state.data.myGroup;
    if (!myGroup || !window.confirm("确定退出当前小组吗？")) {
      return;
    }
    NZX_DATA_API.leaveGroup(myGroup.id).then(function () {
      loadGroupData();
      NZX_APP.showToast("已退出小组", "success");
    }).catch(showError);
  }

  function openRecommendDialog(member) {
    if (!member) {
      return;
    }
    state.recommendMember = member;
    state.selectedRecommendations = (member.recommendations || []).slice();
    document.getElementById("recommend-title").textContent = "为 " + member.nickname + " 设置品种";
    document.getElementById("recommend-error").textContent = "";
    renderSelectedRecommendations();
    document.getElementById("recommend-candidates").innerHTML = '<div class="empty-state">推荐计算中…</div>';
    NZX_DATA_API.groupRecommendProducts(member.city || NZX_APP.city()).then(function (result) {
      document.getElementById("recommend-candidates").innerHTML = (result.items || []).map(function (item) {
        return candidateChip(item.product, item.score);
      }).join("");
    }).catch(function () {
      document.getElementById("recommend-candidates").innerHTML =
        '<div class="empty-state">推荐数据暂时不可用</div>';
    });
    showDialog();
  }

  function candidateChip(product, score) {
    var selected = state.selectedRecommendations.indexOf(product) >= 0;
    return '<button class="candidate-chip' + (selected ? " selected" : "") + '" type="button" data-product="' +
      escapeHtml(product) + '"><strong>' + escapeHtml(product) + '</strong><small>' + score + " 分</small></button>";
  }

  function toggleCandidate(event) {
    var chip = event.target.closest("[data-product]");
    if (!chip) {
      return;
    }
    var product = chip.getAttribute("data-product");
    var index = state.selectedRecommendations.indexOf(product);
    if (index >= 0) {
      state.selectedRecommendations.splice(index, 1);
    } else {
      state.selectedRecommendations.push(product);
    }
    chip.classList.toggle("selected", index < 0);
    renderSelectedRecommendations();
  }

  function addManualProduct() {
    var product = document.getElementById("recommend-product-select").value;
    if (product && state.selectedRecommendations.indexOf(product) < 0) {
      state.selectedRecommendations.push(product);
      renderSelectedRecommendations();
    }
  }

  function removeSelected(event) {
    var chip = event.target.closest("[data-product]");
    if (!chip) {
      return;
    }
    var product = chip.getAttribute("data-product");
    state.selectedRecommendations = state.selectedRecommendations.filter(function (item) {
      return item !== product;
    });
    renderSelectedRecommendations();
    var candidateChips = document.querySelectorAll("#recommend-candidates [data-product]");
    candidateChips.forEach(function (item) {
      if (item.getAttribute("data-product") === product) {
        item.classList.remove("selected");
      }
    });
  }

  function renderSelectedRecommendations() {
    var container = document.getElementById("recommend-selected");
    container.innerHTML = state.selectedRecommendations.length
      ? state.selectedRecommendations.map(function (product) {
        return '<span class="selected-product" data-product="' + escapeHtml(product) + '">' +
          escapeHtml(product) + ' <button type="button" aria-label="移除">×</button></span>';
      }).join("")
      : '<div class="group-status-empty">尚未选择品种</div>';
  }

  function saveRecommendations() {
    var group = currentGroup();
    if (!group || !state.recommendMember) {
      return;
    }
    NZX_DATA_API.setGroupRecommendations(
      group.id,
      state.recommendMember.phone,
      state.selectedRecommendations
    ).then(function () {
      closeRecommendDialog();
      loadGroupData();
      NZX_APP.showToast("推荐设置已保存", "success");
    }).catch(showError);
  }

  function closeRecommendDialog() {
    var dialog = document.getElementById("recommend-dialog");
    if (dialog && typeof dialog.close === "function") {
      dialog.close();
    } else if (dialog) {
      dialog.removeAttribute("open");
    }
  }

  function showDialog() {
    var dialog = document.getElementById("recommend-dialog");
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function panelHtml(title, body) {
    return '<div class="panel-header"><div><h2>' + escapeHtml(title) + "</h2></div></div>" +
      '<div class="panel-body">' + body + "</div>";
  }

  function showError(error) {
    NZX_APP.showToast((error && error.message) || "操作失败", "error");
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
