export function formatDate(date: string | Date, locale = "hi-IN") {
  return new Date(date).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}
export function formatTime(date: string | Date, locale = "hi-IN") {
  return new Date(date).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}
export function formatCurrency(amount: number, locale = "hi-IN") {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}
export function getGreeting(hour = new Date().getHours()) {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}