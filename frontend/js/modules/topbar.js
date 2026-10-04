import { state } from "./state.js";
import { loadCoreData } from "./data-loader.js";

let globalSearchRequest = 0;

function hideGlobalSearchResults() {
  const results = document.getElementById("global-search-results");
  if (results) {
    results.hidden = true;
    results.innerHTML = "";
  }
}

function getGlobalSearchRecords() {
  return [
    ...state.transactions.map((transaction) => ({
      type: "Transaction",
      title: transaction.transaction_id,
      meta: `${transaction.transaction_type} · ${transaction.service} · ${transaction.booth}`,
      page: "transactions",
      search: `${transaction.transaction_id} ${transaction.transaction_type} ${transaction.phone_number} ${transaction.account_number} ${transaction.service} ${transaction.booth}`,
    })),
    ...state.booths.map((booth) => ({
      type: "Booth",
      title: booth.booth,
      meta: booth.location,
      page: "settings",
      search: `${booth.booth} ${booth.location}`,
    })),
    ...state.services.map((service) => ({
      type: "Service",
      title: service.service,
      meta: `Revenue ${(Number(service.revenue_rate) * 100).toFixed(2)}% · ${service.identifier_type}`,
      page: "settings",
      search: `${service.service} ${service.identifier_type}`,
    })),
    ...state.users.map((user) => ({
      type: "User",
      title: user.full_name,
      meta: `${user.username} · ${user.role}`,
      page: "users",
      search: `${user.full_name} ${user.username} ${user.email} ${user.role}`,
    })),
  ];
}

function renderGlobalSearchResults(query, showPage) {
  const resultsContainer = document.getElementById("global-search-results");
  if (!resultsContainer) return;

  const normalizedQuery = query.toLowerCase();
  const matches = getGlobalSearchRecords()
    .filter((record) => record.search.toLowerCase().includes(normalizedQuery))
    .slice(0, 8);

  resultsContainer.innerHTML = "";
  resultsContainer.hidden = false;

  if (matches.length === 0) {
    const empty = document.createElement("div");
    empty.className = "search-empty";
    empty.textContent = "No matching records found";
    resultsContainer.appendChild(empty);
    return;
  }

  matches.forEach((record) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-result";
    const type = document.createElement("span");
    type.className = "search-result-type";
    type.textContent = record.type;
    const title = document.createElement("span");
    title.className = "search-result-title";
    title.textContent = record.title;
    const meta = document.createElement("span");
    meta.className = "search-result-meta";
    meta.textContent = record.meta;
    button.append(type, title, meta);
    button.addEventListener("click", () => {
      document.getElementById("global-search").value = record.title;
      hideGlobalSearchResults();
      showPage(record.page);
    });
    resultsContainer.appendChild(button);
  });
}

async function handleGlobalSearch(query, showPage) {
  const requestId = ++globalSearchRequest;
  const trimmedQuery = query.trim();
  const clearButton = document.getElementById("global-search-clear");
  if (clearButton) clearButton.hidden = trimmedQuery.length === 0;

  if (trimmedQuery.length < 2) {
    hideGlobalSearchResults();
    return;
  }

  if (state.booths.length === 0 && state.services.length === 0 && state.transactions.length === 0 && state.users.length === 0) {
    try {
      await loadCoreData();
    } catch (err) {
      console.error("Failed to load global search data:", err);
      return;
    }
  }
  if (requestId === globalSearchRequest) renderGlobalSearchResults(trimmedQuery, showPage);
}

export function setupTopBar(showPage) {
  const searchInput = document.getElementById("global-search");
  const clearButton = document.getElementById("global-search-clear");
  const profileToggle = document.getElementById("profile-toggle");
  const profileImage = document.getElementById("profile-image");
  const profileInitials = document.getElementById("profile-initials");
  const profileMenu = document.getElementById("profile-menu");
  const profileUsersLink = document.getElementById("profile-users-link");

  profileImage.addEventListener("error", () => {
    profileImage.hidden = true;
    profileInitials.hidden = false;
  });
  searchInput.addEventListener("input", () => handleGlobalSearch(searchInput.value, showPage));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchInput.value = "";
      clearButton.hidden = true;
      hideGlobalSearchResults();
      searchInput.blur();
    }
  });
  clearButton.addEventListener("click", () => {
    searchInput.value = "";
    clearButton.hidden = true;
    hideGlobalSearchResults();
    searchInput.focus();
  });
  profileToggle.addEventListener("click", () => {
    const isOpen = profileToggle.getAttribute("aria-expanded") === "true";
    profileToggle.setAttribute("aria-expanded", String(!isOpen));
    profileMenu.hidden = isOpen;
  });
  profileUsersLink.addEventListener("click", () => {
    profileMenu.hidden = true;
    profileToggle.setAttribute("aria-expanded", "false");
    showPage("users");
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search")) hideGlobalSearchResults();
    if (!event.target.closest(".profile-wrap")) {
      profileMenu.hidden = true;
      profileToggle.setAttribute("aria-expanded", "false");
    }
  });
}
