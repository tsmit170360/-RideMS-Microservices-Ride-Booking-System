import { useState, useEffect, useRef } from "react";

const API = "http://localhost:3000";

const req = async (method, path, body, token) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
};

const nominatim = async (query) => {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=in`;
  const r = await fetch(url, { headers: { "User-Agent": "RideMS-learning-app/1.0" } });
  return r.json();
};

const fetchSuggestions = (() => {
  let t = null;
  return (q, cb) => {
    clearTimeout(t);
    if (!q || q.trim().length < 3) { cb([]); return; }
    t = setTimeout(async () => {
      try { const d = await nominatim(q); cb(d.map(p => ({ label: p.display_name, lat: parseFloat(p.lat), lng: parseFloat(p.lon) }))); }
      catch { cb([]); }
    }, 400);
  };
})();

const C = {
  bg: "#0a0a0f", surface: "#13131a", card: "#1a1a24", border: "#2a2a3a",
  accent: "#6c63ff", accentSoft: "rgba(108,99,255,0.12)",
  green: "#22c55e", greenSoft: "rgba(34,197,94,0.12)",
  red: "#ef4444", redSoft: "rgba(239,68,68,0.12)",
  amber: "#f59e0b", amberSoft: "rgba(245,158,11,0.12)",
  text: "#f0f0f8", muted: "#8888aa", dim: "#44445a",
};

const S = {
  app: { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',system-ui,sans-serif", display: "flex", flexDirection: "column" },
  center: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px" },
  authCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "32px", width: "100%", maxWidth: "440px" },
  nav: { background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "60px", position: "sticky", top: 0, zIndex: 100 },
  logo: { fontSize: "20px", fontWeight: "700", letterSpacing: "-0.5px", color: C.text, display: "flex", alignItems: "center", gap: "8px" },
  layout: { display: "grid", gridTemplateColumns: "400px 1fr", minHeight: "calc(100vh - 60px)" },
  sidebar: { background: C.surface, borderRight: `1px solid ${C.border}`, padding: "20px", overflowY: "auto" },
  mapArea: { position: "relative", background: "#0d1117" },
  h2: { fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: C.text },
  label: { display: "block", fontSize: "11px", fontWeight: "600", color: C.muted, marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" },
  input: { width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: "9px", padding: "10px 13px", color: C.text, fontSize: "14px", outline: "none", boxSizing: "border-box" },
  select: { width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: "9px", padding: "10px 13px", color: C.text, fontSize: "14px", outline: "none", boxSizing: "border-box", appearance: "none" },
  dropdown: { position: "absolute", top: "100%", left: 0, right: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: "9px", zIndex: 300, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", marginTop: "3px" },
  dropItem: { padding: "9px 13px", fontSize: "12px", color: C.text, cursor: "pointer", borderBottom: `1px solid ${C.border}`, lineHeight: 1.4 },
  btn: (v = "primary") => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px", padding: "10px 18px", borderRadius: "9px", fontWeight: "600", fontSize: "13px", border: "none", cursor: "pointer", transition: "opacity 0.15s", ...(v === "primary" ? { background: C.accent, color: "#fff" } : v === "ghost" ? { background: "transparent", color: C.muted, border: `1px solid ${C.border}` } : v === "danger" ? { background: C.redSoft, color: C.red, border: `1px solid rgba(239,68,68,0.25)` } : v === "success" ? { background: C.greenSoft, color: C.green, border: `1px solid rgba(34,197,94,0.25)` } : v === "selected" ? { background: C.accent, color: "#fff", border: `1px solid ${C.accent}` } : v === "outline" ? { background: "transparent", color: C.text, border: `1px solid ${C.border}` } : {}) }),
  tag: (color = C.accent, bg = C.accentSoft) => ({ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", color, background: bg }),
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "14px", marginBottom: "12px" },
  row: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
  divider: { border: "none", borderTop: `1px solid ${C.border}`, margin: "16px 0" },
  toast: (t) => ({ position: "fixed", bottom: "24px", right: "24px", background: t === "error" ? C.red : t === "success" ? C.green : C.accent, color: "#fff", padding: "11px 16px", borderRadius: "9px", fontSize: "13px", fontWeight: "500", zIndex: 9999, maxWidth: "300px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", animation: "slideUp 0.2s ease" }),
};

const VEHICLES = [
  { type: "cab",  label: "Cab",  emoji: "🚖", desc: "Comfortable sedan" },
  { type: "auto", label: "Auto", emoji: "🛺", desc: "Quick & affordable" },
  { type: "bike", label: "Bike", emoji: "🏍️", desc: "Fastest option" },
];

// ─── Leaflet map ──────────────────────────────────────────────────────
let leafletLoaded = false;
const loadLeaflet = () => new Promise((res) => {
  if (leafletLoaded || window.L) { leafletLoaded = true; res(); return; }
  const css = document.createElement("link");
  css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(css);
  const script = document.createElement("script");
  script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  script.onload = () => { leafletLoaded = true; res(); };
  document.head.appendChild(script);
});

const isValidCoord = (c) => c && typeof c.lat === "number" && typeof c.lng === "number" && !isNaN(c.lat) && !isNaN(c.lng);

const MapView = ({ pickup, destination }) => {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    loadLeaflet().then(() => {
      if (!mapRef.current || !window.L) return;
      if (!instanceRef.current) {
        try {
          instanceRef.current = window.L.map(mapRef.current, { zoomControl: true }).setView([25.4358, 81.8463], 12);
          window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          }).addTo(instanceRef.current);
        } catch(e) { return; }
      }
      markersRef.current.forEach(m => { try { m.remove(); } catch {} });
      markersRef.current = [];
      const map = instanceRef.current;
      const L = window.L;
      const bounds = [];
      const greenIcon = L.divIcon({ html: `<div style="background:#22c55e;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px rgba(34,197,94,0.9)"></div>`, iconSize:[14,14], iconAnchor:[7,7], className:"" });
      const purpleIcon = L.divIcon({ html: `<div style="background:#6c63ff;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px rgba(108,99,255,0.9)"></div>`, iconSize:[14,14], iconAnchor:[7,7], className:"" });
      if (isValidCoord(pickup)) {
        try { const m = L.marker([pickup.lat, pickup.lng], { icon: greenIcon }).addTo(map).bindPopup(`<b>Pickup</b><br/>${pickup.label}`); markersRef.current.push(m); bounds.push([pickup.lat, pickup.lng]); } catch {}
      }
      if (isValidCoord(destination)) {
        try { const m = L.marker([destination.lat, destination.lng], { icon: purpleIcon }).addTo(map).bindPopup(`<b>Destination</b><br/>${destination.label}`); markersRef.current.push(m); bounds.push([destination.lat, destination.lng]); } catch {}
      }
      try {
        if (bounds.length === 2) {
          const [a, b] = bounds;
          const tooClose = Math.abs(a[0]-b[0]) < 0.001 && Math.abs(a[1]-b[1]) < 0.001;
          if (!tooClose) {
            const lb = L.latLngBounds(bounds);
            if (lb.isValid()) map.fitBounds(lb, { padding:[60,60], maxZoom:16 });
          } else { map.setView(a, 15); }
          const line = L.polyline(bounds, { color:"#6c63ff", weight:2, dashArray:"6 6", opacity:0.7 }).addTo(map);
          markersRef.current.push(line);
        } else if (bounds.length === 1) { map.setView(bounds[0], 14); }
      } catch {}
    });
  }, [pickup, destination]);

  return (
    <div style={{ height:"100%", position:"relative" }}>
      <div ref={mapRef} style={{ height:"100%", width:"100%" }} />
      {!pickup && !destination && (
        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center", color:C.muted, pointerEvents:"none" }}>
          <div style={{ fontSize:"36px", marginBottom:"8px" }}>🗺️</div>
          <div style={{ fontSize:"13px" }}>Enter locations to see route</div>
        </div>
      )}
      <div style={{ position:"absolute", bottom:"8px", left:"8px", zIndex:400, display:"flex", gap:"6px" }}>
        {pickup && <span style={S.tag(C.green,"rgba(34,197,94,0.15)")}>● Pickup</span>}
        {destination && <span style={S.tag(C.accent, C.accentSoft)}>● Destination</span>}
      </div>
    </div>
  );
};

// ─── LocationInput ────────────────────────────────────────────────────
const LocationInput = ({ label, value, onChange, onCoordPick, placeholder }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const handle = (val) => { onChange(val); fetchSuggestions(val, (s) => { setSuggestions(s); setOpen(s.length > 0); }); };
  const pick = (s) => { onChange(s.label); onCoordPick({ lat:s.lat, lng:s.lng, label:s.label }); setSuggestions([]); setOpen(false); };
  return (
    <div style={{ marginBottom:"12px", position:"relative" }} ref={ref}>
      <label style={S.label}>{label}</label>
      <input style={S.input} value={value} onChange={(e) => handle(e.target.value)} onFocus={() => suggestions.length > 0 && setOpen(true)} placeholder={placeholder} autoComplete="off" />
      {open && suggestions.length > 0 && (
        <div style={S.dropdown}>
          {suggestions.map((s,i) => (
            <div key={i} style={{ ...S.dropItem, ...(i===suggestions.length-1?{borderBottom:"none"}:{}) }}
              onMouseDown={() => pick(s)}
              onMouseEnter={e => e.currentTarget.style.background = C.surface}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              📍 {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Vehicle selector card ────────────────────────────────────────────
const VehicleSelector = ({ fares, selected, onSelect }) => (
  <div style={{ marginBottom:"14px" }}>
    <label style={S.label}>Choose vehicle</label>
    <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
      {VEHICLES.map(v => {
        const fare = fares?.[v.type];
        const isSelected = selected === v.type;
        return (
          <div key={v.type}
            onClick={() => onSelect(v.type)}
            style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderRadius:"10px", border:`1px solid ${isSelected ? C.accent : C.border}`, background: isSelected ? C.accentSoft : C.card, cursor:"pointer", transition:"all 0.15s" }}>
            <div style={S.row}>
              <span style={{ fontSize:"22px" }}>{v.emoji}</span>
              <div>
                <div style={{ fontWeight:"600", fontSize:"14px", color: isSelected ? C.accent : C.text }}>{v.label}</div>
                <div style={{ fontSize:"11px", color:C.muted }}>{v.desc}</div>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              {fare ? (
                <div style={{ fontWeight:"700", fontSize:"15px", color: isSelected ? C.accent : C.text }}>₹{fare}</div>
              ) : (
                <div style={{ fontSize:"12px", color:C.muted }}>—</div>
              )}
              {fares?.distanceKm && <div style={{ fontSize:"10px", color:C.muted }}>{fares.distanceKm} km</div>}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ─── Helpers ──────────────────────────────────────────────────────────
const Btn = ({ variant, style, ...p }) => <button style={{ ...S.btn(variant), ...style }} {...p} />;
const Toast = ({ msg, type }) => msg ? <div style={S.toast(type)}>{type==="error"?"✕ ":"✓ "}{msg}</div> : null;
const Dot = ({ on }) => <span style={{ width:8, height:8, borderRadius:"50%", background:on?C.green:C.dim, display:"inline-block", boxShadow:on?`0 0 6px ${C.green}`:"none" }} />;
const Field = ({ label, ...p }) => <div style={{ marginBottom:"12px" }}><label style={S.label}>{label}</label><input style={S.input} {...p} /></div>;
const SelectField = ({ label, children, ...p }) => <div style={{ marginBottom:"12px" }}><label style={S.label}>{label}</label><select style={S.select} {...p}>{children}</select></div>;
const Badge = ({ status }) => {
  const map = { requested:[C.amber,C.amberSoft], accepted:[C.green,C.greenSoft], completed:[C.muted,C.surface] };
  const [color,bg] = map[status]||[C.muted,C.surface];
  return <span style={S.tag(color,bg)}>{status}</span>;
};
const InfoBox = ({ label, value, accent }) => (
  <div style={{ background:accent?C.accentSoft:C.surface, border:`1px solid ${accent?"rgba(108,99,255,0.2)":C.border}`, borderRadius:"9px", padding:"11px", marginBottom:"8px" }}>
    <div style={{ fontSize:"10px", fontWeight:"600", color:C.muted, marginBottom:"3px", textTransform:"uppercase", letterSpacing:"0.5px" }}>{label}</div>
    <div style={{ fontSize:"13px", color:C.text }}>{value}</div>
  </div>
);
const Nav = ({ name, role, onLogout }) => (
  <nav style={S.nav}>
    <div style={S.logo}><span>⬡</span><span>RideMS</span><span style={{ ...S.tag(C.muted,C.surface), fontSize:"11px" }}>{role}</span></div>
    <div style={S.row}>
      <span style={{ color:C.muted, fontSize:"13px" }}>{name}</span>
      <Btn variant="ghost" style={{ padding:"7px 13px", fontSize:"12px" }} onClick={onLogout}>Logout</Btn>
    </div>
  </nav>
);

// ─── Auth ─────────────────────────────────────────────────────────────
const AuthForm = ({ mode, role, onSuccess, onSwitch }) => {
  const [step, setStep] = useState(1); // step 2 = captain vehicle details
  const [form, setForm] = useState({ name:"", email:"", password:"", vehicleType:"cab", plate:"", color:"" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submitStep1 = (e) => {
    e.preventDefault();
    if (role === "captain" && mode === "register") { setStep(2); return; }
    submitFinal();
  };

  const submitFinal = async () => {
    setLoading(true); setErr("");
    try {
      const path = `/${role}/${mode==="login"?"login":"register"}`;
      let body;
      if (mode === "login") {
        body = { email: form.email, password: form.password };
      } else if (role === "captain") {
        body = { name: form.name, email: form.email, password: form.password, vehicle: { type: form.vehicleType, plate: form.plate, color: form.color } };
      } else {
        body = { name: form.name, email: form.email, password: form.password };
      }
      const data = await req("POST", path, body);
      const token = data.token;
      const user = data.newUser || data.newcaptain || data.user || data.captain;
      onSuccess(token, user);
    } catch(e) { setErr(e.message); setStep(1); } finally { setLoading(false); }
  };

  return (
    <div style={S.center}>
      <div style={S.authCard}>
        <div style={{ textAlign:"center", marginBottom:"22px" }}>
          <div style={{ fontSize:"28px", marginBottom:"8px" }}>{role==="user"?"🧑":"🚗"}</div>
          <h1 style={{ fontSize:"22px", fontWeight:"700", letterSpacing:"-0.5px" }}>
            {mode==="login" ? "Welcome back" : step===1 ? "Create account" : "Vehicle details"}
          </h1>
          <p style={{ color:C.muted, fontSize:"13px", marginTop:"4px" }}>
            {role==="user"?"Rider":"Captain"} · {mode==="login"?"Sign in":"Sign up"}
            {role==="captain" && mode==="register" && <span style={{ color:C.accent }}> · Step {step}/2</span>}
          </p>
        </div>

        {/* Step 1 — basic info */}
        {step === 1 && (
          <div>
            {mode==="register" && <Field label="Full name" value={form.name} onChange={set("name")} placeholder="Your name" />}
            <Field label="Email" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" />
            <Field label="Password" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" />
            {err && <div style={{ background:C.redSoft, color:C.red, padding:"10px 13px", borderRadius:"8px", fontSize:"13px", marginBottom:"12px" }}>{err}</div>}
            <Btn
              type="button"
              style={{ width:"100%", marginBottom:"10px" }}
              disabled={loading}
              onClick={() => {
                if (!form.email || !form.password) return;
                if (mode==="login") { submitFinal(); return; }
                if (role==="captain") { setStep(2); return; }
                submitFinal();
              }}
            >
              {loading ? "Please wait…" : mode==="login" ? "Sign in" : role==="captain" ? "Next →" : "Create account"}
            </Btn>
          </div>
        )}

        {/* Step 2 — captain vehicle details */}
        {step === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); submitFinal(); }}>
            <div style={{ marginBottom:"12px" }}>
              <label style={S.label}>Vehicle type</label>
              <div style={{ display:"flex", gap:"8px" }}>
                {VEHICLES.map(v => (
                  <div key={v.type} onClick={() => setForm(f=>({...f, vehicleType:v.type}))}
                    style={{ flex:1, textAlign:"center", padding:"10px 6px", borderRadius:"9px", border:`1px solid ${form.vehicleType===v.type?C.accent:C.border}`, background:form.vehicleType===v.type?C.accentSoft:C.card, cursor:"pointer" }}>
                    <div style={{ fontSize:"20px" }}>{v.emoji}</div>
                    <div style={{ fontSize:"11px", fontWeight:"600", color:form.vehicleType===v.type?C.accent:C.muted, marginTop:"3px" }}>{v.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <Field label="Vehicle plate number" value={form.plate} onChange={set("plate")} placeholder="e.g. UP70 AB 1234" required />
            <Field label="Vehicle color" value={form.color} onChange={set("color")} placeholder="e.g. White" required />
            {err && <div style={{ background:C.redSoft, color:C.red, padding:"10px 13px", borderRadius:"8px", fontSize:"13px", marginBottom:"12px" }}>{err}</div>}
            <div style={{ display:"flex", gap:"8px" }}>
              <Btn variant="ghost" type="button" onClick={() => setStep(1)} style={{ flex:1 }}>← Back</Btn>
              <Btn type="submit" style={{ flex:2 }} disabled={loading}>
                {loading ? "Creating…" : "Create account"}
              </Btn>
            </div>
          </form>
        )}

        {step === 1 && (
          <>
            <hr style={S.divider} />
            <div style={{ display:"flex", flexDirection:"column", gap:"8px", textAlign:"center" }}>
              <button onClick={() => onSwitch("mode")} style={{ background:"none", border:"none", color:C.muted, fontSize:"13px", cursor:"pointer" }}>
                {mode==="login" ? "No account? Sign up" : "Already registered? Sign in"}
              </button>
              <button onClick={() => onSwitch("role")} style={{ background:"none", border:"none", color:C.accent, fontSize:"13px", cursor:"pointer", fontWeight:"600" }}>
                Switch to {role==="user"?"Captain":"Rider"} →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Rider dashboard ──────────────────────────────────────────────────
const RiderDashboard = ({ token, user, onLogout, showToast }) => {
  const [pickupText, setPickupText] = useState("");
  const [destText, setDestText] = useState("");
  const [pickupCoord, setPickupCoord] = useState(null);
  const [destCoord, setDestCoord] = useState(null);
  const [fares, setFares] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState("cab");
  const [ride, setRide] = useState(null);
  const [polling, setPolling] = useState(false);
  const [loadingFare, setLoadingFare] = useState(false);
  const [loadingRide, setLoadingRide] = useState(false);
  const [step, setStep] = useState("input"); // input | select | booked
  const pollRef = useRef(false);

  const getFares = async () => {
    if (!pickupText || !destText) return;
    setLoadingFare(true);
    try {
      const data = await req("GET", `/ride/get-fare?pickup=${encodeURIComponent(pickupText)}&destination=${encodeURIComponent(destText)}`, null, token);
      setFares(data);
      setStep("select");
    } catch(err) { showToast(err.message, "error"); }
    finally { setLoadingFare(false); }
  };

  const createRide = async () => {
    setLoadingRide(true);
    try {
      const data = await req("POST", "/ride/create-ride", { pickup:pickupText, destination:destText, vehicleType:selectedVehicle }, token);
      setRide(data);
      setStep("booked");
      showToast("Ride requested! Looking for a captain…", "success");
      pollForAcceptance();
    } catch(err) { showToast(err.message, "error"); }
    finally { setLoadingRide(false); }
  };

  const pollForAcceptance = async () => {
    setPolling(true); pollRef.current = true;
    try {
      const data = await req("GET", "/user/accepted-ride", null, token);
      if (pollRef.current && data?._id) { setRide(data); showToast("Captain accepted your ride!", "success"); }
    } catch {} finally { setPolling(false); }
  };

  const reset = () => { setRide(null); setPickupText(""); setDestText(""); setPickupCoord(null); setDestCoord(null); setFares(null); setStep("input"); pollRef.current = false; };

  return (
    <>
      <Nav name={user?.name||"Rider"} role="Rider" onLogout={onLogout} />
      <div style={S.layout}>
        <div style={S.sidebar}>

          {step === "input" && (
            <>
              <h2 style={S.h2}>Book a ride</h2>
              <LocationInput label="📍 Pickup" value={pickupText} onChange={setPickupText} onCoordPick={setPickupCoord} placeholder="Search pickup location…" />
              <LocationInput label="🏁 Destination" value={destText} onChange={setDestText} onCoordPick={setDestCoord} placeholder="Search destination…" />
              <Btn onClick={getFares} disabled={loadingFare||!pickupText||!destText} style={{ width:"100%", marginTop:"4px" }}>
                {loadingFare ? "Getting fares…" : "See fares →"}
              </Btn>
            </>
          )}

          {step === "select" && (
            <>
              <div style={{ ...S.row, marginBottom:"14px" }}>
                <button onClick={() => setStep("input")} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:"18px" }}>←</button>
                <h2 style={{ ...S.h2, marginBottom:0 }}>Choose a ride</h2>
              </div>
              <InfoBox label="📍 From" value={pickupText} />
              <InfoBox label="🏁 To" value={destText} />
              <hr style={S.divider} />
              <VehicleSelector fares={fares} selected={selectedVehicle} onSelect={setSelectedVehicle} />
              <Btn onClick={createRide} disabled={loadingRide} style={{ width:"100%", marginTop:"4px" }}>
                {loadingRide ? "Requesting…" : `Confirm ${VEHICLES.find(v=>v.type===selectedVehicle)?.emoji} ₹${fares?.[selectedVehicle]||"—"}`}
              </Btn>
            </>
          )}

          {step === "booked" && ride && (
            <>
              <div style={{ ...S.row, marginBottom:"14px" }}>
                <h2 style={{ ...S.h2, marginBottom:0 }}>Your ride</h2>
                <Badge status={ride.status||"requested"} />
              </div>
              <InfoBox label="📍 From" value={ride.pickup} />
              <InfoBox label="🏁 To" value={ride.destination} />
              <InfoBox label="Vehicle" value={`${VEHICLES.find(v=>v.type===ride.vehicleType)?.emoji||""} ${ride.vehicleType}`} />
              <InfoBox label="Fare" value={`₹${ride.fare}`} />

              {ride.status==="accepted" ? (
                <div style={{ background:C.greenSoft, border:`1px solid rgba(34,197,94,0.2)`, borderRadius:"10px", padding:"14px", margin:"12px 0" }}>
                  <div style={{ color:C.green, fontWeight:"600", marginBottom:"3px" }}>🎉 Captain on the way!</div>
                  <div style={{ color:C.muted, fontSize:"12px" }}>Your ride has been accepted.</div>
                </div>
              ) : polling ? (
                <div style={{ background:C.amberSoft, border:`1px solid rgba(245,158,11,0.2)`, borderRadius:"10px", padding:"14px", margin:"12px 0" }}>
                  <div style={{ color:C.amber, fontWeight:"600", marginBottom:"3px" }}>⏳ Finding a captain…</div>
                  <div style={{ color:C.muted, fontSize:"12px" }}>Waiting up to 30s</div>
                </div>
              ) : null}
              <Btn variant="ghost" onClick={reset} style={{ width:"100%", marginTop:"8px" }}>Book another ride</Btn>
            </>
          )}
        </div>
        <div style={S.mapArea}><MapView pickup={pickupCoord} destination={destCoord} /></div>
      </div>
    </>
  );
};

// ─── Captain dashboard ────────────────────────────────────────────────
const CaptainDashboard = ({ token, user, onLogout, showToast }) => {
  const [captain, setCaptain] = useState(user);
  const [incomingRide, setIncomingRide] = useState(null);
  const [listening, setListening] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rideCoords, setRideCoords] = useState({ pickup:null, destination:null });
  const listenRef = useRef(false);

  const geocodeRide = async (ride) => {
    try {
      const [p,d] = await Promise.all([nominatim(ride.pickup), nominatim(ride.destination)]);
      setRideCoords({
        pickup: p[0] ? { lat:parseFloat(p[0].lat), lng:parseFloat(p[0].lon), label:ride.pickup } : null,
        destination: d[0] ? { lat:parseFloat(d[0].lat), lng:parseFloat(d[0].lon), label:ride.destination } : null,
      });
    } catch {}
  };

  const toggle = async () => {
    try {
      const data = await req("PATCH", "/captain/toggle-availability", null, token);
      setCaptain(data);
      showToast(`You are now ${data.isAvailable?"available":"offline"}`, "success");
      if (data.isAvailable) startListening();
      else { listenRef.current = false; setListening(false); }
    } catch(err) { showToast(err.message, "error"); }
  };

  const startListening = () => {
    if (listening) return;
    setListening(true); listenRef.current = true;
    const poll = async () => {
      if (!listenRef.current) return setListening(false);
      try {
        const data = await req("GET", "/captain/new-ride", null, token);
        if (data?._id) { setIncomingRide(data); geocodeRide(data); showToast("New ride request!", "success"); setListening(false); return; }
      } catch {}
      if (listenRef.current) poll(); else setListening(false);
    };
    poll();
  };

  const acceptRide = async () => {
    if (!incomingRide) return;
    setAccepting(true);
    try {
      await req("PUT", `/ride/accept-ride?rideId=${incomingRide._id}`, null, token);
      showToast("Ride accepted! Rider notified.", "success");
      setIncomingRide(null); setRideCoords({ pickup:null, destination:null });
      if (captain.isAvailable) startListening();
    } catch(err) { showToast(err.message, "error"); } finally { setAccepting(false); }
  };

  const ignoreRide = () => { setIncomingRide(null); setRideCoords({ pickup:null, destination:null }); if (captain.isAvailable) startListening(); };

  const vInfo = captain?.vehicle;

  return (
    <>
      <Nav name={captain?.name||"Captain"} role="Captain" onLogout={onLogout} />
      <div style={S.layout}>
        <div style={S.sidebar}>
          {/* Status */}
          <div style={{ ...S.card, marginBottom:"12px" }}>
            <div style={{ ...S.row, justifyContent:"space-between" }}>
              <div>
                <div style={{ ...S.row, marginBottom:"4px" }}>
                  <Dot on={captain?.isAvailable} />
                  <span style={{ fontWeight:"600", fontSize:"14px" }}>{captain?.isAvailable?"Online":"Offline"}</span>
                  {listening && <span style={S.tag(C.accent,C.accentSoft)}><span style={{ animation:"pulse 1.5s infinite" }}>●</span> Listening</span>}
                </div>
                <div style={{ color:C.muted, fontSize:"12px" }}>{captain?.isAvailable?"Waiting for ride requests":"Go online to receive rides"}</div>
              </div>
              <Btn variant={captain?.isAvailable?"danger":"success"} onClick={toggle} style={{ fontSize:"12px", padding:"8px 12px" }}>
                {captain?.isAvailable?"Go Offline":"Go Online"}
              </Btn>
            </div>
            {vInfo && (
              <div style={{ marginTop:"12px", paddingTop:"12px", borderTop:`1px solid ${C.border}`, display:"flex", gap:"8px", alignItems:"center" }}>
                <span style={{ fontSize:"20px" }}>{VEHICLES.find(v=>v.type===vInfo.type)?.emoji||"🚗"}</span>
                <div>
                  <div style={{ fontSize:"13px", fontWeight:"600" }}>{vInfo.plate}</div>
                  <div style={{ fontSize:"11px", color:C.muted }}>{vInfo.color} · {vInfo.type}</div>
                </div>
              </div>
            )}
          </div>

          {/* Incoming ride */}
          {incomingRide ? (
            <div style={{ ...S.card, border:`1px solid rgba(108,99,255,0.4)`, animation:"glow 2s ease-in-out infinite alternate" }}>
              <div style={{ ...S.row, marginBottom:"12px" }}>
                <span style={{ fontSize:"18px" }}>🛎️</span>
                <span style={{ fontWeight:"600", color:C.accent }}>New Ride Request</span>
                <span style={{ marginLeft:"auto", ...S.tag(C.amber, C.amberSoft) }}>{VEHICLES.find(v=>v.type===incomingRide.vehicleType)?.emoji} {incomingRide.vehicleType}</span>
              </div>
              <InfoBox label="📍 Pickup" value={incomingRide.pickup} accent />
              <InfoBox label="🏁 Drop" value={incomingRide.destination} accent />
              <div style={{ background:C.greenSoft, borderRadius:"8px", padding:"10px 13px", marginBottom:"12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:"12px", color:C.muted }}>Fare</span>
                <span style={{ fontWeight:"700", fontSize:"16px", color:C.green }}>₹{incomingRide.fare}</span>
              </div>
              <div style={S.row}>
                <Btn variant="success" onClick={acceptRide} disabled={accepting} style={{ flex:1, fontSize:"12px" }}>{accepting?"Accepting…":"✓ Accept"}</Btn>
                <Btn variant="danger" onClick={ignoreRide} style={{ flex:1, fontSize:"12px" }}>✕ Ignore</Btn>
              </div>
            </div>
          ) : captain?.isAvailable && !listening ? (
            <div style={{ textAlign:"center", padding:"32px 0", color:C.muted }}>
              <div style={{ fontSize:"32px", marginBottom:"10px" }}>🚗</div>
              <div style={{ fontSize:"13px" }}>No rides right now</div>
            </div>
          ) : null}
        </div>
        <div style={S.mapArea}><MapView pickup={rideCoords.pickup} destination={rideCoords.destination} /></div>
      </div>
    </>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(() => {
    const t = sessionStorage.getItem("ms_token");
    const u = sessionStorage.getItem("ms_user");
    const r = sessionStorage.getItem("ms_role");
    return t ? { token:t, user:JSON.parse(u), role:r } : null;
  });
  const [authMode, setAuthMode] = useState("login");
  const [authRole, setAuthRole] = useState("user");
  const [toast, setToast] = useState(null);

  const showToast = (msg, type="info") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };
  const login = (token, user, role) => {
    sessionStorage.setItem("ms_token", token);
    sessionStorage.setItem("ms_user", JSON.stringify(user));
    sessionStorage.setItem("ms_role", role);
    setSession({ token, user, role });
    showToast(`Welcome, ${user?.name||"there"}!`, "success");
  };
  const logout = async () => {
    const path = session.role==="user" ? "/user/logout" : "/captain/logout";
    await req("GET", path, null, session.token).catch(() => {});
    sessionStorage.clear(); setSession(null);
  };
  const switchAuth = (what) => {
    if (what==="mode") setAuthMode(m => m==="login"?"register":"login");
    if (what==="role") setAuthRole(r => r==="user"?"captain":"user");
  };

  return (
    <>
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:${C.bg}; }
        input:focus, select:focus { border-color:${C.accent} !important; }
        button:hover { opacity:0.85; }
        .leaflet-container { background:#0d1117 !important; }
        @keyframes slideUp { from { transform:translateY(16px); opacity:0 } to { transform:translateY(0); opacity:1 } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes glow { from{box-shadow:0 0 0 rgba(108,99,255,0)} to{box-shadow:0 0 20px rgba(108,99,255,0.2)} }
      `}</style>
      <div style={S.app}>
        {!session
          ? <AuthForm mode={authMode} role={authRole} onSuccess={(t,u) => login(t,u,authRole)} onSwitch={switchAuth} />
          : session.role==="user"
          ? <RiderDashboard token={session.token} user={session.user} onLogout={logout} showToast={showToast} />
          : <CaptainDashboard token={session.token} user={session.user} onLogout={logout} showToast={showToast} />
        }
      </div>
      <Toast msg={toast?.msg} type={toast?.type} />
    </>
  );
}