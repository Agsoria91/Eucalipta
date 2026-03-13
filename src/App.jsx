import { useState, useMemo, useRef } from "react";

// ── Constants ──────────────────────────────────────────────────────────────
const COLORS = { cream:"#fff5e9", sage:"#aac395", forest:"#749558", sky:"#afd3d8", dark:"#2f3334" };
const CUOTA_SIN = 78000;
const CUOTA_CON = 83000;
const CARGO_EXTRA = { horneada_extra:8000, arcilla_extra:12000, multa:5000 };

const formatPeso = (n) => `$${Number(n).toLocaleString("es-AR")}`;
const formatDate = (d) => d ? new Date(d+"T00:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—";

// ── Ciclos 20→19 ───────────────────────────────────────────────────────────
function getCicloActual() {
  const hoy = new Date();
  const year = hoy.getFullYear(), month = hoy.getMonth();
  const desde = new Date(month===0?year-1:year, month===0?11:month-1, 20);
  const hasta  = new Date(year, month, 19);
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return { label:`${meses[hasta.getMonth()]} ${hasta.getFullYear()}`, desde, hasta, key:`${hasta.getFullYear()}-${String(hasta.getMonth()+1).padStart(2,"0")}` };
}
function getCiclos() {
  const result = [], hoy = new Date();
  for (let i=0; i<12; i++) {
    const ref = new Date(hoy.getFullYear(), hoy.getMonth()-i, 1);
    const year=ref.getFullYear(), month=ref.getMonth();
    const desde=new Date(month===0?year-1:year, month===0?11:month-1, 20);
    const hasta=new Date(year, month, 19);
    const meses=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    result.push({ label:`${meses[month]} ${year}`, desde, hasta, key:`${year}-${String(month+1).padStart(2,"0")}` });
  }
  return result;
}

// ── Photo upload abstraction ───────────────────────────────────────────────
// Cuando conecten Supabase Storage, solo reemplazar esta función.
// La UI no cambia nada.
async function uploadPhoto(file) {
  // ── MODO LOCAL (sin Supabase) ──
  // Convierte a base64 y lo guarda en memoria.
  // Limitación: se pierde al cerrar el navegador y ocupa RAM.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ url: reader.result, mode: "local" });
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });

  // ── MODO SUPABASE (descomentar cuando tengan Supabase Storage) ──
  // import { createClient } from "@supabase/supabase-js";
  // const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
  // const ext = file.name.split(".").pop();
  // const path = `horneadas/${Date.now()}.${ext}`;
  // const { error } = await supabase.storage.from("eucalipta").upload(path, file);
  // if (error) throw error;
  // const { data } = supabase.storage.from("eucalipta").getPublicUrl(path);
  // return { url: data.publicUrl, mode: "supabase" };
}

// ── Initial Data ───────────────────────────────────────────────────────────
const CICLO = getCicloActual();

const initialTurnos = [
  { id:1, dia:"Lunes",     hora:"10:00 a 12:00hs", profesora:"Azu",         capacidad:6 },
  { id:2, dia:"Lunes",     hora:"18:00 a 20:00hs", profesora:"Azu",         capacidad:6 },
  { id:3, dia:"Martes",    hora:"10:00 a 12:00hs", profesora:"Profe extra", capacidad:8 },
  { id:4, dia:"Miércoles", hora:"16:00 a 18:00hs", profesora:"Azu",         capacidad:6 },
  { id:5, dia:"Jueves",    hora:"18:00 a 20:00hs", profesora:"Profe extra", capacidad:8 },
  { id:6, dia:"Viernes",   hora:"10:00 a 12:00hs", profesora:"Azu",         capacidad:6 },
  { id:7, dia:"Sábado",    hora:"10:00 a 12:00hs", profesora:"Azu",         capacidad:10 },
];

const initialAlumnos = [
  { id:1, nombre:"María González",   turnoId:1, arcilla:true,  celular:"299-4561234", cumple:"1990-05-14",
    pagos:[{ cicloKey:CICLO.key, monto:CUOTA_CON, fecha:"2025-03-10", metodo:"transferencia", items:[], observaciones:"" }] },
  { id:2, nombre:"Laura Pérez",       turnoId:2, arcilla:false, celular:"299-4109876", cumple:"1995-11-03", pagos:[] },
  { id:3, nombre:"Sofía Martínez",    turnoId:3, arcilla:true,  celular:"", cumple:"",
    pagos:[{ cicloKey:CICLO.key, monto:CUOTA_CON, fecha:"2025-03-08", metodo:"efectivo", items:[], observaciones:"" }] },
  { id:4, nombre:"Ana Rodríguez",     turnoId:4, arcilla:false, celular:"299-4221100", cumple:"1988-07-22",
    pagos:[{ cicloKey:CICLO.key, monto:CUOTA_SIN, fecha:"2025-03-01", metodo:"transferencia", items:[], observaciones:"" }] },
  { id:5, nombre:"Valentina López",   turnoId:2, arcilla:true,  celular:"", cumple:"2000-03-30", pagos:[] },
  { id:6, nombre:"Camila Torres",     turnoId:7, arcilla:false, celular:"299-4881122", cumple:"",
    pagos:[{ cicloKey:CICLO.key, monto:CUOTA_SIN, fecha:"2025-03-15", metodo:"efectivo", items:[], observaciones:"" }] },
  { id:7, nombre:"Florencia Díaz",    turnoId:1, arcilla:true,  celular:"299-4773344", cumple:"1992-12-01", pagos:[] },
  { id:8, nombre:"Lucía Fernández",   turnoId:3, arcilla:false, celular:"", cumple:"",
    pagos:[{ cicloKey:CICLO.key, monto:CUOTA_SIN, fecha:"2025-03-12", metodo:"transferencia", items:[], observaciones:"" }] },
];

const initialEncargos = [
  { id:1, cliente:"María González", descripcion:"Juego de tazas x6", estado:"en_proceso", entrega:"2025-03-20", seña:15000, total:45000 },
  { id:2, cliente:"Roberto Silva",  descripcion:"Macetas medianas x3", estado:"listo",     entrega:"2025-03-15", seña:10000, total:28000 },
  { id:3, cliente:"Patricia Gómez", descripcion:"Cuencos x4",          estado:"pendiente", entrega:"2025-03-28", seña:0,     total:32000 },
  { id:4, cliente:"Lucas Herrera",  descripcion:"Platos de pasta x2",  estado:"entregado", entrega:"2025-03-10", seña:8000,  total:18000 },
];

// horneadas ahora tienen: foto (url|null), observaciones
const initialHorneadas = [
  { id:1, fecha:"2025-03-08", alumnoId:1, pieza:"Tazas x6",            notas:"1050°C",  foto:null, observaciones:"" },
  { id:2, fecha:"2025-03-08", alumnoId:3, pieza:"Bowl mediano",         notas:"",        foto:null, observaciones:"Quedó muy bien el esmalte" },
  { id:3, fecha:"2025-03-12", alumnoId:2, pieza:"Maceta pequeña x2",   notas:"Bizcocho",foto:null, observaciones:"" },
  { id:4, fecha:"2025-03-15", alumnoId:1, pieza:"Tazas esmaltadas x6", notas:"Vidriado",foto:null, observaciones:"Se rompió una en el horno" },
  { id:5, fecha:"2025-03-15", alumnoId:4, pieza:"Plato hondo",          notas:"",        foto:null, observaciones:"" },
];

const estadoConfig = {
  pendiente:  { label:"Pendiente",  color:"#e8c96a", text:"#7a5c00" },
  en_proceso: { label:"En proceso", color:"#afd3d8", text:"#2f3334" },
  listo:      { label:"Listo",      color:"#aac395", text:"#2f3334" },
  entregado:  { label:"Entregado",  color:"#d0d0d0", text:"#555"    },
};

const DIAS_ORDEN = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

