import { useState, useMemo, useRef, useEffect } from "react";
import { supabase } from "./supabase";

const CUOTA_SIN = 78000;
const CUOTA_CON = 83000;
const CARGO_EXTRA = { horneada_extra:8000, arcilla_extra:12000, multa:5000 };
const C = { cream:"#fff5e9", sage:"#aac395", forest:"#749558", dark:"#2f3334" };

const formatPeso = (n) => `$${Number(n).toLocaleString("es-AR")}`;
const formatDate = (d) => d ? new Date(d+"T00:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—";
const montoBase = (a) => a.arcilla ? CUOTA_CON : CUOTA_SIN;
const itemsLabel = (items) => { const m={horneada_extra:"Horneada extra",arcilla_extra:"Arcilla",multa:"Multa"}; return (items||[]).map(i=>m[i]||i).join(", "); };

// ── Estilos globales input ─────────────────────────────────────────────────
const INPUT_STYLE = {
  width:"100%", border:"1.5px solid #e8e8e8", borderRadius:10,
  padding:"11px 14px", fontSize:15, outline:"none", fontFamily:"inherit",
  boxSizing:"border-box", background:"white", color:"#2f3334",
};

// ── Responsive ─────────────────────────────────────────────────────────────
function useIsTablet() {
  const [tablet, setTablet] = useState(window.innerWidth >= 600);
  useEffect(() => {
    const fn = () => setTablet(window.innerWidth >= 600);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return tablet;
}

// ── Ciclos ─────────────────────────────────────────────────────────────────
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
function getCicloActual() {
  const hoy = new Date(), year = hoy.getFullYear(), month = hoy.getMonth();
  const desde = new Date(month===0?year-1:year, month===0?11:month-1, 25);
  const hasta  = new Date(year, month, 24);
  return { label:`${MESES[hasta.getMonth()]} ${hasta.getFullYear()}`, desde, hasta, key:`${hasta.getFullYear()}-${String(hasta.getMonth()+1).padStart(2,"0")}` };
}
function getCiclos() {
  const result = [], hoy = new Date();
  for (let i=0;i<12;i++) {
    const ref = new Date(hoy.getFullYear(), hoy.getMonth()-i, 1);
    const year=ref.getFullYear(), month=ref.getMonth();
    const desde=new Date(month===0?year-1:year, month===0?11:month-1, 25);
    const hasta=new Date(year, month, 24);
    result.push({ label:`${MESES[month]} ${year}`, desde, hasta, key:`${year}-${String(month+1).padStart(2,"0")}` });
  }
  return result;
}

// ── Excel export ───────────────────────────────────────────────────────────
function toCSV(headers, rows) {
  const esc = v => `"${String(v??"").replace(/"/g,'""')}"`;
  return [headers.map(esc).join(","), ...rows.map(r=>r.map(esc).join(","))].join("\n");
}
function downloadCSV(filename, csv) {
  const bom = "\uFEFF"; // UTF-8 BOM para que Excel abra bien con acentos
  const blob = new Blob([bom+csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

function exportAlumnas(alumnos, pagos, turnos) {
  const ciclo = getCicloActual();
  const getTurno = id => turnos.find(t=>t.id===id);
  const getPago = aid => pagos.find(p=>p.alumno_id===aid && p.ciclo_key===ciclo.key);
  const headers = ["Nombre","Turno","Arcilla","Celular","Cumpleaños","Estado pago "+ciclo.label,"Monto","Fecha pago","Método","Destinatario","Extras","Observaciones"];
  const rows = alumnos.map(a=>{
    const t=getTurno(a.turno_id), p=getPago(a.id);
    return [a.nombre, t?`${t.dia} ${t.hora}`:"Sin turno", a.arcilla?"Sí":"No", a.celular||"", a.cumple||"",
      p?"Pagó":"Debe", p?p.monto:montoBase(a), p?p.fecha:"", p?p.metodo:"", p?p.destinatario||"":"",
      p?itemsLabel(p.items):"", p?p.observaciones||"":""];
  });
  downloadCSV(`eucalipta-alumnas-${ciclo.key}.csv`, toCSV(headers, rows));
}

function exportPagos(pagos, alumnos) {
  const headers = ["Alumna","Ciclo","Monto","Fecha","Método","Destinatario","Extras","Observaciones"];
  const rows = pagos.map(p=>{
    const a=alumnos.find(x=>x.id===p.alumno_id);
    return [a?.nombre||"?", p.ciclo_key, p.monto, p.fecha, p.metodo, p.destinatario||"", itemsLabel(p.items), p.observaciones||""];
  });
  downloadCSV("eucalipta-pagos.csv", toCSV(headers, rows));
}

function exportMovimientos(movimientos, cicloLabel) {
  const headers = ["Tipo","Categoría","Descripción","Monto","Fecha","Método","Destinatario","Ciclo","Observaciones"];
  const catLabel={cuota:"Cuota",encargo:"Encargo",material:"Material",sueldo:"Sueldo",otro:"Otro"};
  const rows = movimientos.map(m=>[m.tipo,catLabel[m.categoria]||m.categoria,m.descripcion,m.monto,m.fecha,m.metodo,m.destinatario||"",m.ciclo_key,m.observaciones||""]);
  downloadCSV(`eucalipta-finanzas-${cicloLabel}.csv`, toCSV(headers, rows));
}

// ── Photo upload ───────────────────────────────────────────────────────────
async function uploadPhoto(file) {
  if (file.size > 2*1024*1024) {
    const canvas = document.createElement("canvas"), img = new Image();
    const url = URL.createObjectURL(file);
    await new Promise(r=>{img.onload=r;img.src=url;});
    const ratio = Math.min(1200/img.width, 1200/img.height, 1);
    canvas.width=img.width*ratio; canvas.height=img.height*ratio;
    canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
    URL.revokeObjectURL(url);
    file = new File([await new Promise(r=>canvas.toBlob(r,"image/jpeg",0.82))],"pieza.jpg",{type:"image/jpeg"});
  }
  const path = `horneadas/${Date.now()}.jpg`;
  const {error} = await supabase.storage.from("eucalipta").upload(path, file);
  if (error) throw error;
  return { url: supabase.storage.from("eucalipta").getPublicUrl(path).data.publicUrl };
}

// ── UI Atoms ───────────────────────────────────────────────────────────────
const Spinner = () => (
  <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"80px 0"}}>
    <div style={{width:36,height:36,border:`3px solid ${C.sage}`,borderTop:`3px solid ${C.forest}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

const Modal = ({open,onClose,title,children}) => {
  if(!open)return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"white",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,maxHeight:"90vh",overflowY:"auto",padding:"28px 24px 52px"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{fontSize:18,fontWeight:700,color:C.dark,margin:0}}>{title}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:28,cursor:"pointer",color:"#aaa",lineHeight:1,padding:0}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
};

const Input = ({label,...props}) => (
  <div style={{marginBottom:14}}>
    {label&&<label style={{fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:5}}>{label}</label>}
    <input {...props} style={{...INPUT_STYLE,...props.style}}/>
  </div>
);

const Textarea = ({label,...props}) => (
  <div style={{marginBottom:14}}>
    {label&&<label style={{fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:5}}>{label}</label>}
    <textarea {...props} style={{...INPUT_STYLE,resize:"vertical",minHeight:72,...props.style}}/>
  </div>
);

const Sel = ({label,children,...props}) => (
  <div style={{marginBottom:14}}>
    {label&&<label style={{fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:5}}>{label}</label>}
    <select {...props} style={{...INPUT_STYLE}}>{children}</select>
  </div>
);

// Selector destinatario transferencia
const DestSelector = ({value, onChange}) => (
  <div style={{marginBottom:14}}>
    <label style={{fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:8}}>Destinatario transferencia</label>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
      {["Azul","Agustín","—"].map(d=>(
        <button key={d} onClick={()=>onChange(d==="—"?"":d)} style={{padding:"10px 8px",borderRadius:12,border:`2px solid ${value===(d==="—"?"":d)?C.forest:"#e0e0e0"}`,background:value===(d==="—"?"":d)?"#e8f5e9":"white",color:value===(d==="—"?"":d)?C.forest:"#aaa",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>{d}</button>
      ))}
    </div>
  </div>
);

const Btn = ({children,onClick,variant="primary",style={},disabled=false}) => (
  <button onClick={onClick} disabled={disabled} style={{background:variant==="primary"?C.forest:variant==="danger"?"#d95050":variant==="export"?"#5a8ec0":"#efefef",color:["primary","danger","export"].includes(variant)?"white":C.dark,border:"none",borderRadius:12,padding:"13px 0",width:"100%",fontSize:15,fontWeight:700,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",marginTop:6,opacity:disabled?0.6:1,...style}}>{children}</button>
);

const FAB = ({onClick}) => (
  <button onClick={onClick} style={{position:"fixed",bottom:90,right:24,width:56,height:56,borderRadius:"50%",background:C.forest,color:"white",fontSize:28,border:"none",cursor:"pointer",boxShadow:"0 4px 16px rgba(116,149,88,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}}>+</button>
);

const Row = ({label,value,valueColor}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #f0ece6"}}>
    <span style={{fontSize:13,color:"#aaa",fontWeight:600}}>{label}</span>
    <span style={{fontSize:14,fontWeight:700,color:valueColor||C.dark,textAlign:"right",maxWidth:"65%"}}>{value}</span>
  </div>
);

const LeafIcon = ({size=20}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6 2 2 8 2 14c0 4 2.5 7 6 8 0-4 1-8 4-11C15 8 19 6 22 6c0 0-2 12-10 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 22v-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

const icons = {
  alumnos:  ()=><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><path d="M16 3.13a4 4 0 010 7.75"/><path d="M21 21v-2a4 4 0 00-3-3.87"/></svg>,
  turnos:   ()=><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>,
  encargos: ()=><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>,
  horno:    ()=><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M6 6V4a2 2 0 012-2h8a2 2 0 012 2v2"/><circle cx="8" cy="13" r="1.5"/><circle cx="16" cy="13" r="1.5"/><path d="M11 13h2"/></svg>,
  finanzas: ()=><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
};

const estadoConfig = {
  pendiente:  {label:"Pendiente",  color:"#e8c96a",text:"#7a5c00"},
  en_proceso: {label:"En proceso", color:"#afd3d8",text:"#2f3334"},
  listo:      {label:"Listo",      color:"#aac395",text:"#2f3334"},
  entregado:  {label:"Entregado",  color:"#d0d0d0",text:"#555"},
};

const DIAS_ORDEN = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

function PhotoPicker({value,onChange}) {
  const inputRef=useRef();
  const [uploading,setUploading]=useState(false);
  const handleFile=async(file)=>{if(!file)return;setUploading(true);try{const r=await uploadPhoto(file);onChange(r.url);}catch(e){alert("Error al subir la foto: "+e.message);}finally{setUploading(false);}};
  return (
    <div style={{marginBottom:14}}>
      <label style={{fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:8}}>Foto de la pieza (opcional)</label>
      {value?(
        <div style={{position:"relative",borderRadius:12,overflow:"hidden"}}>
          <img src={value} alt="pieza" style={{width:"100%",maxHeight:260,objectFit:"cover",display:"block"}}/>
          <button onClick={()=>onChange(null)} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.55)",border:"none",borderRadius:"50%",width:34,height:34,color:"white",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
      ):(
        <div onClick={()=>!uploading&&inputRef.current.click()} style={{border:"2px dashed #d0e8c8",borderRadius:12,padding:"28px",textAlign:"center",cursor:uploading?"wait":"pointer",background:"#f8fcf5"}}>
          {uploading?<div style={{color:C.forest,fontSize:14,fontWeight:600}}>Subiendo foto...</div>:<><div style={{fontSize:32,marginBottom:8}}>📷</div><div style={{fontSize:15,fontWeight:600,color:C.forest}}>Tocar para agregar foto</div><div style={{fontSize:12,color:"#aaa",marginTop:4}}>Cámara o galería</div></>}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ALUMNAS
// ══════════════════════════════════════════════════════════════════════════
function AlumnosTab({alumnos,pagos,turnos,onRefresh,tablet,rol}) {
  const ciclos=useMemo(()=>getCiclos(),[]);
  const [cicloKey,setCicloKey]=useState(getCicloActual().key);
  const ciclo=ciclos.find(c=>c.key===cicloKey)||ciclos[0];
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("todos");
  const [verBajas,setVerBajas]=useState(false);
  const [modalAdd,setModalAdd]=useState(false);
  const [modalDet,setModalDet]=useState(null);
  const [modalEdit,setModalEdit]=useState(null);
  const [modalPago,setModalPago]=useState(null);
  const [modalBaja,setModalBaja]=useState(null);
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({nombre:"",turnoId:"",arcilla:false,celular:"",cumple:""});
  const [editForm,setEditForm]=useState({nombre:"",turnoId:"",arcilla:false,celular:"",cumple:""});
  const [pagoForm,setPagoForm]=useState({fecha:"",metodo:"transferencia",destinatario:"",items:[],observaciones:""});
  const [bajaForm,setBajaForm]=useState({fecha_baja:"",motivo_baja:""});

  const getTurno=id=>turnos.find(t=>t.id===id);
  const getPago=aid=>pagos.find(p=>p.alumno_id===aid&&p.ciclo_key===ciclo.key)||null;
  const getHistorial=aid=>pagos.filter(p=>p.alumno_id===aid).sort((a,b)=>b.ciclo_key.localeCompare(a.ciclo_key));

  const activas=alumnos.filter(a=>a.activa!==false);
  const bajas=alumnos.filter(a=>a.activa===false);
  const lista=verBajas?bajas:activas;
  const pagados=activas.filter(a=>!!getPago(a.id)).length;

  const filtered=useMemo(()=>lista.filter(a=>{
    const ms=a.nombre.toLowerCase().includes(search.toLowerCase());
    const pago=getPago(a.id);
    const mf=filter==="todos"?true:filter==="pagados"?!!pago:!pago;
    return ms&&mf;
  }),[lista,pagos,search,filter]);

  const hoy=new Date();
  const proxCumple=activas.filter(a=>{
    if(!a.cumple)return false;
    const c=new Date(a.cumple+"T00:00:00");
    const diff=(new Date(hoy.getFullYear(),c.getMonth(),c.getDate())-hoy)/86400000;
    return diff>=0&&diff<=30;
  });

  const registrarPago=async()=>{
    if(!pagoForm.fecha)return;
    setSaving(true);
    const monto=montoBase(modalPago)+pagoForm.items.reduce((s,i)=>s+(CARGO_EXTRA[i]||0),0);
    await supabase.from("pagos").insert({alumno_id:modalPago.id,ciclo_key:ciclo.key,monto,fecha:pagoForm.fecha,metodo:pagoForm.metodo,destinatario:pagoForm.metodo==="transferencia"?pagoForm.destinatario:"",items:pagoForm.items,observaciones:pagoForm.observaciones});
    await onRefresh();setSaving(false);setModalPago(null);setModalDet(null);
    setPagoForm({fecha:"",metodo:"transferencia",destinatario:"",items:[],observaciones:""});
  };

  const quitarPago=async(aid)=>{setSaving(true);await supabase.from("pagos").delete().eq("alumno_id",aid).eq("ciclo_key",ciclo.key);await onRefresh();setSaving(false);setModalDet(null);};

  const addAlumno=async()=>{
    if(!form.nombre.trim())return;
    setSaving(true);
    await supabase.from("alumnos").insert({nombre:form.nombre,turno_id:Number(form.turnoId)||null,arcilla:form.arcilla,celular:form.celular,cumple:form.cumple,activa:true});
    await onRefresh();setSaving(false);setForm({nombre:"",turnoId:"",arcilla:false,celular:"",cumple:""});setModalAdd(false);
  };

  const editarAlumno=async()=>{
    if(!editForm.nombre.trim())return;
    setSaving(true);
    await supabase.from("alumnos").update({nombre:editForm.nombre,turno_id:Number(editForm.turnoId)||null,arcilla:editForm.arcilla,celular:editForm.celular,cumple:editForm.cumple}).eq("id",modalEdit.id);
    await onRefresh();setSaving(false);
    setModalEdit(null);setModalDet(null);
  };

  const darBaja=async()=>{
    if(!bajaForm.fecha_baja)return;
    setSaving(true);
    await supabase.from("alumnos").update({activa:false,fecha_baja:bajaForm.fecha_baja,motivo_baja:bajaForm.motivo_baja}).eq("id",modalBaja.id);
    await onRefresh();setSaving(false);setModalBaja(null);setModalDet(null);
    setBajaForm({fecha_baja:"",motivo_baja:""});
  };

  const reactivar=async(id)=>{
    setSaving(true);
    await supabase.from("alumnos").update({activa:true,fecha_baja:null,motivo_baja:null}).eq("id",id);
    await onRefresh();setSaving(false);setModalDet(null);
  };

  const toggleItem=item=>setPagoForm(p=>({...p,items:p.items.includes(item)?p.items.filter(i=>i!==item):[...p.items,item]}));

  const itemsConfig=[
    {key:"horneada_extra",label:"Horneada extra",precio:CARGO_EXTRA.horneada_extra},
    {key:"arcilla_extra",label:"Arcilla",precio:CARGO_EXTRA.arcilla_extra},
    {key:"multa",label:"Multa por pago fuera de término",precio:CARGO_EXTRA.multa},
  ];

  return (
    <div>
      {/* Selector de ciclo */}
      <select value={cicloKey} onChange={e=>setCicloKey(e.target.value)} style={{...INPUT_STYLE,fontWeight:700,fontSize:15,marginBottom:12}}>
        {ciclos.map(c=><option key={c.key} value={c.key}>{c.label}{c.key===getCicloActual().key?" (actual)":""}</option>)}
      </select>

      {/* Banner ciclo */}
      <div style={{background:`linear-gradient(135deg,${C.forest},${C.sage})`,borderRadius:16,padding:"14px 20px",marginBottom:16,color:"white",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,opacity:0.8,letterSpacing:"0.08em"}}>{cicloKey===getCicloActual().key?"CICLO ACTIVO":"CICLO HISTÓRICO"}</div>
          <div style={{fontSize:18,fontWeight:800}}>{ciclo.label}</div>
          <div style={{fontSize:12,opacity:0.75}}>25/{ciclo.desde.getMonth()+1} — 24/{ciclo.hasta.getMonth()+1}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:32,fontWeight:900}}>{pagados}<span style={{fontSize:16,opacity:0.7}}>/{activas.length}</span></div>
          <div style={{fontSize:12,opacity:0.75}}>pagaron</div>
        </div>
      </div>

      {/* Stats clickeables */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:16}}>
        {[
          {key:"todos",label:"Activas",value:activas.length,color:C.forest,action:()=>{setVerBajas(false);setFilter("todos");}},
          {key:"pagados",label:"Pagaron",value:pagados,color:"#5a9e6a",action:()=>{setVerBajas(false);setFilter("pagados");}},
          {key:"pendientes",label:"Deben",value:activas.length-pagados,color:"#c0784a",action:()=>{setVerBajas(false);setFilter("pendientes");}},
          {key:"bajas",label:"Bajas",value:bajas.length,color:"#aaa",action:()=>{setVerBajas(true);setFilter("todos");}},
        ].map(s=>(
          <div key={s.key} onClick={s.action} style={{background:(s.key==="bajas"?verBajas:!verBajas&&filter===s.key)?s.color:"white",borderRadius:14,padding:"12px 6px",textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",cursor:"pointer",border:`2px solid ${(s.key==="bajas"?verBajas:!verBajas&&filter===s.key)?s.color:"transparent"}`}}>
            <div style={{fontSize:24,fontWeight:900,color:(s.key==="bajas"?verBajas:!verBajas&&filter===s.key)?"white":s.color}}>{s.value}</div>
            <div style={{fontSize:11,fontWeight:600,marginTop:2,color:(s.key==="bajas"?verBajas:!verBajas&&filter===s.key)?"rgba(255,255,255,0.85)":"#aaa"}}>{s.label}</div>
          </div>
        ))}
      </div>

      {proxCumple.length>0&&(
        <div style={{background:"linear-gradient(135deg,#fde8b0,#fdf3d0)",borderRadius:14,padding:"12px 18px",marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:"#a07820",marginBottom:6}}>🎂 Cumpleaños próximos</div>
          {proxCumple.map(a=>{const c=new Date(a.cumple+"T00:00:00");return <div key={a.id} style={{fontSize:14,color:"#7a5c00",fontWeight:600}}>{a.nombre} — {c.getDate()}/{c.getMonth()+1}</div>;})}
        </div>
      )}

      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar..." style={{...INPUT_STYLE,flex:1,padding:"11px 16px"}}/>
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{...INPUT_STYLE,width:"auto",padding:"11px 14px"}}>
          <option value="todos">Todas</option><option value="pagados">Pagaron</option><option value="pendientes">Deben</option>
        </select>
      </div>

      {/* Toggle activas/bajas */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>setVerBajas(false)} style={{flex:1,padding:"9px",borderRadius:10,border:`2px solid ${!verBajas?C.forest:"#e0e0e0"}`,background:!verBajas?"#e8f5e9":"white",color:!verBajas?C.forest:"#aaa",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Activas ({activas.length})</button>
        <button onClick={()=>setVerBajas(true)} style={{flex:1,padding:"9px",borderRadius:10,border:`2px solid ${verBajas?"#aaa":"#e0e0e0"}`,background:verBajas?"#f0f0f0":"white",color:verBajas?"#666":"#aaa",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Bajas ({bajas.length})</button>
      </div>

      {/* Exportar — solo admin */}
      {(rol==="admin"||rol===null)&&<div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>exportAlumnas(alumnos,pagos,turnos)} style={{flex:1,background:"#e8f5e9",border:"none",borderRadius:10,padding:"9px",fontSize:12,fontWeight:700,color:C.forest,cursor:"pointer",fontFamily:"inherit"}}>📥 Exportar alumnas</button>
        <button onClick={()=>exportPagos(pagos,alumnos)} style={{flex:1,background:"#e8f5e9",border:"none",borderRadius:10,padding:"9px",fontSize:12,fontWeight:700,color:C.forest,cursor:"pointer",fontFamily:"inherit"}}>📥 Exportar pagos</button>
      </div>}

      {/* Lista */}
      <div style={{display:"grid",gridTemplateColumns:tablet?"1fr 1fr":"1fr",gap:10,marginBottom:100}}>
        {filtered.map(a=>{
          const turno=getTurno(a.turno_id),pago=getPago(a.id);
          return (
            <div key={a.id} onClick={()=>setModalDet(a)} style={{background:"white",borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 2px 8px rgba(0,0,0,0.05)",cursor:"pointer",opacity:a.activa===false?0.6:1}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:a.activa===false?"#e0e0e0":pago?C.sage+"55":"#f5d4c0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:a.activa===false?"#aaa":pago?C.forest:"#c0784a",flexShrink:0}}>{a.nombre.charAt(0)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,color:C.dark,fontSize:15,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.nombre}</div>
                <div style={{fontSize:12,color:"#aaa",marginTop:2}}>{a.activa===false?"🔴 Baja":turno?`${turno.dia} ${turno.hora}`:"Sin turno"}</div>
              </div>
              {a.activa!==false&&<div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                <div style={{fontSize:13,fontWeight:800,color:pago?C.forest:"#c0784a"}}>{formatPeso(pago?pago.monto:montoBase(a))}</div>
                <div style={{fontSize:11,background:pago?"#e8f5e9":"#fdecea",color:pago?"#388e3c":"#c62828",borderRadius:6,padding:"2px 8px",fontWeight:700}}>{pago?"✓ Pago":"Debe"}</div>
              </div>}
            </div>
          );
        })}
      </div>

      {(rol==="admin"||rol===null)&&<FAB onClick={()=>setModalAdd(true)}/>}

      {/* DETALLE */}
      <Modal open={!!modalDet} onClose={()=>setModalDet(null)} title="Detalle alumna">
        {modalDet&&(()=>{
          const turno=getTurno(modalDet.turno_id),pago=getPago(modalDet.id),historial=getHistorial(modalDet.id);
          return(
            <div>
              <div style={{textAlign:"center",marginBottom:18}}>
                <div style={{width:64,height:64,borderRadius:"50%",background:C.sage+"55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:900,color:C.forest,margin:"0 auto 10px"}}>{modalDet.nombre.charAt(0)}</div>
                <div style={{fontSize:20,fontWeight:800,color:C.dark}}>{modalDet.nombre}</div>
                {modalDet.activa===false&&<div style={{fontSize:12,background:"#f0f0f0",color:"#888",borderRadius:8,padding:"3px 12px",display:"inline-block",marginTop:6,fontWeight:700}}>🔴 Baja {modalDet.fecha_baja?formatDate(modalDet.fecha_baja):""}</div>}
              </div>

              {/* Datos */}
              <div style={{background:C.cream,borderRadius:14,padding:16,marginBottom:16}}>
                <Row label="Turno" value={turno?`${turno.dia} ${turno.hora}`:"Sin turno"}/>
                {turno&&<Row label="Profesora" value={turno.profesora}/>}
                <Row label="Arcilla" value={modalDet.arcilla?"Incluida":"No incluida"}/>
                {modalDet.celular&&<Row label="📱 Celular" value={modalDet.celular}/>}
                {modalDet.cumple&&<Row label="🎂 Cumpleaños" value={formatDate(modalDet.cumple)}/>}
                {modalDet.motivo_baja&&<Row label="Motivo baja" value={modalDet.motivo_baja}/>}
              </div>

              {/* Pago ciclo actual — solo activas */}
              {modalDet.activa!==false&&(
                <div style={{background:pago?"#e8f5e9":"#fdecea",borderRadius:14,padding:16,marginBottom:16}}>
                  <div style={{fontWeight:700,color:pago?"#388e3c":"#c62828",fontSize:15,marginBottom:pago?8:0}}>{pago?"✓ Pago "+ciclo.label:"⚠ Pendiente — "+ciclo.label}</div>
                  {pago&&rol==="admin"&&(<><Row label="Monto" value={formatPeso(pago.monto)}/><Row label="Fecha" value={formatDate(pago.fecha)}/><Row label="Método" value={pago.metodo}/>{pago.destinatario&&<Row label="Destinatario" value={pago.destinatario}/>}{pago.items?.length>0&&<Row label="Extras" value={itemsLabel(pago.items)}/>}{pago.observaciones&&<div style={{marginTop:8,fontSize:13,color:"#555",fontStyle:"italic"}}>"{pago.observaciones}"</div>}</>)}
                </div>
              )}

              {/* Historial de pagos — solo admin */}
              {(rol==="admin"||rol===null)&&historial.length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:800,color:"#aaa",textTransform:"uppercase",marginBottom:10}}>Historial de pagos ({historial.length} ciclos)</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {historial.map(p=>{
                      const [yr,mn]=p.ciclo_key.split("-");
                      const label=`${MESES[Number(mn)-1]} ${yr}`;
                      return (
                        <div key={p.id} style={{background:"white",borderRadius:12,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",border:"1px solid #f0ece6"}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:700,color:C.dark}}>{label}</div>
                            <div style={{fontSize:11,color:"#aaa"}}>{formatDate(p.fecha)} · {p.metodo}{p.destinatario?` → ${p.destinatario}`:""}</div>
                            {p.items?.length>0&&<div style={{fontSize:11,color:C.forest}}>{itemsLabel(p.items)}</div>}
                          </div>
                          <div style={{fontSize:15,fontWeight:900,color:C.forest}}>{formatPeso(p.monto)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Acciones — solo admin */}
              {(rol==="admin"||rol===null)&&modalDet.activa!==false&&(
                <>
                  {!pago?<Btn onClick={()=>{setModalDet(null);setModalPago(modalDet);}}>✓ Registrar pago {ciclo.label}</Btn>:<Btn onClick={()=>quitarPago(modalDet.id)} variant="secondary" disabled={saving}>Quitar pago del ciclo</Btn>}
                  <Btn onClick={()=>{setEditForm({nombre:modalDet.nombre,turnoId:modalDet.turno_id||"",arcilla:modalDet.arcilla,celular:modalDet.celular||"",cumple:modalDet.cumple||""});setModalEdit(modalDet);}} variant="secondary" style={{marginTop:8}}>✏️ Editar datos</Btn>
                  <Btn onClick={()=>{setBajaForm({fecha_baja:new Date().toISOString().split("T")[0],motivo_baja:""});setModalBaja(modalDet);}} variant="secondary" style={{marginTop:8,color:"#c0784a",border:"2px solid #e0d0c0",background:"#fff8f5"}}>🔴 Dar de baja</Btn>
                </>
              )}
              {(rol==="admin"||rol===null)&&modalDet.activa===false&&(
                <Btn onClick={()=>reactivar(modalDet.id)} disabled={saving}>🟢 Reactivar alumna</Btn>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* EDITAR */}
      <Modal open={!!modalEdit} onClose={()=>setModalEdit(null)} title={`Editar — ${modalEdit?.nombre}`}>
        {modalEdit&&(<div>
          <Input label="Nombre completo *" value={editForm.nombre} onChange={e=>setEditForm(p=>({...p,nombre:e.target.value}))}/>
          <Sel label="Turno" value={editForm.turnoId} onChange={e=>setEditForm(p=>({...p,turnoId:e.target.value}))}>
            <option value="">Sin turno</option>
            {turnos.map(t=><option key={t.id} value={t.id}>{t.dia} {t.hora} — {t.profesora}</option>)}
          </Sel>
          <Input label="📱 Celular" value={editForm.celular} onChange={e=>setEditForm(p=>({...p,celular:e.target.value}))} type="tel" placeholder="299-4xxxxxx"/>
          <Input label="🎂 Cumpleaños" value={editForm.cumple} onChange={e=>setEditForm(p=>({...p,cumple:e.target.value}))} type="date"/>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:8}}>Arcilla</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[false,true].map(v=>(<button key={String(v)} onClick={()=>setEditForm(p=>({...p,arcilla:v}))} style={{padding:"12px 8px",borderRadius:12,border:`2px solid ${editForm.arcilla===v?C.forest:"#e0e0e0"}`,background:editForm.arcilla===v?"#e8f5e9":"white",color:editForm.arcilla===v?C.forest:"#aaa",fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>{v?`Con — ${formatPeso(CUOTA_CON)}`:`Sin — ${formatPeso(CUOTA_SIN)}`}</button>))}
            </div>
          </div>
          <Btn onClick={editarAlumno} disabled={saving}>{saving?"Guardando...":"Guardar cambios"}</Btn>
        </div>)}
      </Modal>

      {/* DAR DE BAJA */}
      <Modal open={!!modalBaja} onClose={()=>setModalBaja(null)} title={`Dar de baja — ${modalBaja?.nombre}`}>
        {modalBaja&&(<div>
          <div style={{background:"#fff8f5",borderRadius:12,padding:"12px 16px",marginBottom:16,fontSize:13,color:"#c0784a",fontWeight:600}}>
            La alumna quedará en el registro histórico. Podés reactivarla en cualquier momento.
          </div>
          <Input label="Fecha de baja" type="date" value={bajaForm.fecha_baja} onChange={e=>setBajaForm(p=>({...p,fecha_baja:e.target.value}))}/>
          <Textarea label="Motivo (opcional)" value={bajaForm.motivo_baja} onChange={e=>setBajaForm(p=>({...p,motivo_baja:e.target.value}))} placeholder="Ej: Viaje, cambio de horario..."/>
          <Btn onClick={darBaja} disabled={saving} variant="danger">{saving?"Guardando...":"Confirmar baja"}</Btn>
        </div>)}
      </Modal>

      {/* REGISTRAR PAGO */}
      <Modal open={!!modalPago} onClose={()=>setModalPago(null)} title={`Pago — ${modalPago?.nombre}`}>
        {modalPago&&(<div>
          <div style={{background:C.cream,borderRadius:12,padding:"12px 16px",marginBottom:16}}>
            <div style={{fontSize:13,color:"#888",marginBottom:4}}>Cuota base {ciclo.label}</div>
            <div style={{fontSize:24,fontWeight:900,color:C.forest}}>{formatPeso(montoBase(modalPago))}</div>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:8}}>Cargos adicionales</label>
            {itemsConfig.map(it=>(
              <div key={it.key} onClick={()=>toggleItem(it.key)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderRadius:10,border:`1.5px solid ${pagoForm.items.includes(it.key)?C.forest:"#e8e8e8"}`,background:pagoForm.items.includes(it.key)?"#e8f5e9":"white",marginBottom:8,cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:22,height:22,borderRadius:4,border:`2px solid ${pagoForm.items.includes(it.key)?C.forest:"#ccc"}`,background:pagoForm.items.includes(it.key)?C.forest:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"white",flexShrink:0}}>{pagoForm.items.includes(it.key)?"✓":""}</div>
                  <span style={{fontSize:14,fontWeight:600,color:C.dark}}>{it.label}</span>
                </div>
                <span style={{fontSize:14,fontWeight:700,color:C.forest}}>+{formatPeso(it.precio)}</span>
              </div>
            ))}
          </div>
          {pagoForm.items.length>0&&(<div style={{background:C.forest,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{color:"white",fontWeight:700}}>Total</span><span style={{color:"white",fontSize:22,fontWeight:900}}>{formatPeso(montoBase(modalPago)+pagoForm.items.reduce((s,i)=>s+(CARGO_EXTRA[i]||0),0))}</span></div>)}
          <Input label="Fecha de pago *" type="date" value={pagoForm.fecha} onChange={e=>setPagoForm(p=>({...p,fecha:e.target.value}))}/>
          <Sel label="Método" value={pagoForm.metodo} onChange={e=>setPagoForm(p=>({...p,metodo:e.target.value,destinatario:""}))}>
            <option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option>
          </Sel>
          {pagoForm.metodo==="transferencia"&&<DestSelector value={pagoForm.destinatario} onChange={v=>setPagoForm(p=>({...p,destinatario:v}))}/>}
          <Textarea label="Observaciones (opcional)" value={pagoForm.observaciones} onChange={e=>setPagoForm(p=>({...p,observaciones:e.target.value}))} placeholder="Ej: Pagó en dos cuotas..."/>
          <Btn onClick={registrarPago} disabled={saving}>{saving?"Guardando...":"Confirmar pago"}</Btn>
        </div>)}
      </Modal>

      {/* NUEVA ALUMNA */}
      <Modal open={modalAdd} onClose={()=>setModalAdd(false)} title="Nueva alumna">
        <Input label="Nombre completo *" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} placeholder="Nombre y apellido"/>
        <Sel label="Turno" value={form.turnoId} onChange={e=>setForm(p=>({...p,turnoId:e.target.value}))}>
          <option value="">Sin turno</option>
          {turnos.map(t=><option key={t.id} value={t.id}>{t.dia} {t.hora} — {t.profesora}</option>)}
        </Sel>
        <Input label="📱 Celular (opcional)" value={form.celular} onChange={e=>setForm(p=>({...p,celular:e.target.value}))} type="tel" placeholder="299-4xxxxxx"/>
        <Input label="🎂 Cumpleaños (opcional)" value={form.cumple} onChange={e=>setForm(p=>({...p,cumple:e.target.value}))} type="date"/>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:8}}>Arcilla</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[false,true].map(v=>(<button key={String(v)} onClick={()=>setForm(p=>({...p,arcilla:v}))} style={{padding:"12px 8px",borderRadius:12,border:`2px solid ${form.arcilla===v?C.forest:"#e0e0e0"}`,background:form.arcilla===v?"#e8f5e9":"white",color:form.arcilla===v?C.forest:"#aaa",fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>{v?`Con — ${formatPeso(CUOTA_CON)}`:`Sin — ${formatPeso(CUOTA_SIN)}`}</button>))}
          </div>
        </div>
        <Btn onClick={addAlumno} disabled={saving}>{saving?"Guardando...":"Agregar alumna"}</Btn>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TURNOS
// ══════════════════════════════════════════════════════════════════════════
function TurnosTab({turnos,alumnos,onRefresh,tablet}) {
  const [modalAdd,setModalAdd]=useState(false);
  const [modalDet,setModalDet]=useState(null);
  const [modalEdit,setModalEdit]=useState(null);
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({dia:"Lunes",hora:"",profesora:"Azu",capacidad:6});
  const [editForm,setEditForm]=useState({dia:"Lunes",hora:"",profesora:"",capacidad:6});

  const [filterTurno,setFilterTurno]=useState("todos");
  const ocupacion=id=>alumnos.filter(a=>a.turno_id===id).length;
  const turnosPorDia=useMemo(()=>{const m={};DIAS_ORDEN.forEach(d=>{m[d]=turnos.filter(t=>t.dia===d);});return m;},[turnos]);
  const totalLugares=turnos.reduce((a,t)=>a+t.capacidad,0);
  const completos=turnos.filter(t=>ocupacion(t.id)>=t.capacidad).length;
  const conLugar=turnos.filter(t=>ocupacion(t.id)<t.capacidad).length;

  const addTurno=async()=>{if(!form.hora.trim())return;setSaving(true);await supabase.from("turnos").insert({dia:form.dia,hora:form.hora,profesora:form.profesora,capacidad:Number(form.capacidad)});await onRefresh();setSaving(false);setForm({dia:"Lunes",hora:"",profesora:"Azu",capacidad:6});setModalAdd(false);};
  const delTurno=async(id)=>{setSaving(true);await supabase.from("turnos").delete().eq("id",id);await onRefresh();setSaving(false);setModalDet(null);};
  const editarTurno=async()=>{
    if(!editForm.hora.trim())return;
    setSaving(true);
    await supabase.from("turnos").update({dia:editForm.dia,hora:editForm.hora,profesora:editForm.profesora,capacidad:Number(editForm.capacidad)}).eq("id",modalEdit.id);
    await onRefresh();setSaving(false);setModalEdit(null);setModalDet(null);
  };

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
        {[{key:"todos",label:"Todos",value:turnos.length,color:C.forest},{key:"completos",label:"Completos",value:completos,color:"#c0784a"},{key:"disponibles",label:"Disponibles",value:conLugar,color:"#5a9e6a"}].map(s=>(
          <div key={s.key} onClick={()=>setFilterTurno(f=>f===s.key?"todos":s.key)} style={{background:filterTurno===s.key?s.color:"white",borderRadius:14,padding:"14px 8px",textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",cursor:"pointer",border:`2px solid ${filterTurno===s.key?s.color:"transparent"}`}}>
            <div style={{fontSize:26,fontWeight:900,color:filterTurno===s.key?"white":s.color}}>{s.value}</div>
            <div style={{fontSize:11,fontWeight:600,marginTop:2,lineHeight:1.3,color:filterTurno===s.key?"rgba(255,255,255,0.85)":"#aaa"}}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:tablet?"1fr 1fr":"1fr",gap:10,marginBottom:100}}>
        {DIAS_ORDEN.map(dia=>{
          const ts=turnosPorDia[dia];if(!ts||ts.length===0)return null;
          return ts.map(t=>{
            const ocup=ocupacion(t.id),libre=t.capacidad-ocup,pct=Math.min(ocup/t.capacidad,1);
            const alumnosEnTurno=alumnos.filter(a=>a.turno_id===t.id);
            if(filterTurno==="completos"&&ocup<t.capacidad)return null;
            if(filterTurno==="disponibles"&&ocup>=t.capacidad)return null;
            return (
              <div key={t.id} onClick={()=>setModalDet({...t,ocup,libre,alumnosEnTurno})} style={{background:"white",borderRadius:14,padding:"16px",boxShadow:"0 2px 8px rgba(0,0,0,0.05)",cursor:"pointer"}}>
                <div style={{fontSize:11,fontWeight:800,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{dia}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div><div style={{fontWeight:700,color:C.dark,fontSize:15}}>{t.hora}</div><div style={{fontSize:12,color:"#aaa",marginTop:2}}>👩‍🏫 {t.profesora}</div></div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:20,fontWeight:900,color:ocup>=t.capacidad?"#c0784a":C.forest}}>{ocup}<span style={{fontSize:14,fontWeight:600,color:"#ccc"}}>/{t.capacidad}</span></div>
                    <div style={{fontSize:11,color:ocup>=t.capacidad?"#c0784a":"#5a9e6a",fontWeight:700}}>{ocup>=t.capacidad?"🔴 Completo":`${libre} libre${libre!==1?"s":""}`}</div>
                  </div>
                </div>
                <div style={{background:"#f0f0f0",borderRadius:8,height:7,overflow:"hidden"}}><div style={{width:`${pct*100}%`,height:"100%",background:pct>=1?"#c0784a":pct>0.75?C.sage:C.forest,borderRadius:8}}/></div>
                {alumnosEnTurno.length>0&&(<div style={{display:"flex",marginTop:10,gap:4,flexWrap:"wrap"}}>{alumnosEnTurno.map(a=>(<div key={a.id} style={{width:30,height:30,borderRadius:"50%",background:C.sage+"55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:C.forest}}>{a.nombre.charAt(0)}</div>))}</div>)}
              </div>
            );
          });
        })}
      </div>
      <FAB onClick={()=>setModalAdd(true)}/>

      {/* DETALLE */}
      <Modal open={!!modalDet} onClose={()=>setModalDet(null)} title="Detalle turno">
        {modalDet&&(<div>
          <div style={{background:C.cream,borderRadius:14,padding:16,marginBottom:16}}>
            <Row label="Día" value={modalDet.dia}/>
            <Row label="Horario" value={modalDet.hora}/>
            <Row label="Profesora" value={modalDet.profesora}/>
            <Row label="Capacidad" value={`${modalDet.capacidad} lugares`}/>
            <Row label="Libres" value={modalDet.libre<0?`${Math.abs(modalDet.libre)} sobre cupo`:modalDet.libre} valueColor={modalDet.libre<=0?"#c0784a":"#388e3c"}/>
          </div>
          {modalDet.alumnosEnTurno.length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:"#aaa",textTransform:"uppercase",marginBottom:8}}>Alumnas en este turno</div>
              {modalDet.alumnosEnTurno.map(a=>(
                <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f5f5f5"}}>
                  <div style={{width:34,height:34,borderRadius:"50%",background:C.sage+"55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:C.forest}}>{a.nombre.charAt(0)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.dark}}>{a.nombre}</div>
                    {a.celular&&<div style={{fontSize:12,color:"#aaa"}}>📱 {a.celular}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Btn onClick={()=>{setEditForm({dia:modalDet.dia,hora:modalDet.hora,profesora:modalDet.profesora,capacidad:modalDet.capacidad});setModalEdit(modalDet);}} variant="secondary">✏️ Editar turno</Btn>
          <Btn onClick={()=>delTurno(modalDet.id)} variant="danger" style={{marginTop:8}} disabled={saving}>Eliminar turno</Btn>
        </div>)}
      </Modal>

      {/* EDITAR */}
      <Modal open={!!modalEdit} onClose={()=>setModalEdit(null)} title={`Editar — ${modalEdit?.dia} ${modalEdit?.hora}`}>
        {modalEdit&&(<div>
          <Sel label="Día" value={editForm.dia} onChange={e=>setEditForm(p=>({...p,dia:e.target.value}))}>{DIAS_ORDEN.map(d=><option key={d}>{d}</option>)}</Sel>
          <Input label="Horario" value={editForm.hora} onChange={e=>setEditForm(p=>({...p,hora:e.target.value}))} placeholder="Ej: 18:00 a 20:00hs"/>
          <Input label="Profesora" value={editForm.profesora} onChange={e=>setEditForm(p=>({...p,profesora:e.target.value}))}/>
          <Input label="Capacidad" type="number" value={editForm.capacidad} onChange={e=>setEditForm(p=>({...p,capacidad:e.target.value}))}/>
          <Btn onClick={editarTurno} disabled={saving}>{saving?"Guardando...":"Guardar cambios"}</Btn>
        </div>)}
      </Modal>

      {/* NUEVO */}
      <Modal open={modalAdd} onClose={()=>setModalAdd(false)} title="Nuevo turno">
        <Sel label="Día" value={form.dia} onChange={e=>setForm(p=>({...p,dia:e.target.value}))}>{DIAS_ORDEN.map(d=><option key={d}>{d}</option>)}</Sel>
        <Input label="Horario" value={form.hora} onChange={e=>setForm(p=>({...p,hora:e.target.value}))} placeholder="Ej: 18:00 a 20:00hs"/>
        <Input label="Profesora" value={form.profesora} onChange={e=>setForm(p=>({...p,profesora:e.target.value}))}/>
        <Input label="Capacidad" type="number" value={form.capacidad} onChange={e=>setForm(p=>({...p,capacidad:e.target.value}))}/>
        <Btn onClick={addTurno} disabled={saving}>{saving?"Guardando...":"Crear turno"}</Btn>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ENCARGOS
// ══════════════════════════════════════════════════════════════════════════
function EncargosTab({encargos,onRefresh,tablet}) {
  const [modalAdd,setModalAdd]=useState(false);
  const [modalDet,setModalDet]=useState(null);
  const [filterEstado,setFilterEstado]=useState("todos");
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({cliente:"",descripcion:"",entrega:"",sena:0,total:0,estado:"pendiente"});

  const filtered=encargos.filter(e=>filterEstado==="todos"?true:e.estado===filterEstado);
  const addEncargo=async()=>{if(!form.cliente.trim())return;setSaving(true);await supabase.from("encargos").insert({cliente:form.cliente,descripcion:form.descripcion,entrega:form.entrega,sena:Number(form.sena),total:Number(form.total),estado:form.estado});await onRefresh();setSaving(false);setForm({cliente:"",descripcion:"",entrega:"",sena:0,total:0,estado:"pendiente"});setModalAdd(false);};
  const cambiarEstado=async(id,estado)=>{await supabase.from("encargos").update({estado}).eq("id",id);await onRefresh();setModalDet(p=>p?.id===id?{...p,estado}:p);};
  const delEncargo=async(id)=>{setSaving(true);await supabase.from("encargos").delete().eq("id",id);await onRefresh();setSaving(false);setModalDet(null);};

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
        {["todos","pendiente","en_proceso","listo","entregado"].map(e=>{
          const count=e==="todos"?encargos.length:encargos.filter(x=>x.estado===e).length;
          const cfg=e==="todos"?{label:"Todos",color:"#e0e0e0",text:C.dark}:estadoConfig[e];
          return <button key={e} onClick={()=>setFilterEstado(e)} style={{flexShrink:0,padding:"9px 16px",borderRadius:20,background:filterEstado===e?cfg.color:"white",border:`2px solid ${filterEstado===e?cfg.color:"#e8e8e8"}`,color:filterEstado===e?(e==="todos"?C.dark:cfg.text):"#aaa",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{cfg.label} ({count})</button>;
        })}
      </div>
      <div style={{display:"grid",gridTemplateColumns:tablet?"1fr 1fr":"1fr",gap:10,marginBottom:100}}>
        {filtered.map(e=>{
          const cfg=estadoConfig[e.estado],resta=e.total-e.sena;
          return (
            <div key={e.id} onClick={()=>setModalDet(e)} style={{background:"white",borderRadius:14,padding:"15px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.05)",cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{flex:1,paddingRight:8}}><div style={{fontWeight:700,color:C.dark,fontSize:15}}>{e.cliente}</div><div style={{fontSize:12,color:"#aaa",marginTop:2}}>{e.descripcion}</div></div>
                <span style={{background:cfg.color,color:cfg.text,borderRadius:8,padding:"3px 10px",fontSize:12,fontWeight:700,flexShrink:0}}>{cfg.label}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid #f5f5f5",paddingTop:10}}>
                <div style={{fontSize:12,color:"#aaa"}}>📅 {formatDate(e.entrega)}</div>
                <div style={{display:"flex",gap:14}}>
                  <div style={{fontSize:12,textAlign:"right"}}><div style={{color:"#aaa"}}>Seña</div><div style={{fontWeight:700}}>{formatPeso(e.sena)}</div></div>
                  <div style={{fontSize:12,textAlign:"right"}}><div style={{color:"#aaa"}}>Resta</div><div style={{fontWeight:700,color:resta>0?"#c0784a":"#388e3c"}}>{formatPeso(resta)}</div></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <FAB onClick={()=>setModalAdd(true)}/>
      <Modal open={!!modalDet} onClose={()=>setModalDet(null)} title="Encargo">
        {modalDet&&(()=>{const cfg=estadoConfig[modalDet.estado],resta=modalDet.total-modalDet.sena;return(<div>
          <div style={{background:C.cream,borderRadius:14,padding:16,marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:17,color:C.dark,marginBottom:4}}>{modalDet.cliente}</div>
            <div style={{color:"#888",fontSize:14,marginBottom:12}}>{modalDet.descripcion}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <div><div style={{fontSize:11,color:"#aaa"}}>TOTAL</div><div style={{fontWeight:800,color:C.forest,fontSize:16}}>{formatPeso(modalDet.total)}</div></div>
              <div><div style={{fontSize:11,color:"#aaa"}}>SEÑA</div><div style={{fontWeight:700,fontSize:15}}>{formatPeso(modalDet.sena)}</div></div>
              <div><div style={{fontSize:11,color:"#aaa"}}>RESTA</div><div style={{fontWeight:700,fontSize:15,color:resta>0?"#c0784a":"#388e3c"}}>{formatPeso(resta)}</div></div>
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:8}}>Estado</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {Object.entries(estadoConfig).map(([key,c])=>(<button key={key} onClick={()=>cambiarEstado(modalDet.id,key)} style={{padding:"11px",borderRadius:10,border:`2px solid ${modalDet.estado===key?c.color:"#e0e0e0"}`,background:modalDet.estado===key?c.color:"white",color:modalDet.estado===key?c.text:"#aaa",fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>{c.label}</button>))}
            </div>
          </div>
          <Btn onClick={()=>delEncargo(modalDet.id)} variant="danger" disabled={saving}>Eliminar</Btn>
        </div>);})()}
      </Modal>
      <Modal open={modalAdd} onClose={()=>setModalAdd(false)} title="Nuevo encargo">
        <Input label="Cliente" value={form.cliente} onChange={e=>setForm(p=>({...p,cliente:e.target.value}))} placeholder="Nombre"/>
        <Input label="Descripción" value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))}/>
        <Input label="Fecha de entrega" type="date" value={form.entrega} onChange={e=>setForm(p=>({...p,entrega:e.target.value}))}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Input label="Seña ($)" type="number" value={form.sena} onChange={e=>setForm(p=>({...p,sena:e.target.value}))}/>
          <Input label="Total ($)" type="number" value={form.total} onChange={e=>setForm(p=>({...p,total:e.target.value}))}/>
        </div>
        <Sel label="Estado" value={form.estado} onChange={e=>setForm(p=>({...p,estado:e.target.value}))}>{Object.entries(estadoConfig).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</Sel>
        <Btn onClick={addEncargo} disabled={saving}>{saving?"Guardando...":"Guardar"}</Btn>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// HORNO
// ══════════════════════════════════════════════════════════════════════════
function HornoTab({horneadas,alumnos,onRefresh,tablet}) {
  const [modalAdd,setModalAdd]=useState(false);
  const [modalDet,setModalDet]=useState(null);
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({fecha:"",alumnoId:"",pieza:"",notas:"",foto:null,observaciones:""});

  const [filterAlumnaHorno,setFilterAlumnaHorno]=useState(null); // null=todos, número=alumno_id
  const addHorneada=async()=>{if(!form.pieza.trim()||!form.fecha)return;setSaving(true);await supabase.from("horneadas").insert({fecha:form.fecha,alumno_id:Number(form.alumnoId)||null,pieza:form.pieza,notas:form.notas,observaciones:form.observaciones,foto_url:form.foto||""});await onRefresh();setSaving(false);setForm({fecha:"",alumnoId:"",pieza:"",notas:"",foto:null,observaciones:""});setModalAdd(false);};
  const delHorneada=async(id)=>{setSaving(true);await supabase.from("horneadas").delete().eq("id",id);await onRefresh();setSaving(false);setModalDet(null);};
  const getNombre=id=>alumnos.find(a=>a.id===id)?.nombre||"Sin asignar";
  const sesiones=useMemo(()=>{const map={};horneadas.forEach(h=>{if(!map[h.fecha])map[h.fecha]=[];map[h.fecha].push(h);});return Object.entries(map).sort((a,b)=>b[0].localeCompare(a[0]));},[horneadas]);
  const statsPorAlumno=useMemo(()=>{const map={};horneadas.forEach(h=>{if(h.alumno_id)map[h.alumno_id]=(map[h.alumno_id]||0)+1;});return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5);},[horneadas]);
  const maxStat=statsPorAlumno.length?Math.max(...statsPorAlumno.map(x=>x[1])):1;

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <div onClick={()=>setFilterAlumnaHorno(null)} style={{background:filterAlumnaHorno===null?"linear-gradient(135deg,#f5c07a,#e8945a)":"white",borderRadius:14,padding:"18px",cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",border:`2px solid ${filterAlumnaHorno===null?"#e8945a":"transparent"}`}}>
          <div style={{fontSize:34,fontWeight:900,color:filterAlumnaHorno===null?"white":"#e8945a"}}>{sesiones.length}</div>
          <div style={{fontSize:13,fontWeight:700,color:filterAlumnaHorno===null?"rgba(255,255,255,0.85)":"#aaa"}}>Todas las sesiones</div>
        </div>
        <div style={{background:"white",borderRadius:14,padding:"18px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
          <div style={{fontSize:34,fontWeight:900,color:C.forest}}>{horneadas.length}</div>
          <div style={{fontSize:13,fontWeight:700,color:"#aaa"}}>Piezas en total</div>
        </div>
      </div>
      {statsPorAlumno.length>0&&(
        <div style={{background:"white",borderRadius:14,padding:"15px 16px",marginBottom:14,boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
          <div style={{fontSize:12,fontWeight:800,color:"#aaa",textTransform:"uppercase",marginBottom:10}}>Piezas por alumna</div>
          <div style={{display:"grid",gridTemplateColumns:tablet?"1fr 1fr":"1fr",gap:8}}>
            {statsPorAlumno.map(([id,count])=>(
              <div key={id} onClick={()=>setFilterAlumnaHorno(f=>f===Number(id)?null:Number(id))} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",borderRadius:10,background:filterAlumnaHorno===Number(id)?"#e8f5e9":"transparent",cursor:"pointer"}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:filterAlumnaHorno===Number(id)?C.forest:C.sage+"55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:filterAlumnaHorno===Number(id)?"white":C.forest,flexShrink:0}}>{getNombre(Number(id)).charAt(0)}</div>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:C.dark}}>{getNombre(Number(id))}</div><div style={{background:"#f0f0f0",borderRadius:6,height:5,marginTop:4,overflow:"hidden"}}><div style={{width:`${(count/maxStat)*100}%`,height:"100%",background:filterAlumnaHorno===Number(id)?C.forest:C.sage,borderRadius:6}}/></div></div>
                <div style={{fontSize:16,fontWeight:800,color:C.forest}}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:tablet?"1fr 1fr":"1fr",gap:10,marginBottom:100}}>
        {sesiones.map(([fecha,items])=>{
          const itemsFiltrados=filterAlumnaHorno===null?items:items.filter(h=>h.alumno_id===filterAlumnaHorno);
          if(itemsFiltrados.length===0)return null;
          return(
          <div key={fecha} style={{background:"white",borderRadius:14,padding:"15px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:14,fontWeight:800,color:C.dark}}>🔥 {formatDate(fecha)}</div>
              <div style={{fontSize:12,background:"#fff0e0",color:"#c0784a",borderRadius:8,padding:"3px 10px",fontWeight:700}}>{items.length} {items.length===1?"pieza":"piezas"}</div>
            </div>
            {itemsFiltrados.map(h=>(
              <div key={h.id} onClick={()=>setModalDet(h)} style={{padding:"10px 0",borderTop:"1px solid #f5f5f5",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  {h.foto_url?<div style={{width:50,height:50,borderRadius:8,overflow:"hidden",flexShrink:0}}><img src={h.foto_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>
                    :<div style={{width:50,height:50,borderRadius:8,background:C.sage+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:22}}>🏺</div>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.dark}}>{h.pieza}</div>
                    <div style={{fontSize:12,color:"#aaa"}}>{h.alumno_id?getNombre(h.alumno_id):"Sin asignar"}{h.notas?` · ${h.notas}`:""}</div>
                    {h.observaciones&&<div style={{fontSize:11,color:"#888",fontStyle:"italic",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>"{h.observaciones}"</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );})}
        {sesiones.length===0&&<div style={{textAlign:"center",color:"#ccc",padding:"50px 0",gridColumn:"1/-1"}}>Aún no hay horneadas 🔥</div>}
      </div>
      <FAB onClick={()=>setModalAdd(true)}/>
      <Modal open={!!modalDet} onClose={()=>setModalDet(null)} title="Detalle pieza">
        {modalDet&&(<div>
          {modalDet.foto_url&&<img src={modalDet.foto_url} alt="pieza" style={{width:"100%",borderRadius:14,marginBottom:16,maxHeight:280,objectFit:"cover"}}/>}
          <div style={{background:C.cream,borderRadius:14,padding:16,marginBottom:16}}>
            <Row label="Pieza" value={modalDet.pieza}/><Row label="Alumna" value={modalDet.alumno_id?getNombre(modalDet.alumno_id):"Sin asignar"}/><Row label="Fecha" value={formatDate(modalDet.fecha)}/>{modalDet.notas&&<Row label="Notas técnicas" value={modalDet.notas}/>}
          </div>
          {modalDet.observaciones&&<div style={{background:"#f8f8f8",borderRadius:12,padding:"12px 16px",marginBottom:16}}><div style={{fontSize:12,fontWeight:700,color:"#aaa",marginBottom:6}}>OBSERVACIONES</div><div style={{fontSize:14,color:C.dark,lineHeight:1.5}}>{modalDet.observaciones}</div></div>}
          <Btn onClick={()=>delHorneada(modalDet.id)} variant="danger" disabled={saving}>Eliminar registro</Btn>
        </div>)}
      </Modal>
      <Modal open={modalAdd} onClose={()=>setModalAdd(false)} title="Registrar horneada">
        <Input label="Fecha *" type="date" value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))}/>
        <Sel label="Alumna" value={form.alumnoId} onChange={e=>setForm(p=>({...p,alumnoId:e.target.value}))}>
          <option value="">Sin asignar</option>
          {[...alumnos].sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
        </Sel>
        <Input label="Pieza *" value={form.pieza} onChange={e=>setForm(p=>({...p,pieza:e.target.value}))} placeholder="Ej: Tazas x4"/>
        <Input label="Notas técnicas" value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} placeholder="Ej: Bizcocho 1050°C"/>
        <Textarea label="Observaciones" value={form.observaciones} onChange={e=>setForm(p=>({...p,observaciones:e.target.value}))} placeholder="Ej: Quedó muy bien el esmalte..."/>
        <PhotoPicker value={form.foto} onChange={url=>setForm(p=>({...p,foto:url}))}/>
        <Btn onClick={addHorneada} disabled={saving}>{saving?"Guardando...":"Registrar"}</Btn>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// FINANZAS
// ══════════════════════════════════════════════════════════════════════════
function FinanzasTab({alumnos,pagos,encargos,movimientos,onRefresh,tablet}) {
  const ciclos=useMemo(()=>getCiclos(),[]);
  const [cicloKey,setCicloKey]=useState(ciclos[0].key);
  const cicloActual=ciclos.find(c=>c.key===cicloKey)||ciclos[0];
  const [modalAdd,setModalAdd]=useState(false);
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({tipo:"ingreso",categoria:"cuota",descripcion:"",monto:"",fecha:"",metodo:"transferencia",destinatario:"",observaciones:""});
  // auto-switch categoria default segun tipo
  const handleTipoChange=(t)=>setForm(p=>({...p,tipo:t,categoria:t==="ingreso"?"cuota":"t_alquiler"}));

  const movsDelCiclo=movimientos.filter(m=>m.ciclo_key===cicloKey);
  const ingresos=movsDelCiclo.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.monto,0);
  const gastos=movsDelCiclo.filter(m=>m.tipo==="gasto").reduce((a,m)=>a+m.monto,0);
  const balance=ingresos-gastos;
  const pagosDeCiclo=pagos.filter(p=>p.ciclo_key===cicloKey);
  const alumnosConPago=alumnos.filter(a=>pagosDeCiclo.some(p=>p.alumno_id===a.id));
  const alumnosSinPago=alumnos.filter(a=>!pagosDeCiclo.some(p=>p.alumno_id===a.id));
  const recaudadoCuotas=pagosDeCiclo.reduce((s,p)=>s+p.monto,0);
  const porCobrarCuotas=alumnosSinPago.reduce((s,a)=>s+montoBase(a),0);
  const encargosSaldo=encargos.filter(e=>e.estado!=="entregado").reduce((a,e)=>a+(e.total-e.sena),0);
  const pctPagaron=alumnos.length?Math.round((alumnosConPago.length/alumnos.length)*100):0;

  // Resumen por destinatario del ciclo (pagos de cuotas)
  const porDest={};
  pagosDeCiclo.forEach(p=>{const d=p.destinatario||"Sin especificar";porDest[d]=(porDest[d]||0)+p.monto;});

  const CATEGORIAS={
    // Ingresos
    cuota:          {label:"Cuota",              grupo:"ingreso",  color:C.forest},
    encargo:        {label:"Encargo",            grupo:"ingreso",  color:"#5a9e8a"},
    otro_ing:       {label:"Otro ingreso",       grupo:"ingreso",  color:"#888"},
    // Taller
    t_alquiler:     {label:"Alquiler taller",    grupo:"taller",   color:"#c0784a"},
    t_expensas:     {label:"Expensas taller",    grupo:"taller",   color:"#c0784a"},
    t_luz:          {label:"Luz",                grupo:"taller",   color:"#c0784a"},
    t_agua:         {label:"Agua",               grupo:"taller",   color:"#c0784a"},
    t_gas:          {label:"Gas",                grupo:"taller",   color:"#c0784a"},
    t_retributivos: {label:"Retributivos",       grupo:"taller",   color:"#8070c0"},
    t_materiales:   {label:"Materiales",         grupo:"taller",   color:"#c0784a"},
    t_insumos:      {label:"Insumos",            grupo:"taller",   color:"#c0784a"},
    t_equipamento:  {label:"Equipamiento",       grupo:"taller",   color:"#c0784a"},
    t_prestamo_b:   {label:"Préstamo bancario",  grupo:"taller",   color:"#5a7ec0"},
    t_prestamo_f:   {label:"Préstamo familiar",  grupo:"taller",   color:"#5a7ec0"},
    t_internet:     {label:"Internet",           grupo:"taller",   color:"#c0784a"},
    t_otros:        {label:"Otros taller",       grupo:"taller",   color:"#888"},
    // Casa
    c_alquiler:     {label:"Alquiler",           grupo:"casa",     color:"#5a7ec0"},
    c_impuestos:    {label:"Impuestos",          grupo:"casa",     color:"#5a7ec0"},
    c_tarjeta_visa: {label:"Tarjeta Visa",       grupo:"casa",     color:"#5a7ec0"},
    c_tarjeta_nx:   {label:"Tarjeta Naranja",    grupo:"casa",     color:"#5a7ec0"},
    c_mercaderias:  {label:"Mercaderías",        grupo:"casa",     color:"#5a7ec0"},
    c_mantenimiento:{label:"Mantenimiento",      grupo:"casa",     color:"#5a7ec0"},
    c_indumentaria: {label:"Indumentaria",       grupo:"casa",     color:"#5a7ec0"},
    c_internet:     {label:"Internet",           grupo:"casa",     color:"#5a7ec0"},
    c_salud:        {label:"Salud",              grupo:"casa",     color:"#5a7ec0"},
    c_otros:        {label:"Otros casa",         grupo:"casa",     color:"#888"},
    // Personal
    p_ocio:         {label:"Ocio",               grupo:"personal", color:"#9070c0"},
    p_gustos:       {label:"Gustos",             grupo:"personal", color:"#9070c0"},
    p_otros:        {label:"Otros personales",   grupo:"personal", color:"#888"},
    // Otros
    no_registrado:  {label:"No registrado",      grupo:"otros",    color:"#bbb"},
  };
  const catColor=Object.fromEntries(Object.entries(CATEGORIAS).map(([k,v])=>[k,v.color]));
  const catLabel=Object.fromEntries(Object.entries(CATEGORIAS).map(([k,v])=>[k,v.label]));
  const grupoColor={taller:"#c0784a",casa:"#5a7ec0",personal:"#9070c0",otros:"#bbb",ingreso:C.forest};
  const grupoLabel={taller:"Taller",casa:"Casa",personal:"Personal",otros:"Otros",ingreso:"Ingresos"};
  const addMov=async()=>{if(!form.descripcion.trim()||!form.monto)return;setSaving(true);await supabase.from("movimientos").insert({tipo:form.tipo,categoria:form.categoria,descripcion:form.descripcion,monto:Number(form.monto),fecha:form.fecha,metodo:form.metodo,destinatario:form.metodo==="transferencia"?form.destinatario:"",ciclo_key:cicloKey,observaciones:form.observaciones});await onRefresh();setSaving(false);setForm({tipo:"ingreso",categoria:"cuota",descripcion:"",monto:"",fecha:"",metodo:"transferencia",destinatario:"",observaciones:""});setModalAdd(false);}; 
  const delMov=async(id)=>{await supabase.from("movimientos").delete().eq("id",id);await onRefresh();};

  return (
    <div>
      <div style={{marginBottom:14}}>
        <select value={cicloKey} onChange={e=>setCicloKey(e.target.value)} style={{...INPUT_STYLE,fontWeight:700,fontSize:15}}>
          {ciclos.map(c=><option key={c.key} value={c.key}>{c.label}{c.key===ciclos[0].key?" (actual)":""}</option>)}
        </select>
      </div>

      <div style={{background:balance>=0?`linear-gradient(135deg,${C.forest},${C.sage})`:"linear-gradient(135deg,#c0784a,#e0a080)",borderRadius:20,padding:"24px 22px",marginBottom:14,color:"white"}}>
        <div style={{fontSize:11,fontWeight:700,opacity:0.85,letterSpacing:"0.06em"}}>BALANCE — {cicloActual.label.toUpperCase()}</div>
        <div style={{fontSize:tablet?42:36,fontWeight:900,margin:"6px 0"}}>{formatPeso(balance)}</div>
        <div style={{display:"flex",gap:24,opacity:0.9}}>
          <div><div style={{fontSize:11,opacity:0.75}}>INGRESOS</div><div style={{fontSize:17,fontWeight:700}}>{formatPeso(ingresos)}</div></div>
          <div><div style={{fontSize:11,opacity:0.75}}>GASTOS</div><div style={{fontSize:17,fontWeight:700}}>{formatPeso(gastos)}</div></div>
        </div>
      </div>

      {/* Resumen por destinatario */}
      {Object.keys(porDest).length>0&&(
        <div style={{background:"white",borderRadius:14,padding:"14px 16px",marginBottom:14,boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
          <div style={{fontSize:12,fontWeight:800,color:"#aaa",textTransform:"uppercase",marginBottom:10}}>Transferencias por destinatario</div>
          <div style={{display:"grid",gridTemplateColumns:tablet?"1fr 1fr 1fr":"1fr 1fr",gap:8}}>
            {Object.entries(porDest).map(([dest,total])=>(
              <div key={dest} style={{background:dest==="Azul"?"#e8f0fe":dest==="Agustín"?"#fce8e8":"#f5f5f5",borderRadius:12,padding:"12px 14px"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#888",marginBottom:2}}>{dest}</div>
                <div style={{fontSize:18,fontWeight:900,color:dest==="Azul"?"#3a6bc0":dest==="Agustín"?"#c03a3a":C.dark}}>{formatPeso(total)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumen gastos por grupo */}
      {(()=>{
        const grupos=["taller","casa","personal","otros"];
        const totales=grupos.map(g=>({
          g,
          total:movsDelCiclo.filter(m=>m.tipo==="gasto"&&CATEGORIAS[m.categoria]?.grupo===g).reduce((s,m)=>s+m.monto,0)
        })).filter(x=>x.total>0);
        if(totales.length===0)return null;
        const bgColor={taller:"#fff3ee",casa:"#f0f4ff",personal:"#f5f0ff",otros:"#f5f5f5"};
        return(
          <div style={{background:"white",borderRadius:14,padding:"14px 16px",marginBottom:14,boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
            <div style={{fontSize:12,fontWeight:800,color:"#aaa",textTransform:"uppercase",marginBottom:10}}>Gastos por categoría</div>
            <div style={{display:"grid",gridTemplateColumns:tablet?"1fr 1fr 1fr 1fr":"1fr 1fr",gap:8}}>
              {totales.map(({g,total})=>(
                <div key={g} style={{background:bgColor[g],borderRadius:12,padding:"12px 14px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:grupoColor[g],marginBottom:2}}>{grupoLabel[g].toUpperCase()}</div>
                  <div style={{fontSize:18,fontWeight:900,color:grupoColor[g]}}>{formatPeso(total)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div style={{background:"white",borderRadius:14,padding:"16px",marginBottom:14,boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
        <div style={{fontSize:12,fontWeight:800,color:"#aaa",textTransform:"uppercase",marginBottom:12}}>Cuotas — {cicloActual.label}</div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
          <span style={{fontSize:13,fontWeight:700,color:C.dark}}>{alumnosConPago.length} de {alumnos.length} pagaron</span>
          <span style={{fontSize:13,fontWeight:800,color:C.forest}}>{pctPagaron}%</span>
        </div>
        <div style={{background:"#f0f0f0",borderRadius:8,height:10,overflow:"hidden",marginBottom:14}}>
          <div style={{width:`${pctPagaron}%`,height:"100%",background:pctPagaron===100?C.forest:pctPagaron>60?C.sage:"#e8c96a",borderRadius:8}}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{background:"#e8f5e9",borderRadius:12,padding:"14px"}}><div style={{fontSize:11,color:"#5a9e6a",fontWeight:700}}>RECAUDADO</div><div style={{fontSize:20,fontWeight:900,color:"#388e3c"}}>{formatPeso(recaudadoCuotas)}</div></div>
          <div style={{background:"#fdecea",borderRadius:12,padding:"14px"}}><div style={{fontSize:11,color:"#c0784a",fontWeight:700}}>POR COBRAR</div><div style={{fontSize:20,fontWeight:900,color:"#c62828"}}>{formatPeso(porCobrarCuotas)}</div></div>
        </div>
        {alumnosSinPago.length>0&&(<div style={{marginTop:12}}>
          <div style={{fontSize:12,fontWeight:700,color:"#c0784a",marginBottom:6}}>Pendientes ({alumnosSinPago.length})</div>
          <div style={{display:"grid",gridTemplateColumns:tablet?"1fr 1fr":"1fr",gap:4}}>
            {alumnosSinPago.map(a=>(<div key={a.id} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"5px 0",borderBottom:"1px solid #f5f5f5",color:C.dark}}><span>{a.nombre}</span><span style={{fontWeight:700,color:"#c0784a"}}>{formatPeso(montoBase(a))}</span></div>))}
          </div>
        </div>)}
        {alumnosSinPago.length===0&&alumnos.length>0&&<div style={{marginTop:12,textAlign:"center",color:"#5a9e6a",fontWeight:700,fontSize:15}}>🎉 ¡Todas pagaron este ciclo!</div>}
      </div>

      <div style={{background:"white",borderRadius:14,padding:"15px 18px",marginBottom:14,boxShadow:"0 2px 8px rgba(0,0,0,0.05)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:11,color:"#aaa",fontWeight:700}}>ENCARGOS (saldo pendiente)</div><div style={{fontSize:22,fontWeight:900,color:C.forest,marginTop:2}}>{formatPeso(encargosSaldo)}</div></div>
        <div style={{fontSize:12,color:"#aaa"}}>por cobrar</div>
      </div>

      {/* Exportar */}
      <button onClick={()=>exportMovimientos(movsDelCiclo,cicloActual.label)} style={{width:"100%",background:"#e8f5e9",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,color:C.forest,cursor:"pointer",fontFamily:"inherit",marginBottom:14}}>📥 Exportar finanzas {cicloActual.label} a Excel</button>

      <div style={{fontSize:14,fontWeight:800,color:C.dark,marginBottom:10}}>Movimientos del ciclo</div>
      <div style={{display:"grid",gridTemplateColumns:tablet?"1fr 1fr":"1fr",gap:8,marginBottom:100}}>
        {[...movsDelCiclo].reverse().map(m=>(
          <div key={m.id} style={{background:"white",borderRadius:14,padding:"13px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:m.tipo==="ingreso"?"#e8f5e9":"#fdecea",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{m.tipo==="ingreso"?"↑":"↓"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,color:C.dark,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.descripcion}</div>
              <div style={{fontSize:11,color:"#bbb",marginTop:1}}>
                <span style={{background:catColor[m.categoria]+"22",color:catColor[m.categoria],borderRadius:4,padding:"1px 6px",fontWeight:600,marginRight:6}}>{catLabel[m.categoria]}</span>
                {formatDate(m.fecha)} · {m.metodo}{m.destinatario?` → ${m.destinatario}`:""}
              </div>
              {m.observaciones&&<div style={{fontSize:11,color:"#aaa",marginTop:2,fontStyle:"italic"}}>"{m.observaciones}"</div>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontSize:15,fontWeight:800,color:m.tipo==="ingreso"?"#388e3c":"#c62828",whiteSpace:"nowrap"}}>{m.tipo==="ingreso"?"+":"-"}{formatPeso(m.monto)}</div>
              <button onClick={()=>delMov(m.id)} style={{background:"none",border:"none",color:"#ddd",fontSize:20,cursor:"pointer",padding:"2px",lineHeight:1}}>×</button>
            </div>
          </div>
        ))}
        {movsDelCiclo.length===0&&<div style={{textAlign:"center",color:"#ccc",padding:"40px 0",fontSize:15,gridColumn:"1/-1"}}>Sin movimientos en este ciclo</div>}
      </div>

      <FAB onClick={()=>setModalAdd(true)}/>
      <Modal open={modalAdd} onClose={()=>setModalAdd(false)} title="Nuevo movimiento">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          {["ingreso","gasto"].map(t=>(<button key={t} onClick={()=>handleTipoChange(t)} style={{padding:"11px",borderRadius:12,border:`2px solid ${form.tipo===t?(t==="ingreso"?C.forest:"#c0784a"):"#e0e0e0"}`,background:form.tipo===t?(t==="ingreso"?"#e8f5e9":"#fdecea"):"white",color:form.tipo===t?(t==="ingreso"?C.forest:"#c0784a"):"#aaa",fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>{t==="ingreso"?"↑ Ingreso":"↓ Gasto"}</button>))}
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:5}}>Categoría</label>
          <select value={form.categoria} onChange={e=>setForm(p=>({...p,categoria:e.target.value}))} style={{...INPUT_STYLE}}>
            <optgroup label="── Ingresos">
              <option value="cuota">Cuota</option>
              <option value="encargo">Encargo</option>
              <option value="otro_ing">Otro ingreso</option>
            </optgroup>
            <optgroup label="── Taller">
              <option value="t_alquiler">Alquiler taller</option>
              <option value="t_expensas">Expensas taller</option>
              <option value="t_luz">Luz</option>
              <option value="t_agua">Agua</option>
              <option value="t_gas">Gas</option>
              <option value="t_retributivos">Retributivos</option>
              <option value="t_materiales">Materiales</option>
              <option value="t_insumos">Insumos</option>
              <option value="t_equipamento">Equipamiento</option>
              <option value="t_prestamo_b">Préstamo bancario</option>
              <option value="t_prestamo_f">Préstamo familiar</option>
              <option value="t_internet">Internet</option>
              <option value="t_otros">Otros taller</option>
            </optgroup>
            <optgroup label="── Casa">
              <option value="c_alquiler">Alquiler</option>
              <option value="c_impuestos">Impuestos</option>
              <option value="c_tarjeta_visa">Tarjeta Visa</option>
              <option value="c_tarjeta_nx">Tarjeta Naranja</option>
              <option value="c_mercaderias">Mercaderías</option>
              <option value="c_mantenimiento">Mantenimiento</option>
              <option value="c_indumentaria">Indumentaria</option>
              <option value="c_internet">Internet</option>
              <option value="c_salud">Salud</option>
              <option value="c_otros">Otros casa</option>
            </optgroup>
            <optgroup label="── Personal">
              <option value="p_ocio">Ocio</option>
              <option value="p_gustos">Gustos</option>
              <option value="p_otros">Otros personales</option>
            </optgroup>
            <optgroup label="── Otros">
              <option value="no_registrado">No registrado</option>
            </optgroup>
          </select>
        </div>
        <Input label="Descripción / Comentario" value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))} placeholder="Detalle del movimiento"/>
        <Input label="Monto ($)" type="number" value={form.monto} onChange={e=>setForm(p=>({...p,monto:e.target.value}))}/>
        <Input label="Fecha" type="date" value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))}/>
        <Sel label="Método" value={form.metodo} onChange={e=>setForm(p=>({...p,metodo:e.target.value,destinatario:""}))}>
          <option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option>
        </Sel>
        {form.metodo==="transferencia"&&<DestSelector value={form.destinatario} onChange={v=>setForm(p=>({...p,destinatario:v}))}/>}
        <Textarea label="Observaciones (opcional)" value={form.observaciones} onChange={e=>setForm(p=>({...p,observaciones:e.target.value}))} placeholder="Notas adicionales..."/>
        <Btn onClick={addMov} disabled={saving}>{saving?"Guardando...":"Guardar"}</Btn>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════════
function LoginScreen({onLogin}) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);

  const handleLogin=async()=>{
    if(!email||!password){setError("Completá email y contraseña");return;}
    setLoading(true);setError("");
    const {error:err}=await supabase.auth.signInWithPassword({email,password});
    if(err){setError("Email o contraseña incorrectos");setLoading(false);}
  };

  return (
    <div style={{minHeight:"100vh",background:C.cream,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Montserrat','Segoe UI',sans-serif",padding:20}}>
      <div style={{background:"white",borderRadius:24,padding:"40px 32px",width:"100%",maxWidth:380,boxShadow:"0 8px 40px rgba(116,149,88,0.15)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:72,height:72,borderRadius:"50%",background:"#e8f5e9",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",color:C.forest}}>
            <LeafIcon size={36}/>
          </div>
          <div style={{fontSize:26,fontWeight:900,color:C.dark}}>Eucalipta</div>
          <div style={{fontSize:11,letterSpacing:"0.14em",color:C.forest,fontWeight:700,textTransform:"uppercase",marginTop:4}}>Taller de Cerámica</div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:5}}>Email</label>
          <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}} placeholder="tucorreo@gmail.com" onKeyDown={e=>e.key==="Enter"&&handleLogin()} style={{...INPUT_STYLE}}/>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:5}}>Contraseña</label>
          <input type="password" value={password} onChange={e=>{setPassword(e.target.value);setError("");}} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handleLogin()} style={{...INPUT_STYLE}}/>
        </div>
        {error&&<div style={{background:"#fdecea",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#c62828",fontWeight:600}}>⚠ {error}</div>}
        <button onClick={handleLogin} disabled={loading} style={{width:"100%",background:C.forest,color:"white",border:"none",borderRadius:12,padding:"14px",fontSize:16,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",opacity:loading?0.7:1}}>
          {loading?"Ingresando...":"Ingresar"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════════════════
const TABS=[
  {id:"alumnos",label:"Alumnas"},{id:"turnos",label:"Turnos"},
  {id:"encargos",label:"Encargos"},{id:"horno",label:"Horno"},
  {id:"finanzas",label:"Finanzas"},
];

export default function EucaliptaApp() {
  const [tab,setTab]=useState("alumnos");
  const [loading,setLoading]=useState(true);
  const [session,setSession]=useState(null);
  const [data,setData]=useState({alumnos:[],turnos:[],encargos:[],horneadas:[],pagos:[],movimientos:[]});
  const tablet=useIsTablet();

  const [rol,setRol]=useState(null); // 'admin' | 'profe'

  const loadRol=async(session)=>{
    if(!session)return;
    const {data}=await supabase.from("user_roles").select("rol").eq("user_id",session.user.id).single();
    setRol(data?.rol||"profe");
  };

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setSession(session);
      if(session){loadRol(session);loadAll();}
      else setLoading(false);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,sess)=>{
      setSession(sess);
      if(sess){loadRol(sess);loadAll();}
      else setLoading(false);
    });
    return ()=>subscription.unsubscribe();
  },[]);

  const loadAll=async()=>{
    setLoading(true);
    const [a,t,e,h,p,m]=await Promise.all([
      supabase.from("alumnos").select("*").order("nombre"),
      supabase.from("turnos").select("*").order("id"),
      supabase.from("encargos").select("*").order("created_at",{ascending:false}),
      supabase.from("horneadas").select("*").order("fecha",{ascending:false}),
      supabase.from("pagos").select("*"),
      supabase.from("movimientos").select("*").order("created_at",{ascending:false}),
    ]);
    setData({alumnos:a.data||[],turnos:t.data||[],encargos:e.data||[],horneadas:h.data||[],pagos:p.data||[],movimientos:m.data||[]});
    setLoading(false);
  };

  const handleLogout=async()=>{
    await supabase.auth.signOut();
    setSession(null);
  };

  if(loading) return <div style={{minHeight:"100vh",background:C.cream,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div>;
  if(!session) return <LoginScreen/>;

  const titulos={alumnos:"Alumnas",turnos:"Turnos",encargos:"Encargos",horno:"Horno",finanzas:"Finanzas"};

  return (
    <div style={{background:C.cream,minHeight:"100vh",fontFamily:"'Montserrat','Segoe UI',sans-serif",display:"flex",flexDirection:"column"}}>
      <div style={{background:"white",padding:"14px 24px 12px",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid #f0ece6",position:"sticky",top:0,zIndex:40}}>
        <div style={{color:C.forest}}><LeafIcon size={26}/></div>
        <div>
          <div style={{fontSize:17,fontWeight:900,color:C.dark,lineHeight:1}}>Eucalipta</div>
          <div style={{fontSize:9,letterSpacing:"0.12em",color:C.forest,fontWeight:700,textTransform:"uppercase"}}>Taller de Cerámica</div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
          <div style={{fontSize:14,fontWeight:700,color:C.forest}}>{titulos[tab]}</div>
          {rol&&<div style={{fontSize:11,fontWeight:700,background:rol==="admin"?"#e8f5e9":"#f0f4ff",color:rol==="admin"?C.forest:"#5a7ec0",borderRadius:6,padding:"3px 8px"}}>{rol==="admin"?"Admin":"Profe"}</div>}
          <button onClick={handleLogout} title="Cerrar sesión" style={{background:"none",border:"1.5px solid #e0e0e0",borderRadius:8,padding:"5px 10px",fontSize:12,color:"#aaa",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Salir</button>
        </div>
      </div>

      <div style={{display:"flex",flex:1}}>
        {tablet&&(
          <div style={{width:200,flexShrink:0,background:"white",borderRight:"1px solid #f0ece6",padding:"20px 0",display:"flex",flexDirection:"column",gap:4,position:"sticky",top:57,height:"calc(100vh - 57px)",overflowY:"auto"}}>
            {TABS.filter(t=>!(t.id==="finanzas"&&rol==="profe")).map(t=>{const Icon=icons[t.id];return(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 20px",background:tab===t.id?"#e8f5e9":"none",border:"none",cursor:"pointer",color:tab===t.id?C.forest:"#bbb",fontFamily:"inherit",textAlign:"left",borderLeft:`3px solid ${tab===t.id?C.forest:"transparent"}`,fontWeight:tab===t.id?700:500,fontSize:14}}>
                <Icon/> {t.label}
              </button>
            );})}
          </div>
        )}

        <div style={{flex:1,padding:tablet?"20px 24px":"14px 14px 0",maxWidth:tablet?900:480,margin:"0 auto",width:"100%"}}>
          {tab==="alumnos"  &&<AlumnosTab  alumnos={data.alumnos} pagos={data.pagos} turnos={data.turnos} onRefresh={loadAll} tablet={tablet}/>}
          {tab==="turnos"   &&<TurnosTab   turnos={data.turnos} alumnos={data.alumnos} onRefresh={loadAll} tablet={tablet}/>}
          {tab==="encargos" &&<EncargosTab encargos={data.encargos} onRefresh={loadAll} tablet={tablet}/>}
          {tab==="horno"    &&<HornoTab    horneadas={data.horneadas} alumnos={data.alumnos} onRefresh={loadAll} tablet={tablet}/>}
          {tab==="finanzas" &&<FinanzasTab alumnos={data.alumnos} pagos={data.pagos} encargos={data.encargos} movimientos={data.movimientos} onRefresh={loadAll} tablet={tablet}/>}
        </div>
      </div>

      {!tablet&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"white",borderTop:"1px solid #f0ece6",display:"flex",zIndex:40}}>
          {TABS.filter(t=>!(t.id==="finanzas"&&rol==="profe")).map(t=>{const Icon=icons[t.id];return(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 0 8px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,color:tab===t.id?C.forest:"#ccc",fontFamily:"inherit"}}>
              <Icon/><span style={{fontSize:9,fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase"}}>{t.label}</span>
              {tab===t.id&&<div style={{width:4,height:4,borderRadius:"50%",background:C.forest}}/>}
            </button>
          );})}
        </div>
      )}
    </div>
  );
}
