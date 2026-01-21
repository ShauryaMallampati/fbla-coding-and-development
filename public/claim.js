const claimFormEl = document.getElementById("claimForm");
const claimFormStatusEl = document.getElementById("claimFormStatus");

if (claimFormEl) {
  claimFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    claimFormStatusEl.textContent = "Submitting...";
    claimFormStatusEl.style.color = "#6b7280";

    const formData = new FormData(claimFormEl);
    const payload = {
      itemId: formData.get("itemId"),
      claimantName: formData.get("claimerName"),
      claimantEmail: formData.get("claimerEmail"),
      details: formData.get("details")
    };

    try {
      const response = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to submit claim");
      }

      const data = await response.json();
      claimFormStatusEl.textContent = data.message || "Claim submitted!";
      claimFormStatusEl.style.color = "#16a34a";
      claimFormEl.reset();
    } catch (err) {
      console.error(err);
      claimFormStatusEl.textContent = err.message;
      claimFormStatusEl.style.color = "#dc2626";
    }
  });
}
