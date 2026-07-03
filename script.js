(function () {
  "use strict";

  const STORAGE_KEY = "stockroom_inventory_v2";

  /** @type {Array<{id:string, description:string, inDate:string, qtyIn:number, partyName:string, outDate:string, qtyOut:number, purchasePrice:number, sellingPrice:number}>} */
  let items = [];
  let activeFilter = "all";
  let searchTerm = "";

  // ---------- Persistence ----------

  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        items = JSON.parse(raw);
        return;
      }
    } catch (e) {
      console.warn("Could not read saved inventory, starting fresh.", e);
    }
    items = seedData();
    saveItems();
  }

  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Could not save inventory.", e);
    }
  }

  function seedData() {
    return [
      { id: uid(), description: "Corrugated box — medium", inDate: "2026-06-02", qtyIn: 500, partyName: "Kwality Cartons", outDate: "2026-06-20", qtyOut: 80, purchasePrice: 12, sellingPrice: 18 },
      { id: uid(), description: "Cotton yarn — natural, 500g", inDate: "2026-06-05", qtyIn: 60, partyName: "Ganga Textiles", outDate: "2026-06-28", qtyOut: 60, purchasePrice: 280, sellingPrice: 340 },
      { id: uid(), description: "Steel bracket — L-type", inDate: "2026-06-10", qtyIn: 300, partyName: "Metro Hardware", outDate: "", qtyOut: 0, purchasePrice: 16, sellingPrice: 22 },
      { id: uid(), description: "Barcode label roll", inDate: "2026-06-15", qtyIn: 40, partyName: "PrintFast", outDate: "2026-06-30", qtyOut: 35, purchasePrice: 70, sellingPrice: 95 },
    ];
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // ---------- Derived state ----------

  function leftQty(item) {
    return Number(item.qtyIn || 0) - Number(item.qtyOut || 0);
  }

  function itemStatus(item) {
    return leftQty(item) <= 0 ? "out" : "in";
  }

  function filteredItems() {
    return items.filter((item) => {
      if (activeFilter === "instock" && itemStatus(item) !== "in") return false;
      if (activeFilter === "out" && itemStatus(item) !== "out") return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesDescription = item.description.toLowerCase().includes(q);
        const matchesParty = (item.partyName || "").toLowerCase().includes(q);
        if (!matchesDescription && !matchesParty) return false;
      }
      return true;
    });
  }

  // ---------- Rendering ----------

  const els = {
    ledgerBody: document.getElementById("ledger-body"),
    emptyState: document.getElementById("empty-state"),
    countAll: document.getElementById("count-all"),
    countIn: document.getElementById("count-in"),
    countOut: document.getElementById("count-out"),
    statItems: document.getElementById("stat-items"),
    statLeft: document.getElementById("stat-left"),
    statPurchaseValue: document.getElementById("stat-purchase-value"),
    statSellingValue: document.getElementById("stat-selling-value"),
    search: document.getElementById("search"),
    toast: document.getElementById("toast"),
  };

  function render() {
    renderSidebarCounts();
    renderStats();
    renderTable();
  }

  function renderSidebarCounts() {
    els.countAll.textContent = items.length;
    els.countIn.textContent = items.filter((i) => itemStatus(i) === "in").length;
    els.countOut.textContent = items.filter((i) => itemStatus(i) === "out").length;
  }

  function renderStats() {
    const totalLeft = items.reduce((sum, i) => sum + Math.max(0, leftQty(i)), 0);
    const purchaseValue = items.reduce((sum, i) => sum + Math.max(0, leftQty(i)) * Number(i.purchasePrice || 0), 0);
    const sellingValue = items.reduce((sum, i) => sum + Math.max(0, leftQty(i)) * Number(i.sellingPrice || 0), 0);

    els.statItems.textContent = items.length;
    els.statLeft.textContent = totalLeft.toLocaleString("en-IN");
    els.statPurchaseValue.textContent = formatCurrency(purchaseValue);
    els.statSellingValue.textContent = formatCurrency(sellingValue);
  }

  function renderTable() {
    const list = filteredItems();
    els.emptyState.hidden = list.length !== 0;
    els.ledgerBody.innerHTML = "";

    list.forEach((item, index) => {
      const status = itemStatus(item);
      const left = leftQty(item);
      const tr = document.createElement("tr");
      tr.className = `state-${status}`;
      tr.innerHTML = `
        <td class="row-no">${String(index + 1).padStart(2, "0")}</td>
        <td class="row-name">${escapeHtml(item.description)}</td>
        <td class="row-date ${item.inDate ? "" : "empty"}">${formatDate(item.inDate)}</td>
        <td class="row-num">${item.qtyIn || 0}</td>
        <td class="row-name">${item.partyName ? escapeHtml(item.partyName) : '<span class="row-date empty">—</span>'}</td>
        <td class="row-date ${item.outDate ? "" : "empty"}">${formatDate(item.outDate)}</td>
        <td class="row-num">${item.qtyOut || 0}</td>
        <td class="row-num">
          <span class="status-tag">
            <span class="status-dot"></span>${left}
          </span>
        </td>
        <td class="row-price">${formatCurrency(item.purchasePrice)}</td>
        <td class="row-price">${formatCurrency(item.sellingPrice)}</td>
        <td><button class="row-delete" data-id="${item.id}" aria-label="Delete ${escapeHtml(item.description)}">✕</button></td>
      `;
      tr.addEventListener("click", (e) => {
        if (e.target.closest(".row-delete")) return;
        openModal(item.id);
      });
      els.ledgerBody.appendChild(tr);
    });

    els.ledgerBody.querySelectorAll(".row-delete").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        const item = items.find((i) => i.id === id);
        if (item && confirm(`Delete "${item.description}"? This can't be undone.`)) {
          items = items.filter((i) => i.id !== id);
          saveItems();
          render();
          showToast("Entry deleted");
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

  // ---------- Filter buttons ----------

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
    renderTable();
  });

  // ---------- Modal ----------

  const modal = {
    overlay: document.getElementById("modal-overlay"),
    title: document.getElementById("modal-title"),
    form: document.getElementById("item-form"),
    id: document.getElementById("item-id"),
    description: document.getElementById("f-description"),
    inDate: document.getElementById("f-in-date"),
    qtyIn: document.getElementById("f-qty-in"),
    party: document.getElementById("f-party"),
    outDate: document.getElementById("f-out-date"),
    qtyOut: document.getElementById("f-qty-out"),
    purchasePrice: document.getElementById("f-purchase-price"),
    sellingPrice: document.getElementById("f-selling-price"),
    deleteBtn: document.getElementById("btn-delete"),
    leftHint: document.getElementById("left-qty-hint"),
  };

  function updateLeftHint() {
    const inQ = Number(modal.qtyIn.value) || 0;
    const outQ = Number(modal.qtyOut.value) || 0;
    modal.leftHint.textContent = `Left quantity: ${inQ - outQ}`;
  }

  [modal.qtyIn, modal.qtyOut].forEach((input) => input.addEventListener("input", updateLeftHint));

  function openModal(itemId) {
    modal.form.reset();
    if (itemId) {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      modal.title.textContent = "Edit entry";
      modal.id.value = item.id;
      modal.description.value = item.description;
      modal.inDate.value = item.inDate || "";
      modal.qtyIn.value = item.qtyIn || 0;
      modal.party.value = item.partyName || "";
      modal.outDate.value = item.outDate || "";
      modal.qtyOut.value = item.qtyOut || 0;
      modal.purchasePrice.value = item.purchasePrice;
      modal.sellingPrice.value = item.sellingPrice;
      modal.deleteBtn.hidden = false;
    } else {
      modal.title.textContent = "Add entry";
      modal.id.value = "";
      modal.deleteBtn.hidden = true;
    }
    updateLeftHint();
    modal.overlay.hidden = false;
    modal.description.focus();
  }

  function closeModal() {
    modal.overlay.hidden = true;
  }

  document.getElementById("btn-add").addEventListener("click", () => openModal(null));
  document.getElementById("btn-add-empty").addEventListener("click", () => openModal(null));
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  modal.overlay.addEventListener("click", (e) => {
    if (e.target === modal.overlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.overlay.hidden) closeModal();
  });

  modal.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = modal.id.value;
    const payload = {
      description: modal.description.value.trim(),
      inDate: modal.inDate.value,
      qtyIn: Math.max(0, Math.round(Number(modal.qtyIn.value) || 0)),
      partyName: modal.party.value.trim(),
      outDate: modal.outDate.value,
      qtyOut: Math.max(0, Math.round(Number(modal.qtyOut.value) || 0)),
      purchasePrice: Math.max(0, Number(modal.purchasePrice.value) || 0),
      sellingPrice: Math.max(0, Number(modal.sellingPrice.value) || 0),
    };

    if (id) {
      const item = items.find((i) => i.id === id);
      Object.assign(item, payload);
      showToast("Entry updated");
    } else {
      items.push({ id: uid(), ...payload });
      showToast("Entry added");
    }
    saveItems();
    closeModal();
    render();
  });

  modal.deleteBtn.addEventListener("click", () => {
    const id = modal.id.value;
    const item = items.find((i) => i.id === id);
    if (item && confirm(`Delete "${item.description}"? This can't be undone.`)) {
      items = items.filter((i) => i.id !== id);
      saveItems();
      closeModal();
      render();
      showToast("Entry deleted");
    }
  });

  // ---------- Import / export ----------

  document.getElementById("btn-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
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
        if (!Array.isArray(parsed)) throw new Error("File must contain a list of entries.");
        items = parsed.map((i) => ({
          id: i.id || uid(),
          description: String(i.description || "Untitled item"),
          inDate: String(i.inDate || ""),
          qtyIn: Number(i.qtyIn) || 0,
          partyName: String(i.partyName || ""),
          outDate: String(i.outDate || ""),
          qtyOut: Number(i.qtyOut) || 0,
          purchasePrice: Number(i.purchasePrice) || 0,
          sellingPrice: Number(i.sellingPrice) || 0,
        }));
        saveItems();
        render();
        showToast(`Imported ${items.length} entries`);
      } catch (err) {
        alert("Could not import this file: " + err.message);
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  // ---------- Init ----------

  loadItems();
  render();
})();
