const foundFormEl = document.getElementById("foundForm");
const foundFormStatusEl = document.getElementById("foundFormStatus");

if (foundFormEl) {
  foundFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    foundFormStatusEl.textContent = "Submitting...";
    foundFormStatusEl.style.color = "#6b7280";

    const formData = new FormData(foundFormEl);

    try {
      const response = await fetch("/api/items", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const detail = errBody.hint
          ? `${errBody.error || "Failed to submit item"} — ${errBody.hint}`
          : errBody.error;
        throw new Error(detail || "Failed to submit item");
      }

      const data = await response.json();
      foundFormStatusEl.textContent = data.message || "Item submitted!";
      foundFormStatusEl.style.color = "#16a34a";
      foundFormEl.reset();
    } catch (err) {
      console.error(err);
      foundFormStatusEl.textContent = err.message;
      foundFormStatusEl.style.color = "#dc2626";
    }
  });
}
