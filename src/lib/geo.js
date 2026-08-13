// ===========================================================================
// geo.js — مسافة بين نقطتين (haversine) وإيجاد أقرب نطاق عمل
//   يُستخدم لفرض النطاق الجغرافي على **الخادم**. تحقّق الواجهة وحده لا يكفي:
//   يُتجاوَز بأدوات المطوّر أو بتزييف الموقع أو بنداء API مباشر.
// ===========================================================================
const R = 6371e3; // نصف قطر الأرض بالمتر
const rad = (d) => (d * Math.PI) / 180;

export function distanceM(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

// أقرب نطاق للنقطة → { location, distance, within }
export function nearestLocation(lat, lng, locations = []) {
  let best = null;
  for (const loc of locations) {
    if (loc.latitude == null || loc.longitude == null) continue;
    const d = distanceM(lat, lng, loc.latitude, loc.longitude);
    if (!best || d < best.distance) best = { location: loc, distance: d };
  }
  if (!best) return null;
  return { ...best, within: best.distance <= (best.location.radius_m || 0) };
}
