const adminItemsTbody = document.getElementById("adminItemsTbody");
const adminClaimsTbody = document.getElementById("adminClaimsTbody");
const adminSearchQuery = document.getElementById("adminSearchQuery");
const adminStatusFilter = document.getElementById("adminStatusFilter");
const adminCategoryFilter = document.getElementById("adminCategoryFilter");
const adminRefreshButton = document.getElementById("adminRefreshButton");
const adminItemsSummary = document.getElementById("adminItemsSummary");

async function loadAdminItems() {
  try {
    const params = new URLSearchParams();
    params.set("status", "all"); // admin view = no filter

    const q = adminSearchQuery.value.trim();
    if (q) params.set("q", q);

    const statusFilter = adminStatusFilter.value;
    if (statusFilter !== "all") params.set("status", statusFilter);

    const categoryFilter = adminCategoryFilter.value;
    if (categoryFilter !== "all") params.set("category", categoryFilter);

    const response = await fetch("/api/items?" + params.toString());
    if (!response.ok) {
      throw new Error("Failed to load items");
    }

    const items = await response.json();
    renderAdminItems(items);
  } catch (err) {
    console.error(err);
    adminItemsTbody.innerHTML = "<tr><td colspan='5'>Error loading items</td></tr>";
  }
}

function renderAdminItems(items) {
  adminItemsTbody.innerHTML = "";

  if (!items || items.length === 0) {
    adminItemsTbody.innerHTML = "<tr><td colspan='5'>No items found</td></tr>";
    if (adminItemsSummary) {
      adminItemsSummary.textContent = "0 items";
    }
    return;
  }

  if (adminItemsSummary) {
    const pendingCount = items.filter(item => item.status === "pending").length;
    const needsValidation = items.filter(item => !item.ai_validation && item.status === "pending").length;
    
    let summaryText = `${items.length} item${items.length === 1 ? "" : "s"}`;
    if (pendingCount > 0) {
      summaryText += ` (${pendingCount} pending)`;
    }
    if (needsValidation > 0) {
      summaryText += ` - ${needsValidation} need AI validation`;
    }
    
    adminItemsSummary.textContent = summaryText;
  }

  // auto-validate pending items missing AI checks
  autoValidatePendingItems(items);

  for (const item of items) {
    const tr = document.createElement("tr");

    // ID (reference)
    const tdId = document.createElement("td");
    tdId.textContent = item.id;
    tr.appendChild(tdId);

    // item name
    const tdItem = document.createElement("td");
    tdItem.textContent = item.title || "Untitled";
    tr.appendChild(tdItem);

    // details snapshot
    const tdDetails = document.createElement("td");
    const detailsList = document.createElement("div");
    detailsList.style.fontSize = "0.875rem";
    detailsList.style.color = "#6b7280";
    
    const category = item.category ? item.category.replace(/-/g, " ") : "N/A";
    const location = item.location_found || "N/A";
    const date = item.date_found ? new Date(item.date_found).toLocaleDateString() : "N/A";
    
    detailsList.innerHTML = `
      <div><strong>Category:</strong> ${category}</div>
      <div><strong>Location:</strong> ${location}</div>
      <div><strong>Date found:</strong> ${date}</div>
      <div><strong>Finder:</strong> ${item.finder_name || "Anonymous"}</div>
    `;
    tdDetails.appendChild(detailsList);
    tr.appendChild(tdDetails);

    // status + badges
    const tdStatus = document.createElement("td");
    
    const statusContainer = document.createElement("div");
    statusContainer.style.display = "flex";
    statusContainer.style.alignItems = "center";
    statusContainer.style.gap = "0.5rem";
    statusContainer.style.flexWrap = "wrap";
    
    const statusBadge = document.createElement("span");
    statusBadge.className = "badge";
    statusBadge.textContent = item.status || "unknown";
    
    if (item.status === "approved") {
      statusBadge.classList.add("badge-status-approved");
    } else if (item.status === "claimed") {
      statusBadge.classList.add("badge-status-claimed");
    } else if (item.status === "pending") {
      statusBadge.style.backgroundColor = "#fef3c7";
      statusBadge.style.color = "#92400e";
    } else if (item.status === "archived") {
      statusBadge.style.backgroundColor = "#f3f4f6";
      statusBadge.style.color = "#6b7280";
    }
    
    statusContainer.appendChild(statusBadge);
    
    // AI badge if we have a result
    if (item.ai_validation) {
      const aiBadge = document.createElement("span");
      aiBadge.className = "badge";
      aiBadge.style.fontSize = "0.75rem";
      aiBadge.style.cursor = "pointer";
      aiBadge.title = item.ai_validation.reasoning || "AI validation result";
      
      if (item.ai_validation.isLegitimate) {
        aiBadge.textContent = `✓ AI: ${item.ai_validation.confidence}%`;
        aiBadge.style.backgroundColor = "#d1fae5";
        aiBadge.style.color = "#065f46";
      } else {
        aiBadge.textContent = `⚠ AI: ${item.ai_validation.confidence}%`;
        aiBadge.style.backgroundColor = "#fee2e2";
        aiBadge.style.color = "#991b1b";
      }
      
      statusContainer.appendChild(aiBadge);
    }
    
    tdStatus.appendChild(statusContainer);
    tr.appendChild(tdStatus);

    // actions row
    const tdActions = document.createElement("td");
    
    const actionsDiv = document.createElement("div");
    actionsDiv.style.display = "flex";
    actionsDiv.style.gap = "0.5rem";
    actionsDiv.style.flexWrap = "wrap";

    // AI validate button
    const btnValidate = document.createElement("button");
    btnValidate.className = "btn-small";
    btnValidate.style.backgroundColor = "#dbeafe";
    btnValidate.style.color = "#1e40af";
    btnValidate.textContent = "🤖 Validate";
    btnValidate.onclick = (event) => validateItemWithAI(item.id, event.currentTarget);
    actionsDiv.appendChild(btnValidate);

    // status change buttons
    if (item.status === "pending") {
      const btnApprove = document.createElement("button");
      btnApprove.className = "btn-small btn-primary";
      btnApprove.textContent = "Approve";
      btnApprove.onclick = () => changeItemStatus(item.id, "approved");
      actionsDiv.appendChild(btnApprove);
    }

    if (item.status !== "archived") {
      const btnArchive = document.createElement("button");
      btnArchive.className = "btn-small btn-secondary";
      btnArchive.textContent = "Archive";
      btnArchive.onclick = () => changeItemStatus(item.id, "archived");
      actionsDiv.appendChild(btnArchive);
    }

    if (item.status !== "claimed") {
      const btnClaimed = document.createElement("button");
      btnClaimed.className = "btn-small btn-secondary";
      btnClaimed.textContent = "Mark Claimed";
      btnClaimed.onclick = () => changeItemStatus(item.id, "claimed");
      actionsDiv.appendChild(btnClaimed);
    }

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn-small";
    btnDelete.style.backgroundColor = "#fee2e2";
    btnDelete.style.color = "#991b1b";
    btnDelete.textContent = "Delete";
    btnDelete.onclick = () => deleteItem(item.id);
    actionsDiv.appendChild(btnDelete);

    tdActions.appendChild(actionsDiv);
    tr.appendChild(tdActions);

    adminItemsTbody.appendChild(tr);
  }
}

