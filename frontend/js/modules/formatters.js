export function money(amount) {
  const n = Number(amount) || 0;
  return "K " + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function percent(rate) {
  return (Number(rate) * 100).toFixed(2) + "%";
}

export function formatDateTime(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleString();
}

export function formatTime(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export function isSameDay(isoString, date) {
  const d = new Date(isoString);
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  );
}
