function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

function initNav() {
  const navToggleBtn = document.querySelector(".nav-toggle");
  const navLinksEl = document.querySelector(".nav-links");
  
  if (navToggleBtn && navLinksEl) {
    navToggleBtn.addEventListener("click", () => {
      const isOpen = navLinksEl.classList.toggle("nav-open");
      navToggleBtn.setAttribute("aria-expanded", String(isOpen));
    });
  }
}

initTheme();

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
});
