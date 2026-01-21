const itemsListEl = document.getElementById("itemsList");
const itemsSummaryEl = document.getElementById("itemsSummary");
const searchQueryEl = document.getElementById("searchQuery");
const searchCategoryEl = document.getElementById("searchCategory");
const searchButtonEl = document.getElementById("searchButton");
const clearSearchButtonEl = document.getElementById("clearSearchButton");

async function loadItems() {
  try {
    const params = new URLSearchParams();
    const q = searchQueryEl.value.trim();
    const category = searchCategoryEl.value;

    if (q) params.set("q", q);
    if (category && category !== "all") params.set("category", category);

    const response = await fetch("/api/items?" + params.toString());
    if (!response.ok) {
      throw new Error("Failed to load items");
    }
    const items = await response.json();
    renderItems(items);
  } catch (err) {
    console.error(err);
    itemsListEl.innerHTML = "<p>Could not load items at this time.</p>";
    if (itemsSummaryEl) {
      itemsSummaryEl.textContent = "";
    }
  }
}

function renderItems(items) {
  itemsListEl.innerHTML = "";

  if (!items || items.length === 0) {
    itemsListEl.innerHTML = "<p>No items found. Try adjusting your search.</p>";
    if (itemsSummaryEl) {
      itemsSummaryEl.textContent = "0 items match your filters.";
    }
    return;
  }

  if (itemsSummaryEl) {
    itemsSummaryEl.textContent = `${items.length} item${items.length === 1 ? "" : "s"} found.`;
  }

  for (const item of items) {
    const card = document.createElement("article");
    card.className = "item-card";
    card.setAttribute("tabindex", "0");

    const header = document.createElement("div");
    header.className = "item-card-header";

    const title = document.createElement("h3");
    title.className = "item-card-title";
    title.textContent = item.title || "Item";

    const idSpan = document.createElement("span");
    idSpan.className = "item-id";
    idSpan.textContent = "ID #" + item.id;

    header.appendChild(title);
    header.appendChild(idSpan);
    card.appendChild(header);

    if (item.photo_path) {
      const photoWrap = document.createElement("div");
      photoWrap.className = "item-photo";

      const img = document.createElement("img");
      img.src = item.photo_path;
      img.alt = `Photo of found item: ${item.title || "item"}`;
      photoWrap.appendChild(img);

      card.appendChild(photoWrap);
    }

    const meta = document.createElement("div");
    meta.className = "item-meta";
    const dateText = item.date_found ? new Date(item.date_found).toLocaleDateString() : "Unknown date";

    const location = item.location_found || "Location not specified";
    meta.textContent = `${location} · found on ${dateText}`;
    card.appendChild(meta);

    const badgeRow = document.createElement("div");
    badgeRow.className = "item-badge-row";

    if (item.category) {
      const catBadge = document.createElement("span");
      catBadge.className = "badge";
      catBadge.textContent = item.category.replace(/-/g, " ");
      badgeRow.appendChild(catBadge);
    }

    if (item.status) {
      const statusBadge = document.createElement("span");
      statusBadge.className = "badge";
      if (item.status === "approved") {
        statusBadge.classList.add("badge-status-approved");
        statusBadge.textContent = "Available";
      } else if (item.status === "claimed") {
        statusBadge.classList.add("badge-status-claimed");
        statusBadge.textContent = "Claim in progress";
      } else {
        statusBadge.textContent = item.status;
      }
      badgeRow.appendChild(statusBadge);
    }

    card.appendChild(badgeRow);

    const desc = document.createElement("p");
    desc.className = "item-meta";
    desc.textContent = item.description || "No description provided.";
    card.appendChild(desc);

    const hint = document.createElement("p");
    hint.className = "item-meta";
    hint.innerHTML = `To claim this item, use ID #${item.id} in the <a href="claim.html">claim form</a>.`;
    card.appendChild(hint);

    itemsListEl.appendChild(card);
  }
}

if (searchButtonEl) {
  searchButtonEl.addEventListener("click", () => loadItems());
}

if (clearSearchButtonEl) {
  clearSearchButtonEl.addEventListener("click", () => {
    searchQueryEl.value = "";
    searchCategoryEl.value = "all";
    loadItems();
  });
}

if (searchQueryEl) {
  searchQueryEl.addEventListener("keyup", (event) => {
    if (event.key === "Enter") loadItems();
  });
}

document.addEventListener("DOMContentLoaded", loadItems);