async function changeItemStatus(itemId, newStatus) {
  try {
    const response = await fetch(`/api/items/${itemId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status: newStatus })
    });

    if (!response.ok) {
      throw new Error("Failed to update status");
    }

    await loadAdminItems();
  } catch (err) {
    console.error(err);
    alert("Failed to update item status: " + err.message);
  }
}

async function validateItemWithAI(itemId, buttonEl) {
  try {
    // loading state so users know it's working
    const button = buttonEl;
    const originalText = button ? button.textContent : "";
    if (button) {
      button.textContent = "🤖 Validating...";
      button.disabled = true;
    }

    const response = await fetch(`/api/validate-item/${itemId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("AI validation failed");
    }

    const validation = await response.json();
    
    // show result
    let resultMessage = `AI Validation Result:\n\n`;
    resultMessage += `Legitimate: ${validation.isLegitimate ? "✓ YES" : "✗ NO"}\n`;
    resultMessage += `Confidence: ${validation.confidence}%\n`;
    resultMessage += `Reasoning: ${validation.reasoning}\n`;
    
    if (validation.flags && validation.flags.length > 0) {
      resultMessage += `\nFlags: ${validation.flags.join(", ")}`;
    }

    alert(resultMessage);

    // refresh to show the new AI badge
    await loadAdminItems();
  } catch (err) {
    console.error(err);
    alert("Failed to validate item with AI: " + err.message);
  } finally {
    if (buttonEl) {
      buttonEl.textContent = "🤖 Validate";
      buttonEl.disabled = false;
    }
  }
}

async function deleteItem(itemId) {
  if (!confirm("Are you sure you want to delete this item? This cannot be undone.")) {
    return;
  }

  try {
    const response = await fetch(`/api/items/${itemId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error("Failed to delete item");
    }

    await loadAdminItems();
    await loadAdminClaims();
  } catch (err) {
    console.error(err);
    alert("Failed to delete item: " + err.message);
  }
}

// load claims for review
async function loadAdminClaims() {
  try {
    const response = await fetch("/api/claims");
    if (!response.ok) {
      throw new Error("Failed to load claims");
    }

    const claims = await response.json();
    renderAdminClaims(claims);
  } catch (err) {
    console.error(err);
    adminClaimsTbody.innerHTML = "<tr><td colspan='6'>Error loading claims</td></tr>";
  }
}

function renderAdminClaims(claims) {
  adminClaimsTbody.innerHTML = "";

  if (!claims || claims.length === 0) {
    adminClaimsTbody.innerHTML = "<tr><td colspan='6'>No claims submitted yet</td></tr>";
    return;
  }

  for (const claim of claims) {
    const tr = document.createElement("tr");

    // claim ID
    const tdId = document.createElement("td");
    tdId.textContent = claim.id;
    tr.appendChild(tdId);

    // item title
    const tdItem = document.createElement("td");
    tdItem.textContent = claim.item_title || `Item #${claim.item_id}`;
    tr.appendChild(tdItem);

    // claimant info
    const tdClaimant = document.createElement("td");
    const claimantDiv = document.createElement("div");
    claimantDiv.style.fontSize = "0.875rem";
    claimantDiv.innerHTML = `
      <div><strong>${claim.claimant_name || "Anonymous"}</strong></div>
      <div style="color: #6b7280;">${claim.claimant_email || "N/A"}</div>
    `;
    tdClaimant.appendChild(claimantDiv);
    tr.appendChild(tdClaimant);

    // details
    const tdDetails = document.createElement("td");
    tdDetails.textContent = claim.details || "No details provided";
    tdDetails.style.maxWidth = "300px";
    tdDetails.style.wordWrap = "break-word";
    tr.appendChild(tdDetails);

    // status
    const tdStatus = document.createElement("td");
    const statusBadge = document.createElement("span");
    statusBadge.className = "badge";
    statusBadge.textContent = claim.status || "new";
    
    if (claim.status === "resolved") {
      statusBadge.classList.add("badge-status-approved");
    } else if (claim.status === "in_review") {
      statusBadge.style.backgroundColor = "#dbeafe";
      statusBadge.style.color = "#1e40af";
    } else {
      statusBadge.style.backgroundColor = "#fef3c7";
      statusBadge.style.color = "#92400e";
    }
    
    tdStatus.appendChild(statusBadge);
    tr.appendChild(tdStatus);

    // action buttons
    const tdActions = document.createElement("td");
    
    const actionsDiv = document.createElement("div");
    actionsDiv.style.display = "flex";
    actionsDiv.style.gap = "0.5rem";
    actionsDiv.style.flexWrap = "wrap";

    if (claim.status === "new") {
      const btnReview = document.createElement("button");
      btnReview.className = "btn-small btn-secondary";
      btnReview.textContent = "In Review";
      btnReview.onclick = () => changeClaimStatus(claim.id, "in_review");
      actionsDiv.appendChild(btnReview);
    }

    if (claim.status !== "resolved") {
      const btnResolve = document.createElement("button");
      btnResolve.className = "btn-small btn-primary";
      btnResolve.textContent = "Resolve";
      btnResolve.onclick = () => changeClaimStatus(claim.id, "resolved");
      actionsDiv.appendChild(btnResolve);
    }

    tdActions.appendChild(actionsDiv);
    tr.appendChild(tdActions);

    adminClaimsTbody.appendChild(tr);
  }
}

async function changeClaimStatus(claimId, newStatus) {
  try {
    const response = await fetch(`/api/claims/${claimId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status: newStatus })
    });

    if (!response.ok) {
      throw new Error("Failed to update claim status");
    }

    await loadAdminClaims();
  } catch (err) {
    console.error(err);
    alert("Failed to update claim status: " + err.message);
  }
}

// event listeners
if (adminRefreshButton) {
  adminRefreshButton.addEventListener("click", () => {
    loadAdminItems();
    loadAdminClaims();
  });
}

if (adminSearchQuery) {
  adminSearchQuery.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      loadAdminItems();
    }
  });
}

if (adminStatusFilter) {
  adminStatusFilter.addEventListener("change", loadAdminItems);
}

if (adminCategoryFilter) {
  adminCategoryFilter.addEventListener("change", loadAdminItems);
}

// auto-validate pending items missing AI checks
async function autoValidatePendingItems(items) {
  const needsValidation = items.filter(item => 
    !item.ai_validation && item.status === "pending"
  );

  if (needsValidation.length === 0) return;

  console.log(`Auto-validating ${needsValidation.length} pending items...`);

  // cap at 3 so we don't spam the API
  const itemsToValidate = needsValidation.slice(0, 3);

  for (const item of itemsToValidate) {
    try {
      await fetch(`/api/validate-item/${item.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
    } catch (err) {
      console.error(`Failed to auto-validate item ${item.id}:`, err);
    }
  }

  // refresh after validation
  if (itemsToValidate.length > 0) {
    setTimeout(() => {
      loadAdminItems();
    }, 2000); // Wait 2 seconds before reloading
  }
}

// initial load
document.addEventListener("DOMContentLoaded", () => {
  loadAdminItems();
  loadAdminClaims();
});
