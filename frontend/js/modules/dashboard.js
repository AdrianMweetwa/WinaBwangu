import { state } from "./state.js";
import { loadCoreData } from "./data-loader.js";
import { money } from "./formatters.js";

export async function renderDashboard() {
  try {
    await loadCoreData();
  } catch (err) {
    console.error("Failed to load dashboard data:", err);
    return;
  }

  const totalRevenue = state.transactions.reduce((sum, t) => sum + Number(t.transaction_revenue), 0);
  const totalCapital = state.services.reduce((sum, service) => sum + Number(service.monthly_transaction_limit), 0);
  document.getElementById("dash-total-revenue").textContent = money(totalRevenue);
  document.getElementById("dash-total-transactions").textContent = state.transactions.length;
  document.getElementById("dash-active-booths").textContent = state.booths.length;
  document.getElementById("dash-total-capital").textContent = money(totalCapital);

  const perService = state.services.map((service) => {
    const rows = state.transactions.filter((t) => t.service_id === service.id);
    const totalAmount = rows.reduce((sum, t) => sum + Number(t.transaction_amount), 0);
    const tax = rows.reduce((sum, t) => sum + Number(t.transaction_tax), 0);
    const revenue = rows.reduce((sum, t) => sum + Number(t.transaction_revenue), 0);
    const utilisation = service.monthly_transaction_limit > 0 ? totalAmount / service.monthly_transaction_limit : 0;
    return { service, count: rows.length, totalAmount, tax, revenue, utilisation };
  });
  const overallUtilisation = perService.length > 0
    ? perService.reduce((sum, service) => sum + service.utilisation, 0) / perService.length
    : 0;
  document.getElementById("dash-credit-utilised").textContent = `${(overallUtilisation * 100).toFixed(1)}%`;

  const tbody = document.getElementById("dashboard-service-tbody");
  tbody.innerHTML = "";
  if (perService.length === 0) {
    tbody.innerHTML = '<tr class="empty-table-row"><td colspan="6">No services found</td></tr>';
  } else {
    perService.forEach(({ service, count, totalAmount, revenue, utilisation }) => {
      const remaining = Math.max(service.monthly_transaction_limit - totalAmount, 0);
      const statusClass = utilisation >= 1 ? "exceeded" : utilisation >= 0.8 ? "warning" : "good";
      const statusText = utilisation >= 1 ? "Exceeded" : utilisation >= 0.8 ? "Near Limit" : "Good";
      const row = document.createElement("tr");
      row.innerHTML = `<td>${service.service}</td><td>${count}</td><td>${money(revenue)}</td><td>${money(totalAmount)}</td><td>${money(remaining)}</td><td><span class="service-status ${statusClass}">${statusText}</span></td>`;
      tbody.appendChild(row);
    });
  }

  const boothRows = state.booths.map((booth) => {
    const rows = state.transactions.filter((transaction) => transaction.booth_id === booth.id);
    const frequency = state.services
      .map((service) => {
        const count = rows.filter((transaction) => transaction.service_id === service.id).length;
        return count > 0 ? `${service.service}: ${count}` : null;
      })
      .filter(Boolean)
      .join(", ") || "-";
    return {
      booth,
      count: rows.length,
      revenue: rows.reduce((sum, transaction) => sum + Number(transaction.transaction_revenue), 0),
      frequency,
    };
  });
  const boothBody = document.getElementById("dashboard-booth-tbody");
  boothBody.innerHTML = "";
  if (boothRows.length === 0) {
    boothBody.innerHTML = '<tr class="empty-table-row"><td colspan="5">No booths found</td></tr>';
  } else {
    boothRows.forEach(({ booth, count, revenue, frequency }) => {
      const row = document.createElement("tr");
      [booth.booth, booth.location, count, money(revenue), frequency].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      boothBody.appendChild(row);
    });
  }

  renderBarChart("revenue-by-service-chart", perService.map((s) => ({ label: s.service.service, value: s.revenue })), money);
  renderBarChart("credit-utilization-chart", perService.map((s) => ({ label: s.service.service, value: s.utilisation * 100 })), (value) => `${value.toFixed(1)}%`, 100);
  renderBarChart("tax-obligations-chart", perService.map((s) => ({ label: s.service.service, value: s.tax })), money);
  renderPieChart("revenue-by-service-pie-chart", perService.map((s) => ({ label: s.service.service, value: s.revenue })));
  renderPieChart("revenue-by-booth-pie-chart", boothRows.map((row) => ({ label: row.booth.booth, value: row.revenue })));
}

