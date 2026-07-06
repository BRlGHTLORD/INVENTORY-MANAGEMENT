(function () {
  "use strict";

  const STORAGE_KEY = "stockroom_inventory_v3";
  const OLD_STORAGE_KEY = "stockroom_inventory_v2";

  /** @type {Array<{id:string, name:string, group:string}>} */
  let products = [];
  /** @type {Array<{id:string, productId:string, type:'purchase'|'sale', party:string, date:string, qty:number, rate:number}>} */
  let transactions = [];

  let activeFilter = "all"; // all | instock | out
  let activeGroup = null;
  let searchTerm = "";
  let openProductId = null;

  // ---------- Persistence ----------

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        products = parsed.products || [];
        transactions = parsed.transactions || [];
        return;
      }
    } catch (e) {
      console.warn("Could not read saved inventory, checking for older data.", e);
    }

    // Try migrating from the previous flat-row format.
    if (migrateFromOldFormat()) {
      saveData();
      return;
    }

    seedData();
    saveData();
  }

  function migrateFromOldFormat() {
    try {
      const raw = localStorage.getItem(OLD_STORAGE_KEY);
      if (!raw) return false;
      const oldItems = JSON.parse(raw);
      if (!Array.isArray(oldItems) || oldItems.length === 0) return false;

      oldItems.forEach((old) => {
        const product = { id: uid(), name: old.description || "Untitled item", group: old.group || "" };
        products.push(product);
        if (Number(old.qtyIn) > 0) {
          transactions.push({
            id: uid(), productId: product.id, type: "purchase",
            party: old.partyName || "", date: old.inDate || "",
            qty: Number(old.qtyIn) || 0, rate: Number(old.purchasePrice) || 0,
          });
        }
        if (Number(old.qtyOut) > 0) {
          transactions.push({
            id: uid(), productId: product.id, type: "sale",
            party: old.partyName || "", date: old.outDate || "",
            qty: Number(old.qtyOut) || 0, rate: Number(old.sellingPrice) || 0,
          });
        }
      });
      return true;
    } catch (e) {
      console.warn("Migration from older data failed, starting fresh.", e);
      return false;
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, transactions }));
      const check = localStorage.getItem(STORAGE_KEY);
      if (!check) throw new Error("Write did not persist");
      setStorageWarning(false);
    } catch (e) {
      console.warn("Could not save inventory.", e);
      setStorageWarning(true);
    }
  }

  function storageAvailable() {
    try {
      const testKey = "__stockroom_storage_test__";
      localStorage.setItem(testKey, "1");
      const ok = localStorage.getItem(testKey) === "1";
      localStorage.removeItem(testKey);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function setStorageWarning(show) {
    const banner = document.getElementById("storage-warning");
    if (banner) banner.hidden = !show;
  }

  function seedData() {
    const box = { id: uid(), name: "Corrugated box — medium", group: "Packaging" };
    const kanexExt = { id: uid(), name: "Fire extinguisher — 4kg CO2", group: "Kanex" };
    const safeguardExt = { id: uid(), name: "Fire extinguisher — 6kg ABC", group: "Safeguard" };
    const agniExt = { id: uid(), name: "Fire extinguisher — 9kg water", group: "Agni" };
    const bracket = { id: uid(), name: "Steel bracket — L-type", group: "Hardware" };

    products = [box, kanexExt, safeguardExt, agniExt, bracket];

    transactions = [
      { id: uid(), productId: box.id, type: "purchase", party: "Kwality Cartons", date: "2026-06-02", qty: 500, rate: 12 },
      { id: uid(), productId: box.id, type: "sale", party: "Retail Corner", date: "2026-06-20", qty: 80, rate: 18 },

      { id: uid(), productId: kanexExt.id, type: "purchase", party: "Kanex Safety", date: "2026-06-08", qty: 25, rate: 1450 },
      { id: uid(), productId: kanexExt.id, type: "sale", party: "Om Traders", date: "2026-06-18", qty: 6, rate: 1800 },

      { id: uid(), productId: safeguardExt.id, type: "purchase", party: "Safeguard Fire Systems", date: "2026-06-09", qty: 18, rate: 1620 },

      { id: uid(), productId: agniExt.id, type: "purchase", party: "Agni Fire Solutions", date: "2026-06-11", qty: 12, rate: 1780 },
      { id: uid(), productId: agniExt.id, type: "sale", party: "City Hardware", date: "2026-06-25", qty: 4, rate: 2150 },

      { id: uid(), productId: bracket.id, type: "purchase", party: "Metro Hardware", date: "2026-06-10", qty: 300, rate: 16 },
    ];
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // ---------- Group colors ----------

  const GROUP_PALETTE = [
    { name: "amber",  border: "#C6791A", bg: "#FBEEDA", text: "#7A4B0F" },
    { name: "teal",   border: "#2F7A72", bg: "#E1F0EE", text: "#1E4F49" },
    { name: "plum",   border: "#7A3B69", bg: "#F3E4EF", text: "#552849" },
    { name: "indigo", border: "#3B4E8C", bg: "#E5E8F5", text: "#293765" },
    { name: "rust",   border: "#B5462E", bg: "#F8E4DE", text: "#7E301F" },
    { name: "olive",  border: "#6B7A2E", bg: "#EDF0DC", text: "#4A5420" },
    { name: "sky",    border: "#3E6E8C", bg: "#DEEBF2", text: "#2A4C61" },
    { name: "maroon", border: "#8C3B4E", bg: "#F3E0E5", text: "#602836" },
  ];
  const UNGROUPED_COLOR = { name: "neutral", border: "#8B95A6", bg: "#EEECE5", text: "#4B5566" };

  function groupColor(groupName) {
    if (!groupName) return UNGROUPED_COLOR;
    let hash = 0;
    for (let i = 0; i < groupName.length; i++) hash = (hash * 31 + groupName.charCodeAt(i)) >>> 0;
    return GROUP_PALETTE[hash % GROUP_PALETTE.length];
  }

  // ---------- Derived state ----------

  function productTxns(productId) {
    return transactions.filter((t) => t.productId === productId);
  }

  function remainingQty(productId) {
    return productTxns(productId).reduce((sum, t) => sum + (t.type === "purchase" ? t.qty : -t.qty), 0);
  }

  function lastRate(productId, type) {
    const list = productTxns(productId)
      .filter((t) => t.type === type)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    return list.length ? Number(list[list.length - 1].rate) : 0;
  }

  function productStatus(productId) {
    return remainingQty(productId) <= 0 ? "out" : "in";
  }

  function getGroups() {
    return [...new Set(products.map((p) => p.group).filter(Boolean))].sort();
  }

  function filteredProducts() {
    return products.filter((p) => {
      if (activeFilter === "instock" && productStatus(p.id) !== "in") return false;
      if (activeFilter === "out" && productStatus(p.id) !== "out") return false;
      if (activeGroup && p.group !== activeGroup) return false;
      if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }

  // ---------- Rendering: main page ----------

  const els = {
    productBody: document.getElementById("product-body"),
    emptyState: document.getElementById("empty-state"),
    countAll: document.getElementById("count-all"),
    countIn: document.getElementById("count-in"),
    countOut: document.getElementById("count-out"),
    groupFilters: document.getElementById("group-filters"),
    groupList: document.getElementById("group-list"),
    statProducts: document.getElementById("stat-products"),
    statLeft: document.getElementById("stat-left"),
    statPurchaseValue: document.getElementById("stat-purchase-value"),
    statSellingValue: document.getElementById("stat-selling-value"),
    search: document.getElementById("search"),
    toast: document.getElementById("toast"),
  };

  function render() {
    renderSidebarCounts();
    renderGroupFilters();
    renderStats();
    renderProductTable();
    if (openProductId) renderLedger();
  }

  function renderSidebarCounts() {
    els.countAll.textContent = products.length;
    els.countIn.textContent = products.filter((p) => productStatus(p.id) === "in").length;
    els.countOut.textContent = products.filter((p) => productStatus(p.id) === "out").length;
  }

  function renderGroupFilters() {
    const groups = getGroups();
    els.groupList.innerHTML = groups.map((g) => `<option value="${escapeHtml(g)}">`).join("");

    if (groups.length === 0) {
      els.groupFilters.innerHTML = `<span class="filters-label">Brand / group</span>
        <p class="filters-empty">Add a brand on any product to sort by group.</p>`;
      return;
    }

    const label = `<span class="filters-label">Brand / group</span>`;
    const allBtn = `<button class="filter-btn ${activeGroup === null ? "active" : ""}" data-group="">
        <span>All groups</span>
      </button>`;
    const groupBtns = groups
      .map((g) => {
        const color = groupColor(g);
        return `<button class="filter-btn ${activeGroup === g ? "active" : ""}" data-group="${escapeHtml(g)}">
          <span class="group-dot" style="background:${color.border}"></span>
          <span class="group-btn-label">${escapeHtml(g)}</span>
          <span class="count">${products.filter((p) => p.group === g).length}</span>
        </button>`;
      })
      .join("");

    els.groupFilters.innerHTML = label + allBtn + groupBtns;
    els.groupFilters.querySelectorAll("[data-group]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeGroup = btn.getAttribute("data-group") || null;
        render();
      });
    });
  }

  function renderStats() {
    let totalLeft = 0, purchaseValue = 0, sellingValue = 0;
    products.forEach((p) => {
      const left = Math.max(0, remainingQty(p.id));
      totalLeft += left;
      purchaseValue += left * lastRate(p.id, "purchase");
      sellingValue += left * lastRate(p.id, "sale");
    });
    els.statProducts.textContent = products.length;
    els.statLeft.textContent = totalLeft.toLocaleString("en-IN");
    els.statPurchaseValue.textContent = formatCurrency(purchaseValue);
    els.statSellingValue.textContent = formatCurrency(sellingValue);
  }

  function renderProductTable() {
    const list = filteredProducts();
    els.emptyState.hidden = list.length !== 0;
    els.productBody.innerHTML = "";

    const groupNames = [...new Set(list.map((p) => p.group).filter(Boolean))].sort();
    const buckets = groupNames.map((name) => ({ name, entries: list.filter((p) => p.group === name) }));
    const ungrouped = list.filter((p) => !p.group);
    if (ungrouped.length) buckets.push({ name: null, entries: ungrouped });

    let rowNumber = 0;

    buckets.forEach((bucket) => {
      const color = groupColor(bucket.name);
      const headerRow = document.createElement("tr");
      headerRow.className = "group-header-row";
      headerRow.style.setProperty("--group-bg", color.bg);
      headerRow.style.setProperty("--group-text", color.text);
      headerRow.style.setProperty("--group-border", color.border);
      headerRow.innerHTML = `<td colspan="4" class="group-header-cell">
        <span class="group-header-dot"></span>${escapeHtml(bucket.name || "Ungrouped")}
        <span class="group-header-count">${bucket.entries.length} product${bucket.entries.length === 1 ? "" : "s"}</span>
      </td>`;
      els.productBody.appendChild(headerRow);

      bucket.entries.forEach((p) => {
        rowNumber += 1;
        const status = productStatus(p.id);
        const left = remainingQty(p.id);
        const tr = document.createElement("tr");
        tr.className = `state-${status}`;
        tr.style.setProperty("--group-border", color.border);
        tr.innerHTML = `
          <td class="row-no">${String(rowNumber).padStart(2, "0")}</td>
          <td class="row-name">${escapeHtml(p.name)}</td>
          <td class="row-num">
            <span class="status-tag"><span class="status-dot"></span>${left}</span>
          </td>
          <td><button class="row-delete" data-id="${p.id}" aria-label="Delete ${escapeHtml(p.name)}">✕</button></td>
        `;
        tr.addEventListener("click", (e) => {
          if (e.target.closest(".row-delete")) return;
          openLedger(p.id);
        });
        els.productBody.appendChild(tr);
      });
    });

    els.productBody.querySelectorAll(".row-delete").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        const p = products.find((x) => x.id === id);
        if (p && confirm(`Delete "${p.name}" and all its purchase/sale entries? This can't be undone.`)) {
          products = products.filter((x) => x.id !== id);
          transactions = transactions.filter((t) => t.productId !== id);
          saveData();
          render();
          showToast("Product deleted");
        }
      });
    });
  }

  function formatCurrency(n) {
    return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }

  function formatDate(d) {
    if (!d) return "—";
    const date = new Date(d + "T00:00:00");
    if (isNaN(date)) return "—";
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => (els.toast.hidden = true), 2200);
  }

  // ---------- Filter buttons / search ----------

  document.querySelectorAll(".filters .filter-btn[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.getAttribute("data-filter");
      document.querySelectorAll(".filters .filter-btn[data-filter]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      render();
    });
  });

  els.search.addEventListener("input", () => {
    searchTerm = els.search.value.trim();
    renderProductTable();
  });

  // ---------- Product modal (add/edit product) ----------

  const pModal = {
    overlay: document.getElementById("product-modal-overlay"),
    title: document.getElementById("product-modal-title"),
    form: document.getElementById("product-form"),
    id: document.getElementById("p-id"),
    name: document.getElementById("p-name"),
    group: document.getElementById("p-group"),
    deleteBtn: document.getElementById("p-btn-delete"),
  };

  function openProductModal(productId) {
    pModal.form.reset();
    if (productId) {
      const p = products.find((x) => x.id === productId);
      if (!p) return;
      pModal.title.textContent = "Edit product";
      pModal.id.value = p.id;
      pModal.name.value = p.name;
      pModal.group.value = p.group || "";
      pModal.deleteBtn.hidden = false;
    } else {
      pModal.title.textContent = "Add product";
      pModal.id.value = "";
      pModal.deleteBtn.hidden = true;
    }
    pModal.overlay.hidden = false;
    pModal.name.focus();
  }

  function closeProductModal() {
    pModal.overlay.hidden = true;
  }

  document.getElementById("btn-add-product").addEventListener("click", () => openProductModal(null));
  document.getElementById("btn-add-empty").addEventListener("click", () => openProductModal(null));
  document.getElementById("product-modal-close").addEventListener("click", closeProductModal);
  document.getElementById("product-modal-cancel").addEventListener("click", closeProductModal);
  pModal.overlay.addEventListener("click", (e) => { if (e.target === pModal.overlay) closeProductModal(); });

  pModal.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = pModal.id.value;
    const payload = { name: pModal.name.value.trim(), group: pModal.group.value.trim() };

    if (id) {
      const p = products.find((x) => x.id === id);
      Object.assign(p, payload);
      showToast("Product updated");
    } else {
      products.push({ id: uid(), ...payload });
      showToast("Product added");
    }
    saveData();
    closeProductModal();
    render();
  });

  pModal.deleteBtn.addEventListener("click", () => {
    const id = pModal.id.value;
    const p = products.find((x) => x.id === id);
    if (p && confirm(`Delete "${p.name}" and all its purchase/sale entries? This can't be undone.`)) {
      products = products.filter((x) => x.id !== id);
      transactions = transactions.filter((t) => t.productId !== id);
      saveData();
      closeProductModal();
      render();
      showToast("Product deleted");
    }
  });

  // ---------- Ledger overlay (transaction history for one product) ----------

  const ledger = {
    overlay: document.getElementById("ledger-overlay"),
    title: document.getElementById("ledger-title"),
    groupTag: document.getElementById("ledger-group-tag"),
    remaining: document.getElementById("ledger-remaining"),
    body: document.getElementById("txn-body"),
    empty: document.getElementById("txn-empty"),
  };

  function openLedger(productId) {
    openProductId = productId;
    ledger.overlay.hidden = false;
    renderLedger();
  }

  function closeLedger() {
    ledger.overlay.hidden = true;
    openProductId = null;
  }

  function renderLedger() {
    const p = products.find((x) => x.id === openProductId);
    if (!p) { closeLedger(); return; }

    ledger.title.textContent = p.name;
    ledger.groupTag.textContent = p.group || "Ungrouped";
    ledger.remaining.textContent = remainingQty(p.id);

    const rows = productTxns(p.id).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    ledger.empty.hidden = rows.length !== 0;
    ledger.body.innerHTML = "";

    rows.forEach((t) => {
      const tr = document.createElement("tr");
      tr.className = t.type === "purchase" ? "txn-purchase" : "txn-sale";
      tr.innerHTML = `
        <td class="row-name"><span class="txn-type-dot"></span>${t.party ? escapeHtml(t.party) : "—"}</td>
        <td class="row-date">${formatDate(t.date)}</td>
        <td class="row-num">${t.type === "purchase" ? t.qty : ""}</td>
        <td class="row-num">${t.type === "sale" ? t.qty : ""}</td>
        <td class="row-price">${formatCurrency(t.rate)}</td>
        <td><button class="row-delete" data-id="${t.id}" aria-label="Delete entry">✕</button></td>
      `;
      tr.addEventListener("click", (e) => {
        if (e.target.closest(".row-delete")) return;
        openTxnModal(t.id);
      });
      ledger.body.appendChild(tr);
    });

    ledger.body.querySelectorAll(".row-delete").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        if (confirm("Delete this entry? This can't be undone.")) {
          transactions = transactions.filter((t) => t.id !== id);
          saveData();
          render();
          showToast("Entry deleted");
        }
      });
    });
  }

  document.getElementById("ledger-close").addEventListener("click", closeLedger);
  ledger.overlay.addEventListener("click", (e) => { if (e.target === ledger.overlay) closeLedger(); });
  document.getElementById("btn-edit-product").addEventListener("click", () => openProductModal(openProductId));
  document.getElementById("btn-add-purchase").addEventListener("click", () => openTxnModal(null, "purchase"));
  document.getElementById("btn-add-sale").addEventListener("click", () => openTxnModal(null, "sale"));

  // ---------- Transaction modal (add/edit a purchase or sale entry) ----------

  const tModal = {
    overlay: document.getElementById("txn-modal-overlay"),
    title: document.getElementById("txn-modal-title"),
    form: document.getElementById("txn-form"),
    id: document.getElementById("t-id"),
    productId: document.getElementById("t-product-id"),
    type: document.getElementById("t-type"),
    party: document.getElementById("t-party"),
    date: document.getElementById("t-date"),
    qty: document.getElementById("t-qty"),
    qtyLabel: document.getElementById("t-qty-label"),
    rate: document.getElementById("t-rate"),
    deleteBtn: document.getElementById("t-btn-delete"),
    submitBtn: document.getElementById("txn-submit-btn"),
  };

  function openTxnModal(txnId, presetType) {
    tModal.form.reset();
    if (txnId) {
      const t = transactions.find((x) => x.id === txnId);
      if (!t) return;
      tModal.id.value = t.id;
      tModal.productId.value = t.productId;
      tModal.type.value = t.type;
      tModal.party.value = t.party || "";
      tModal.date.value = t.date || "";
      tModal.qty.value = t.qty;
      tModal.rate.value = t.rate;
      tModal.deleteBtn.hidden = false;
      setTxnModalTypeUI(t.type, true);
    } else {
      tModal.id.value = "";
      tModal.productId.value = openProductId;
      tModal.type.value = presetType;
      tModal.deleteBtn.hidden = true;
      setTxnModalTypeUI(presetType, false);
    }
    tModal.overlay.hidden = false;
    tModal.party.focus();
  }

  function setTxnModalTypeUI(type, isEdit) {
    const isPurchase = type === "purchase";
    tModal.title.textContent = (isEdit ? "Edit " : "Add ") + (isPurchase ? "purchase entry" : "sale entry");
    tModal.qtyLabel.textContent = isPurchase ? "No of items in" : "No of items out";
    tModal.submitBtn.style.background = isPurchase ? "var(--red)" : "var(--green)";
  }

  function closeTxnModal() {
    tModal.overlay.hidden = true;
  }

  document.getElementById("txn-modal-close").addEventListener("click", closeTxnModal);
  document.getElementById("txn-modal-cancel").addEventListener("click", closeTxnModal);
  tModal.overlay.addEventListener("click", (e) => { if (e.target === tModal.overlay) closeTxnModal(); });

  tModal.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = tModal.id.value;
    const payload = {
      productId: tModal.productId.value,
      type: tModal.type.value,
      party: tModal.party.value.trim(),
      date: tModal.date.value,
      qty: Math.max(0, Math.round(Number(tModal.qty.value) || 0)),
      rate: Math.max(0, Number(tModal.rate.value) || 0),
    };

    if (id) {
      const t = transactions.find((x) => x.id === id);
      Object.assign(t, payload);
      showToast("Entry updated");
    } else {
      transactions.push({ id: uid(), ...payload });
      showToast(payload.type === "purchase" ? "Purchase entry added" : "Sale entry added");
    }
    saveData();
    closeTxnModal();
    render();
  });

  tModal.deleteBtn.addEventListener("click", () => {
    const id = tModal.id.value;
    if (confirm("Delete this entry? This can't be undone.")) {
      transactions = transactions.filter((x) => x.id !== id);
      saveData();
      closeTxnModal();
      render();
      showToast("Entry deleted");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!tModal.overlay.hidden) { closeTxnModal(); return; }
    if (!pModal.overlay.hidden) { closeProductModal(); return; }
    if (!ledger.overlay.hidden) { closeLedger(); return; }
  });

  // ---------- Import / export ----------

  document.getElementById("btn-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ products, transactions }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stockroom-inventory-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported inventory");
  });

  document.getElementById("import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.products || !Array.isArray(parsed.products)) throw new Error("File must contain a products list.");
        products = parsed.products.map((p) => ({
          id: p.id || uid(),
          name: String(p.name || "Untitled item"),
          group: String(p.group || ""),
        }));
        transactions = (parsed.transactions || []).map((t) => ({
          id: t.id || uid(),
          productId: t.productId,
          type: t.type === "sale" ? "sale" : "purchase",
          party: String(t.party || ""),
          date: String(t.date || ""),
          qty: Number(t.qty) || 0,
          rate: Number(t.rate) || 0,
        }));
        saveData();
        render();
        showToast(`Imported ${products.length} products`);
      } catch (err) {
        alert("Could not import this file: " + err.message);
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  // ---------- Init ----------

  setStorageWarning(!storageAvailable());
  loadData();
  render();
})();