// ── UI Atoms ───────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"white",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",padding:"28px 20px 48px" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
          <h2 style={{ fontSize:18,fontWeight:700,color:COLORS.dark,margin:0 }}>{title}</h2>
          <button onClick={onClose} style={{ background:"none",border:"none",fontSize:26,cursor:"pointer",color:"#aaa",lineHeight:1,padding:0 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
};

const Input = ({ label, ...props }) => (
  <div style={{ marginBottom:14 }}>
    {label && <label style={{ fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:5 }}>{label}</label>}
    <input {...props} style={{ width:"100%",border:"1.5px solid #e8e8e8",borderRadius:10,padding:"11px 14px",fontSize:15,outline:"none",fontFamily:"inherit",boxSizing:"border-box",background:"#fafafa",...props.style }}/>
  </div>
);

const Textarea = ({ label, ...props }) => (
  <div style={{ marginBottom:14 }}>
    {label && <label style={{ fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:5 }}>{label}</label>}
    <textarea {...props} style={{ width:"100%",border:"1.5px solid #e8e8e8",borderRadius:10,padding:"11px 14px",fontSize:15,outline:"none",fontFamily:"inherit",boxSizing:"border-box",background:"#fafafa",resize:"vertical",minHeight:72,...props.style }}/>
  </div>
);

const Sel = ({ label, children, ...props }) => (
  <div style={{ marginBottom:14 }}>
    {label && <label style={{ fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:5 }}>{label}</label>}
    <select {...props} style={{ width:"100%",border:"1.5px solid #e8e8e8",borderRadius:10,padding:"11px 14px",fontSize:15,outline:"none",fontFamily:"inherit",background:"#fafafa",boxSizing:"border-box" }}>{children}</select>
  </div>
);

const Btn = ({ children, onClick, variant="primary", style={} }) => (
  <button onClick={onClick} style={{ background:variant==="primary"?COLORS.forest:variant==="danger"?"#d95050":"#efefef",color:variant==="primary"?"white":variant==="danger"?"white":COLORS.dark,border:"none",borderRadius:12,padding:"13px 0",width:"100%",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:6,...style }}>{children}</button>
);

const FAB = ({ onClick }) => (
  <button onClick={onClick} style={{ position:"fixed",bottom:90,right:20,width:56,height:56,borderRadius:"50%",background:COLORS.forest,color:"white",fontSize:28,border:"none",cursor:"pointer",boxShadow:"0 4px 16px rgba(116,149,88,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50 }}>+</button>
);

const Row = ({ label, value, valueColor }) => (
  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #f0ece6" }}>
    <span style={{ fontSize:13,color:"#aaa",fontWeight:600 }}>{label}</span>
    <span style={{ fontSize:14,fontWeight:700,color:valueColor||COLORS.dark,textAlign:"right",maxWidth:"65%" }}>{value}</span>
  </div>
);

const LeafIcon = ({ size=20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6 2 2 8 2 14c0 4 2.5 7 6 8 0-4 1-8 4-11C15 8 19 6 22 6c0 0-2 12-10 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 22v-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

const icons = {
  alumnos:  () => <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><path d="M16 3.13a4 4 0 010 7.75"/><path d="M21 21v-2a4 4 0 00-3-3.87"/></svg>,
  turnos:   () => <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>,
  encargos: () => <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>,
  horno:    () => <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M6 6V4a2 2 0 012-2h8a2 2 0 012 2v2"/><circle cx="8" cy="13" r="1.5"/><circle cx="16" cy="13" r="1.5"/><path d="M11 13h2"/></svg>,
  finanzas: () => <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
};

// ── Helpers ────────────────────────────────────────────────────────────────
const pagoCiclo = (alumno, key) => alumno.pagos?.find(p=>p.cicloKey===key)||null;
const montoBase = (alumno) => alumno.arcilla ? CUOTA_CON : CUOTA_SIN;
const itemsLabel = (items) => { const m={horneada_extra:"Horneada extra",arcilla_extra:"Arcilla",multa:"Multa"}; return items.map(i=>m[i]||i).join(", "); };

// ── Photo Picker Component ─────────────────────────────────────────────────
function PhotoPicker({ value, onChange, label="Foto de la pieza (opcional)" }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    // Comprimir si es muy grande (>2MB)
    if (file.size > 2*1024*1024) {
      const canvas = document.createElement("canvas");
      const img = new Image();
      const url = URL.createObjectURL(file);
      await new Promise(resolve => { img.onload=resolve; img.src=url; });
      const maxW = 1200;
      const ratio = Math.min(maxW/img.width, maxW/img.height, 1);
      canvas.width = img.width*ratio; canvas.height = img.height*ratio;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.82));
      file = new File([blob], "pieza.jpg", { type:"image/jpeg" });
    }
    setUploading(true);
    try {
      const result = await uploadPhoto(file);
      onChange(result.url);
    } catch(e) {
      alert("Error al subir la foto: "+e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:8 }}>{label}</label>

      {value ? (
        <div style={{ position:"relative",borderRadius:12,overflow:"hidden",background:"#f5f5f5" }}>
          <img src={value} alt="pieza" style={{ width:"100%",maxHeight:220,objectFit:"cover",display:"block" }}/>
          <button onClick={() => onChange(null)} style={{ position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.55)",border:"none",borderRadius:"50%",width:32,height:32,color:"white",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1 }}>×</button>
          <button onClick={() => inputRef.current.click()} style={{ position:"absolute",bottom:8,right:8,background:"rgba(0,0,0,0.55)",border:"none",borderRadius:8,color:"white",fontSize:12,fontWeight:700,cursor:"pointer",padding:"6px 12px",fontFamily:"inherit" }}>Cambiar</button>
        </div>
      ) : (
        <div onClick={() => !uploading && inputRef.current.click()} style={{ border:"2px dashed #d0e8c8",borderRadius:12,padding:"24px",textAlign:"center",cursor:uploading?"wait":"pointer",background:"#f8fcf5",transition:"background 0.15s" }}>
          {uploading ? (
            <div style={{ color:COLORS.forest,fontSize:14,fontWeight:600 }}>Subiendo foto...</div>
          ) : (
            <>
              <div style={{ fontSize:28,marginBottom:6 }}>📷</div>
              <div style={{ fontSize:14,fontWeight:600,color:COLORS.forest }}>Tocar para agregar foto</div>
              <div style={{ fontSize:12,color:"#aaa",marginTop:4 }}>Cámara o galería · Se comprime automáticamente</div>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display:"none" }}
        onChange={e => handleFile(e.target.files[0])}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ALUMNAS
// ══════════════════════════════════════════════════════════════════════════
function AlumnosTab({ alumnos, setAlumnos, turnos }) {
  const ciclo = getCicloActual();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");
  const [modalAdd, setModalAdd] = useState(false);
  const [modalDet, setModalDet] = useState(null);
  const [modalPago, setModalPago] = useState(null);
  const [form, setForm] = useState({ nombre:"", turnoId:"", arcilla:false, celular:"", cumple:"" });
  const [pagoForm, setPagoForm] = useState({ fecha:"", metodo:"transferencia", items:[], observaciones:"" });

  const getTurno = id => turnos.find(t=>t.id===id);

  const filtered = useMemo(() => alumnos.filter(a => {
    const ms = a.nombre.toLowerCase().includes(search.toLowerCase());
    const pago = pagoCiclo(a, ciclo.key);
    const mf = filter==="todos"?true:filter==="pagados"?!!pago:!pago;
    return ms && mf;
  }), [alumnos, search, filter, ciclo.key]);

  const pagados = alumnos.filter(a=>!!pagoCiclo(a,ciclo.key)).length;

  const hoy = new Date();
  const proxCumple = alumnos.filter(a => {
    if (!a.cumple) return false;
    const c = new Date(a.cumple+"T00:00:00");
    const esteAnio = new Date(hoy.getFullYear(), c.getMonth(), c.getDate());
    const diff = (esteAnio-hoy)/86400000;
    return diff>=0 && diff<=30;
  });

  const registrarPago = () => {
    if (!pagoForm.fecha) return;
    const a = modalPago;
    const monto = montoBase(a) + pagoForm.items.reduce((s,i)=>s+(CARGO_EXTRA[i]||0),0);
    const nuevoPago = { cicloKey:ciclo.key, monto, fecha:pagoForm.fecha, metodo:pagoForm.metodo, items:pagoForm.items, observaciones:pagoForm.observaciones };
    setAlumnos(p => p.map(al => al.id===a.id ? {...al, pagos:[...(al.pagos||[]).filter(p=>p.cicloKey!==ciclo.key), nuevoPago]} : al));
    setModalPago(null); setModalDet(null);
    setPagoForm({ fecha:"", metodo:"transferencia", items:[], observaciones:"" });
  };

  const quitarPago = id => { setAlumnos(p=>p.map(a=>a.id===id?{...a,pagos:(a.pagos||[]).filter(p=>p.cicloKey!==ciclo.key)}:a)); setModalDet(null); };
  const addAlumno = () => { if(!form.nombre.trim())return; setAlumnos(p=>[...p,{id:Date.now(),...form,turnoId:Number(form.turnoId)||null,pagos:[]}]); setForm({nombre:"",turnoId:"",arcilla:false,celular:"",cumple:""}); setModalAdd(false); };
  const delAlumno = id => { setAlumnos(p=>p.filter(a=>a.id!==id)); setModalDet(null); };
  const toggleItem = item => setPagoForm(p=>({...p,items:p.items.includes(item)?p.items.filter(i=>i!==item):[...p.items,item]}));

  const itemsConfig = [
    { key:"horneada_extra", label:"Horneada extra",               precio:CARGO_EXTRA.horneada_extra },
    { key:"arcilla_extra",  label:"Arcilla",                      precio:CARGO_EXTRA.arcilla_extra  },
    { key:"multa",          label:"Multa por pago fuera de término", precio:CARGO_EXTRA.multa      },
  ];

  return (
    <div>
      <div style={{ background:`linear-gradient(135deg,${COLORS.forest},${COLORS.sage})`,borderRadius:14,padding:"12px 16px",marginBottom:14,color:"white",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div>
          <div style={{ fontSize:11,fontWeight:700,opacity:0.8,letterSpacing:"0.08em" }}>CICLO ACTIVO</div>
          <div style={{ fontSize:16,fontWeight:800 }}>{ciclo.label}</div>
          <div style={{ fontSize:11,opacity:0.75 }}>20/{ciclo.desde.getMonth()+1} — 19/{ciclo.hasta.getMonth()+1}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:28,fontWeight:900 }}>{pagados}<span style={{ fontSize:14,opacity:0.7 }}>/{alumnos.length}</span></div>
          <div style={{ fontSize:11,opacity:0.75 }}>pagaron</div>
        </div>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14 }}>
        {[{label:"Total",value:alumnos.length,color:COLORS.forest},{label:"Pagaron",value:pagados,color:"#5a9e6a"},{label:"Deben",value:alumnos.length-pagados,color:"#c0784a"}].map(s=>(
          <div key={s.label} style={{ background:"white",borderRadius:14,padding:"12px 8px",textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize:26,fontWeight:900,color:s.color }}>{s.value}</div>
            <div style={{ fontSize:11,color:"#aaa",fontWeight:600,marginTop:1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {proxCumple.length>0 && (
        <div style={{ background:"linear-gradient(135deg,#fde8b0,#fdf3d0)",borderRadius:14,padding:"12px 16px",marginBottom:14 }}>
          <div style={{ fontSize:12,fontWeight:700,color:"#a07820",marginBottom:6 }}>🎂 Cumpleaños próximos</div>
          {proxCumple.map(a=>{const c=new Date(a.cumple+"T00:00:00");return <div key={a.id} style={{ fontSize:14,color:"#7a5c00",fontWeight:600 }}>{a.nombre} — {c.getDate()}/{c.getMonth()+1}</div>;})}
        </div>
      )}

      <div style={{ display:"flex",gap:8,marginBottom:12 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar..." style={{ flex:1,border:"1.5px solid #e8e8e8",borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",fontFamily:"inherit",background:"white" }}/>
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{ border:"1.5px solid #e8e8e8",borderRadius:12,padding:"10px 12px",fontSize:13,outline:"none",fontFamily:"inherit",background:"white" }}>
          <option value="todos">Todas</option><option value="pagados">Pagaron</option><option value="pendientes">Deben</option>
        </select>
      </div>

      <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:90 }}>
        {filtered.map(a=>{
          const turno=getTurno(a.turnoId), pago=pagoCiclo(a,ciclo.key);
          return (
            <div key={a.id} onClick={()=>setModalDet(a)} style={{ background:"white",borderRadius:14,padding:"13px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 2px 8px rgba(0,0,0,0.05)",cursor:"pointer" }}>
              <div style={{ width:42,height:42,borderRadius:"50%",background:pago?COLORS.sage+"55":"#f5d4c0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:800,color:pago?COLORS.forest:"#c0784a",flexShrink:0 }}>{a.nombre.charAt(0)}</div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontWeight:700,color:COLORS.dark,fontSize:15,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{a.nombre}</div>
                <div style={{ fontSize:12,color:"#aaa",marginTop:2 }}>{turno?`${turno.dia} ${turno.hora}`:"Sin turno"} · {a.arcilla?"Con arcilla":"Sin arcilla"}</div>
              </div>
              <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4 }}>
                <div style={{ fontSize:13,fontWeight:800,color:pago?COLORS.forest:"#c0784a" }}>{formatPeso(pago?pago.monto:montoBase(a))}</div>
                <div style={{ fontSize:11,background:pago?"#e8f5e9":"#fdecea",color:pago?"#388e3c":"#c62828",borderRadius:6,padding:"2px 8px",fontWeight:700 }}>{pago?"✓ Pago":"Debe"}</div>
              </div>
            </div>
          );
        })}
      </div>

      <FAB onClick={()=>setModalAdd(true)}/>

      <Modal open={!!modalDet} onClose={()=>setModalDet(null)} title="Detalle alumna">
        {modalDet&&(()=>{
          const turno=getTurno(modalDet.turnoId), pago=pagoCiclo(modalDet,ciclo.key);
          return (
            <div>
              <div style={{ textAlign:"center",marginBottom:18 }}>
                <div style={{ width:60,height:60,borderRadius:"50%",background:COLORS.sage+"55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:900,color:COLORS.forest,margin:"0 auto 10px" }}>{modalDet.nombre.charAt(0)}</div>
                <div style={{ fontSize:19,fontWeight:800,color:COLORS.dark }}>{modalDet.nombre}</div>
              </div>
              <div style={{ background:COLORS.cream,borderRadius:14,padding:16,marginBottom:16 }}>
                <Row label="Turno" value={turno?`${turno.dia} ${turno.hora}`:"Sin turno"}/>
                {turno&&<Row label="Profesora" value={turno.profesora}/>}
                <Row label="Arcilla" value={modalDet.arcilla?"Incluida":"No incluida"}/>
                {modalDet.celular&&<Row label="📱 Celular" value={modalDet.celular}/>}
                {modalDet.cumple&&<Row label="🎂 Cumpleaños" value={formatDate(modalDet.cumple)}/>}
              </div>
              <div style={{ background:pago?"#e8f5e9":"#fdecea",borderRadius:14,padding:16,marginBottom:16 }}>
                <div style={{ fontWeight:700,color:pago?"#388e3c":"#c62828",fontSize:15,marginBottom:pago?8:0 }}>{pago?"✓ Pago "+ciclo.label:"⚠ Pendiente — "+ciclo.label}</div>
                {pago&&(<><Row label="Monto" value={formatPeso(pago.monto)}/><Row label="Fecha" value={formatDate(pago.fecha)}/><Row label="Método" value={pago.metodo}/>{pago.items?.length>0&&<Row label="Extras" value={itemsLabel(pago.items)}/>}{pago.observaciones&&<div style={{ marginTop:8,fontSize:13,color:"#555",fontStyle:"italic" }}>"{pago.observaciones}"</div>}</>)}
              </div>
              {!pago?<Btn onClick={()=>{setModalDet(null);setModalPago(modalDet);}}>✓ Registrar pago {ciclo.label}</Btn>:<Btn onClick={()=>quitarPago(modalDet.id)} variant="secondary">Quitar pago del ciclo</Btn>}
              <Btn onClick={()=>delAlumno(modalDet.id)} variant="danger" style={{ marginTop:8 }}>Eliminar alumna</Btn>
            </div>
          );
        })()}
      </Modal>

      <Modal open={!!modalPago} onClose={()=>setModalPago(null)} title={`Pago — ${modalPago?.nombre}`}>
        {modalPago&&(
          <div>
            <div style={{ background:COLORS.cream,borderRadius:12,padding:"12px 16px",marginBottom:16 }}>
              <div style={{ fontSize:13,color:"#aaa",marginBottom:4 }}>Cuota base {ciclo.label}</div>
              <div style={{ fontSize:22,fontWeight:900,color:COLORS.forest }}>{formatPeso(montoBase(modalPago))}</div>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:8 }}>Cargos adicionales</label>
              {itemsConfig.map(it=>(
                <div key={it.key} onClick={()=>toggleItem(it.key)} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderRadius:10,border:`1.5px solid ${pagoForm.items.includes(it.key)?COLORS.forest:"#e8e8e8"}`,background:pagoForm.items.includes(it.key)?"#e8f5e9":"white",marginBottom:8,cursor:"pointer" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <div style={{ width:20,height:20,borderRadius:4,border:`2px solid ${pagoForm.items.includes(it.key)?COLORS.forest:"#ccc"}`,background:pagoForm.items.includes(it.key)?COLORS.forest:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"white",flexShrink:0 }}>{pagoForm.items.includes(it.key)?"✓":""}</div>
                    <span style={{ fontSize:14,fontWeight:600,color:COLORS.dark }}>{it.label}</span>
                  </div>
                  <span style={{ fontSize:14,fontWeight:700,color:COLORS.forest }}>+{formatPeso(it.precio)}</span>
                </div>
              ))}
            </div>
            {pagoForm.items.length>0&&(
              <div style={{ background:COLORS.forest,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <span style={{ color:"white",fontWeight:700 }}>Total</span>
                <span style={{ color:"white",fontSize:20,fontWeight:900 }}>{formatPeso(montoBase(modalPago)+pagoForm.items.reduce((s,i)=>s+(CARGO_EXTRA[i]||0),0))}</span>
              </div>
            )}
            <Input label="Fecha de pago *" type="date" value={pagoForm.fecha} onChange={e=>setPagoForm(p=>({...p,fecha:e.target.value}))}/>
            <Sel label="Método" value={pagoForm.metodo} onChange={e=>setPagoForm(p=>({...p,metodo:e.target.value}))}>
              <option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option>
            </Sel>
            <Textarea label="Observaciones (opcional)" value={pagoForm.observaciones} onChange={e=>setPagoForm(p=>({...p,observaciones:e.target.value}))} placeholder="Ej: Pagó en dos cuotas..."/>
            <Btn onClick={registrarPago}>Confirmar pago</Btn>
          </div>
        )}
      </Modal>

      <Modal open={modalAdd} onClose={()=>setModalAdd(false)} title="Nueva alumna">
        <Input label="Nombre completo *" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} placeholder="Nombre y apellido"/>
        <Sel label="Turno" value={form.turnoId} onChange={e=>setForm(p=>({...p,turnoId:e.target.value}))}>
          <option value="">Sin turno</option>
          {turnos.map(t=><option key={t.id} value={t.id}>{t.dia} {t.hora} — {t.profesora}</option>)}
        </Sel>
        <Input label="📱 Celular (opcional)" value={form.celular} onChange={e=>setForm(p=>({...p,celular:e.target.value}))} type="tel" placeholder="299-4xxxxxx"/>
        <Input label="🎂 Cumpleaños (opcional)" value={form.cumple} onChange={e=>setForm(p=>({...p,cumple:e.target.value}))} type="date"/>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:8 }}>Arcilla</label>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
            {[false,true].map(v=>(
              <button key={String(v)} onClick={()=>setForm(p=>({...p,arcilla:v}))} style={{ padding:"10px 8px",borderRadius:12,border:`2px solid ${form.arcilla===v?COLORS.forest:"#e0e0e0"}`,background:form.arcilla===v?"#e8f5e9":"white",color:form.arcilla===v?COLORS.forest:"#aaa",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit" }}>
                {v?`Con — ${formatPeso(CUOTA_CON)}`:`Sin — ${formatPeso(CUOTA_SIN)}`}
              </button>
            ))}
          </div>
        </div>
        <Btn onClick={addAlumno}>Agregar alumna</Btn>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TURNOS
// ══════════════════════════════════════════════════════════════════════════
function TurnosTab({ turnos, setTurnos, alumnos }) {
  const [modalAdd, setModalAdd] = useState(false);
  const [modalDet, setModalDet] = useState(null);
  const [form, setForm] = useState({ dia:"Lunes", hora:"", profesora:"Azu", capacidad:6 });

  const ocupacion = id => alumnos.filter(a=>a.turnoId===id).length;
  const turnosPorDia = useMemo(()=>{const m={};DIAS_ORDEN.forEach(d=>{m[d]=turnos.filter(t=>t.dia===d);});return m;},[turnos]);
  const totalLugares = turnos.reduce((a,t)=>a+t.capacidad,0);

  const addTurno = () => { if(!form.hora.trim())return; setTurnos(p=>[...p,{id:Date.now(),...form,capacidad:Number(form.capacidad)}]); setForm({dia:"Lunes",hora:"",profesora:"Azu",capacidad:6}); setModalAdd(false); };
  const delTurno = id => { setTurnos(p=>p.filter(t=>t.id!==id)); setModalDet(null); };

  return (
    <div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16 }}>
        {[{label:"Lugares totales",value:totalLugares,color:COLORS.forest},{label:"Ocupados",value:alumnos.length,color:"#c0784a"},{label:"Disponibles",value:Math.max(0,totalLugares-alumnos.length),color:totalLugares-alumnos.length>0?"#5a9e6a":"#aaa"}].map(s=>(
          <div key={s.label} style={{ background:"white",borderRadius:14,padding:"12px 8px",textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize:24,fontWeight:900,color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10,color:"#aaa",fontWeight:600,marginTop:2,lineHeight:1.2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:90 }}>
        {DIAS_ORDEN.map(dia=>{
          const ts=turnosPorDia[dia]; if(!ts||ts.length===0)return null;
          return (
            <div key={dia}>
              <div style={{ fontSize:11,fontWeight:800,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6,paddingLeft:4 }}>{dia}</div>
              {ts.map(t=>{
                const ocup=ocupacion(t.id),libre=t.capacidad-ocup,pct=Math.min(ocup/t.capacidad,1);
                const alumnosEnTurno=alumnos.filter(a=>a.turnoId===t.id);
                return (
                  <div key={t.id} onClick={()=>setModalDet({...t,ocup,libre,alumnosEnTurno})} style={{ background:"white",borderRadius:14,padding:"14px 16px",marginBottom:8,boxShadow:"0 2px 8px rgba(0,0,0,0.05)",cursor:"pointer" }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                      <div><div style={{ fontWeight:700,color:COLORS.dark,fontSize:15 }}>{t.hora}</div><div style={{ fontSize:12,color:"#aaa",marginTop:2 }}>👩‍🏫 {t.profesora}</div></div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:18,fontWeight:900,color:ocup>=t.capacidad?"#c0784a":COLORS.forest }}>{ocup}<span style={{ fontSize:13,fontWeight:600,color:"#ccc" }}>/{t.capacidad}</span></div>
                        <div style={{ fontSize:11,color:ocup>=t.capacidad?"#c0784a":"#5a9e6a",fontWeight:700 }}>{ocup>=t.capacidad?"🔴 Completo":`${libre} libre${libre!==1?"s":""}`}</div>
                      </div>
                    </div>
                    <div style={{ background:"#f0f0f0",borderRadius:8,height:6,overflow:"hidden" }}><div style={{ width:`${pct*100}%`,height:"100%",background:pct>=1?"#c0784a":pct>0.75?COLORS.sage:COLORS.forest,borderRadius:8 }}/></div>
                    {alumnosEnTurno.length>0&&(<div style={{ display:"flex",marginTop:10,gap:4,flexWrap:"wrap" }}>{alumnosEnTurno.map(a=>(<div key={a.id} style={{ width:28,height:28,borderRadius:"50%",background:COLORS.sage+"55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:COLORS.forest }}>{a.nombre.charAt(0)}</div>))}</div>)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <FAB onClick={()=>setModalAdd(true)}/>
      <Modal open={!!modalDet} onClose={()=>setModalDet(null)} title="Detalle turno">
        {modalDet&&(<div>
          <div style={{ background:COLORS.cream,borderRadius:14,padding:16,marginBottom:16 }}>
            <Row label="Día" value={modalDet.dia}/><Row label="Horario" value={modalDet.hora}/><Row label="Profesora" value={modalDet.profesora}/><Row label="Capacidad" value={`${modalDet.capacidad} lugares`}/><Row label="Libres" value={modalDet.libre<0?`${Math.abs(modalDet.libre)} sobre cupo`:modalDet.libre} valueColor={modalDet.libre<=0?"#c0784a":"#388e3c"}/>
          </div>
          {modalDet.alumnosEnTurno.length>0&&(<div><div style={{ fontSize:12,fontWeight:700,color:"#aaa",textTransform:"uppercase",marginBottom:8 }}>Alumnas</div>{modalDet.alumnosEnTurno.map(a=>(<div key={a.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f5f5f5" }}><div style={{ width:32,height:32,borderRadius:"50%",background:COLORS.sage+"55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:COLORS.forest }}>{a.nombre.charAt(0)}</div><div style={{ flex:1 }}><div style={{ fontSize:14,fontWeight:700,color:COLORS.dark }}>{a.nombre}</div>{a.celular&&<div style={{ fontSize:12,color:"#aaa" }}>📱 {a.celular}</div>}</div></div>))}</div>)}
          <Btn onClick={()=>delTurno(modalDet.id)} variant="danger" style={{ marginTop:12 }}>Eliminar turno</Btn>
        </div>)}
      </Modal>
      <Modal open={modalAdd} onClose={()=>setModalAdd(false)} title="Nuevo turno">
        <Sel label="Día" value={form.dia} onChange={e=>setForm(p=>({...p,dia:e.target.value}))}>{DIAS_ORDEN.map(d=><option key={d}>{d}</option>)}</Sel>
        <Input label="Horario" value={form.hora} onChange={e=>setForm(p=>({...p,hora:e.target.value}))} placeholder="Ej: 18:00 a 20:00hs"/>
        <Input label="Profesora" value={form.profesora} onChange={e=>setForm(p=>({...p,profesora:e.target.value}))}/>
        <Input label="Capacidad" type="number" value={form.capacidad} onChange={e=>setForm(p=>({...p,capacidad:e.target.value}))}/>
        <Btn onClick={addTurno}>Crear turno</Btn>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ENCARGOS
// ══════════════════════════════════════════════════════════════════════════
function EncargosTab({ encargos, setEncargos }) {
  const [modalAdd, setModalAdd] = useState(false);
  const [modalDet, setModalDet] = useState(null);
  const [filterEstado, setFilterEstado] = useState("todos");
  const [form, setForm] = useState({ cliente:"", descripcion:"", entrega:"", seña:0, total:0, estado:"pendiente" });

  const filtered = encargos.filter(e=>filterEstado==="todos"?true:e.estado===filterEstado);
  const addEncargo = () => { if(!form.cliente.trim())return; setEncargos(p=>[...p,{id:Date.now(),...form,seña:Number(form.seña),total:Number(form.total)}]); setForm({cliente:"",descripcion:"",entrega:"",seña:0,total:0,estado:"pendiente"}); setModalAdd(false); };
  const cambiarEstado = (id,estado) => { setEncargos(p=>p.map(e=>e.id===id?{...e,estado}:e)); setModalDet(p=>p?.id===id?{...p,estado}:p); };
  const delEncargo = id => { setEncargos(p=>p.filter(e=>e.id!==id)); setModalDet(null); };

  return (
    <div>
      <div style={{ display:"flex",gap:8,marginBottom:14,overflowX:"auto",paddingBottom:4 }}>
        {["todos","pendiente","en_proceso","listo","entregado"].map(e=>{
          const count=e==="todos"?encargos.length:encargos.filter(x=>x.estado===e).length;
          const cfg=e==="todos"?{label:"Todos",color:"#e0e0e0",text:COLORS.dark}:estadoConfig[e];
          return <button key={e} onClick={()=>setFilterEstado(e)} style={{ flexShrink:0,padding:"8px 14px",borderRadius:20,background:filterEstado===e?cfg.color:"white",border:`2px solid ${filterEstado===e?cfg.color:"#e8e8e8"}`,color:filterEstado===e?(e==="todos"?COLORS.dark:cfg.text):"#aaa",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" }}>{cfg.label} ({count})</button>;
        })}
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:90 }}>
        {filtered.map(e=>{
          const cfg=estadoConfig[e.estado],resta=e.total-e.seña;
          return (
            <div key={e.id} onClick={()=>setModalDet(e)} style={{ background:"white",borderRadius:14,padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.05)",cursor:"pointer" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                <div style={{ flex:1,minWidth:0,paddingRight:8 }}><div style={{ fontWeight:700,color:COLORS.dark,fontSize:15 }}>{e.cliente}</div><div style={{ fontSize:12,color:"#aaa",marginTop:2 }}>{e.descripcion}</div></div>
                <span style={{ background:cfg.color,color:cfg.text,borderRadius:8,padding:"3px 10px",fontSize:12,fontWeight:700,flexShrink:0 }}>{cfg.label}</span>
              </div>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid #f5f5f5",paddingTop:8 }}>
                <div style={{ fontSize:12,color:"#aaa" }}>📅 {formatDate(e.entrega)}</div>
                <div style={{ display:"flex",gap:14 }}>
                  <div style={{ fontSize:12,textAlign:"right" }}><div style={{ color:"#aaa" }}>Seña</div><div style={{ fontWeight:700 }}>{formatPeso(e.seña)}</div></div>
                  <div style={{ fontSize:12,textAlign:"right" }}><div style={{ color:"#aaa" }}>Resta</div><div style={{ fontWeight:700,color:resta>0?"#c0784a":"#388e3c" }}>{formatPeso(resta)}</div></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <FAB onClick={()=>setModalAdd(true)}/>
      <Modal open={!!modalDet} onClose={()=>setModalDet(null)} title="Encargo">
        {modalDet&&(()=>{const cfg=estadoConfig[modalDet.estado],resta=modalDet.total-modalDet.seña;return(
          <div>
            <div style={{ background:COLORS.cream,borderRadius:14,padding:16,marginBottom:16 }}>
              <div style={{ fontWeight:800,fontSize:17,color:COLORS.dark,marginBottom:4 }}>{modalDet.cliente}</div>
              <div style={{ color:"#888",fontSize:14,marginBottom:12 }}>{modalDet.descripcion}</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10 }}>
                <div><div style={{ fontSize:11,color:"#aaa" }}>TOTAL</div><div style={{ fontWeight:800,color:COLORS.forest,fontSize:16 }}>{formatPeso(modalDet.total)}</div></div>
                <div><div style={{ fontSize:11,color:"#aaa" }}>SEÑA</div><div style={{ fontWeight:700,fontSize:15 }}>{formatPeso(modalDet.seña)}</div></div>
                <div><div style={{ fontSize:11,color:"#aaa" }}>RESTA</div><div style={{ fontWeight:700,fontSize:15,color:resta>0?"#c0784a":"#388e3c" }}>{formatPeso(resta)}</div></div>
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:8 }}>Estado</label>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                {Object.entries(estadoConfig).map(([key,c])=>(<button key={key} onClick={()=>cambiarEstado(modalDet.id,key)} style={{ padding:"10px",borderRadius:10,border:`2px solid ${modalDet.estado===key?c.color:"#e0e0e0"}`,background:modalDet.estado===key?c.color:"white",color:modalDet.estado===key?c.text:"#aaa",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit" }}>{c.label}</button>))}
              </div>
            </div>
            <Btn onClick={()=>delEncargo(modalDet.id)} variant="danger">Eliminar</Btn>
          </div>
        );})()}
      </Modal>
      <Modal open={modalAdd} onClose={()=>setModalAdd(false)} title="Nuevo encargo">
        <Input label="Cliente" value={form.cliente} onChange={e=>setForm(p=>({...p,cliente:e.target.value}))} placeholder="Nombre"/>
        <Input label="Descripción" value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))}/>
        <Input label="Fecha de entrega" type="date" value={form.entrega} onChange={e=>setForm(p=>({...p,entrega:e.target.value}))}/>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
          <Input label="Seña ($)" type="number" value={form.seña} onChange={e=>setForm(p=>({...p,seña:e.target.value}))}/>
          <Input label="Total ($)" type="number" value={form.total} onChange={e=>setForm(p=>({...p,total:e.target.value}))}/>
        </div>
        <Sel label="Estado" value={form.estado} onChange={e=>setForm(p=>({...p,estado:e.target.value}))}>
          {Object.entries(estadoConfig).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </Sel>
        <Btn onClick={addEncargo}>Guardar</Btn>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// HORNO — con foto y observaciones
// ══════════════════════════════════════════════════════════════════════════
function HornoTab({ horneadas, setHorneadas, alumnos }) {
  const [modalAdd, setModalAdd] = useState(false);
  const [modalDet, setModalDet] = useState(null);
  const [form, setForm] = useState({ fecha:"", alumnoId:"", pieza:"", notas:"", foto:null, observaciones:"" });

  const addHorneada = () => {
    if (!form.pieza.trim()||!form.fecha) return;
    setHorneadas(p=>[...p,{id:Date.now(),...form,alumnoId:Number(form.alumnoId)||null}]);
    setForm({ fecha:"", alumnoId:"", pieza:"", notas:"", foto:null, observaciones:"" });
    setModalAdd(false);
  };
  const delHorneada = id => { setHorneadas(p=>p.filter(h=>h.id!==id)); setModalDet(null); };
  const getNombre = id => alumnos.find(a=>a.id===id)?.nombre||"Sin asignar";

  const sesiones = useMemo(()=>{
    const map={};
    horneadas.forEach(h=>{if(!map[h.fecha])map[h.fecha]=[];map[h.fecha].push(h);});
    return Object.entries(map).sort((a,b)=>b[0].localeCompare(a[0]));
  },[horneadas]);

  const statsPorAlumno = useMemo(()=>{
    const map={};
    horneadas.forEach(h=>{if(h.alumnoId)map[h.alumnoId]=(map[h.alumnoId]||0)+1;});
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5);
  },[horneadas]);

  const maxStat = statsPorAlumno.length?Math.max(...statsPorAlumno.map(x=>x[1])):1;

  return (
    <div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16 }}>
        <div style={{ background:"linear-gradient(135deg,#f5c07a,#e8945a)",borderRadius:14,padding:"16px",color:"white" }}>
          <div style={{ fontSize:32,fontWeight:900 }}>{sesiones.length}</div>
          <div style={{ fontSize:12,fontWeight:700,opacity:0.85 }}>Horneadas del mes</div>
        </div>
        <div style={{ background:"white",borderRadius:14,padding:"16px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize:32,fontWeight:900,color:COLORS.forest }}>{horneadas.length}</div>
          <div style={{ fontSize:12,fontWeight:700,color:"#aaa" }}>Piezas en total</div>
        </div>
      </div>

      {statsPorAlumno.length>0&&(
        <div style={{ background:"white",borderRadius:14,padding:"14px 16px",marginBottom:14,boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize:12,fontWeight:800,color:"#aaa",textTransform:"uppercase",marginBottom:10 }}>Piezas por alumna</div>
          {statsPorAlumno.map(([id,count])=>(
            <div key={id} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
              <div style={{ width:30,height:30,borderRadius:"50%",background:COLORS.sage+"55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:COLORS.forest,flexShrink:0 }}>{getNombre(Number(id)).charAt(0)}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13,fontWeight:700,color:COLORS.dark }}>{getNombre(Number(id))}</div>
                <div style={{ background:"#f0f0f0",borderRadius:6,height:5,marginTop:4,overflow:"hidden" }}><div style={{ width:`${(count/maxStat)*100}%`,height:"100%",background:COLORS.forest,borderRadius:6 }}/></div>
              </div>
              <div style={{ fontSize:15,fontWeight:800,color:COLORS.forest }}>{count}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:90 }}>
        {sesiones.map(([fecha,items])=>(
          <div key={fecha} style={{ background:"white",borderRadius:14,padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
              <div style={{ fontSize:14,fontWeight:800,color:COLORS.dark }}>🔥 {formatDate(fecha)}</div>
              <div style={{ fontSize:12,background:"#fff0e0",color:"#c0784a",borderRadius:8,padding:"3px 10px",fontWeight:700 }}>{items.length} {items.length===1?"pieza":"piezas"}</div>
            </div>
            {items.map(h=>(
              <div key={h.id} onClick={()=>setModalDet(h)} style={{ padding:"10px 0",borderTop:"1px solid #f5f5f5",cursor:"pointer" }}>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  {/* Thumbnail */}
                  {h.foto ? (
                    <div style={{ width:48,height:48,borderRadius:8,overflow:"hidden",flexShrink:0 }}>
                      <img src={h.foto} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
                    </div>
                  ) : (
                    <div style={{ width:48,height:48,borderRadius:8,background:COLORS.sage+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:20 }}>🏺</div>
                  )}
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:14,fontWeight:700,color:COLORS.dark }}>{h.pieza}</div>
                    <div style={{ fontSize:12,color:"#aaa" }}>{h.alumnoId?getNombre(h.alumnoId):"Sin asignar"}{h.notas?` · ${h.notas}`:""}</div>
                    {h.observaciones&&<div style={{ fontSize:11,color:"#888",fontStyle:"italic",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>"{h.observaciones}"</div>}
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </div>
              </div>
            ))}
          </div>
        ))}
        {sesiones.length===0&&<div style={{ textAlign:"center",color:"#ccc",padding:"40px 0" }}>Aún no hay horneadas 🔥</div>}
      </div>

      <FAB onClick={()=>setModalAdd(true)}/>

      {/* Modal detalle horneada */}
      <Modal open={!!modalDet} onClose={()=>setModalDet(null)} title="Detalle pieza">
        {modalDet&&(
          <div>
            {modalDet.foto&&<img src={modalDet.foto} alt="pieza" style={{ width:"100%",borderRadius:14,marginBottom:16,maxHeight:260,objectFit:"cover" }}/>}
            <div style={{ background:COLORS.cream,borderRadius:14,padding:16,marginBottom:16 }}>
              <Row label="Pieza" value={modalDet.pieza}/>
              <Row label="Alumna" value={modalDet.alumnoId?getNombre(modalDet.alumnoId):"Sin asignar"}/>
              <Row label="Fecha" value={formatDate(modalDet.fecha)}/>
              {modalDet.notas&&<Row label="Notas técnicas" value={modalDet.notas}/>}
            </div>
            {modalDet.observaciones&&(
              <div style={{ background:"#f8f8f8",borderRadius:12,padding:"12px 16px",marginBottom:16 }}>
                <div style={{ fontSize:12,fontWeight:700,color:"#aaa",marginBottom:6 }}>OBSERVACIONES</div>
                <div style={{ fontSize:14,color:COLORS.dark,lineHeight:1.5 }}>{modalDet.observaciones}</div>
              </div>
            )}
            {!modalDet.foto&&<div style={{ textAlign:"center",color:"#ccc",fontSize:13,marginBottom:16 }}>Sin foto adjunta</div>}
            <Btn onClick={()=>delHorneada(modalDet.id)} variant="danger">Eliminar registro</Btn>
          </div>
        )}
      </Modal>

      {/* Modal agregar */}
      <Modal open={modalAdd} onClose={()=>setModalAdd(false)} title="Registrar horneada">
        <Input label="Fecha *" type="date" value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))}/>
        <Sel label="Alumna" value={form.alumnoId} onChange={e=>setForm(p=>({...p,alumnoId:e.target.value}))}>
          <option value="">Sin asignar</option>
          {[...alumnos].sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
        </Sel>
        <Input label="Pieza *" value={form.pieza} onChange={e=>setForm(p=>({...p,pieza:e.target.value}))} placeholder="Ej: Tazas x4"/>
        <Input label="Notas técnicas" value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} placeholder="Ej: Bizcocho 1050°C, vidriado"/>
        <Textarea label="Observaciones" value={form.observaciones} onChange={e=>setForm(p=>({...p,observaciones:e.target.value}))} placeholder="Ej: Se rompió una pieza, quedó muy bien el esmalte..."/>
        <PhotoPicker value={form.foto} onChange={url=>setForm(p=>({...p,foto:url}))}/>
        <Btn onClick={addHorneada}>Registrar</Btn>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// FINANZAS
// ══════════════════════════════════════════════════════════════════════════
function FinanzasTab({ alumnos, encargos }) {
  const ciclos = useMemo(()=>getCiclos(),[]);
  const [cicloKey, setCicloKey] = useState(ciclos[0].key);
  const cicloActual = ciclos.find(c=>c.key===cicloKey)||ciclos[0];

  const [movimientos, setMovimientos] = useState([
    {id:1,tipo:"ingreso",categoria:"cuota",descripcion:"Cuotas Marzo (lote)",monto:1560000,fecha:"2025-03-10",metodo:"transferencia",cicloKey:ciclos[0].key,observaciones:""},
    {id:2,tipo:"gasto",categoria:"material",descripcion:"Arcilla 20kg",monto:45000,fecha:"2025-03-08",metodo:"efectivo",cicloKey:ciclos[0].key,observaciones:""},
    {id:3,tipo:"ingreso",categoria:"encargo",descripcion:"Seña macetas Roberto",monto:10000,fecha:"2025-03-10",metodo:"transferencia",cicloKey:ciclos[0].key,observaciones:""},
    {id:4,tipo:"gasto",categoria:"sueldo",descripcion:"Sueldo profe extra",monto:180000,fecha:"2025-03-01",metodo:"transferencia",cicloKey:ciclos[0].key,observaciones:""},
    {id:5,tipo:"gasto",categoria:"material",descripcion:"Pintura cerámica",monto:28000,fecha:"2025-03-12",metodo:"efectivo",cicloKey:ciclos[0].key,observaciones:""},
  ]);
  const [modalAdd, setModalAdd] = useState(false);
  const [form, setForm] = useState({tipo:"ingreso",categoria:"cuota",descripcion:"",monto:"",fecha:"",metodo:"transferencia",observaciones:""});

  const movsDelCiclo = movimientos.filter(m=>m.cicloKey===cicloKey);
  const ingresos = movsDelCiclo.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.monto,0);
  const gastos   = movsDelCiclo.filter(m=>m.tipo==="gasto").reduce((a,m)=>a+m.monto,0);
  const balance  = ingresos-gastos;

  const alumnosPagaron   = alumnos.filter(a=>!!pagoCiclo(a,cicloKey));
  const alumnosNoPagaron = alumnos.filter(a=>!pagoCiclo(a,cicloKey));
  const recaudadoCuotas  = alumnos.reduce((s,a)=>{const p=pagoCiclo(a,cicloKey);return p?s+p.monto:s;},0);
  const porCobrarCuotas  = alumnosNoPagaron.reduce((s,a)=>s+montoBase(a),0);
  const encargosSaldo    = encargos.filter(e=>e.estado!=="entregado").reduce((a,e)=>a+(e.total-e.seña),0);
  const pctPagaron       = alumnos.length?Math.round((alumnosPagaron.length/alumnos.length)*100):0;

  const catColor = {cuota:COLORS.forest,encargo:"#5a9e8a",material:"#c0784a",sueldo:"#8070c0",otro:"#888"};
  const catLabel = {cuota:"Cuota",encargo:"Encargo",material:"Material",sueldo:"Sueldo",otro:"Otro"};

  const addMov = () => { if(!form.descripcion.trim()||!form.monto)return; setMovimientos(p=>[...p,{id:Date.now(),...form,monto:Number(form.monto),cicloKey}]); setForm({tipo:"ingreso",categoria:"cuota",descripcion:"",monto:"",fecha:"",metodo:"transferencia",observaciones:""}); setModalAdd(false); };
  const delMov = id => setMovimientos(p=>p.filter(m=>m.id!==id));

  return (
    <div>
      <div style={{ marginBottom:14 }}>
        <select value={cicloKey} onChange={e=>setCicloKey(e.target.value)} style={{ width:"100%",border:"1.5px solid #e8e8e8",borderRadius:12,padding:"12px 14px",fontSize:15,fontWeight:700,outline:"none",fontFamily:"inherit",background:"white",color:COLORS.dark }}>
          {ciclos.map(c=><option key={c.key} value={c.key}>{c.label}{c.key===ciclos[0].key?" (actual)":""}</option>)}
        </select>
      </div>

      <div style={{ background:balance>=0?`linear-gradient(135deg,${COLORS.forest},${COLORS.sage})`:"linear-gradient(135deg,#c0784a,#e0a080)",borderRadius:20,padding:"22px 20px",marginBottom:14,color:"white" }}>
        <div style={{ fontSize:11,fontWeight:700,opacity:0.85,letterSpacing:"0.06em" }}>BALANCE — {cicloActual.label.toUpperCase()}</div>
        <div style={{ fontSize:36,fontWeight:900,margin:"6px 0" }}>{formatPeso(balance)}</div>
        <div style={{ display:"flex",gap:20,opacity:0.9 }}>
          <div><div style={{ fontSize:11,opacity:0.75 }}>INGRESOS</div><div style={{ fontSize:16,fontWeight:700 }}>{formatPeso(ingresos)}</div></div>
          <div><div style={{ fontSize:11,opacity:0.75 }}>GASTOS</div><div style={{ fontSize:16,fontWeight:700 }}>{formatPeso(gastos)}</div></div>
        </div>
      </div>

      <div style={{ background:"white",borderRadius:14,padding:"16px",marginBottom:14,boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
        <div style={{ fontSize:12,fontWeight:800,color:"#aaa",textTransform:"uppercase",marginBottom:12 }}>Cuotas — {cicloActual.label}</div>
        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
          <span style={{ fontSize:13,fontWeight:700,color:COLORS.dark }}>{alumnosPagaron.length} de {alumnos.length} pagaron</span>
          <span style={{ fontSize:13,fontWeight:800,color:COLORS.forest }}>{pctPagaron}%</span>
        </div>
        <div style={{ background:"#f0f0f0",borderRadius:8,height:10,overflow:"hidden",marginBottom:14 }}>
          <div style={{ width:`${pctPagaron}%`,height:"100%",background:pctPagaron===100?COLORS.forest:pctPagaron>60?COLORS.sage:"#e8c96a",borderRadius:8 }}/>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
          <div style={{ background:"#e8f5e9",borderRadius:12,padding:"12px" }}><div style={{ fontSize:11,color:"#5a9e6a",fontWeight:700 }}>RECAUDADO</div><div style={{ fontSize:18,fontWeight:900,color:"#388e3c" }}>{formatPeso(recaudadoCuotas)}</div></div>
          <div style={{ background:"#fdecea",borderRadius:12,padding:"12px" }}><div style={{ fontSize:11,color:"#c0784a",fontWeight:700 }}>POR COBRAR</div><div style={{ fontSize:18,fontWeight:900,color:"#c62828" }}>{formatPeso(porCobrarCuotas)}</div></div>
        </div>
        {alumnosNoPagaron.length>0&&(
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:12,fontWeight:700,color:"#c0784a",marginBottom:6 }}>Pendientes ({alumnosNoPagaron.length})</div>
            {alumnosNoPagaron.map(a=>(<div key={a.id} style={{ display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0",borderBottom:"1px solid #f5f5f5",color:COLORS.dark }}><span>{a.nombre}</span><span style={{ fontWeight:700,color:"#c0784a" }}>{formatPeso(montoBase(a))}</span></div>))}
          </div>
        )}
        {alumnosNoPagaron.length===0&&alumnos.length>0&&<div style={{ marginTop:12,textAlign:"center",color:"#5a9e6a",fontWeight:700,fontSize:14 }}>🎉 ¡Todas pagaron este ciclo!</div>}
      </div>

      <div style={{ background:"white",borderRadius:14,padding:"14px 16px",marginBottom:14,boxShadow:"0 2px 8px rgba(0,0,0,0.05)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div><div style={{ fontSize:11,color:"#aaa",fontWeight:700 }}>ENCARGOS (saldo pendiente)</div><div style={{ fontSize:20,fontWeight:900,color:COLORS.forest,marginTop:2 }}>{formatPeso(encargosSaldo)}</div></div>
        <div style={{ fontSize:12,color:"#aaa" }}>por cobrar</div>
      </div>

      <div style={{ fontSize:13,fontWeight:800,color:COLORS.dark,marginBottom:10 }}>Movimientos del ciclo</div>
      <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:90 }}>
        {[...movsDelCiclo].reverse().map(m=>(
          <div key={m.id} style={{ background:"white",borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ width:38,height:38,borderRadius:"50%",background:m.tipo==="ingreso"?"#e8f5e9":"#fdecea",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0 }}>{m.tipo==="ingreso"?"↑":"↓"}</div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontWeight:700,color:COLORS.dark,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{m.descripcion}</div>
              <div style={{ fontSize:11,color:"#bbb",marginTop:1 }}><span style={{ background:catColor[m.categoria]+"22",color:catColor[m.categoria],borderRadius:4,padding:"1px 6px",fontWeight:600,marginRight:6 }}>{catLabel[m.categoria]}</span>{formatDate(m.fecha)} · {m.metodo}</div>
              {m.observaciones&&<div style={{ fontSize:11,color:"#aaa",marginTop:2,fontStyle:"italic" }}>"{m.observaciones}"</div>}
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:6 }}>
              <div style={{ fontSize:15,fontWeight:800,color:m.tipo==="ingreso"?"#388e3c":"#c62828" }}>{m.tipo==="ingreso"?"+":"-"}{formatPeso(m.monto)}</div>
              <button onClick={()=>delMov(m.id)} style={{ background:"none",border:"none",color:"#ddd",fontSize:18,cursor:"pointer",padding:"2px",lineHeight:1 }}>×</button>
            </div>
          </div>
        ))}
        {movsDelCiclo.length===0&&<div style={{ textAlign:"center",color:"#ccc",padding:"30px 0",fontSize:14 }}>Sin movimientos en este ciclo</div>}
      </div>
      <FAB onClick={()=>setModalAdd(true)}/>
      <Modal open={modalAdd} onClose={()=>setModalAdd(false)} title="Nuevo movimiento">
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
          {["ingreso","gasto"].map(t=>(<button key={t} onClick={()=>setForm(p=>({...p,tipo:t}))} style={{ padding:"10px",borderRadius:12,border:`2px solid ${form.tipo===t?(t==="ingreso"?COLORS.forest:"#c0784a"):"#e0e0e0"}`,background:form.tipo===t?(t==="ingreso"?"#e8f5e9":"#fdecea"):"white",color:form.tipo===t?(t==="ingreso"?COLORS.forest:"#c0784a"):"#aaa",fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"inherit" }}>{t==="ingreso"?"↑ Ingreso":"↓ Gasto"}</button>))}
        </div>
        <Sel label="Categoría" value={form.categoria} onChange={e=>setForm(p=>({...p,categoria:e.target.value}))}>{Object.entries(catLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</Sel>
        <Input label="Descripción" value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))} placeholder="Detalle"/>
        <Input label="Monto ($)" type="number" value={form.monto} onChange={e=>setForm(p=>({...p,monto:e.target.value}))}/>
        <Input label="Fecha" type="date" value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))}/>
        <Sel label="Método" value={form.metodo} onChange={e=>setForm(p=>({...p,metodo:e.target.value}))}><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option></Sel>
        <Textarea label="Observaciones (opcional)" value={form.observaciones} onChange={e=>setForm(p=>({...p,observaciones:e.target.value}))} placeholder="Notas adicionales..."/>
        <Btn onClick={addMov}>Guardar</Btn>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════════════════
const TABS = [
  {id:"alumnos", label:"Alumnas" },{id:"turnos",   label:"Turnos"  },
  {id:"encargos",label:"Encargos"},{id:"horno",    label:"Horno"   },
  {id:"finanzas",label:"Finanzas"},
];

export default function EucaliptaApp() {
  const [tab, setTab] = useState("alumnos");
  const [alumnos,   setAlumnos]   = useState(initialAlumnos);
  const [turnos,    setTurnos]    = useState(initialTurnos);
  const [encargos,  setEncargos]  = useState(initialEncargos);
  const [horneadas, setHorneadas] = useState(initialHorneadas);

  const titulos = {alumnos:"Alumnas",turnos:"Turnos",encargos:"Encargos",horno:"Horno",finanzas:"Finanzas"};

  return (
    <div style={{ background:COLORS.cream,minHeight:"100vh",fontFamily:"'Montserrat','Segoe UI',sans-serif",maxWidth:480,margin:"0 auto",position:"relative" }}>
      <div style={{ background:"white",padding:"14px 20px 12px",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid #f0ece6",position:"sticky",top:0,zIndex:40 }}>
        <div style={{ color:COLORS.forest }}><LeafIcon size={24}/></div>
        <div>
          <div style={{ fontSize:16,fontWeight:900,color:COLORS.dark,lineHeight:1 }}>Eucalipta</div>
          <div style={{ fontSize:9,letterSpacing:"0.12em",color:COLORS.forest,fontWeight:700,textTransform:"uppercase" }}>Taller de Cerámica</div>
        </div>
        <div style={{ marginLeft:"auto",fontSize:13,fontWeight:700,color:COLORS.forest }}>{titulos[tab]}</div>
      </div>
      <div style={{ padding:"14px 14px 0" }}>
        {tab==="alumnos"  &&<AlumnosTab  alumnos={alumnos}   setAlumnos={setAlumnos}   turnos={turnos}/>}
        {tab==="turnos"   &&<TurnosTab   turnos={turnos}     setTurnos={setTurnos}     alumnos={alumnos}/>}
        {tab==="encargos" &&<EncargosTab encargos={encargos} setEncargos={setEncargos}/>}
        {tab==="horno"    &&<HornoTab    horneadas={horneadas} setHorneadas={setHorneadas} alumnos={alumnos}/>}
        {tab==="finanzas" &&<FinanzasTab alumnos={alumnos}   encargos={encargos}/>}
      </div>
      <div style={{ position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"white",borderTop:"1px solid #f0ece6",display:"flex",zIndex:40 }}>
        {TABS.map(t=>{const Icon=icons[t.id];return(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1,padding:"10px 0 8px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,color:tab===t.id?COLORS.forest:"#ccc",fontFamily:"inherit" }}>
            <Icon/><span style={{ fontSize:9,fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase" }}>{t.label}</span>
            {tab===t.id&&<div style={{ width:4,height:4,borderRadius:"50%",background:COLORS.forest }}/>}
          </button>
        );})}
      </div>
    </div>
  );
}