const PIE_COLORS = ["#9d1d23", "#c94b52", "#e07b80", "#7a151a", "#d9a0a3", "#555555"];

function renderPieChart(containerId, rows) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row.value) || 0), 0);
  if (!rows.length || total <= 0) {
    container.innerHTML = '<div class="chart-empty">No data available</div>';
    return;
  }

  let cursor = 0;
  const stops = [];
  rows.forEach((row, index) => {
    const percentage = (Math.max(0, Number(row.value) || 0) / total) * 100;
    const next = cursor + percentage;
    stops.push(`${PIE_COLORS[index % PIE_COLORS.length]} ${cursor}% ${next}%`);
    cursor = next;
  });

  const pie = document.createElement("div");
  pie.className = "dashboard-pie";
  pie.style.background = `conic-gradient(${stops.join(", ")})`;
  const legend = document.createElement("div");
  legend.className = "pie-legend";
  rows.forEach((row, index) => {
    const item = document.createElement("div");
    item.className = "pie-legend-item";
    const swatch = document.createElement("span");
    swatch.className = "pie-legend-swatch";
    swatch.style.backgroundColor = PIE_COLORS[index % PIE_COLORS.length];
    const label = document.createElement("span");
    label.textContent = `${row.label}: ${money(row.value)}`;
    item.append(swatch, label);
    legend.appendChild(item);
  });
  container.append(pie, legend);
}

function renderBarChart(containerId, rows, formatValue, fixedMax = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  if (rows.length === 0) {
    container.innerHTML = '<div class="chart-empty">No data available</div>';
    return;
  }

  const max = fixedMax || Math.max(1, ...rows.map((row) => Number(row.value) || 0));
  const chart = document.createElement("div");
  chart.className = "proper-bar-chart";
  const yAxis = document.createElement("div");
  yAxis.className = "bar-chart-y-axis";
  [1, 0.75, 0.5, 0.25, 0].forEach((ratio) => {
    const tick = document.createElement("span");
    tick.textContent = formatValue(max * ratio);
    yAxis.appendChild(tick);
  });
  const plot = document.createElement("div");
  plot.className = "bar-chart-plot";
  const grid = document.createElement("div");
  grid.className = "bar-chart-grid";
  [0, 1, 2, 3, 4].forEach(() => grid.appendChild(document.createElement("span")));
  plot.appendChild(grid);
  const bars = document.createElement("div");
  bars.className = "bar-chart-bars";
  const labels = document.createElement("div");
  labels.className = "bar-chart-labels";
  rows.forEach(({ label, value }) => {
    const numericValue = Number(value) || 0;
    const column = document.createElement("div");
    column.className = "bar-chart-column";
    column.style.setProperty("--bar-height", `${Math.min(100, Math.max(0, (numericValue / max) * 100))}%`);
    column.title = `${label}: ${formatValue(numericValue)}`;
    const valueLabel = document.createElement("span");
    valueLabel.className = "bar-chart-value";
    valueLabel.textContent = formatValue(numericValue);
    const bar = document.createElement("span");
    bar.className = "bar-chart-bar";
    column.append(valueLabel, bar);
    bars.appendChild(column);
    const labelElement = document.createElement("span");
    labelElement.className = "bar-chart-label";
    labelElement.textContent = label;
    labels.appendChild(labelElement);
  });
  plot.appendChild(bars);
  chart.append(yAxis, plot, document.createElement("span"), labels);
  container.appendChild(chart);
}
