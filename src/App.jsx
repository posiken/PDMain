import { useState, useEffect, useCallback, useRef } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const STATUS_ORDER = { "none": 5, "best-fit": 0, "trouble-call": 0, "manual-schedule": 1, "in-training": 2, "pto": 3, "do-not-schedule": 4,
                        available: 0, "on-call": 2, "off-duty": 3 }; // legacy aliases
const TECH_TYPES   = ["GHP","Lawn","Termite","Mosquito","Bed Bugs","Commercial","Exclusion","Wildlife","TAP","Sentricon","SMART","Pre Treat","Post Treat","Field Inspector","Trouble Call","Supervisor"];
const BRANCHES     = ["Jax N","Jax E","Jax W","Jax S","St. Augustine","Daytona","Gainesville","Ocala","Orlando","Melbourne","Port St Lucie","WPB-FTL","Sarasota","Tampa","Ft. Myers/Naples"];
const TYPE_CFG     = {
  GHP:               { color:"#38bdf8", bg:"rgba(56,189,248,.13)",  bd:"rgba(56,189,248,.32)"  },
  Lawn:              { color:"#4ade80", bg:"rgba(74,222,128,.13)",  bd:"rgba(74,222,128,.32)"  },
  Termite:           { color:"#fb923c", bg:"rgba(251,146,60,.13)",  bd:"rgba(251,146,60,.32)"  },
  Supervisor:        { color:"#c084fc", bg:"rgba(192,132,252,.13)", bd:"rgba(192,132,252,.32)" },
  "Trouble Call":    { color:"#f87171", bg:"rgba(248,113,113,.13)", bd:"rgba(248,113,113,.32)" },
  Production:        { color:"#475569", bg:"rgba(71,85,105,.1)",    bd:"rgba(71,85,105,.3)"    },
  Commercial:        { color:"#22d3ee", bg:"rgba(34,211,238,.13)",  bd:"rgba(34,211,238,.32)"  },
  Mosquito:          { color:"#a3e635", bg:"rgba(163,230,53,.13)",  bd:"rgba(163,230,53,.32)"  },
  Exclusion:         { color:"#b45309", bg:"rgba(251,191,36,.13)",  bd:"rgba(251,191,36,.32)"  },
  Wildlife:          { color:"#e879f9", bg:"rgba(232,121,249,.13)", bd:"rgba(232,121,249,.32)" },
  TAP:               { color:"#f472b6", bg:"rgba(244,114,182,.13)", bd:"rgba(244,114,182,.32)" },
  "Pre Treat":       { color:"#818cf8", bg:"rgba(129,140,248,.13)", bd:"rgba(129,140,248,.32)" },
  "Post Treat":      { color:"#34d399", bg:"rgba(52,211,153,.13)",  bd:"rgba(52,211,153,.32)"  },
  SMART:             { color:"#f0abfc", bg:"rgba(240,171,252,.13)", bd:"rgba(240,171,252,.32)" },
  Sentricon:         { color:"#67e8f9", bg:"rgba(103,232,249,.13)", bd:"rgba(103,232,249,.32)" },
  "Bed Bugs":        { color:"#fb7185", bg:"rgba(251,113,133,.13)", bd:"rgba(251,113,133,.32)" },
  "Field Inspector": { color:"#475569", bg:"rgba(148,163,184,.13)", bd:"rgba(148,163,184,.32)" },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
const mid = () => "m" + Date.now().toString(36);
const timeAgo = ts => { const s=Math.max(1,Math.floor((Date.now()-ts)/1000)); if(s<60)return s+"s ago"; const m=Math.floor(s/60); if(m<60)return m+"m ago"; const h=Math.floor(m/60); if(h<24)return h+"h ago"; return Math.floor(h/24)+"d ago"; };
const beep = () => { try { const C=window.AudioContext||window.webkitAudioContext; const ctx=new C(); const o=ctx.createOscillator(), g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type="sine"; o.frequency.value=880; g.gain.setValueAtTime(.0001,ctx.currentTime); g.gain.exponentialRampToValueAtTime(.2,ctx.currentTime+.03); g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.6); o.start(); o.stop(ctx.currentTime+.65); } catch {} };
const ini = n  => n.trim().split(/\s+/).map(w=>w[0]||"").join("").toUpperCase().slice(0,2)||"??";
const formatPhone = v => {
  const d = v.replace(/\D/g,"").slice(0,10);
  if (d.length===0) return "";
  if (d.length<=3)  return `(${d}`;
  if (d.length<=6)  return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
};

// Parses a pasted block of text (Excel column, comma-separated, etc.)
// into an array of unique valid 5-digit ZIP codes.
const parseZipList = text =>
  [...new Set(
    text.split(/[\n\r,\t ]+/)
      .map(z => z.replace(/\D/g,"").slice(0,5))
      .filter(z => z.length===5)
  )];

// ─── API HELPERS ──────────────────────────────────────────────────────────────
const api = {
  getTechs:      ()                  => fetch("/api/techs").then(r=>r.json()),
  saveTechs:     (techs,code,reason) => fetch("/api/techs",{method:"PUT",   headers:{"Content-Type":"application/json"},body:JSON.stringify({techs,code,reason})}).then(r=>r.json()),
  auth:          (body)              => fetch("/api/auth",  {method:"POST",  headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(r=>r.json()),
  changelog:     (body)              => fetch("/api/changelog",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(r=>r.json()),
  listBackups:   (code)              => fetch("/api/techs",{method:"POST",  headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"listBackups",code})}).then(r=>r.json()),
  restoreBackup: (backupId,code)     => fetch("/api/techs",{method:"POST",  headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"restore",backupId,code})}).then(r=>r.json()),
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=DM+Mono:wght@400;500&family=Barlow:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;}

.app{min-height:100vh;background:#f8fafc;color:#0f172a;font-family:'Barlow',sans-serif;}

.top-bar{display:flex;align-items:center;justify-content:space-between;padding:13px 24px;
  border-bottom:1px solid #e2e8f0;background:#ffffff;position:sticky;top:0;z-index:99;
  box-shadow:0 1px 3px rgba(0,0,0,.06);}
.brand{display:flex;align-items:center;gap:10px;background:none;border:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.brand:hover .brand-name{color:#2563eb;}
.brand:hover .brand-name span{color:#1e40af;}
.brand-name{font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:.05em;color:#0f172a;line-height:1.15;text-align:left;transition:color .18s;}
.brand-name span{color:#2563eb;display:block;}
.nav-pill{padding:7px 15px;border-radius:6px;border:1px solid #e2e8f0;background:transparent;color:#64748b;
  font-family:'Barlow',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .18s;flex-shrink:0;}
.nav-pill:hover{border-color:#2563eb;color:#2563eb;}
.nav-active{background:#eff6ff;border-color:#bfdbfe!important;color:#1e40af!important;}

.search-hero{max-width:600px;margin:60px auto 0;padding:0 20px;text-align:center;}
.hero-eyebrow{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#2563eb;margin-bottom:12px;}
.hero-title{font-family:'Barlow Condensed',sans-serif;font-size:clamp(44px,8vw,68px);font-weight:900;line-height:.95;margin-bottom:12px;letter-spacing:-.02em;color:#0f172a;}
.hero-sub{color:#64748b;font-size:15px;margin-bottom:28px;line-height:1.6;}
.search-bar{display:flex;border:1.5px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#ffffff;transition:border-color .2s,box-shadow .2s;}
.search-bar:focus-within{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.zip-input{flex:1;padding:16px 20px;font-family:'DM Mono',monospace;font-size:28px;font-weight:500;letter-spacing:.15em;background:transparent;border:none;outline:none;color:#0f172a;}
.zip-input::placeholder{color:#cbd5e1;}
.type-section{margin-top:14px;}
.type-label{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:#94a3b8;margin-bottom:10px;text-align:left;}
.type-grid{display:grid;gap:10px;}
.type-grid-4{grid-template-columns:repeat(4,minmax(0,1fr));}
.type-grid-2{grid-template-columns:repeat(2,minmax(0,1fr));}
@media(max-width:480px){.type-grid-4{grid-template-columns:repeat(2,minmax(0,1fr));}}
.type-btn{padding:16px 8px;border-radius:9px;border:1.5px solid #e2e8f0;background:#ffffff;color:#64748b;
  cursor:pointer;transition:none;display:flex;flex-direction:column;align-items:center;gap:5px;
  outline:none;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;min-width:0;overflow:hidden;}
.type-btn:hover:not(:disabled){border-color:#2563eb;color:#1e40af;}
.type-btn:active:not(:disabled){background:#ffffff;border-color:#e2e8f0;color:#64748b;transform:none;}
.type-btn:focus{outline:none;}
.type-btn:focus:not(:focus-visible){border-color:#e2e8f0;box-shadow:none;}
.type-btn:disabled{opacity:.4;cursor:not-allowed;}
.type-btn-label{font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;overflow:hidden;}
.type-chk{font-family:'DM Mono',monospace;font-size:10px;font-weight:700;line-height:1;color:#1e40af;margin-right:5px;}
.type-btn-sub{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.08em;text-transform:uppercase;text-align:center;}
.type-btn-feat{padding:14px 8px;}
.type-btn.ghp-active,.type-btn.lawn-active,.type-btn.tmte-active,.type-btn.spvr-active,.type-btn.tc-active,
.type-btn.comm-active,.type-btn.mosq-active,.type-btn.excl-active,.type-btn.wild-active,.type-btn.tap-active,
.type-btn.pret-active,.type-btn.post-active,.type-btn.smrt-active,.type-btn.sent-active,
.type-btn.bbug-active,.type-btn.finsp-active{border-color:#2563eb;background:#eff6ff;color:#1e40af;}
.type-btn.ghp-active:active,.type-btn.lawn-active:active,.type-btn.tmte-active:active,.type-btn.spvr-active:active,
.type-btn.tc-active:active,.type-btn.comm-active:active,.type-btn.mosq-active:active,.type-btn.excl-active:active,
.type-btn.wild-active:active,.type-btn.tap-active:active,.type-btn.pret-active:active,.type-btn.post-active:active,
.type-btn.smrt-active:active,.type-btn.sent-active:active,.type-btn.bbug-active:active,.type-btn.finsp-active:active{border-color:#2563eb;background:#eff6ff;color:#1e40af;}

.results-wrap{max-width:600px;margin:24px auto 0;padding:0 20px 60px;}
.results-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;}
.results-label{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;}

.tech-card{background:#ffffff;border:1px solid #e2e8f0;border-radius:9px;padding:18px;margin-bottom:9px;
  display:flex;gap:14px;animation:slideIn .3s ease both;transition:border-color .2s,box-shadow .2s,transform .15s;}
.tech-card:hover{border-color:#bfdbfe;box-shadow:0 4px 12px rgba(0,0,0,.07);transform:translateY(-1px);}
.tech-warn-banner{background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:7px 12px;
  flex:0 0 100%;display:flex;align-items:center;gap:8px;
  font-family:'DM Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:#c2410c;}
@keyframes slideIn{from{opacity:0;transform:translateY(9px);}to{opacity:1;transform:translateY(0);}}
.tech-avatar{width:44px;height:44px;border-radius:50%;background:#eff6ff;border:2px solid #bfdbfe;
  display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;color:#1e40af;flex-shrink:0;}
.tech-name{font-family:'Barlow Condensed',sans-serif;font-size:21px;font-weight:700;color:#0f172a;}
.tech-phone{display:block;font-family:'DM Mono',monospace;font-size:14px;font-weight:600;color:#334155;text-decoration:none;margin-bottom:7px;letter-spacing:.03em;}
.tech-phone:hover{color:#2563eb;}
.tech-notes{font-size:13px;color:#64748b;margin-bottom:8px;}
.tag-row{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:7px;}
.zip-tags{display:flex;flex-wrap:wrap;gap:5px;}
.zip-tag{font-family:'DM Mono',monospace;font-size:11px;padding:2px 8px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;color:#64748b;}
.zip-hl{background:#eff6ff;border-color:#bfdbfe;color:#1e40af;font-weight:500;}
.zip-more{font-family:'DM Mono',monospace;font-size:11px;padding:2px 8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;color:#1e40af;font-weight:500;}
.empty-state{text-align:center;padding:52px 20px;}
.empty-icon{font-size:42px;margin-bottom:13px;}
.empty-title{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:700;margin-bottom:7px;color:#0f172a;}
.empty-text{color:#64748b;font-size:14px;line-height:1.6;max-width:300px;margin:0 auto;}

.disclaimer{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:13px 15px;margin-top:16px;display:flex;gap:10px;align-items:flex-start;text-align:left;}
.disclaimer-icon{font-size:15px;flex-shrink:0;margin-top:1px;opacity:.8;}
.disclaimer-text{font-size:12px;color:#78350f;line-height:1.65;}
.disclaimer-text strong{color:#1e40af;font-weight:600;}

.admin-view{max-width:980px;margin:0 auto;padding:32px 20px 60px;}
.admin-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;}
.admin-head-left{display:flex;flex-direction:column;gap:5px;}
.admin-title{font-family:'Barlow Condensed',sans-serif;font-size:30px;font-weight:900;color:#0f172a;}
.admin-meta{font-family:'DM Mono',monospace;font-size:11px;color:#94a3b8;letter-spacing:.08em;}
.admin-meta span{color:#2563eb;}
.admin-head-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.session-badge{display:flex;align-items:center;gap:7px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;padding:5px 12px;font-family:'DM Mono',monospace;font-size:11px;color:#64748b;letter-spacing:.06em;}
.session-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.btn-signout{padding:6px 13px;background:transparent;border:1px solid #e2e8f0;border-radius:6px;color:#64748b;font-size:12px;cursor:pointer;transition:all .18s;font-family:'Barlow',sans-serif;}
.btn-signout:hover{border-color:rgba(239,68,68,.4);color:#ef4444;}
.btn-add{padding:9px 18px;background:#2563eb;border:none;border-radius:6px;color:#ffffff;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;transition:background .18s;}
.btn-add:hover{background:#2563eb;}
.btn-outline{padding:7px 14px;background:transparent;border:1px solid #e2e8f0;border-radius:6px;color:#64748b;font-family:'Barlow',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .18s;display:flex;align-items:center;gap:6px;}
.btn-outline:hover{border-color:#2563eb;color:#2563eb;}
.admin-tabs{display:flex;gap:2px;margin-bottom:24px;border-bottom:1px solid #e2e8f0;overflow-x:auto;scrollbar-width:thin;scrollbar-color:#cbd5e1 transparent;}
.admin-tabs::-webkit-scrollbar{height:5px;}
.admin-tabs::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px;}
.admin-tab{padding:10px 18px;background:transparent;border:none;border-bottom:2px solid transparent;color:#64748b;font-family:'Barlow',sans-serif;font-size:14px;font-weight:500;cursor:pointer;transition:all .18s;margin-bottom:-1px;white-space:nowrap;flex-shrink:0;}
.admin-tab:hover{color:#334155;}
.tab-active{color:#2563eb!important;border-bottom-color:#2563eb!important;}
.import-banner{background:#eff6ff;border:1px solid #bfdbfe;border-radius:9px;padding:16px 20px;margin-bottom:20px;animation:slideIn .25s ease both;}
.import-banner-title{font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:700;margin-bottom:4px;color:#0f172a;}
.import-banner-sub{font-size:13px;color:#64748b;margin-bottom:14px;line-height:1.5;}
.import-banner-actions{display:flex;gap:8px;}
.save-toast{display:flex;align-items:center;gap:8px;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.06em;padding:5px 12px;border-radius:6px;border:1px solid transparent;transition:all .3s;}
.save-saving{color:#1e40af;border-color:rgba(37,99,235,.2);background:rgba(37,99,235,.08);}
.save-ok    {color:#15803d;border-color:rgba(21,128,61,.3); background:rgba(21,128,61,.08);}
.save-err   {color:#dc2626;border-color:rgba(220,38,38,.3); background:rgba(220,38,38,.08);}
.bulk-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;margin-bottom:10px;
  background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;animation:slideIn .2s ease both;}
.bulk-count{font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:#1e40af;letter-spacing:.06em;}
.bulk-cancel{margin-left:auto;background:none;border:none;color:#64748b;cursor:pointer;
  font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;}
.bulk-cancel:hover{color:#dc2626;}
.row-check{width:15px;height:15px;accent-color:#2563eb;cursor:pointer;}

.table-wrap{border:1px solid #e2e8f0;border-radius:9px;overflow:hidden;}
.tech-table{width:100%;border-collapse:collapse;}
.tech-table th{background:#f8fafc;padding:10px 14px;text-align:left;font-family:'DM Mono',monospace;font-size:9px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #e2e8f0;}
.tech-table td{padding:12px 14px;border-bottom:1px solid #f1f5f9;vertical-align:middle;color:#334155;}
.tech-table tr:last-child td{border-bottom:none;}
.tech-table tbody tr:hover td{background:#fafafa;}
.row-avatar{width:30px;height:30px;border-radius:50%;background:#eff6ff;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:#1e40af;}
.btn-edit{padding:5px 12px;background:transparent;border:1px solid #e2e8f0;border-radius:5px;color:#64748b;font-size:12px;cursor:pointer;font-family:'Barlow',sans-serif;transition:all .18s;}
.btn-edit:hover{border-color:#2563eb;color:#2563eb;}
.btn-del{padding:5px 12px;background:transparent;border:1px solid rgba(239,68,68,.25);border-radius:5px;color:#ef4444;font-size:12px;cursor:pointer;font-family:'Barlow',sans-serif;transition:all .18s;}
.btn-del:hover{background:rgba(239,68,68,.06);border-color:rgba(239,68,68,.5);}
.btn-del-confirm{padding:5px 12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.35);border-radius:5px;color:#dc2626;font-size:12px;cursor:pointer;font-family:'Barlow',sans-serif;}
.btn-cancel{padding:9px 16px;background:transparent;border:1px solid #e2e8f0;border-radius:6px;color:#64748b;font-family:'Barlow',sans-serif;font-size:14px;font-weight:500;cursor:pointer;transition:all .18s;}
.btn-cancel:hover{border-color:#94a3b8;color:#334155;}
.btn-save{padding:9px 20px;background:#2563eb;border:none;border-radius:6px;color:#ffffff;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;transition:background .18s;}
.btn-save:hover{background:#2563eb;}
.btn-save:disabled{background:#e2e8f0;color:#94a3b8;cursor:not-allowed;}
.btn-restore{padding:5px 13px;background:transparent;border:1px solid #e2e8f0;border-radius:5px;color:#64748b;font-size:12px;cursor:pointer;font-family:'Barlow',sans-serif;transition:all .18s;}
.btn-restore:hover{border-color:#2563eb;color:#2563eb;}
.btn-popout{font-size:16px!important;padding:6px 10px!important;}
.bell-btn{position:relative;}
.bell-badge{position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;border-radius:8px;background:#dc2626;color:#fff;font-family:'DM Mono',monospace;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;animation:bellPulse 1.5s ease-in-out infinite;}
@keyframes bellPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.2);}}
.help-panel{position:absolute;top:44px;right:0;width:330px;max-width:calc(100vw - 24px);background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.16);z-index:300;overflow:hidden;max-height:70vh;overflow-y:auto;}
.help-item{padding:11px 14px;border-bottom:1px solid #f1f5f9;}
.help-item:last-child{border-bottom:none;}
.nav-backdrop{position:fixed;inset:0;z-index:290;background:transparent;}
.nav-panel{position:absolute;top:44px;right:0;width:215px;max-width:calc(100vw - 16px);background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.16);z-index:300;overflow:hidden;padding:6px;}
.nav-item{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;background:transparent;border:none;border-radius:7px;color:#475569;font-family:'Barlow',sans-serif;font-size:14px;font-weight:500;cursor:pointer;text-align:left;transition:background .12s;}
.nav-item:hover{background:#f1f5f9;}
.nav-item.nav-item-active{background:#eff6ff;color:#1e40af;font-weight:600;}
.nav-item-icon{width:20px;text-align:center;flex-shrink:0;font-size:14px;}
.nav-divider{height:1px;background:#e2e8f0;margin:5px 8px;}
@media(max-width:520px){.menu-label{display:none;}}
.fab-help{position:fixed;right:18px;bottom:18px;z-index:150;background:#dc2626;color:#fff;border:none;border-radius:28px;padding:13px 20px;font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:900;letter-spacing:.06em;cursor:pointer;box-shadow:0 6px 18px rgba(220,38,38,.35);display:flex;align-items:center;gap:8px;transition:background .15s;}
.fab-help:hover{background:#b91c1c;}
.alert-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;}
.alert-box{background:#fff;border-radius:14px;padding:22px 24px;width:100%;max-width:390px;border:3px solid #dc2626;animation:alertFlash .9s ease-in-out infinite;}
@keyframes alertFlash{0%,100%{border-color:#dc2626;box-shadow:0 0 0 0 rgba(220,38,38,.5);}50%{border-color:#fecaca;box-shadow:0 0 0 16px rgba(220,38,38,0);}}
.fab-chip{position:fixed;right:18px;bottom:18px;z-index:150;background:#fff;border:1.5px solid #bfdbfe;border-radius:12px;padding:11px 14px;box-shadow:0 8px 24px rgba(0,0,0,.14);width:280px;max-width:calc(100vw - 24px);}
@media(max-width:480px){.fab-help{right:12px;bottom:12px;padding:11px 16px;font-size:14px;}.fab-chip{right:12px;bottom:12px;}}

.overlay{position:fixed;inset:0;background:rgba(15,23,42,.4);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;}
.modal{background:#ffffff;border-radius:12px;padding:26px 28px;width:100%;max-width:560px;box-shadow:0 20px 60px rgba(0,0,0,.12);border:1px solid #e2e8f0;}
.modal-sm{max-width:400px;}
.modal-title{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:700;margin-bottom:18px;letter-spacing:.02em;color:#0f172a;}
.modal-footer{display:flex;justify-content:flex-end;gap:10px;margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;}
.field{margin-bottom:16px;}
.field-label{font-family:'DM Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:7px;display:block;}
.field-input{width:100%;padding:11px 14px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;color:#0f172a;font-family:'Barlow',sans-serif;font-size:15px;font-weight:400;outline:none;transition:border-color .2s,box-shadow .2s;}
.field-input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.field-textarea{width:100%;padding:11px 14px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;color:#0f172a;font-family:'Barlow',sans-serif;font-size:15px;resize:vertical;outline:none;transition:border-color .2s,box-shadow .2s;}
.field-textarea:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.err-box{background:#fee2e2;border:1px solid #fca5a5;border-radius:6px;padding:10px 14px;font-size:13px;color:#dc2626;margin-bottom:14px;}
.field-warn{font-family:'DM Mono',monospace;font-size:10px;color:#2563eb;letter-spacing:.04em;margin-top:-6px;margin-bottom:8px;}
.type-toggle-row{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:4px;}
.type-toggle{padding:8px 4px;border-radius:6px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#64748b;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.06em;text-align:center;cursor:pointer;transition:none;text-transform:uppercase;}
.type-toggle:hover{border-color:#2563eb;color:#1e40af;}
.warn-toggle{display:flex;align-items:center;gap:8px;font-size:13px;color:#64748b;cursor:pointer;}
.warn-toggle input{accent-color:#2563eb;}
.zip-list{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;min-height:32px;}
.zip-token{display:flex;align-items:center;gap:5px;font-family:'DM Mono',monospace;font-size:11px;padding:3px 9px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;color:#334155;}
.zip-token-del{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:13px;padding:0;line-height:1;}
.zip-token-del:hover{color:#ef4444;}
.zip-add-row{display:flex;gap:8px;}

.backup-item{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;}
.backup-meta{font-family:'DM Mono',monospace;font-size:11px;color:#64748b;letter-spacing:.05em;}
.backup-meta strong{color:#334155;display:block;margin-bottom:2px;}

.copy-btn{padding:3px 9px;background:transparent;border:1px solid #e2e8f0;border-radius:4px;color:#94a3b8;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;transition:all .18s;}
.copy-btn:hover{border-color:#2563eb;color:#2563eb;}
.copy-btn-ok{border-color:rgba(21,128,61,.4)!important;color:#15803d!important;background:rgba(21,128,61,.08)!important;}

.shortcut-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px;}
.shortcut-pill{display:flex;align-items:center;gap:5px;padding:4px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;cursor:pointer;font-family:'DM Mono',monospace;font-size:10px;color:#1e40af;letter-spacing:.04em;transition:background .15s;white-space:nowrap;-webkit-tap-highlight-color:transparent;}
.shortcut-pill:hover{background:#dbeafe;}
.shortcut-pill-del{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:13px;padding:0 0 0 2px;line-height:1;}
.shortcut-pill-del:hover{color:#ef4444;}
.shortcut-save{padding:4px 10px;background:transparent;border:1px dashed #bfdbfe;border-radius:20px;cursor:pointer;font-family:'DM Mono',monospace;font-size:10px;color:#94a3b8;letter-spacing:.04em;transition:all .15s;white-space:nowrap;}
.shortcut-save:hover{border-color:#2563eb;color:#2563eb;}

.offline-banner{background:#eff6ff;border-bottom:1px solid #bfdbfe;padding:6px 24px;font-family:'DM Mono',monospace;font-size:10px;color:#1e40af;letter-spacing:.08em;text-align:center;text-transform:uppercase;}

.guide-card{background:#ffffff;border:1px solid #e2e8f0;border-radius:9px;padding:20px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.04);}
.guide-card-title{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:700;margin-bottom:14px;letter-spacing:.02em;color:#0f172a;}
.guide-step{display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;}
.guide-step-num{font-family:'DM Mono',monospace;font-size:11px;color:#2563eb;background:#eff6ff;border:1px solid #bfdbfe;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
.guide-step-body{font-size:13px;color:#475569;line-height:1.7;padding-top:2px;}
.guide-row{display:flex;align-items:center;gap:10px;margin-bottom:9px;}
.guide-row-desc{font-size:13px;color:#475569;line-height:1.5;}
.cheat-search{position:sticky;top:58px;z-index:50;background:#f8fafc;padding:8px 0 10px;}
.cheat-chips{display:flex;gap:6px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:thin;scrollbar-color:#cbd5e1 transparent;}
.cheat-chips::-webkit-scrollbar{height:6px;}
.cheat-chips::-webkit-scrollbar-track{background:transparent;}
.cheat-chips::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px;}
.cheat-chips::-webkit-scrollbar-thumb:hover{background:#94a3b8;}
.cheat-code{font-family:'DM Mono',monospace;font-size:11px;font-weight:700;letter-spacing:.04em;
  background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:5px;padding:3px 8px;
  cursor:pointer;white-space:nowrap;transition:all .15s;}
.cheat-code:hover{background:#dbeafe;}
.cheat-code.copied{background:rgba(21,128,61,.1);border-color:rgba(21,128,61,.4);color:#15803d;}
.cheat-row{padding:11px 0;border-bottom:1px solid #f1f5f9;}
.cheat-row:last-child{border-bottom:none;}
.cheat-freq{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.06em;color:#64748b;
  background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;padding:2px 7px;white-space:nowrap;}
.cheat-name{font-size:12px;font-weight:600;color:#334155;letter-spacing:.02em;}
.cheat-desc{font-size:12.5px;color:#475569;line-height:1.6;margin-top:4px;}
.cheat-inc{display:flex;gap:8px;align-items:flex-start;font-size:13px;color:#475569;line-height:1.65;margin-bottom:6px;}
.cheat-inc span:first-child{flex-shrink:0;font-weight:700;}

.entry-card{background:#ffffff;border:1px solid #e2e8f0;border-radius:9px;padding:18px 20px;margin-bottom:10px;}
.entry-date{font-family:'DM Mono',monospace;font-size:10px;color:#94a3b8;letter-spacing:.08em;margin-bottom:5px;}
.entry-title{font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:700;margin-bottom:8px;color:#0f172a;}
.entry-body{font-size:13px;color:#475569;line-height:1.7;white-space:pre-wrap;}
.entry-actions{display:flex;gap:8px;margin-top:12px;}

.sort-bar{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;}
.sort-btn{padding:5px 12px;background:transparent;border:1px solid #e2e8f0;border-radius:20px;color:#94a3b8;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;transition:all .15s;}
.sort-btn:hover{border-color:#2563eb;color:#2563eb;}
.sort-btn-active{background:#eff6ff;border-color:#bfdbfe!important;color:#1e40af!important;}

.top-nav{display:flex;gap:6px;align-items:center;min-width:0;}

.type-group-divider{height:1px;background:linear-gradient(to right,transparent,#e2e8f0 20%,#e2e8f0 80%,transparent);margin:9px 0;}
.lookup-or{display:flex;align-items:center;gap:12px;margin:12px 0 10px;color:#94a3b8;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.15em;text-transform:uppercase;}
.lookup-or::before,.lookup-or::after{content:'';flex:1;height:1px;}
.lookup-or::before{background:linear-gradient(to right,transparent,#e2e8f0);}
.lookup-or::after{background:linear-gradient(to left,transparent,#e2e8f0);}
.branch-select{width:100%;padding:16px 18px;background:#ffffff;border:2px solid #e2e8f0;border-radius:10px;color:#64748b;font-family:'Barlow',sans-serif;font-size:17px;font-weight:500;outline:none;cursor:pointer;transition:border-color .2s,box-shadow .2s;-webkit-appearance:none;appearance:none;}
.branch-select:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.branch-select.branch-active{border-color:#2563eb;color:#1e40af;box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.pp-row{display:flex;align-items:center;gap:10px;padding:11px 16px;background:#ffffff;border:2px solid #e2e8f0;border-radius:10px;transition:border-color .2s,box-shadow .2s;}
.pp-row:focus-within{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.pp-row.pp-active{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.pp-label{font-family:'DM Mono',monospace;font-size:10px;font-weight:700;color:#2563eb;letter-spacing:.12em;flex-shrink:0;}
.pp-input{flex:1;background:transparent;border:none;outline:none;font-family:'DM Mono',monospace;font-size:15px;font-weight:500;color:#0f172a;letter-spacing:.06em;}
.pp-input::placeholder{color:#cbd5e1;}

.app-footer{border-top:1px solid #e2e8f0;padding:32px 24px 28px;background:#f8fafc;margin-top:0;}
.footer-inner{max-width:980px;margin:0 auto;display:flex;align-items:center;gap:20px;flex-wrap:wrap;}
.footer-divider{width:1px;height:28px;background:#e2e8f0;flex-shrink:0;}
.footer-copy{font-family:'DM Mono',monospace;font-size:10px;color:#94a3b8;letter-spacing:.08em;flex:1;min-width:200px;}
.footer-contact{display:flex;flex-direction:column;}
.footer-contact-label{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#cbd5e1;margin-bottom:11px;}
.footer-contact-name{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:700;color:#94a3b8;margin-bottom:7px;}
.footer-link{display:block;font-family:'DM Mono',monospace;font-size:12px;color:#64748b;text-decoration:none;margin-bottom:4px;transition:color .18s;letter-spacing:.04em;}
.footer-link:hover{color:#2563eb;}

::-webkit-scrollbar{width:5px;}
::-webkit-scrollbar-track{background:#f8fafc;}
::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:3px;}
::-webkit-scrollbar-thumb:hover{background:#cbd5e1;}

@media(max-width:768px){
  .search-hero{margin-top:40px;}
  .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .tech-table{min-width:700px;}
  .admin-view{padding:28px 16px 52px;}
  .top-bar{padding:11px 16px;}
  .footer-divider{display:none;}
  .footer-copy{min-width:0;flex:none;width:100%;}
  .footer-contact{flex:none;width:100%;}
}
@media(max-width:480px){
  .top-bar{padding:10px 14px;}
  .brand-name{font-size:13px;}
  .nav-pill{padding:6px 10px;font-size:12px;}
  .search-hero{margin-top:28px;padding:0 14px;}
  .hero-eyebrow{display:none;}
  .hero-sub{font-size:13px;margin-bottom:20px;}
  .zip-input{font-size:22px;letter-spacing:.1em;padding:13px 14px;}
  .type-grid{gap:8px;}
  .type-btn{padding:13px 6px;}
  .type-btn-label{font-size:15px;}
  .type-btn-sub{font-size:8px;}
  .results-wrap{padding:0 14px 48px;}
  .tech-card{padding:14px;}
  .tech-name{font-size:18px;}
  .admin-view{padding:20px 12px 40px;}
  .admin-head{gap:10px;}
  .admin-head-right{gap:6px;}
  .admin-title{font-size:24px;}
  .session-badge{display:none;}
  .overlay{padding:8px;}
  .modal{padding:18px;border-radius:8px;}
  .modal-sm{max-width:100%;}
  .type-toggle-row{grid-template-columns:repeat(2,1fr);}
  .disclaimer{padding:11px 13px;}
  .disclaimer-text{font-size:11px;}
  .app-footer{padding:24px 16px 20px;}
}
@media(max-width:360px){
  .brand-name{font-size:12px;}
  .nav-pill{padding:5px 9px;font-size:11px;}
  .zip-input{font-size:20px;}
  .type-grid{gap:6px;}
  .type-btn-label{font-size:14px;}
}
`;
// ─── BADGES ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (!status || status === "none") return null;
  const cfg = {
    // Current statuses
    "best-fit":        { label:"Best Fit",       bg:"rgba(16,185,129,.15)",  color:"#10b981", bd:"rgba(16,185,129,.3)"   },
    "trouble-call":    { label:"Trouble Call",    bg:"rgba(34,197,94,.13)",   color:"#22c55e", bd:"rgba(34,197,94,.28)"   },
    "in-training":     { label:"In Training",     bg:"rgba(14,116,144,.1)",   color:"#0e7490", bd:"rgba(45,212,191,.28)"  },
    "pto":             { label:"PTO",              bg:"rgba(251,191,36,.15)",  color:"#92400e", bd:"rgba(251,191,36,.3)"   },
    "manual-schedule":  { label:"Manual Schedule",  bg:"rgba(129,140,248,.15)", color:"#818cf8", bd:"rgba(129,140,248,.35)"  },
    "do-not-schedule": { label:"DO NOT SCHEDULE", bg:"rgba(239,68,68,.18)",   color:"#ef4444", bd:"rgba(239,68,68,.4)"    },
    // Legacy aliases (existing techs in DB)
    "available":       { label:"Trouble Call",    bg:"rgba(34,197,94,.13)",   color:"#22c55e", bd:"rgba(34,197,94,.28)"   },
    "on-call":         { label:"PTO",             bg:"rgba(251,191,36,.13)",  color:"#92400e", bd:"rgba(251,191,36,.28)"  },
    "off-duty":        { label:"DO NOT SCHEDULE", bg:"rgba(239,68,68,.18)",   color:"#ef4444", bd:"rgba(239,68,68,.4)"    },
  }[status] || { label:status, bg:"transparent", color:"#475569", bd:"#263047" };
  return (
    <span style={{padding:"2px 9px",borderRadius:20,fontSize:10,fontFamily:"'DM Mono',monospace",
      letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:500,
      background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.bd}`}}>{cfg.label}</span>
  );
}
function TypeBadge({ type, highlight }) {
  const c = TYPE_CFG[type]; if(!c) return null;
  return (
    <span style={{padding:"2px 9px",borderRadius:4,fontSize:10,fontFamily:"'DM Mono',monospace",
      letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:600,transition:"all .18s",
      background:highlight?c.bg:"#f8fafc",color:highlight?c.color:"#475569",
      border:highlight?`1px solid ${c.bd}`:"1px solid #cbd5e1"}}>{type}</span>
  );
}

// ─── TECH CARD ────────────────────────────────────────────────────────────────
function TechCard({ tech, highlightZip, highlightTypes, index }) {
  const extraZips = tech.zipCodes.length - 1;
  const [copiedPhone,    setCopiedPhone]    = useState(false);
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedAll,      setCopiedAll]      = useState(false);
  const handleCopyAll = () => {
    const block = `${tech.name}\nPhone: ${tech.phone}\nPestPac: ${tech.pestpacUsername||"—"}\nBranch: ${tech.branch||"—"}`;
    navigator.clipboard?.writeText(block)
      .then(()=>{ setCopiedAll(true); setTimeout(()=>setCopiedAll(false), 2000); })
      .catch(()=>{});
  };

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(tech.phone)
      .then(()=>{ setCopiedPhone(true); setTimeout(()=>setCopiedPhone(false), 2000); })
      .catch(()=>{});
  };

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(tech.pestpacUsername)
      .then(()=>{ setCopiedUsername(true); setTimeout(()=>setCopiedUsername(false), 2000); })
      .catch(()=>{});
  };

  return (
    <div className="tech-card" style={{animationDelay:`${index*55}ms`,flexWrap:"wrap",rowGap:tech.warn?"10px":0}}>
      {tech.warn && (
        <div className="tech-warn-banner">
          <span style={{fontSize:18,lineHeight:1}}>⚠</span>
          READ TECHNICIAN NOTES BEFORE SCHEDULING
        </div>
      )}
      <div className="tech-avatar">{ini(tech.name)}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:5,flexWrap:"wrap"}}>
          <div className="tech-name">{tech.name}</div>
          <StatusBadge status={tech.status}/>
          {tech.branch && (
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#64748b",letterSpacing:".06em"}}>{tech.branch}</span>
          )}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
          <a href={`tel:${tech.phone}`} className="tech-phone" style={{marginBottom:0}}>{tech.phone}</a>
          <button className={`copy-btn${copiedPhone?" copy-btn-ok":""}`} onClick={handleCopyPhone}>
            {copiedPhone ? "✓ Copied!" : "Copy"}
          </button>
        </div>
        {tech.pestpacUsername && (
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#64748b",letterSpacing:".04em"}}>
              PestPac:&nbsp;<span style={{color:"#b0bec5",fontWeight:500}}>{tech.pestpacUsername}</span>
            </span>
            <button className={`copy-btn${copiedUsername?" copy-btn-ok":""}`} onClick={handleCopyUsername}>
              {copiedUsername ? "✓ Copied!" : "Copy"}
            </button>
          </div>
        )}
        {tech.types?.length>0 && (
          <div className="tag-row">
            {tech.types.map(t=><TypeBadge key={t} type={t} highlight={(highlightTypes||[]).includes(t)}/>)}
          </div>
        )}
        {tech.notes && <div className="tech-notes">{tech.notes}</div>}
        <div className="zip-tags" style={{alignItems:"center"}}>
          {highlightZip
            ? <><span className="zip-tag zip-hl">{highlightZip}</span>{extraZips>0&&<span className="zip-more">+{extraZips} more</span>}</>
            : <span className="zip-more">{tech.zipCodes.length} ZIP{tech.zipCodes.length!==1?"s":""}</span>
          }
          <button className={`copy-btn${copiedAll?" copy-btn-ok":""}`} style={{marginLeft:"auto"}}
            onClick={handleCopyAll} title="Copy name, phone, PestPac & branch">
            {copiedAll ? "✓ Copied!" : "⧉ Copy Info"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Sorts a technician array by the chosen method
function sortTechs(arr, by, allTechs=[]) {
  const a = [...arr];
  if (by==="name-asc")  return a.sort((x,y)=>x.name.localeCompare(y.name));
  if (by==="name-desc") return a.sort((x,y)=>y.name.localeCompare(x.name));
  if (by==="branch")    return a.sort((x,y)=>(x.branch||"zzz").localeCompare(y.branch||"zzz")||x.name.localeCompare(y.name));
  if (by==="recent")    return a.sort((x,y)=>allTechs.indexOf(y)-allTechs.indexOf(x));
  // default: status then name
  return a.sort((x,y)=>(STATUS_ORDER[x.status]??3)-(STATUS_ORDER[y.status]??3)||x.name.localeCompare(y.name));
}

const SORT_OPTS_LOOKUP = [
  {value:"status",    label:"Status"},
  {value:"name-asc",  label:"A → Z"},
  {value:"name-desc", label:"Z → A"},
  {value:"branch",    label:"Branch"},
  {value:"recent",    label:"Newest"},
];
const SORT_OPTS_ADMIN = [
  {value:"name-asc",  label:"A → Z"},
  {value:"name-desc", label:"Z → A"},
  {value:"status",    label:"Status"},
  {value:"branch",    label:"Branch"},
  {value:"recent",    label:"Newest"},
];

function SortBar({ sortBy, setSortBy, opts }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",margin:"8px 0 12px"}}>
      <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#64748b",letterSpacing:".1em",textTransform:"uppercase",flexShrink:0,marginRight:2}}>Sort:</span>
      {opts.map(o=>(
        <button key={o.value} onClick={()=>setSortBy(o.value)} style={{
          padding:"4px 10px",borderRadius:5,cursor:"pointer",
          border:`1px solid ${sortBy===o.value?"#2563eb":"#1a2a3d"}`,
          background:sortBy===o.value?"rgba(37,99,235,.1)":"transparent",
          color:sortBy===o.value?"#2563eb":"#64748b",
          fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".05em",
          transition:"border-color .15s,color .15s,background .15s",whiteSpace:"nowrap",
        }}>{o.label}</button>
      ))}
    </div>
  );
}

// ─── SEARCH VIEW ─────────────────────────────────────────────────────────────
const TYPE_ACTIVE_CLASS = {
  GHP:"ghp-active", Lawn:"lawn-active", Termite:"tmte-active",
  Supervisor:"spvr-active", "Trouble Call":"tc-active"
};
const TYPE_SUB = {
  GHP:"Residential", Commercial:"Commercial", Lawn:"Lawn & Outdoor",
  Termite:"Termite Control", Supervisor:"Lead / Oversight",
  "Trouble Call":"New Starts / Callbacks", Production:"Route Techs"
};

function SearchView({ techs, zipInput, setZipInput, result, setResult }) {
  const [selTypes,      setSelTypes]      = useState([]);
  const [selBranch,     setSelBranch]     = useState("");
  const [pestpacSearch, setPestpacSearch] = useState("");
  const [sortBy,        setSortBy]        = useState("status");
  const [showAlso,      setShowAlso]      = useState(false);
  const [recentZips, setRecentZips] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('dispatch_recent_zips')||'[]'); } catch { return []; }
  });
  const [shortcuts, setShortcuts] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('dispatch_shortcuts')||'[]'); } catch { return []; }
  });
  const makeLabel = () => {
    const loc = selBranch || zipInput;
    const tStr = selTypes.slice(0,2).join(' + ')+(selTypes.length>2?` +${selTypes.length-2}`:'');
    return `${loc} · ${tStr}`;
  };
  const saveShortcut = () => {
    const label = makeLabel();
    const sc = {id:'sc_'+Date.now().toString(36),label,zip:zipInput,branch:selBranch,types:[...selTypes]};
    const updated = [sc,...shortcuts.filter(s=>s.label!==label)].slice(0,5);
    setShortcuts(updated);
    try { localStorage.setItem('dispatch_shortcuts',JSON.stringify(updated)); } catch {}
  };
  const deleteShortcut = id => {
    const updated = shortcuts.filter(s=>s.id!==id);
    setShortcuts(updated);
    try { localStorage.setItem('dispatch_shortcuts',JSON.stringify(updated)); } catch {}
  };
  const applyShortcut = sc => {
    setZipInput(sc.zip||''); setSelBranch(sc.branch||'');
    setSelTypes(sc.types||[]); setPestpacSearch('');
  };
  const logAnalytic = (method, query, types, count) => {
    const ev = { ts: Date.now(), method, query, types: [...types], count };
    try {
      const all = JSON.parse(localStorage.getItem('dispatch_analytics')||'[]');
      localStorage.setItem('dispatch_analytics', JSON.stringify([ev, ...all].slice(0, 500)));
    } catch {}
    fetch('/api/analytics', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'log', event: ev }) }).catch(()=>{});
  };
  const resultsRef  = useRef(null);
  const zipReady    = zipInput.length === 5;
  const lookupReady = zipReady || !!selBranch;

  // Unique branches present in the current tech list, sorted
  const branchOptions = [...new Set(techs.map(t=>t.branch).filter(Boolean))].sort();

  const toggleType = (type) => {
    setSelTypes(prev => {
      if (prev.includes(type)) return prev.filter(t=>t!==type);
      // Trouble Call and Production are opposites — selecting one clears the other
      const cleared = type==="Production" ? prev.filter(t=>t!=="Trouble Call")
                    : type==="Trouble Call" ? prev.filter(t=>t!=="Production")
                    : prev;
      return [...cleared, type];
    });
  };

  // Re-run search whenever zip, branch, pestpac, or selected types change
  useEffect(()=>{
    // PestPac username search — independent of ZIP / branch / types
    if (pestpacSearch.trim()) {
      const q = pestpacSearch.trim().toLowerCase();
      const matches = techs
        .filter(t =>
          t.name.toLowerCase().includes(q) ||
          (t.pestpacUsername && t.pestpacUsername.toLowerCase().includes(q))
        )
        .sort((a,b)=>a.name.localeCompare(b.name));
      setResult({ zip:null, branch:null, pestpac:pestpacSearch.trim(), types:[], matches });
      logAnalytic('find', pestpacSearch.trim(), [], matches.length);
      return;
    }

    if (!lookupReady || selTypes.length===0) { setResult(null); return; }

    const supervisorOk = (tt) => tt.includes("Supervisor") ? selTypes.includes("Supervisor") : true;
    // Trouble Call / Production are call-type lenses for techs only — supervisors
    // are matched purely by service type (GHP, Lawn, Termite, etc.)
    const typeOk = (tt) => {
      const isSup = tt.includes("Supervisor");
      return selTypes.every(st => {
        if (isSup && (st==="Trouble Call" || st==="Production")) return true;
        if (st==="Production") return !tt.includes("Trouble Call");
        return tt.includes(st);
      });
    };

    if (selBranch) {
      const matches = techs
        .filter(t => {
          const tt = t.types||[];
          return t.branch===selBranch && typeOk(tt) && supervisorOk(tt);
        })
        .sort((a,b)=>(STATUS_ORDER[a.status]??3)-(STATUS_ORDER[b.status]??3));
      setResult({ zip:null, branch:selBranch, pestpac:null, types:[...selTypes], matches });
      logAnalytic('branch', selBranch, selTypes, matches.length);
    } else {
      const zip = zipInput.trim();
      const byStatus = (a,b)=>(STATUS_ORDER[a.status]??3)-(STATUS_ORDER[b.status]??3);
      // Tier 1 — techs explicitly covering this ZIP
      const matches = techs
        .filter(t => t.zipCodes.includes(zip) && typeOk(t.types||[]) && supervisorOk(t.types||[]))
        .sort(byStatus);
      // Tier 2 — infer which branch(es) serve this ZIP from ANY tech's coverage,
      // then include type-matching techs from those branches (not already in tier 1)
      const zipBranches = [...new Set(techs.filter(t=>t.zipCodes.includes(zip)).map(t=>t.branch).filter(Boolean))];
      const seen = new Set(matches.map(t=>t.id));
      const alsoMatches = techs
        .filter(t => zipBranches.includes(t.branch) && !seen.has(t.id) && typeOk(t.types||[]) && supervisorOk(t.types||[]))
        .sort(byStatus);
      setResult({ zip, branch:null, pestpac:null, types:[...selTypes], matches,
                  also:{ branches:zipBranches, matches:alsoMatches } });
      logAnalytic('zip', zip, selTypes, matches.length + alsoMatches.length);
      if (matches.length + alsoMatches.length > 0) {
        setRecentZips(prev=>{
          const next = [zip, ...prev.filter(z=>z!==zip)].slice(0,5);
          try { localStorage.setItem('dispatch_recent_zips', JSON.stringify(next)); } catch {}
          return next;
        });
      }
    }
  }, [selTypes, zipInput, selBranch, pestpacSearch, techs]);
  useEffect(()=>{ setShowAlso(false); }, [zipInput, selBranch, selTypes, pestpacSearch]);
  useEffect(()=>{ try { window.__dispatchCtx = { zip: zipInput.length===5?zipInput:null, branch: selBranch||null, types:[...selTypes] }; } catch {} }, [zipInput, selBranch, selTypes]);

  return (
    <>
      <div className="search-hero">
        <div className="hero-eyebrow">// Technician Availability</div>
        <h1 className="hero-title">Tech Lookup</h1>
        <p className="hero-sub">Choose service types and a ZIP or branch — any order works.</p>
        <div className="search-bar">
          <input className="zip-input" type="text" inputMode="numeric" placeholder="00000"
            value={zipInput} maxLength={5} autoFocus
            onChange={e=>{
              const v=e.target.value.replace(/\D/g,"").slice(0,5);
              setZipInput(v);
              if(v) { setSelBranch(""); setPestpacSearch(""); }
            }}/>
        </div>
        {!zipInput && !selBranch && !pestpacSearch && recentZips.length>0 && (
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginTop:8}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:".12em",textTransform:"uppercase",color:"#cbd5e1"}}>Recent</span>
            {recentZips.map(z=>(
              <button key={z} onClick={()=>setZipInput(z)}
                style={{fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:500,padding:"3px 10px",
                  background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:20,color:"#475569",
                  cursor:"pointer",letterSpacing:".06em"}}>{z}</button>
            ))}
          </div>
        )}

        <div className="lookup-or">or</div>

        <select
          className={`branch-select${selBranch?" branch-active":""}`}
          value={selBranch}
          onChange={e=>{
            setSelBranch(e.target.value);
            if(e.target.value) { setZipInput(""); setPestpacSearch(""); }
          }}>
          <option value="">Select a branch…</option>
          {branchOptions.map(b=><option key={b} value={b}>{b}</option>)}
        </select>

        <div className="lookup-or">or</div>

        <div className={`pp-row${pestpacSearch?" pp-active":""}`}>
          <span className="pp-label">FIND</span>
          <input className="pp-input" type="text" placeholder="name or PestPac username…"
            value={pestpacSearch}
            onChange={e=>{
              setPestpacSearch(e.target.value);
              if(v) { setZipInput(""); setSelBranch(""); }
            }}/>
          {pestpacSearch && (
            <button onClick={()=>setPestpacSearch("")}
              style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",
                fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:".1em",
                textTransform:"uppercase",padding:0,flexShrink:0}}>
              Clear
            </button>
          )}
        </div>
        <div className="type-section">
          {(shortcuts.length>0 || (lookupReady && selTypes.length>0)) && (
            <div className="shortcut-bar">
              {shortcuts.map(sc=>(
                <button key={sc.id} className="shortcut-pill" onClick={()=>applyShortcut(sc)}>
                  {sc.label}
                  <span className="shortcut-pill-del"
                    onClick={e=>{e.stopPropagation();deleteShortcut(sc.id);}}>×</span>
                </button>
              ))}
              {lookupReady && selTypes.length>0 && (
                <button className="shortcut-save" onClick={saveShortcut}>☆ Save</button>
              )}
            </div>
          )}
          <div className="type-label" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span>Select service type{selTypes.length>1?" (multiple)":""}</span>
            {result && !result.pestpac && (result.matches.length + (result.also?.matches.length||0))>0 && (
              <button onClick={()=>resultsRef.current?.scrollIntoView({behavior:"smooth"})}
                style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:20,padding:"3px 11px",
                  fontFamily:"'DM Mono',monospace",fontSize:10,fontWeight:700,color:"#1e40af",
                  cursor:"pointer",letterSpacing:".05em",whiteSpace:"nowrap"}}>
                {result.zip && result.also
                  ? (result.matches.length>0 ? `${result.matches.length} confirmed ↓` : `${result.also.matches.length} in branch ↓`)
                  : `${result.matches.length + (result.also?.matches.length||0)} matches ↓`}
              </button>
            )}
            {selTypes.length>0 && (
              <button onClick={()=>setSelTypes([])}
                style={{background:"none",border:"none",color:"#64748b",fontFamily:"'DM Mono',monospace",
                  fontSize:9,letterSpacing:".1em",textTransform:"uppercase",cursor:"pointer",padding:0}}>
                Clear
              </button>
            )}
          </div>
          {/* ── Call type first: Trouble Call vs Production ── */}
          <div className="type-grid type-grid-2" style={{marginBottom:2}}>
            {["Trouble Call","Production"].map(type=>(
              <button key={type} className="type-btn type-btn-feat"
                style={selTypes.includes(type)?{borderColor:"#2563eb",background:"#eff6ff",color:"#1e40af"}:{}}
                onClick={e=>{toggleType(type);e.currentTarget.blur();}}>
                <div className="type-btn-label">
                  {selTypes.includes(type) && <span className="type-chk">✓</span>}
                  {type}
                </div>
                <div className="type-btn-sub">{TYPE_SUB[type]}</div>
              </button>
            ))}
          </div>
          <div className="type-group-divider"/>
          {/* ── Core services ── */}
          <div className="type-grid type-grid-2">
            {["GHP","Commercial","Lawn","Termite"].map(type=>(
              <button key={type} className="type-btn type-btn-feat"
                style={selTypes.includes(type)?{borderColor:"#2563eb",background:"#eff6ff",color:"#1e40af"}:{}}
                onClick={e=>{toggleType(type);e.currentTarget.blur();}}>
                <div className="type-btn-label">
                  {selTypes.includes(type) && <span className="type-chk">✓</span>}
                  {type==="GHP" ? "Res GHP" : type==="Commercial" ? "Commercial GHP" : type}
                </div>
                <div className="type-btn-sub">{TYPE_SUB[type]}</div>
              </button>
            ))}
          </div>
          <div className="type-group-divider"/>
          {/* ── Specialty types in 4-column rows ── */}
          <div className="type-grid type-grid-4">
            {["Mosquito","Bed Bugs","Exclusion","Wildlife"].map(type=>(
              <button key={type} className="type-btn"
                style={selTypes.includes(type)?{borderColor:"#2563eb",background:"#eff6ff",color:"#1e40af"}:{}}
                onClick={e=>{toggleType(type);e.currentTarget.blur();}}>
                <div className="type-btn-label">
                  {selTypes.includes(type) && <span className="type-chk">✓</span>}
                  {type}
                </div>
              </button>
            ))}
          </div>
          <div className="type-group-divider"/>
          <div className="type-grid type-grid-4">
            {["TAP","Sentricon","SMART","Pre Treat"].map(type=>(
              <button key={type} className="type-btn"
                style={selTypes.includes(type)?{borderColor:"#2563eb",background:"#eff6ff",color:"#1e40af"}:{}}
                onClick={e=>{toggleType(type);e.currentTarget.blur();}}>
                <div className="type-btn-label">
                  {selTypes.includes(type) && <span className="type-chk">✓</span>}
                  {type}
                </div>
              </button>
            ))}
          </div>
          <div className="type-group-divider"/>
          <div className="type-grid type-grid-2">
            {["Post Treat","Field Inspector"].map(type=>(
              <button key={type} className="type-btn"
                style={selTypes.includes(type)?{borderColor:"#2563eb",background:"#eff6ff",color:"#1e40af"}:{}}
                onClick={e=>{toggleType(type);e.currentTarget.blur();}}>
                <div className="type-btn-label">
                  {selTypes.includes(type) && <span className="type-chk">✓</span>}
                  {type}
                </div>
              </button>
            ))}
          </div>
          <div className="type-group-divider"/>
          <div className="type-grid" style={{gridTemplateColumns:"1fr"}}>
            {["Supervisor"].map(type=>(
              <button key={type} className="type-btn type-btn-feat"
                style={selTypes.includes(type)?{borderColor:"#2563eb",background:"#eff6ff",color:"#1e40af"}:{}}
                onClick={e=>{toggleType(type);e.currentTarget.blur();}}>
                <div className="type-btn-label">
                  {selTypes.includes(type) && <span className="type-chk">✓</span>}
                  {type}
                </div>
                <div className="type-btn-sub">{TYPE_SUB[type]||""}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {result ? (
        <div className="results-wrap" ref={resultsRef}>
          <div className="results-head">
            <span className="results-label">
              {result.pestpac
                ? <><span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#64748b",letterSpacing:".1em"}}>FIND&nbsp;</span><span style={{color:"#2563eb"}}>{result.pestpac}</span></>
                : <><span style={{color:"#2563eb"}}>{result.branch || result.zip}</span>&nbsp;·&nbsp;
                    {result.types.map((t,i)=>(
                      <span key={t}>
                        <span style={{color:TYPE_CFG[t]?.color}}>{t}</span>
                        {i<result.types.length-1&&<span style={{color:"#3d5068"}}>&nbsp;+&nbsp;</span>}
                      </span>
                    ))}</>
              }
            </span>
            <span className="results-label" style={{color:"#64748b"}}>
              {result.zip && result.also
                ? (result.matches.length>0
                    ? `${result.matches.length} confirmed`
                    : `0 confirmed · ${result.also.matches.length} in branch`)
                : ((result.matches.length + (result.also?.matches.length||0))===0?"no techs found":`${(result.matches.length + (result.also?.matches.length||0))} tech${(result.matches.length + (result.also?.matches.length||0))>1?"s":""} found`)}
            </span>
          </div>
          {(result.matches.length + (result.also?.matches.length||0))===0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <div className="empty-title">No Match Found</div>
              <div className="empty-text">
                {result.pestpac
                  ? <>No technician found matching&nbsp;<strong style={{color:"#2563eb"}}>{result.pestpac}</strong>.</>
                  : <>No technicians matching&nbsp;
                      <strong style={{color:"#2563eb"}}>{result.types.join(" + ")}</strong>
                      {result.branch
                        ? <>&nbsp;are assigned to the <strong style={{color:"#2563eb"}}>{result.branch}</strong> branch.</>
                        : <>&nbsp;are assigned to ZIP&nbsp;<strong style={{color:"#2563eb"}}>{result.zip}</strong>.</>
                      }
                    </>
                }
              </div>
              {!result.pestpac && (()=>{
                let branches = result.branch ? [result.branch]
                  : [...new Set(techs.filter(t=>t.zipCodes.includes(result.zip)).map(t=>t.branch).filter(Boolean))];
                const sups = techs.filter(t=>
                  (t.types||[]).includes("Supervisor") &&
                  (branches.length===0 || branches.includes(t.branch))
                ).sort((a,b)=>{
                  const hit = t => result.types.filter(ty=>ty!=="Supervisor"&&(t.types||[]).includes(ty)).length;
                  return hit(b)-hit(a);
                }).slice(0,4);
                return (
                  <div style={{maxWidth:380,margin:"22px auto 0",textAlign:"left"}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".12em",
                      textTransform:"uppercase",color:"#94a3b8",marginBottom:9,textAlign:"center"}}>
                      Next step — try fewer service types, or contact:
                    </div>
                    {sups.length>0 ? sups.map(s=>{
                      const spec = (s.types||[]).filter(t=>t!=="Supervisor");
                      const dept = spec.length ? spec.join(" / ") + " Supervisor"
                        : (/branch manager/i.test(s.notes||"") ? "Branch Manager" : "Supervisor");
                      const hit = spec.some(t=>result.types.includes(t));
                      return (
                      <div key={s.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                        gap:10,padding:"9px 13px",background:"#ffffff",
                        border:hit?"1px solid #bfdbfe":"1px solid #e2e8f0",
                        borderRadius:8,marginBottom:6}}>
                        <div style={{minWidth:0}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:700,color:"#0f172a"}}>{s.name}</div>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:".06em",
                            color:hit?"#1e40af":"#94a3b8",fontWeight:hit?700:400}}>
                            {s.branch||"Regional"} · {dept}
                          </div>
                        </div>
                        <a href={`tel:${s.phone}`} style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,
                          color:"#2563eb",textDecoration:"none",whiteSpace:"nowrap"}}>{s.phone}</a>
                      </div>
                      );
                    }) : (
                      <div style={{fontSize:13,color:"#64748b",textAlign:"center"}}>
                        Contact a branch supervisor or router for assistance.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <>
              <SortBar sortBy={sortBy} setSortBy={setSortBy} opts={SORT_OPTS_LOOKUP}/>
              {result.zip && result.also && result.matches.length>0 && (
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,fontWeight:700,letterSpacing:".1em",
                  textTransform:"uppercase",color:"#1e40af",margin:"2px 0 10px"}}>
                  ✓ Confirmed for ZIP {result.zip} ({result.matches.length})
                </div>
              )}
              {sortTechs(result.matches, sortBy, techs).map((tech,i)=>(
                <TechCard key={tech.id} tech={tech} highlightZip={result.zip} highlightTypes={result.types} index={i}/>
              ))}
              {result.also && result.also.matches.length>0 && (
                !showAlso ? (
                  <button onClick={()=>setShowAlso(true)}
                    style={{display:"block",width:"100%",marginTop:14,padding:"11px 14px",
                      background:"transparent",border:"1.5px dashed #cbd5e1",borderRadius:9,cursor:"pointer",
                      fontFamily:"'DM Mono',monospace",fontSize:11,color:"#64748b",letterSpacing:".05em"}}>
                    View {result.also.matches.length} {result.also.branches.join(" / ")} tech{result.also.matches.length>1?"s":""} NOT confirmed for this ZIP ▾
                  </button>
                ) : (
                  <>
                    <div style={{marginTop:16,marginBottom:10,padding:"10px 13px",background:"#fff7ed",
                      border:"1px solid #fed7aa",borderRadius:8,display:"flex",gap:9,alignItems:"flex-start"}}>
                      <span style={{fontSize:15,lineHeight:1,flexShrink:0}}>⚠</span>
                      <span style={{fontSize:12,color:"#9a3412",lineHeight:1.6}}>
                        These <strong>{result.also.branches.join(" / ")}</strong> techs are <strong>NOT confirmed for ZIP {result.zip}</strong>.
                        Verify coverage with the branch before scheduling — shown for reference only.
                      </span>
                    </div>
                    {sortTechs(result.also.matches, sortBy, techs).map((tech,i)=>(
                      <TechCard key={tech.id} tech={tech} highlightZip={result.zip} highlightTypes={result.types} index={result.matches.length+i}/>
                    ))}
                  </>
                )
              )}
            </>
          )}
        </div>
      ) : (
        <div style={{textAlign:"center",marginTop:48,color:"#2a3f58"}}>
          <div style={{fontSize:48,marginBottom:10}}>📍</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.13em",textTransform:"uppercase"}}>
            {lookupReady ? "Select a service type above"
              : selTypes.length>0 ? "Now enter a ZIP or choose a branch above"
              : "Enter a ZIP, choose a branch, or search by name"}
          </div>
        </div>
      )}

      <div style={{maxWidth:600,margin:"20px auto 40px",padding:"0 20px"}}>
        <div className="disclaimer">
          <div className="disclaimer-icon">⚠️</div>
          <div className="disclaimer-text">
            All scheduling decisions made through this tool remain subject to established drive times,
            technician duties, and standard operating procedures. When uncertain about the appropriate
            technician assignment, you must consult a router or supervisor prior to scheduling.
            <br/><br/>
            <strong>This is an independently developed internal tool and is not an official product of Turner Pest Control.</strong> It is privately maintained outside of company business hours.
          </div>
        </div>
      </div>
    </>
  );
}

// ─── LOGIN MODAL ──────────────────────────────────────────────────────────────
// Checks server on mount whether setup is needed, then handles login or first-time setup.
function LoginModal({ onLogin, onClose }) {
  const [mode,        setMode]        = useState("checking"); // checking | login | setup
  const [code,        setCode]        = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [show,        setShow]        = useState(false);
  const [err,         setErr]         = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [shake,       setShake]       = useState(false);

  const triggerShake = () => { setShake(true); setTimeout(()=>setShake(false),500); };

  useEffect(()=>{
    api.auth({ action:"checkStatus" })
      .then(d => setMode(d.needsSetup ? "setup" : "login"))
      .catch(()  => setMode("login"));
  },[]);

  const submit = async () => {
    setSubmitting(true);
    setErr("");
    if (mode==="setup") {
      if (code.length<4)  { setErr("Code must be at least 4 characters."); triggerShake(); setSubmitting(false); return; }
      if (code!==confirm) { setErr("Codes don't match."); triggerShake(); setSubmitting(false); return; }
    }
    const res = await onLogin(mode==="setup" ? "setup" : "login", code);
    if (res==="wrong") { setErr("Incorrect access code."); triggerShake(); setCode(""); }
    else if (res)       { setErr(res); triggerShake(); }
    setSubmitting(false);
  };

  const isSetup   = mode === "setup";
  const isLoading = mode === "checking";

  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&!isSetup&&onClose()}>
      <div className={`modal modal-sm${shake?" shake":""}`}>
        <div style={{textAlign:"center",marginBottom:22}}>
          <div style={{fontSize:38,marginBottom:10}}>{isSetup?"🔐":"🔒"}</div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:800,marginBottom:6}}>
            {isLoading?"Connecting…":isSetup?"Create Master Code":"Admin Access"}
          </div>
          {!isLoading && (
            <div style={{fontSize:13,color:"#64748b",lineHeight:1.6}}>
              {isSetup
                ?"Create a secure code to protect the admin panel."
                :"Enter your access code to continue."}
            </div>
          )}
        </div>

        {isLoading ? (
          <div style={{textAlign:"center",padding:"20px 0",color:"#64748b",fontFamily:"'DM Mono',monospace",fontSize:12}}>
            Checking status…
          </div>
        ) : (
          <>
            {err && <div className="err-box">{err}</div>}
            <div className="field">
              <label className="field-label">{isSetup?"New Access Code":"Access Code"}</label>
              <div className="code-input-row">
                <input className="field-input" type={show?"text":"password"} value={code}
                  onChange={e=>{setCode(e.target.value);setErr("");}}
                  onKeyDown={e=>!isSetup&&e.key==="Enter"&&submit()}
                  placeholder={isSetup?"Create a code":"Enter your code"} autoFocus/>
                <button className="eye-btn" onClick={()=>setShow(s=>!s)}>{show?"Hide":"Show"}</button>
              </div>
            </div>
            {isSetup && (
              <div className="field">
                <label className="field-label">Confirm Code</label>
                <div className="code-input-row">
                  <input className="field-input" type={show?"text":"password"} value={confirm}
                    onChange={e=>{setConfirm(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Repeat the code"/>
                </div>
              </div>
            )}
            <div className="modal-footer">
              {!isSetup && <button className="btn-cancel" onClick={onClose}>Cancel</button>}
              <button className={`btn-save${isSetup?" btn-save-full":""}`}
                disabled={submitting} onClick={submit}>
                {submitting?"…":isSetup?"Set Code & Enter Admin":"Enter"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── MANAGER CODE MODAL ───────────────────────────────────────────────────────
function ManagerCodeModal({ mode, manager, onSave, onClose }) {
  const [form, setForm] = useState(mode==="edit"?{...manager}:{label:"",code:""});
  const [show, setShow] = useState(false);
  const [err,  setErr]  = useState("");
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));
  const submit = () => {
    if (!form.label.trim()) { setErr("Label is required."); return; }
    if (form.code.length<4) { setErr("Code must be at least 4 characters."); return; }
    onSave(form);
  };
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-sm">
        <div className="modal-title">{mode==="edit"?"Edit Manager Code":"Add Manager Code"}</div>
        {err && <div className="err-box">{err}</div>}
        <div className="field">
          <label className="field-label">Label</label>
          <input className="field-input" value={form.label} onChange={e=>{upd("label",e.target.value);setErr("");}} placeholder="e.g. John Martinez" autoFocus/>
        </div>
        <div className="field">
          <label className="field-label">Access Code</label>
          <div className="code-input-row">
            <input className="field-input" type={show?"text":"password"} value={form.code}
              onChange={e=>{upd("code",e.target.value);setErr("");}}
              onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Min. 4 characters"/>
            <button className="eye-btn" onClick={()=>setShow(s=>!s)}>{show?"Hide":"Show"}</button>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={submit}>{mode==="edit"?"Save Changes":"Add Code"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── CODE MANAGER ─────────────────────────────────────────────────────────────
// Fetches full auth config from server on mount (master code required).
// All saves go back through the API.
function CodeManager({ authCode, onMasterCodeChanged }) {
  const [cfg,         setCfg]         = useState(null);
  const [cfgLoading,  setCfgLoading]  = useState(true);
  const [cfgErr,      setCfgErr]      = useState("");
  const [showMaster,  setShowMaster]  = useState(false);
  const [changing,    setChanging]    = useState(false);
  const [newCode,     setNewCode]     = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [showNew,     setShowNew]     = useState(false);
  const [masterErr,   setMasterErr]   = useState("");
  const [saving,      setSaving]      = useState(false);
  const [codeModal,   setCodeModal]   = useState(null);
  const [confirmDel,  setConfirmDel]  = useState(null);

  useEffect(()=>{
    api.auth({ action:"getConfig", code:authCode })
      .then(d => { if(d.error) throw new Error(d.error); setCfg(d); })
      .catch(e => setCfgErr(e.message))
      .finally(()=> setCfgLoading(false));
  },[authCode]);

  const saveConfig = async (newCfg) => {
    setSaving(true);
    const res = await api.auth({ action:"updateConfig", code:authCode, config:newCfg });
    setSaving(false);
    if (res.error) { setMasterErr(res.error); return false; }
    setCfg(newCfg);
    return true;
  };

  const saveMaster = async () => {
    if (newCode.length<4)      { setMasterErr("Code must be at least 4 characters."); return; }
    if (newCode!==confirmCode) { setMasterErr("Codes don't match."); return; }
    const ok = await saveConfig({...cfg, master:newCode});
    if (ok) {
      onMasterCodeChanged(newCode); // keep parent in sync
      setChanging(false); setNewCode(""); setConfirmCode(""); setMasterErr("");
    }
  };

  const handleSaveMgr = async (data) => {
    const updated = codeModal?.mode==="edit"
      ? cfg.managers.map(m=>m.id===data.id?data:m)
      : [...cfg.managers, {...data, id:mid()}];
    const ok = await saveConfig({...cfg, managers:updated});
    if (ok) setCodeModal(null);
  };

  const handleDelMgr = async (id) => {
    if (confirmDel===id) {
      await saveConfig({...cfg, managers:cfg.managers.filter(m=>m.id!==id)});
      setConfirmDel(null);
    } else {
      setConfirmDel(id);
      setTimeout(()=>setConfirmDel(p=>p===id?null:p),3000);
    }
  };

  if (cfgLoading) return (
    <div style={{padding:"40px 20px",textAlign:"center",color:"#64748b",fontFamily:"'DM Mono',monospace",fontSize:12}}>
      Loading access codes…
    </div>
  );
  if (cfgErr) return (
    <div className="err-box" style={{marginTop:16}}>Failed to load access codes: {cfgErr}</div>
  );
  if (!cfg) return null;

  return (
    <div>
      {/* ── Master Code ── */}
      <div className="code-section">
        <div className="code-section-title">Master Code</div>
        <div className="code-section-sub">Full access + manages all codes. Keep private.</div>
        {!changing ? (
          <div className="code-row-display">
            <span className="code-masked">{showMaster?cfg.master:"●".repeat(Math.min(cfg.master.length,14))}</span>
            <button className="eye-btn-sm" onClick={()=>setShowMaster(s=>!s)}>{showMaster?"Hide":"Show"}</button>
            <button className="btn-edit" onClick={()=>setChanging(true)}>Change</button>
          </div>
        ) : (
          <div className="change-form-wrap">
            {masterErr && <div className="err-box" style={{marginBottom:12}}>{masterErr}</div>}
            <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:140}}>
                <div className="field-label" style={{marginBottom:6}}>New Code</div>
                <input className="field-input" type={showNew?"text":"password"} value={newCode}
                  onChange={e=>{setNewCode(e.target.value);setMasterErr("");}} placeholder="New code" autoFocus/>
              </div>
              <div style={{flex:1,minWidth:140}}>
                <div className="field-label" style={{marginBottom:6}}>Confirm Code</div>
                <input className="field-input" type={showNew?"text":"password"} value={confirmCode}
                  onChange={e=>{setConfirmCode(e.target.value);setMasterErr("");}}
                  onKeyDown={e=>e.key==="Enter"&&saveMaster()} placeholder="Repeat code"/>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <button className="eye-btn-sm" onClick={()=>setShowNew(s=>!s)}>{showNew?"Hide":"Show"} codes</button>
              <div style={{flex:1}}/>
              <button className="btn-cancel" onClick={()=>{setChanging(false);setMasterErr("");setNewCode("");setConfirmCode("");}}>Cancel</button>
              <button className="btn-save" disabled={saving} onClick={saveMaster}>{saving?"Saving…":"Save New Code"}</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Manager Codes ── */}
      <div className="code-section" style={{marginTop:20}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:4}}>
          <div>
            <div className="code-section-title">Manager Codes</div>
            <div className="code-section-sub" style={{marginBottom:0}}>Full technician access. Cannot view or change access codes.</div>
          </div>
          <button className="btn-add" style={{flexShrink:0,marginTop:2}} onClick={()=>setCodeModal("add")}>+ Add Code</button>
        </div>
        {cfg.managers.length===0 ? (
          <div style={{padding:"28px 20px",textAlign:"center",border:"1px dashed #151e30",borderRadius:8,marginTop:16}}>
            <div style={{color:"#64748b",fontSize:12,fontFamily:"'DM Mono',monospace",letterSpacing:".06em"}}>No manager codes yet</div>
          </div>
        ) : (
          <div className="table-wrap" style={{marginTop:16}}>
            <table className="tech-table">
              <thead><tr><th>Label</th><th>Code</th><th></th></tr></thead>
              <tbody>
                {cfg.managers.map(mgr=>(
                  <ManagerRow key={mgr.id} mgr={mgr}
                    onEdit={()=>setCodeModal({mode:"edit",manager:mgr})}
                    onDelete={()=>handleDelMgr(mgr.id)}
                    isConfirming={confirmDel===mgr.id}/>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {codeModal && (
        <ManagerCodeModal mode={codeModal==="add"?"add":"edit"} manager={codeModal?.manager}
          onSave={handleSaveMgr} onClose={()=>setCodeModal(null)}/>
      )}
    </div>
  );
}

function ManagerRow({ mgr, onEdit, onDelete, isConfirming }) {
  const [show, setShow] = useState(false);
  return (
    <tr>
      <td style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:17,fontWeight:700}}>{mgr.label}</td>
      <td>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:"#475569",letterSpacing:".1em"}}>
            {show?mgr.code:"●".repeat(Math.min(mgr.code.length,12))}
          </span>
          <button className="eye-btn-sm" onClick={()=>setShow(s=>!s)}>{show?"Hide":"Show"}</button>
        </div>
      </td>
      <td>
        <div style={{display:"flex",gap:7}}>
          <button className="btn-edit" onClick={onEdit}>Edit</button>
          <button className={isConfirming?"btn-del-confirm":"btn-del"} onClick={onDelete}>{isConfirming?"Confirm?":"Delete"}</button>
        </div>
      </td>
    </tr>
  );
}

// ─── STATUS SELECT ────────────────────────────────────────────────────────────
const STATUS_OPTS = [
  { value:'none',            label:'None',            bg:'transparent',           color:'#64748b', bd:'#2d3f52'             },
  { value:'best-fit',       label:'Best Fit',        bg:'rgba(16,185,129,.15)',  color:'#10b981', bd:'rgba(16,185,129,.3)'  },
  { value:'manual-schedule', label:'Manual Schedule', bg:'rgba(129,140,248,.15)', color:'#818cf8', bd:'rgba(129,140,248,.4)' },
  { value:'in-training',     label:'In Training',     bg:'rgba(45,212,191,.15)',  color:'#2dd4bf', bd:'rgba(45,212,191,.4)' },
  { value:'pto',             label:'PTO',             bg:'rgba(251,191,36,.15)',  color:'#92400e', bd:'rgba(251,191,36,.4)' },
  { value:'do-not-schedule', label:'Do Not Schedule', bg:'rgba(239,68,68,.18)',   color:'#ef4444', bd:'rgba(239,68,68,.5)'  },
];
function StatusSelect({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cur = STATUS_OPTS.find(o=>o.value===(status||'none')) || STATUS_OPTS[0];

  useEffect(()=>{
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return ()=>document.removeEventListener('mousedown', h);
  },[open]);

  return (
    <div ref={ref} style={{position:'relative',display:'inline-block'}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{background:cur.bg,border:`1px solid ${cur.bd}`,borderRadius:5,
          padding:'3px 10px 3px 8px',fontSize:11,fontFamily:"'DM Mono',monospace",
          fontWeight:600,letterSpacing:'.06em',color:cur.color,cursor:'pointer',
          textTransform:'uppercase',minWidth:90,display:'flex',alignItems:'center',
          justifyContent:'space-between',gap:6,whiteSpace:'nowrap'}}>
        {cur.label}<span style={{fontSize:8,opacity:.55}}>▾</span>
      </button>
      {open && (
        <div style={{position:'absolute',top:'calc(100% + 3px)',left:0,
          background:'#ffffff',border:'1px solid #e2e8f0',borderRadius:7,
          boxShadow:'0 8px 24px rgba(0,0,0,.12)',zIndex:200,minWidth:145,overflow:'hidden'}}>
          {STATUS_OPTS.map(opt=>(
            <button key={opt.value} onClick={()=>{onChange(opt.value);setOpen(false);}}
              style={{display:'block',width:'100%',padding:'8px 12px',
                background:(status||'none')===opt.value?opt.bg:'transparent',
                border:'none',borderLeft:`3px solid ${(status||'none')===opt.value?opt.bd:'transparent'}`,
                color:opt.color,fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:600,
                letterSpacing:'.06em',textTransform:'uppercase',cursor:'pointer',
                textAlign:'left',transition:'background .12s'}}
              onMouseEnter={e=>{if((status||'none')!==opt.value)e.currentTarget.style.background='#f8fafc';}}
              onMouseLeave={e=>{if((status||'none')!==opt.value)e.currentTarget.style.background='transparent';}}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── BACKUPS TAB ──────────────────────────────────────────────────────────────
function BackupsTab({ authCode, onRestoreComplete }) {
  const [backups,        setBackups]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [err,            setErr]            = useState("");
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [restoring,      setRestoring]      = useState(false);

  useEffect(()=>{
    api.listBackups(authCode)
      .then(d=>{ setBackups(d.backups||[]); setLoading(false); })
      .catch(()=>{ setErr("Could not load backups."); setLoading(false); });
  },[authCode]);

  const fmtDate = iso => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) +
           " at " + d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
  };

  const handleDownload = (backup) => {
    const blob = new Blob([JSON.stringify({
      app:"PestDispatch",version:1,restoredFrom:backup.timestamp,
      exportedAt:new Date().toISOString(),technicians:backup.techs
    },null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`backup-${backup.timestamp.split("T")[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestore = async (backup) => {
    if (confirmRestore===backup.id) {
      setRestoring(true);
      try {
        const data = await api.restoreBackup(backup.id, authCode);
        if (data.techs) { onRestoreComplete(data.techs); setConfirmRestore(null); }
        else setErr(data.error||"Restore failed.");
      } catch { setErr("Restore failed."); }
      setRestoring(false);
    } else {
      setConfirmRestore(backup.id);
      setTimeout(()=>setConfirmRestore(p=>p===backup.id?null:p),4000);
    }
  };

  return (
    <div>
      <div style={{marginBottom:20,padding:"14px 18px",background:"#eff6ff",border:"1px solid rgba(37,99,235,.12)",borderRadius:8}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:700,marginBottom:4}}>Automatic Backups</div>
        <div style={{fontSize:13,color:"#475569",lineHeight:1.6}}>
          A snapshot is saved automatically every time technicians are added, edited, deleted, or imported.
          The last <strong style={{color:"#2563eb"}}>10 backups</strong> are kept. Older ones are removed automatically.
        </div>
      </div>

      {err && <div className="err-box">{err}</div>}
      {loading && <div style={{textAlign:"center",padding:"40px 0",color:"#64748b",fontFamily:"'DM Mono',monospace",fontSize:12}}>Loading backups…</div>}
      {!loading && !err && backups.length===0 && (
        <div className="empty-state">
          <div className="empty-icon">💾</div>
          <div className="empty-title">No Backups Yet</div>
          <div className="empty-text">Backups are created automatically with the next technician change.</div>
        </div>
      )}

      {backups.map((bk,i)=>(
        <div key={bk.id} className="tech-card" style={{flexDirection:"column",gap:0,animationDelay:`${i*40}ms`}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#64748b",letterSpacing:".08em",marginBottom:4}}>{fmtDate(bk.timestamp)}</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:700}}>{bk.count} technician{bk.count!==1?"s":""}</div>
              {bk.reason && <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#3d5068",marginTop:4,letterSpacing:".04em"}}>{bk.reason}</div>}
            </div>
            <div style={{display:"flex",gap:7,flexShrink:0,flexWrap:"wrap"}}>
              <button className="btn-outline" onClick={()=>handleDownload(bk)}>↓ Download</button>
              <button
                className={confirmRestore===bk.id?"btn-del-confirm":"btn-edit"}
                onClick={()=>handleRestore(bk)} disabled={restoring}>
                {restoring&&confirmRestore===bk.id?"Restoring…":confirmRestore===bk.id?"Confirm?":"↑ Restore"}
              </button>
            </div>
          </div>
          {i===0&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#3d5068",marginTop:10,letterSpacing:".04em"}}>← Most recent</div>}
        </div>
      ))}
    </div>
  );
}

// ─── AGENT LOGIN / HELP REQUEST / AGENTS ADMIN ───────────────────────────────
function AgentLoginModal({ onClose, onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [pin,      setPin]      = useState("");
  const [err,      setErr]      = useState("");
  const [busy,     setBusy]     = useState(false);
  const submit = async () => {
    if (!username.trim() || !pin) { setErr("Enter your username and PIN"); return; }
    setBusy(true); setErr("");
    try {
      const d = await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'login', username: username.trim(), pin }) }).then(r=>r.json());
      if (d.ok) onLoggedIn({ name: d.user.name, username: d.user.username, token: d.token });
      else setErr(d.error || "Invalid username or PIN");
    } catch { setErr("Could not reach the server"); }
    setBusy(false);
  };
  return (
    <div className="overlay" onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="modal modal-sm">
        <div className="modal-title">👤 Agent Sign In</div>
        <div className="field">
          <label className="field-label">Username</label>
          <input className="field-input" value={username} autoFocus autoCapitalize="none"
            onChange={e=>setUsername(e.target.value)} placeholder="e.g. jsmith"/>
        </div>
        <div className="field">
          <label className="field-label">PIN</label>
          <input className="field-input" type="password" inputMode="numeric" value={pin}
            onChange={e=>setPin(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") submit(); }} placeholder="••••"/>
        </div>
        {err && <div className="err-box">{err}</div>}
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" disabled={busy} onClick={submit}>{busy?"Signing in…":"Sign In"}</button>
        </div>
        <div style={{marginTop:12,fontSize:11,color:"#94a3b8",lineHeight:1.5}}>
          No account? Ask a manager to add you under Manage Techs → 👥 Agents.
        </div>
      </div>
    </div>
  );
}

function HelpRequestModal({ agent, onClose, onRaised }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");
  const [supsN, setSupsN] = useState(null);
  useEffect(()=>{
    fetch('/api/help', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'avail_count' }) })
      .then(r=>r.json()).then(d=>setSupsN(typeof d.n==="number"?d.n:null)).catch(()=>{});
  }, []);
  const ctx = (typeof window!=="undefined" && window.__dispatchCtx) || {};
  const ctxLabel = [ctx.branch || ctx.zip, (ctx.types||[]).slice(0,3).join(" + ")].filter(Boolean).join(" · ");
  const send = async () => {
    setBusy(true); setErr("");
    try {
      const d = await fetch('/api/help', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'raise', username: agent.username, token: agent.token, note: note.trim(), context: ctx }) }).then(r=>r.json());
      if (d.request) onRaised(d.request);
      else setErr(d.error || "Could not send — try again");
    } catch { setErr("Could not send — check your connection"); }
    setBusy(false);
  };
  return (
    <div className="overlay" onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="modal modal-sm">
        <div className="modal-title">🆘 Request a Supervisor</div>
        <p style={{fontSize:13,color:"#475569",lineHeight:1.6,marginBottom:14}}>
          Available supervisors get an instant ringing alert with your name{ctxLabel?" and your current search":""}.
        </p>
        {supsN!==null && (
          supsN>0
            ? <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#15803d",marginBottom:12,letterSpacing:".05em"}}>● {supsN} supervisor{supsN>1?"s":""} available now</div>
            : <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#92400e",background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:6,padding:"6px 10px",marginBottom:12,letterSpacing:".04em"}}>○ No supervisors marked available — your request will still be posted to all of them</div>
        )}
        {ctxLabel && (
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#1e40af",background:"#eff6ff",
            border:"1px solid #bfdbfe",borderRadius:6,padding:"7px 11px",marginBottom:12,letterSpacing:".04em"}}>
            CONTEXT · {ctxLabel}
          </div>
        )}
        <div className="field">
          <label className="field-label">What do you need? (optional)</label>
          <textarea className="field-textarea" rows={3} maxLength={200} value={note}
            onChange={e=>setNote(e.target.value)}
            placeholder="e.g. Customer escalation on the line — need approval for a same-day TC"/>
        </div>
        {err && <div className="err-box">{err}</div>}
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" disabled={busy} onClick={send}>{busy?"Sending…":"Send Request"}</button>
        </div>
      </div>
    </div>
  );
}

function AgentsTab({ authCode }) {
  const [users,      setUsers]      = useState(null);
  const [err,        setErr]        = useState("");
  const [fname,      setFname]      = useState("");
  const [funame,     setFuname]     = useState("");
  const [fpin,       setFpin]       = useState("");
  const [busy,       setBusy]       = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const call = body => fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ code: authCode, ...body }) }).then(r=>r.json()).catch(()=>({}));
  useEffect(()=>{ (async()=>{
    const d = await call({ action:'list' });
    if (d.users) setUsers(d.users); else { setUsers([]); setErr(d.error || "Could not load agents"); }
  })(); // eslint-disable-next-line
  }, []);
  const add = async () => {
    if (!fname.trim() || !funame.trim() || !fpin.trim()) { setErr("Name, username and PIN are all required"); return; }
    setBusy(true); setErr("");
    const d = await call({ action:'add', user:{ name:fname.trim(), username:funame.trim(), pin:fpin.trim() } });
    if (d.users) { setUsers(d.users); setFname(""); setFuname(""); setFpin(""); }
    else setErr(d.error || "Could not add agent");
    setBusy(false);
  };
  const toggle = async u => { const d = await call({ action:'update', user:{ id:u.id, active:!u.active } }); if (d.users) setUsers(d.users); };
  const resetPin = async u => {
    const pin = window.prompt("New PIN for " + u.name + " (4–8 digits):");
    if (!pin) return;
    const d = await call({ action:'update', user:{ id:u.id, pin } });
    if (d.users) { setUsers(d.users); window.alert("PIN updated — " + u.name + " will need to sign in again."); }
  };
  const del = async u => {
    if (confirmDel !== u.id) { setConfirmDel(u.id); setTimeout(()=>setConfirmDel(null), 2500); return; }
    const d = await call({ action:'delete', user:{ id:u.id } });
    if (d.users) setUsers(d.users);
    setConfirmDel(null);
  };
  return (
    <div>
      <p style={{fontSize:13,color:"#475569",lineHeight:1.7,marginBottom:16}}>
        Agent accounts let customer service reps sign in (👤 in the top bar) and use the 🆘 Supervisor button.
        Requests appear instantly on every signed-in supervisor's 🔔 bell.
      </p>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
        <input className="field-input" style={{flex:"2 1 140px"}} placeholder="Full name" value={fname} onChange={e=>setFname(e.target.value)}/>
        <input className="field-input" style={{flex:"1 1 110px"}} placeholder="username" autoCapitalize="none" value={funame} onChange={e=>setFuname(e.target.value)}/>
        <input className="field-input" style={{flex:"1 1 90px"}}  placeholder="PIN" inputMode="numeric" value={fpin} onChange={e=>setFpin(e.target.value)}/>
        <button className="btn-add" disabled={busy} onClick={add}>{busy?"Adding…":"+ Add Agent"}</button>
      </div>
      {err && <div className="err-box">{err}</div>}
      {users===null && <div style={{textAlign:"center",padding:"30px 0",color:"#64748b",fontFamily:"'DM Mono',monospace",fontSize:12}}>Loading agents…</div>}
      {users && users.length===0 && !err && (
        <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-title">No Agents Yet</div>
        <div className="empty-text">Add your first customer service agent above — they sign in with the username and PIN you choose.</div></div>
      )}
      {users && users.length>0 && (
        <div className="table-wrap">
          <table className="tech-table">
            <thead><tr><th>Name</th><th>Username</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id}>
                  <td style={{fontWeight:600,color:"#0f172a"}}>{u.name}</td>
                  <td style={{fontFamily:"'DM Mono',monospace",fontSize:12}}>{u.username}</td>
                  <td>
                    <button className="btn-edit" style={{color:u.active?"#15803d":"#94a3b8",borderColor:u.active?"rgba(21,128,61,.35)":"#e2e8f0"}}
                      onClick={()=>toggle(u)}>{u.active?"● Active":"○ Disabled"}</button>
                  </td>
                  <td style={{textAlign:"right",whiteSpace:"nowrap"}}>
                    <button className="btn-edit" style={{marginRight:6}} onClick={()=>resetPin(u)}>Reset PIN</button>
                    <button className={confirmDel===u.id?"btn-del-confirm":"btn-del"} onClick={()=>del(u)}>
                      {confirmDel===u.id?"Confirm?":"Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN VIEW ───────────────────────────────────────────────────────────────
// ─── REPORTS TAB ─────────────────────────────────────────────────────────────
function ReportsTab({ techs, authCode }) {
  const [section,  setSection]  = useState('coverage');
  const [an,       setAn]       = useState({ status:'loading', events:[] });
  const [clearArm, setClearArm] = useState(false);
  const loadAnalytics = useCallback(async () => {
    try {
      const d = await fetch('/api/analytics').then(r=>r.json());
      setAn({ status:'live', events: d.events||[] });
    } catch {
      let local = []; try { local = JSON.parse(localStorage.getItem('dispatch_analytics')||'[]'); } catch {}
      setAn({ status:'local', events: local });
    }
  }, []);
  useEffect(()=>{
    loadAnalytics();
    const id = setInterval(loadAnalytics, 60000);
    return ()=>clearInterval(id);
  }, [loadAnalytics]);
  const clearAnalytics = async () => {
    if (!clearArm) { setClearArm(true); setTimeout(()=>setClearArm(false), 2500); return; }
    try { await fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'clear',code:authCode})}); } catch {}
    try { localStorage.removeItem('dispatch_analytics'); } catch {}
    setClearArm(false); loadAnalytics();
  };

  const checkTypes = TECH_TYPES.filter(t => t !== 'Supervisor');
  // Regional techs (no branch — e.g. the Wildlife team) count toward every branch
  const regional = techs.filter(t => !t.branch && t.status !== 'do-not-schedule');
  const regionalN = type => regional.filter(t => (t.types||[]).includes(type)).length;
  const coverage = BRANCHES
    .filter(b => techs.some(t => t.branch === b))
    .map(branch => {
      const bTechs = techs.filter(t => t.branch === branch && t.status !== 'do-not-schedule');
      const types  = checkTypes.map(type => ({
        type,
        n: bTechs.filter(t => (t.types||[]).includes(type)).length + regionalN(type)
      }));
      const gaps   = types.filter(t => t.n === 0).length;
      const risks  = types.filter(t => t.n === 1).length;
      return { branch, count: bTechs.length, types, gaps, risks };
    })
    .sort((a, b) => b.gaps - a.gaps || b.risks - a.risks);
  const branchCards = coverage.filter(c => c.gaps > 0 || c.risks > 0);
  const fullCov     = coverage.filter(c => c.gaps === 0 && c.risks === 0);
  const totGaps     = coverage.reduce((s,c)=>s+c.gaps, 0);
  const totRisks    = coverage.reduce((s,c)=>s+c.risks, 0);

  const events   = an.events;
  const weekAgo  = Date.now() - 7 * 86400000;
  const recent   = events.filter(e => e.ts > weekAgo);
  const avgRes   = events.length ? Math.round(events.reduce((s, e) => s + e.count, 0) / events.length) : 0;
  const topZips  = Object.entries(events.filter(e => e.method==='zip')
    .reduce((a, e) => ({...a, [e.query]: (a[e.query]||0)+1}), {}))
    .sort((a,b) => b[1]-a[1]).slice(0, 5);
  const typeAcc  = {};
  events.forEach(e => (e.types||[]).forEach(t => { typeAcc[t] = (typeAcc[t]||0)+1; }));
  const topTypes = Object.entries(typeAcc).sort((a,b) => b[1]-a[1]).slice(0, 5);
  const methods  = events.reduce((a, e) => ({...a, [e.method]: (a[e.method]||0)+1}), {});
  const day0     = (()=>{ const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  const todayN   = events.filter(e => e.ts >= day0).length;
  const zeroN    = events.filter(e => e.count === 0).length;
  const zeroRate = events.length ? Math.round(zeroN / events.length * 100) : 0;
  const topBranches = Object.entries(events.filter(e=>e.method==='branch')
    .reduce((a,e)=>({...a,[e.query]:(a[e.query]||0)+1}),{}))
    .sort((a,b)=>b[1]-a[1]).slice(0,5);
  const zeroTop  = Object.entries(events.filter(e=>e.count===0)
    .reduce((a,e)=>{ const k=`${e.query} · ${(e.types||[]).slice(0,2).join('+')||'—'}`; return {...a,[k]:(a[k]||0)+1}; },{}))
    .sort((a,b)=>b[1]-a[1]).slice(0,5);
  const days = [...Array(7)].map((_,i)=>{
    const t = day0 - (6-i)*86400000;
    return { l:['SU','MO','TU','WE','TH','FR','SA'][new Date(t).getDay()],
             n: events.filter(e=>e.ts>=t && e.ts<t+86400000).length };
  });
  const maxDay = Math.max(1, ...days.map(d=>d.n));
  const barList = (items, color='#2563eb', bg='rgba(37,99,235,.12)') =>
    items.length===0 ? <div style={{color:'#94a3b8',fontSize:11}}>—</div>
    : items.map(([label,n],i)=>(
        <div key={label} style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color,width:12,textAlign:'right',flexShrink:0}}>{i+1}</span>
          <div style={{flex:1,background:'#f1f5f9',borderRadius:3,height:17,position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',inset:0,background:bg,width:`${Math.round(n/items[0][1]*100)}%`}}/>
            <div style={{position:'absolute',inset:'0 6px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'#334155',textTransform:'uppercase',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',maxWidth:96}}>{label}</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'#334155',flexShrink:0}}>{n}</span>
            </div>
          </div>
        </div>
      ));

  const tabStyle = (id) => ({
    padding:'7px 14px', borderRadius:7, cursor:'pointer', transition:'all .15s',
    border: section===id ? '1px solid #2563eb' : '1px solid #e2e8f0',
    background: section===id ? 'rgba(37,99,235,.1)' : 'transparent',
    color: section===id ? '#2563eb' : '#64748b',
    fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:'.06em', textTransform:'uppercase'
  });

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        <button onClick={()=>setSection('coverage')}  style={tabStyle('coverage')}>📍 Coverage Gaps</button>
        <button onClick={()=>setSection('analytics')} style={tabStyle('analytics')}>📊 Analytics</button>
      </div>

      {section==='coverage' && (
        <div>
          {coverage.length === 0
            ? <div className="empty-state"><div className="empty-icon">📍</div><div className="empty-title">No Branch Data</div><div className="empty-text">Add technicians with branches to see coverage.</div></div>
            : <>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
                {[{v:totGaps,l:'Coverage Gaps',c:totGaps>0?'#dc2626':'#15803d'},
                  {v:totRisks,l:'At Risk (1 tech)',c:totRisks>0?'#92400e':'#15803d'},
                  {v:`${fullCov.length}/${coverage.length}`,l:'Branches Fully Covered',c:'#15803d'}].map(({v,l,c})=>(
                  <div key={l} style={{background:'#ffffff',border:'1px solid #e2e8f0',borderRadius:9,padding:'12px',textAlign:'center'}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:900,color:c,lineHeight:1}}>{v}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'#475569',letterSpacing:'.1em',textTransform:'uppercase',marginTop:4}}>{l}</div>
                  </div>
                ))}
              </div>
              <p style={{fontSize:10,color:'#94a3b8',fontFamily:"'DM Mono',monospace",marginBottom:14,lineHeight:1.7,letterSpacing:'.03em'}}>
                Excludes Do Not Schedule techs · Regional team (no branch) counts toward every branch · Branches sorted by most gaps
              </p>
              {branchCards.map(({branch, count, types, gaps, risks}) => {
                const gapT  = types.filter(t=>t.n===0).map(t=>t.type).sort();
                const riskT = types.filter(t=>t.n===1).map(t=>t.type).sort();
                const covN  = types.length - gapT.length - riskT.length;
                const chip = (type, col) => (
                  <span key={type} style={{padding:'2px 7px',borderRadius:4,fontSize:9,fontFamily:"'DM Mono',monospace",
                    fontWeight:700,letterSpacing:'.04em',background:col.bg,border:`1px solid ${col.bd}`,color:col.t}}>
                    {type.toUpperCase()}
                  </span>
                );
                const RED = {t:'#dc2626',bg:'rgba(220,38,38,.08)',bd:'rgba(220,38,38,.3)'};
                const AMB = {t:'#92400e',bg:'rgba(180,83,9,.07)', bd:'rgba(180,83,9,.25)'};
                return (
                  <div key={branch} style={{background:'#ffffff',border:'1px solid #e2e8f0',borderRadius:10,padding:'14px 16px',marginBottom:8,boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:11,gap:8,flexWrap:'wrap'}}>
                      <div>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:17,fontWeight:700}}>{branch}</span>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'#475569',marginLeft:8}}>{count} tech{count!==1?'s':''}</span>
                      </div>
                      <div style={{display:'flex',gap:5}}>
                        {gaps>0  && <span style={{background:'rgba(220,38,38,.08)',border:'1px solid rgba(220,38,38,.25)',borderRadius:4,padding:'2px 7px',fontSize:10,color:'#dc2626',fontFamily:"'DM Mono',monospace",fontWeight:700}}>{gaps} gap{gaps!==1?'s':''}</span>}
                        {risks>0 && <span style={{background:'rgba(180,83,9,.07)',border:'1px solid rgba(180,83,9,.22)',borderRadius:4,padding:'2px 7px',fontSize:10,color:'#92400e',fontFamily:"'DM Mono',monospace",fontWeight:700}}>{risks} at risk</span>}
                      </div>
                    </div>
                    {gapT.length>0 && (
                      <div style={{display:'flex',alignItems:'flex-start',gap:9,marginBottom:riskT.length||covN?9:0}}>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,fontWeight:700,letterSpacing:'.1em',color:'#dc2626',flexShrink:0,paddingTop:3,width:78}}>NO COVERAGE</span>
                        <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{gapT.map(t=>chip(t,RED))}</div>
                      </div>
                    )}
                    {riskT.length>0 && (
                      <div style={{display:'flex',alignItems:'flex-start',gap:9,marginBottom:covN?9:0}}>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,fontWeight:700,letterSpacing:'.1em',color:'#92400e',flexShrink:0,paddingTop:3,width:78}}>1 TECH ONLY</span>
                        <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{riskT.map(t=>chip(t,AMB))}</div>
                      </div>
                    )}
                    {covN>0 && (
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'#15803d',letterSpacing:'.04em'}}>
                        ✓ {covN} type{covN!==1?'s':''} covered
                      </div>
                    )}
                  </div>
                );
              })}
              {fullCov.length>0 && (
                <div style={{background:'rgba(21,128,61,.05)',border:'1px solid rgba(21,128,61,.2)',borderRadius:10,padding:'13px 16px',marginTop:4}}>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:700,letterSpacing:'.1em',color:'#15803d',textTransform:'uppercase'}}>✓ Full Coverage&ensp;</span>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:700,color:'#166534'}}>
                    {fullCov.map(c=>c.branch).join('  ·  ')}
                  </span>
                </div>
              )}
            </>
          }
        </div>
      )}

      {section==='analytics' && (
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
            {an.status==='live' && <span style={{display:'flex',alignItems:'center',gap:6,fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:700,letterSpacing:'.12em',color:'#15803d',background:'rgba(21,128,61,.07)',border:'1px solid rgba(21,128,61,.25)',borderRadius:20,padding:'3px 10px'}}><span style={{width:6,height:6,borderRadius:'50%',background:'#15803d'}}/>LIVE · ALL DEVICES</span>}
            {an.status==='local' && <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:700,letterSpacing:'.12em',color:'#92400e',background:'rgba(180,83,9,.07)',border:'1px solid rgba(180,83,9,.25)',borderRadius:20,padding:'3px 10px'}}>OFFLINE · THIS BROWSER ONLY</span>}
            {an.status==='loading' && <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:'.12em',color:'#94a3b8'}}>LOADING…</span>}
            <button onClick={loadAnalytics} title="Refresh now"
              style={{marginLeft:'auto',background:'transparent',border:'1px solid #e2e8f0',borderRadius:5,padding:'4px 10px',color:'#64748b',fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:'.06em',cursor:'pointer',textTransform:'uppercase'}}>↻ Refresh</button>
          </div>
          {events.length === 0
            ? <div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">No Data Yet</div><div className="empty-text">Search analytics appear here once agents start performing lookups — shared live across every device.</div></div>
            : <>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(96px,1fr))',gap:8,marginBottom:14}}>
                {[{v:events.length,l:'Total',c:'#2563eb'},
                  {v:todayN,l:'Today',c:'#2563eb'},
                  {v:recent.length,l:'This Week',c:'#2563eb'},
                  {v:avgRes,l:'Avg Results',c:'#2563eb'},
                  {v:`${zeroRate}%`,l:'Zero-Result',c:zeroRate>15?'#dc2626':'#15803d'}].map(({v,l,c})=>(
                  <div key={l} style={{background:'#ffffff',border:'1px solid #e2e8f0',borderRadius:9,padding:'12px 8px',textAlign:'center'}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,color:c,lineHeight:1}}>{v}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:'#475569',letterSpacing:'.1em',textTransform:'uppercase',marginTop:4}}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{background:'#ffffff',border:'1px solid #e2e8f0',borderRadius:9,padding:'14px 16px 10px',marginBottom:14}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'#475569',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:10}}>Last 7 Days</div>
                <div style={{display:'flex',alignItems:'flex-end',gap:6,height:64}}>
                  {days.map((d,i)=>(
                    <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,height:'100%',justifyContent:'flex-end'}}>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:'#64748b'}}>{d.n||''}</span>
                      <div style={{width:'100%',maxWidth:34,borderRadius:'3px 3px 0 0',background:i===6?'#2563eb':'rgba(37,99,235,.3)',height:`${Math.max(3,Math.round(d.n/maxDay*42))}px`}}/>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:'#94a3b8'}}>{d.l}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
                <div><div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'#475569',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:8}}>Top ZIPs</div>{barList(topZips)}</div>
                <div><div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'#475569',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:8}}>Top Service Types</div>{barList(topTypes)}</div>
                <div><div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'#475569',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:8}}>Top Branches</div>{barList(topBranches)}</div>
                <div><div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'#dc2626',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:8}}>Zero-Result Searches</div>{barList(zeroTop,'#dc2626','rgba(220,38,38,.1)')}</div>
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'#475569',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:8}}>By Method</div>
                <div style={{display:'flex',gap:8}}>
                  {[{k:'zip',l:'ZIP'},{k:'branch',l:'Branch'},{k:'find',l:'Name / ID'}].map(({k,l})=>(
                    <div key={k} style={{flex:1,background:'#ffffff',border:'1px solid #e2e8f0',borderRadius:7,padding:'10px 12px',textAlign:'center'}}>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:'#475569'}}>{methods[k]||0}</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'#475569',letterSpacing:'.06em',textTransform:'uppercase',marginTop:2}}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderTop:'1px solid #e2e8f0',paddingTop:12}}>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'#94a3b8',letterSpacing:'.04em'}}>
                  {an.status==='live' ? `Shared log · ${events.length}/1000 stored · refreshes every 60s` : `Local fallback · ${events.length}/500 stored`}
                </span>
                <button onClick={clearAnalytics}
                  style={{background:clearArm?'rgba(220,38,38,.08)':'transparent',border:`1px solid ${clearArm?'rgba(220,38,38,.4)':'#e2e8f0'}`,borderRadius:5,padding:'4px 10px',color:clearArm?'#dc2626':'#64748b',fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:'.06em',cursor:'pointer',textTransform:'uppercase'}}>
                  {clearArm ? 'Confirm Clear?' : 'Clear Data'}
                </button>
              </div>
            </>
          }
        </div>
      )}
    </div>
  );
}

function AdminView({ techs, confirmId, authLevel, authLabel, authCode,
                     onSignOut, onMasterCodeChanged, onRestoreComplete, onStatusChange, onBulkStatus,
                     onAdd, onEdit, onDelete, onImport, saveStatus }) {
  const [tab,           setTab]           = useState("techs");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [sortBy,        setSortBy]        = useState("name-asc");
  const [filterBranch,  setFilterBranch]  = useState("");
  const [importPending, setImportPending] = useState(null);
  const [selectedIds,   setSelectedIds]   = useState(new Set());
  const [bulkStatus,    setBulkStatus]    = useState("none");
  const [importErr,     setImportErr]     = useState("");
  const fileRef = useRef(null);
  const uniqueZips = new Set(techs.flatMap(t=>t.zipCodes)).size;

  const branchOpts = [...new Set(techs.map(t=>t.branch).filter(Boolean))].sort();
  const filteredTechs = techs
    .filter(t=>!searchQuery.trim() || t.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    .filter(t=>!filterBranch || t.branch===filterBranch);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({app:"PestDispatch",version:1,exportedAt:new Date().toISOString(),technicians:techs},null,2)],{type:"application/json"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download=`pestdispatch-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0]; if(!file) return;
    setImportErr("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const list = data.technicians ?? data;
        if (!Array.isArray(list)||list.length===0) throw new Error("No technicians found.");
        const valid = list.filter(t=>t.name&&t.phone);
        if (!valid.length) throw new Error("File contains no valid technician records.");
        setImportPending({techs:valid,filename:file.name});
      } catch(err) { setImportErr(`Could not read file: ${err.message}`); }
    };
    reader.readAsText(file); e.target.value="";
  };

  return (
    <div className="admin-view">
      <div className="admin-head">
        <div className="admin-head-left">
          <h2 className="admin-title">Admin Panel</h2>
          {tab==="techs" && (
            <div className="admin-meta">
              <span>{techs.length}</span> technicians&nbsp;·&nbsp;<span>{uniqueZips}</span> unique ZIP codes
            </div>
          )}
        </div>
        <div className="admin-head-right">
          {/* Save status indicator */}
          {saveStatus && (
            <div className={`save-toast ${saveStatus==="saving"?"save-saving":saveStatus==="ok"?"save-ok":"save-err"}`}>
              {saveStatus==="saving"?"Saving…":saveStatus==="ok"?"✓ Saved":"✗ Save failed"}
            </div>
          )}
          <div className="session-badge">
            <span className="session-dot" style={{background:authLevel==="master"?"#2563eb":"#38bdf8"}}/>
            {authLabel}
          </div>
          <button className="btn-signout" onClick={onSignOut}>Sign Out</button>
          {tab==="techs" && <>
            <button className="btn-outline" onClick={handleExport}>↓ Export</button>
            <button className="btn-outline" onClick={()=>fileRef.current?.click()}>↑ Import</button>
            <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={handleFileChange}/>
            <button className="btn-add" onClick={onAdd}>+ Add Technician</button>
          </>}
        </div>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab${tab==="techs"?" tab-active":""}`} onClick={()=>{setTab("techs");setSearchQuery("");setFilterBranch("");}}>Technicians</button>
        <button className={`admin-tab${tab==="reports"?" tab-active":""}`} onClick={()=>setTab("reports")}>📊 Reports</button>
        <button className={`admin-tab${tab==="backups"?" tab-active":""}`} onClick={()=>setTab("backups")}>💾 Backups</button>
        <button className={`admin-tab${tab==="agents"?" tab-active":""}`} onClick={()=>setTab("agents")}>👥 Agents</button>
        {authLevel==="master" && <button className={`admin-tab${tab==="codes"?" tab-active":""}`} onClick={()=>setTab("codes")}>🔐 Codes</button>}
      </div>

      {tab==="techs" && (
        <>
          {/* Search bar */}
          <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
            <select
              value={filterBranch} onChange={e=>setFilterBranch(e.target.value)}
              style={{background:"#ffffff",border:"1.5px solid #e2e8f0",borderRadius:8,
                padding:"9px 14px",color:filterBranch?"#2563eb":"#64748b",fontFamily:"'Barlow',sans-serif",
                fontSize:13,cursor:"pointer",outline:"none",WebkitAppearance:"none",
                appearance:"none",flexShrink:0,minWidth:140,
                boxShadow:filterBranch?"0 0 0 2px rgba(37,99,235,.12)":"none",
                borderColor:filterBranch?"rgba(245,158,11,.5)":"#151e30",transition:"border-color .2s,box-shadow .2s"}}>
              <option value="">All Branches</option>
              {branchOpts.map(b=><option key={b} value={b}>{b}</option>)}
            </select>
            <div style={{flex:1,position:"relative",minWidth:160}}>
              <input className="field-input" value={searchQuery}
                onChange={e=>setSearchQuery(e.target.value)}
                placeholder="Search technicians by name…"
                style={{paddingLeft:34,margin:0}}/>
              <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#3d5068",pointerEvents:"none"}}>🔍</span>
            </div>
            {searchQuery && (
              <button className="btn-cancel" style={{flexShrink:0,padding:"9px 14px"}} onClick={()=>setSearchQuery("")}>Clear</button>
            )}
          </div>
          {searchQuery && (
            <div className="admin-meta" style={{marginBottom:8}}>
              Showing <span>{filteredTechs.length}</span> of {techs.length} technicians
            </div>
          )}
          <SortBar sortBy={sortBy} setSortBy={setSortBy} opts={SORT_OPTS_ADMIN}/>
          {importErr && (
            <div className="err-box" style={{marginBottom:16}}>
              {importErr}&nbsp;<span style={{cursor:"pointer",textDecoration:"underline"}} onClick={()=>setImportErr("")}>Dismiss</span>
            </div>
          )}
          {importPending && (
            <div className="import-banner">
              <div className="import-banner-title">📁 {importPending.filename}</div>
              <div className="import-banner-sub">
                <strong style={{color:"#2563eb"}}>{importPending.techs.length} technicians</strong> found.
                This will replace your current {techs.length} technician{techs.length!==1?"s":""}. Cannot be undone.
              </div>
              <div className="import-banner-actions">
                <button className="btn-cancel" onClick={()=>setImportPending(null)}>Cancel</button>
                <button className="btn-save" onClick={()=>{onImport(importPending.techs);setImportPending(null);}}>Yes, Replace All</button>
              </div>
            </div>
          )}

          {filteredTechs.length===0 ? (
            <div className="empty-state">
              <div className="empty-icon">{searchQuery?"🔍":"👷"}</div>
              <div className="empty-title">{searchQuery?"No Match":"No Technicians Yet"}</div>
              <div className="empty-text">{searchQuery?`No technicians found matching "${searchQuery}".`:"Add your first technician above, or import from a backup file."}</div>
            </div>
          ) : (
            <div className="table-wrap">
              {selectedIds.size>0 && (
                <div className="bulk-bar">
                  <span className="bulk-count">{selectedIds.size} selected</span>
                  <StatusSelect status={bulkStatus} onChange={setBulkStatus}/>
                  <button className="btn-save" style={{padding:"5px 14px",fontSize:12}}
                    onClick={()=>{onBulkStatus([...selectedIds], bulkStatus);setSelectedIds(new Set());}}>
                    Apply to {selectedIds.size}
                  </button>
                  <button className="bulk-cancel" onClick={()=>setSelectedIds(new Set())}>Clear</button>
                </div>
              )}
              <table className="tech-table">
                <thead>
                  <tr>
                    <th style={{width:34}}>
                      <input type="checkbox" className="row-check"
                        checked={filteredTechs.length>0 && filteredTechs.every(t=>selectedIds.has(t.id))}
                        onChange={e=>{
                          const next = new Set(selectedIds);
                          filteredTechs.forEach(t=> e.target.checked ? next.add(t.id) : next.delete(t.id));
                          setSelectedIds(next);
                        }}/>
                    </th>
                    <th>Technician</th><th>Phone</th><th>Status</th><th>Branch</th><th>Service Types</th><th>ZIP Codes</th><th>Notes</th><th></th></tr>
                </thead>
                <tbody>
                  {sortTechs(filteredTechs, sortBy, techs).map(tech=>(
                    <tr key={tech.id}>
                      <td>
                        <input type="checkbox" className="row-check"
                          checked={selectedIds.has(tech.id)}
                          onChange={()=>{
                            const next = new Set(selectedIds);
                            next.has(tech.id) ? next.delete(tech.id) : next.add(tech.id);
                            setSelectedIds(next);
                          }}/>
                      </td>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:9}}>
                          <div className="row-avatar">{ini(tech.name)}</div>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:17,fontWeight:700}}>{tech.name}</span>
                        </div>
                      </td>
                      <td style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,color:"#b0bec5",letterSpacing:".03em"}}>{tech.phone}</td>
                      <td><StatusSelect status={tech.status} onChange={s=>onStatusChange(tech.id,s)}/></td>
                      <td style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#64748b"}}>{tech.branch||"—"}</td>
                      <td>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                          {(tech.types||[]).map(t=><TypeBadge key={t} type={t} highlight/>)}
                          {(!tech.types||tech.types.length===0)&&<span style={{color:"#3d5068",fontSize:12}}>—</span>}
                        </div>
                      </td>
                      <td>
                        <div className="zip-tags">
                          {[...tech.zipCodes].sort().slice(0,2).map(z=><span key={z} className="zip-tag">{z}</span>)}
                          {tech.zipCodes.length>2&&<span className="zip-more">+{tech.zipCodes.length-2} more</span>}
                        </div>
                      </td>
                      <td style={{color:"#64748b",fontSize:13,maxWidth:140}}>{tech.notes||"—"}</td>
                      <td>
                        <div style={{display:"flex",gap:7}}>
                          <button className="btn-edit" onClick={()=>onEdit(tech)}>Edit</button>
                          <button className={confirmId===tech.id?"btn-del-confirm":"btn-del"} onClick={()=>onDelete(tech.id)}>
                            {confirmId===tech.id?"Confirm?":"Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab==="reports" && <ReportsTab techs={techs} authCode={authCode}/>}
      {tab==="agents" && <AgentsTab authCode={authCode}/>}

      {tab==="backups" && (
        <BackupsTab authCode={authCode} onRestoreComplete={onRestoreComplete}/>
      )}

      {tab==="codes" && authLevel==="master" && (
        <CodeManager authCode={authCode} onMasterCodeChanged={onMasterCodeChanged}/>
      )}
    </div>
  );
}

// ─── TECH MODAL ───────────────────────────────────────────────────────────────
const TT_CLASS = {
  GHP:"tt-ghp", Lawn:"tt-lawn", Termite:"tt-tmte", Supervisor:"tt-spvr",
  "Trouble Call":"tt-tc", Commercial:"tt-comm", Mosquito:"tt-mosq",
  Exclusion:"tt-excl", Wildlife:"tt-wild", TAP:"tt-tap",
  "Pre Treat":"tt-pret", "Post Treat":"tt-post", SMART:"tt-smrt",
  Sentricon:"tt-sent", "Bed Bugs":"tt-bbug", "Field Inspector":"tt-finsp"
};
function TechModal({ mode, tech, allTechs, onSave, onClose }) {
  const blank = {name:"",pestpacUsername:"",phone:"",status:"none",branch:"",types:[],zipCodes:[],notes:"",warn:false};
  const [form,     setForm]     = useState(mode==="edit"?{...tech,types:tech.types||[],branch:tech.branch||"",pestpacUsername:tech.pestpacUsername||"",warn:tech.warn||false}:blank);
  const [zipEntry,       setZipEntry]       = useState("");
  const [showBulkPaste,  setShowBulkPaste]  = useState(false);
  const [bulkText,       setBulkText]       = useState("");
  const [bulkMsg,        setBulkMsg]        = useState(null); // { text, ok }
  const [err,            setErr]            = useState("");
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));
  const toggleType = (type) => upd("types",form.types.includes(type)?form.types.filter(t=>t!==type):[...form.types,type]);
  const addZip = () => {
    const z = zipEntry.trim().replace(/\D/g,"").slice(0,5);
    if (z.length!==5||form.zipCodes.includes(z)) { setZipEntry(""); return; }
    upd("zipCodes",[...form.zipCodes,z]); setZipEntry("");
  };
  const handleBulkAdd = () => {
    const parsed  = parseZipList(bulkText);
    const newZips = parsed.filter(z=>!form.zipCodes.includes(z));
    if (newZips.length===0) {
      setBulkMsg({ text: parsed.length===0 ? "No valid ZIP codes found." : "All ZIPs already added.", ok: false });
    } else {
      upd("zipCodes",[...form.zipCodes,...newZips]);
      setBulkMsg({ text:`✓ Added ${newZips.length} ZIP code${newZips.length>1?"s":""}${parsed.length>newZips.length?` (${parsed.length-newZips.length} duplicate${parsed.length-newZips.length>1?"s":""} skipped)`:""}`, ok: true });
      setBulkText("");
    }
    setTimeout(()=>setBulkMsg(null), 4000);
  };
  const dupPhone   = form.phone && (allTechs||[]).find(t=>t.id!==tech?.id&&t.phone&&t.phone===form.phone);
  const dupPestpac = form.pestpacUsername && (allTechs||[]).find(t=>
    t.id!==tech?.id && t.pestpacUsername &&
    t.pestpacUsername.toUpperCase()===form.pestpacUsername.toUpperCase());
  const submit = () => {
    if (!form.name.trim())     { setErr("Name is required."); return; }
    if (!form.phone.trim())    { setErr("Phone is required."); return; }
    if (!form.types.length)    { setErr("Select at least one service type."); return; }
    // Duplicate check — only on new techs
    if (mode==="add") {
      const dup = (allTechs||[]).find(t=>t.name.trim().toLowerCase()===form.name.trim().toLowerCase());
      if (dup) { setErr(`"${dup.name}" is already in the system. Check the technician list.`); return; }
    }
    onSave(form);
  };
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title">{mode==="edit"?"Edit Technician":"Add Technician"}</div>
        {err && <div className="err-box">{err}</div>}
        <div className="field">
          <label className="field-label">Full Name</label>
          <input className="field-input" value={form.name} onChange={e=>{upd("name",e.target.value);setErr("");}} placeholder="e.g. John Smith"/>
        </div>
        <div className="field">
          <label className="field-label">PestPac Username</label>
          <input className="field-input" value={form.pestpacUsername} onChange={e=>upd("pestpacUsername",e.target.value.toUpperCase())} placeholder="e.g. jsmith" style={{fontFamily:"'DM Mono',monospace",fontSize:13}}/>
          {dupPestpac&&<div className="field-warn">⚠ {dupPestpac.name} already uses this username</div>}
        </div>
        <div className="field">
          <label className="field-label">Phone Number</label>
          <input className="field-input" value={form.phone} onChange={e=>{upd("phone",formatPhone(e.target.value));setErr("");}} placeholder="(555) 000-0000"/>
          {dupPhone&&<div className="field-warn">⚠ {dupPhone.name} already uses this number</div>}
        </div>
        <div style={{display:"flex",gap:12}}>
          <div className="field" style={{flex:1}}>
            <label className="field-label">Status</label>
            <select className="field-input" value={form.status} onChange={e=>upd("status",e.target.value)}>
              <option value="none">None</option>
              <option value="best-fit">Best Fit</option>
              <option value="manual-schedule">Manual Schedule</option>
              <option value="in-training">In Training</option>
              <option value="pto">PTO</option>
              <option value="do-not-schedule">Do Not Schedule</option>
            </select>
          </div>
          <div className="field" style={{flex:1}}>
            <label className="field-label">Branch</label>
            <select className="field-input" value={form.branch} onChange={e=>upd("branch",e.target.value)}>
              <option value="">— Select —</option>
              {BRANCHES.map(b=><option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="field-label">Service Types — select all that apply</label>
          <div className="type-toggle-row">
            {TECH_TYPES.map(type=>(
              <button key={type} className="type-toggle"
                style={form.types.includes(type)?{borderColor:"#2563eb",background:"#eff6ff",color:"#1e40af"}:{}}
                onClick={e=>{toggleType(type);setErr("");e.currentTarget.blur();}}>
                {form.types.includes(type) && <span style={{fontSize:9,fontFamily:"'DM Mono',monospace",
                  fontWeight:700,color:"#1e40af",marginRight:4}}>✓</span>}{type}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="field-label">Service ZIP Codes</label>
          <div className="zip-entry-row">
            <input className="field-input" value={zipEntry} onChange={e=>setZipEntry(e.target.value.replace(/\D/g,"").slice(0,5))}
              onKeyDown={e=>e.key==="Enter"&&addZip()} placeholder="Type ZIP + Enter" maxLength={5}/>
            <button className="btn-add-zip" onClick={addZip}>Add</button>
          </div>

          {/* Paste from Excel toggle */}
          <button className="paste-toggle" onClick={()=>{setShowBulkPaste(s=>!s);setBulkMsg(null);}}>
            <span>{showBulkPaste?"▲":"▼"}</span>
            {showBulkPaste ? "Hide paste area" : "Paste a list from Excel"}
          </button>

          {showBulkPaste && (
            <div className="bulk-wrap">
              <textarea className="bulk-textarea"
                value={bulkText}
                onChange={e=>setBulkText(e.target.value)}
                placeholder={"Paste your Excel column here — one ZIP per line:\n32204\n32205\n32206\n..."}
              />
              <div className="bulk-footer">
                {bulkMsg && (
                  <span className="bulk-msg" style={{color:bulkMsg.ok?"#22c55e":"#64748b"}}>
                    {bulkMsg.text}
                  </span>
                )}
                <div style={{flex:1}}/>
                <button className="btn-add-zip" onClick={handleBulkAdd} disabled={!bulkText.trim()}>
                  Add All
                </button>
              </div>
            </div>
          )}

          <div className="zip-tags-edit">
            {form.zipCodes.length===0
              ? <span style={{fontSize:12,color:"#3d5068",fontFamily:"'DM Mono',monospace"}}>No ZIPs assigned yet</span>
              : [...form.zipCodes].sort().map(z=>(
                  <span key={z} className="zip-tag-edit">
                    {z}<button className="zip-rm" onClick={()=>upd("zipCodes",form.zipCodes.filter(x=>x!==z))}>×</button>
                  </span>
                ))
            }
          </div>
        </div>
        <div className="field">
          <label className="field-label">Notes / Specialties</label>
          <textarea className="field-textarea" value={form.notes} onChange={e=>upd("notes",e.target.value)} placeholder="e.g. Commercial accounts, high-rise..."/>
        </div>

        <label style={{display:"flex",alignItems:"flex-start",gap:11,padding:"12px 14px",
          background:form.warn?"rgba(239,68,68,.1)":"rgba(239,68,68,.05)",
          border:`1.5px solid ${form.warn?"rgba(239,68,68,.45)":"rgba(239,68,68,.2)"}`,
          borderRadius:8,cursor:"pointer",userSelect:"none",transition:"background .2s,border-color .2s",marginBottom:4}}>
          <input type="checkbox" checked={form.warn||false} onChange={e=>upd("warn",e.target.checked)}
            style={{width:17,height:17,marginTop:2,accentColor:"#ef4444",cursor:"pointer",flexShrink:0}}/>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800,
              letterSpacing:".05em",color:"#ef4444",textTransform:"uppercase",marginBottom:3}}>
              ⚠ Show read-notes warning on card
            </div>
            <div style={{fontSize:12,color:"#475569",lineHeight:1.5}}>
              Dispatchers will see a red warning banner on this tech's lookup card telling them to read the notes before scheduling.
            </div>
          </div>
        </label>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={submit}>{mode==="edit"?"Save Changes":"Add Technician"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── GUIDE PAGE ───────────────────────────────────────────────────────────────
// ─── CS CHEAT SHEET ──────────────────────────────────────────────────────────
const CHEAT_DATA = [
  { id:"policies", label:"Key Policies", emoji:"📌", points:[
      ["✓","Turner does NOT charge for estimates or service calls."],
      ["✓","Serious pest / termite / lawn issues may add a one-time clean-out fee to the initial startup charge, priced by extent of infestation."],
      ["✗","NO wildlife coverage on standard services (squirrels, possums, etc.)."],
      ["✓","Free re-treatments between regular services on guaranteed plans — satisfaction 100% guaranteed."],
    ], codes:[] },

  { id:"ghp", label:"GHP / TurnerShield", emoji:"🏠", points:[
      ["✓","De-web exterior, perimeter treatment; interior on request / service calls as needed."],
      ["✓","Covers roaches, ants, millipedes, centipedes, earwigs, spiders, scorpions, fleas, ticks, rodents, occasional invaders + snake repellant."],
      ["✗","NO termite or bed bug coverage."],
      ["✓","Tri-annual (every 4 months) is the standard — all new sales/setups should be tri-annual."],
    ], codes:[
      ["PCE3","TurnerShield Pest Prevention — Eco3","3x/yr",true,"Basic pest control, interior on request. Most common GHP — all new sales & setups."],
      ["PCQ","TurnerShield — Quarterly","4x/yr",true,"Basic pest control, interior on request. Typically from acquired companies."],
      ["PCEOM","TurnerShield — Every Other Month","6x/yr",true,"Basic pest control, interior on request. Typically from acquired companies."],
      ["PCM","TurnerShield — Monthly","12x/yr",true,"Basic pest control, interior on request. Typically from acquired companies."],
      ["PCA","TurnerShield — Annual","1x/yr",true,"Exterior + interior if needed. Typically townhomes or condos."],
      ["PC-RODENT","Pest Control Rodent Prevention","varies",true,"Residential rodent service — usually a few rodent boxes on property. Frequency varies by sale. More common in South FL."],
      ["PC2","TurnerShield — Twice a Year","2x/yr",false,"Exterior + interior if needed. Typically townhomes or condos."],
      ["PCB","TurnerShield — Every Other Week","26x/yr",false,"Basic pest control, interior on request. Typically from acquired companies."],
      ["PCW","TurnerShield — Weekly","52x/yr",false,"Basic pest control, interior on request. Typically from acquired companies."],
      ["PCQT","TurnerTubes — Quarterly","4x/yr",false,"Pest control for homes with in-wall tubes. Interior on request."],
      ["PCFA","TurnerShield — Fire Ant Service","varies",false,"Fire ant service by GHP tech. Typically one-time; recurring on request."],
      ["PC-FLEA","Pest Control Flea Prevention","varies",false,"Flea prevention by GHP tech. Typically one-time; recurring on request."],
      ["PC-SENTINEL","Pest Control — Sentinel","12x/yr",false,"(FAHEY) Bundled pest control with sentinel stations."],
      ["RPLATPL TMS","Res. Platinum Plus w/ Termite & ATBS","6x/yr",false,"(Catseye) Bundled pest control + termite warranty + monitoring stations."],
      ["RPLATPL TERMITE","Res. Platinum Plus w/ Termite","varies",false,"(Catseye) Bundled pest control + termite warranty + monitoring stations."],
    ] },

  { id:"tg", label:"TurnerGuard", emoji:"🛡️", points:[
      ["✓","All-inclusive: pest control + termite warranty in one bundle. NO excluded pests — even fleas and carpenter ants."],
      ["✓","Platinum = REPAIR & retreat termite warranty. Retreat = RETREAT-only warranty."],
      ["✓","Liquid termite treatment at install + ATBS monitoring stations checked each service. Annual termite inspection included (TGP3AA)."],
      ["✓","Bed bug CHEMICAL treatments included after the first year."],
      ["✗","Bed bug HEAT treatments are always a separate service."],
      ["✓","Free re-treatment when termiticide is due to be refreshed."],
    ], codes:[
      ["TGPP3","TurnerGuard Platinum E3 — Tri-Annual","3x/yr",true,"No excluded pests. Termite REPAIR warranty + service calls between visits."],
      ["TGR3","TurnerGuard Retreat E3 — Tri-Annual","3x/yr",true,"No excluded pests. Termite RETREAT warranty + service calls between visits."],
      ["TGTHP3","TurnerGuard THP E3 — Tri-Annual","3x/yr",true,"OLD code. No excluded pests; retreat warranty + service calls."],
      ["TGTHPR3","TurnerGuard Retreat THP E3","3x/yr",false,"OLD code. No excluded pests; retreat warranty + service calls."],
      ["TGP3AA","TurnerGuard Platinum E3 — Annual","1x/yr",false,"The annual termite inspection code."],
      ["TG3-INITIAL","TurnerGuard E3 Startup Fee","—",true,"Startup fee code for all new TGs."],
      ["TG-INITIAL","TurnerGuard Startup Fee","—",true,"Legacy startup fee code for new TGs."],
      ["TGR3I","TG Retreat E3 — Initial Tri-Annual","—",true,"Initial code for the pest-control portion of the TG install."],
      ["TGPPQ","TurnerGuard Platinum — Quarterly","4x/yr",false,"No longer offered. Repair warranty + service calls."],
      ["TG3-MISC","TurnerGuard E3 — Miscellaneous","—",false,"Other TG-related charges (e.g. rake back rock for termite treatment)."],
      ["TG3DOWN","TurnerGuard E3 Downgrade","—",false,"Downgrading from TurnerGuard to an ATR."],
      ["TGZTRANS","TurnerGuard Transfer Fee","—",false,"Transfer of a TG warranty between homeowners."],
      ["ESTIMATE-TG","Estimate for TurnerGuard","—",false,"TurnerGuard estimate code."],
      ["TGRQ","TurnerGuard Retreat — Quarterly","4x/yr",false,"Retreat warranty + pest control (quarterly legacy)."],
    ] },

  { id:"lawn", label:"Lawn / TurnerGreen", emoji:"🌱", points:[
      ["✓","Every-other-month service: fertilization, weed control, fungicide, insecticide. Requires a verified working in-ground irrigation system — products must be watered in evenly."],
      ["✓","No irrigation? Insecticide-only service is available (LANDOTGIO)."],
      ["✓","Grasses: St. Augustine, Bermuda, Bahia, Zoysia, Centipede. Zoysia is treated MONTHLY."],
      ["✓","Covered insects (turf-damaging, treated year-round): chinch bugs, sod webworms, army worms, spittle bugs, spider mites, grubs, mole crickets. Chinch = hot/dry months; webworms = cooler months."],
      ["✗","Uncontrollable weeds NOT covered: crab grass, torpedo grass, Bermuda grass invasion."],
      ["✗","Regular outside pests (roaches/ants) in the lawn aren't covered — courtesy treatment only."],
      ["✓","Fungus (large/brown patch): advise customer to pause watering & mowing affected areas. Treated as needed — no preventative."],
      ["✗","Mushrooms: NOT treated. Advise: pluck with a plastic bag and dispose outside — don't kick it, that spreads spores."],
      ["✗","NO palm or tree treatments under standard lawn (separate codes exist). One-time services carry a 30-day warranty only."],
    ], codes:[
      ["LANDOTG","TurnerGreen Lawn Service","6x/yr",true,"Residential lawn — fertilization, weed control, fungicide, insecticide. St. Augustine (typical). Pests: grubs, chinch bugs, sod webworms, army worms, mole crickets."],
      ["LANDOTGBH","Bahia TurnerGreen Lawn","6x/yr",true,"Same coverage for Bahia grass."],
      ["LANDOTGZY","Zoysia TurnerGreen Lawn","12x/yr",true,"Same coverage for Zoysia — monthly schedule."],
      ["LANDOCOM","Commercial Lawn Service","6x/yr",true,"Commercial lawn — fertilization, weed control, fungicide, insecticide."],
      ["LANDOSHRUB","TurnerGreen Shrub w/ Flea & Tick","6x/yr",true,"Residential shrubs — fertilization, fungus control, insecticide on non-fruit ornamentals. NO weed control in flower beds."],
      ["LANDOCOMS","Commercial Shrub Service","6x/yr",false,"Commercial shrubs — fertilization, fungus, insecticide on fruit ornamentals. NO weed control in beds."],
      ["LANDOFA","Guaranteed Fire Ant Control","varies",true,"Fire ant treatment — bait or spray depending on frequency; may recur."],
      ["LANDOTGIO","Lawn Service — Insect Only","6x/yr",false,"Insecticide-only. NOT responsible for look, color, or health of lawn."],
      ["LANDOTGFLEA","Lawn Plus Flea Service","one-time",false,"Insecticide for fleas & ticks only (flea/tick is included in shrub coverage)."],
      ["LANDOTGMOLE","Turner Mole Treatment","one-time",false,"Mole baiting around burrows; may include follow-ups. 30-day warranty."],
      ["LANDOTGCCA","Lawn — Caribbean Crazy Ants","varies",false,"Caribbean crazy ant insecticide; may recur."],
      ["LANDO1","Lawn — One Time Service","one-time",false,"Non-recurring lawn service — add-on or one-time green-up."],
      ["LANDOTREEDR","Tree Drench","2x/yr",false,"Root-system drench: fertilizer, insecticide, fungicide."],
      ["LANDOTREEINJ","Tree Injection","3x/yr",false,"Nutrient/insecticide/fungicide injection around tree or palm."],
    ] },

  { id:"smart", label:"SMART", emoji:"📡", points:[
      ["✓","SMART = 24/7 connected rodent monitoring bundled with pest control or TurnerGuard."],
    ], codes:[
      ["PC3SMART","TurnerShield SMART — Tri-Annual","3x/yr",true,"GHP + SMART rodent monitoring."],
      ["PCSMART","TurnerShield SMART — PC & SMART","3x/yr",true,"GHP + SMART rodent monitoring."],
      ["PCSMARTI","PC & SMART — Initial","1x",true,"Tech installs SMART equipment during first GHP service."],
      ["PCSMART-INITIAL","PC & SMART — Startup Fee","1x",true,"Startup fee for PCSMART services."],
      ["PC3SMARTIC","SMART Installation Complete","1x",false,"Marks SMART installation complete."],
      ["TG3SMART","TurnerGuard SMART — Tri-Annual","3x/yr",true,"Full TG (repair warranty, no excluded pests) + SMART."],
      ["TG3SMARTI","TurnerGuard SMART — Installation","1x",true,"Initial pest-control code for TG install w/ SMART."],
      ["TG3SMARTIC","TG SMART Installation Complete","1x",false,"Marks TG SMART installation complete."],
      ["TGP3SMART","TG Platinum E3 — SMART Package","3x/yr",true,"First line of the TGP3SMART package setup."],
      ["TGR3SMART","TG Retreat E3 — SMART Package","3x/yr",true,"First line of the TGR3SMART package setup."],
    ] },

  { id:"tc", label:"Service Calls (Customer)", emoji:"📞", points:[
      ["✓","Customer-initiated visits between regular services — always free on guaranteed plans."],
    ], codes:[
      ["PCE3TC","TurnerShield Eco3 — Trouble Call","—",true,"PCE3-specific customer service call."],
      ["PCTC","TurnerShield — Service Call","—",true,"Non-specific (also flea or rodent service calls)."],
      ["PCTCT","TurnerTubes — Service Call","—",false,"Tubes-home customer service call."],
      ["LANDOSC","TurnerGreen Lawn — Service Call","—",true,"Lawn-specific customer service call."],
      ["TG3TC","TurnerGuard E3 Trouble Call","—",true,"TG-only customer service call."],
      ["TGTC","TurnerGuard Trouble Call","—",true,"TG-only customer service call."],
      ["PC3TCSMART","TurnerShield SMART — Trouble Call","—",true,"Used with PCSMART services."],
      ["TGTCSMART","TurnerGuard SMART — Trouble Call","—",true,"Used with TGSMART services."],
    ] },

  { id:"fu", label:"Follow-Ups (Tech/Sales)", emoji:"🔁", points:[
      ["✓","Tech- or sales-initiated additional visits — NOT customer-requested."],
    ], codes:[
      ["PC3-FOLLOW UP","Pest Control E3 Follow Up","—",true,"PCE3-specific tech/sales follow-up."],
      ["PC-FOLLOW UP","Pest Control Follow Up","—",true,"Non-specific (flea or rodent follow-ups too)."],
      ["LANDOSCFU","Lawn Service Call Follow-Up","—",false,"Lawn-specific tech/sales follow-up."],
    ] },

  { id:"termite", label:"Termite Warranties", emoji:"🪵", points:[
      ["✓","Subterranean termite coverage — contract length is in the Setup."],
      ["✓","REPAIR codes cover damage repair + retreat; RETREAT codes cover re-treatment only."],
      ["✗","NO coverage if the annual renewal isn't paid."],
    ], codes:[
      ["WR-REPAIR","Subterranean Termite — Repair","annual",true,"Repair + retreat warranty."],
      ["WR-RETREAT","Subterranean Termite — Retreat","annual",true,"Retreat-only warranty."],
      ["WC-REPAIR","Subterranean Termite — Repair (WC)","annual",false,"Repair + retreat warranty."],
      ["WC-RETREAT","Subterranean Termite — Retreat (WC)","annual",false,"Retreat-only warranty."],
    ] },

  { id:"comm", label:"Commercial", emoji:"🏢", points:[
      ["✓","Coverage varies by account — tends to be à la carte based on the customer's needs and budget."],
      ["✓","ALWAYS check the Setup or Agreement in Documents to confirm what's covered."],
    ], codes:[
      ["CPCM","Commercial Pest Control — Monthly","12x/yr",true,"Coverage per account Setup/Agreement."],
      ["CPCB","Commercial PC — Every Other Week","26x/yr",false,"Coverage per account Setup/Agreement."],
      ["CPCW","Commercial PC — Weekly","52x/yr",false,"Coverage per account Setup/Agreement."],
      ["CPCEOM","Commercial PC — Every Other Month","6x/yr",true,"Coverage per account Setup/Agreement."],
      ["CPCQ","Commercial PC — Quarterly","4x/yr",true,"Coverage per account Setup/Agreement."],
    ] },

  { id:"mosq", label:"Mosquito", emoji:"🦟", points:[
      ["✗","Not effective on no-see-ums."],
      ["✓","Customers can customize which months they want treated."],
    ], codes:[
      ["MOSULV","Mosquito Control","custom",true,"Customer picks treatment months."],
    ] },

  { id:"impact", label:"Impact (Acquired)", emoji:"⭐", points:[
      ["✓","Legacy services from the Impact acquisition."],
    ], codes:[
      ["PC-SPI","Pest Control Spider Control","2x/yr",true,"Every 6 months, callbacks included. Chemical swept onto all beams in pool cage, lanai, front entry, garage doors, coach lights."],
      ["PC-EXCLUSION","Rodent Exclusion","one-time",true,"One-time fee, LIFETIME guarantee if they have PC or Sentricon with Impact. Seals roof openings — converging roof lines, J-vents, stack pipes — to keep rodents out of the attic."],
    ] },
];

function CheatCode({ code }) {
  const [copied, setCopied] = useState(false);
  return (
    <button className={`cheat-code${copied?" copied":""}`} title="Tap to copy"
      onClick={()=>{ navigator.clipboard?.writeText(code); setCopied(true); setTimeout(()=>setCopied(false),1200); }}>
      {copied ? "✓ copied" : code}
    </button>
  );
}

function CheatSheetPage() {
  const [q,   setQ]   = useState("");
  const [cat, setCat] = useState("all");
  const query = q.trim().toLowerCase();

  const visible = CHEAT_DATA.map(sec => {
    if (!query) return (cat==="all"||cat===sec.id) ? sec : null;
    const codes = sec.codes.filter(([c,n,f,_,d]) =>
      (c+" "+n+" "+d).toLowerCase().includes(query));
    const pointHit = sec.points.some(([_,p])=>p.toLowerCase().includes(query)) ||
                     sec.label.toLowerCase().includes(query);
    if (!codes.length && !pointHit) return null;
    return { ...sec, codes: codes.length?codes:sec.codes, _pointsDim: !pointHit && codes.length>0 };
  }).filter(Boolean);

  return (
    <div style={{maxWidth:680,margin:"0 auto",padding:"28px 20px 60px"}}>
      <div style={{textAlign:"center",marginBottom:14}}>
        <div className="hero-eyebrow">// CS Reference</div>
        <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(34px,6.5vw,48px)",fontWeight:900,lineHeight:.95,letterSpacing:"-.02em"}}>Service Cheat Sheet</h1>
        <p style={{color:"#64748b",fontSize:13,marginTop:8}}>Codes, coverage & talking points — tap any code to copy it.</p>
      </div>

      <div className="cheat-search">
        <div className="pp-row" style={{marginBottom:8}}>
          <span className="pp-label">SEARCH</span>
          <input className="pp-input" placeholder="code, pest, or service… (e.g. PCE3, chinch, mushroom)"
            value={q} onChange={e=>setQ(e.target.value)}/>
          {q && <button onClick={()=>setQ("")}
            style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",
              fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:".1em",textTransform:"uppercase",padding:0}}>Clear</button>}
        </div>
        <div className="cheat-chips" onWheel={e=>{ if(Math.abs(e.deltaY)>Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY; }}>
          <button className={`sort-btn${cat==="all"?" sort-btn-active":""}`} onClick={()=>setCat("all")}>All</button>
          {CHEAT_DATA.map(s=>(
            <button key={s.id} className={`sort-btn${cat===s.id?" sort-btn-active":""}`}
              onClick={()=>{setCat(s.id);setQ("");}}>{s.emoji} {s.label}</button>
          ))}
        </div>
      </div>

      {query && visible.length>0 && (
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".1em",textTransform:"uppercase",
          color:"#94a3b8",margin:"2px 0 12px",textAlign:"center"}}>
          {visible.reduce((n,s)=>n+s.codes.length,0)} codes · {visible.length} categor{visible.length===1?"y":"ies"}
        </div>
      )}
      {visible.length===0 && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-title">Nothing Found</div>
          <div className="empty-text">No codes or coverage notes match "<strong style={{color:"#2563eb"}}>{q}</strong>".</div>
        </div>
      )}

      {visible.map(sec=>(
        <div key={sec.id} className="guide-card">
          <div className="guide-card-title">{sec.emoji} {sec.label}</div>
          {!sec._pointsDim && sec.points.map(([mark,text],i)=>(
            <div key={i} className="cheat-inc">
              <span style={{color:mark==="✓"?"#15803d":"#dc2626"}}>{mark}</span>
              <span>{text}</span>
            </div>
          ))}
          {sec.codes.length>0 && (
            <div style={{marginTop:sec.points.length&&!sec._pointsDim?10:0}}>
              {sec.codes.map(([code,name,freq,common,desc])=>(
                <div key={code+name} className="cheat-row">
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <CheatCode code={code}/>
                    {common && <span style={{width:7,height:7,borderRadius:"50%",background:"#15803d",flexShrink:0}} title="Common"/>}
                    <span className="cheat-name">{name}</span>
                    <span className="cheat-freq" style={{marginLeft:"auto"}}>{freq}</span>
                  </div>
                  <div className="cheat-desc">{desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div style={{textAlign:"center",fontFamily:"'DM Mono',monospace",fontSize:10,color:"#cbd5e1",letterSpacing:".08em",marginTop:8}}>
        ● = common code · Sources: Service Code Outline v1 + Turner Service Coverage
      </div>
    </div>
  );
}

function GuidePage() {
  return (
    <div style={{maxWidth:640,margin:"0 auto",padding:"40px 20px 60px"}}>
      <div style={{marginBottom:28,textAlign:"center"}}>
        <div className="hero-eyebrow">// Reference</div>
        <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(36px,7vw,54px)",fontWeight:900,lineHeight:.95,marginBottom:10,letterSpacing:"-.02em"}}>How To Use</h1>
        <p style={{color:"#64748b",fontSize:14,lineHeight:1.6}}>A complete reference for Tech Dispatch</p>
      </div>

      {/* ── Search Methods ── */}
      <div className="guide-card">
        <div className="guide-card-title">📍 Three Ways to Find a Technician</div>
        <div className="guide-step"><div className="guide-step-num">1</div><div className="guide-step-body"><strong>ZIP Code</strong> — Enter the 5-digit service location ZIP. Techs confirmed for that ZIP appear first. Other techs from the serving branch are tucked behind a "NOT confirmed for this ZIP" button — reference only; verify coverage with the branch before scheduling them.</div></div>
        <div className="guide-step"><div className="guide-step-num">2</div><div className="guide-step-body"><strong>Branch</strong> — Select a branch from the dropdown to see all technicians assigned to that location.</div></div>
        <div className="guide-step"><div className="guide-step-num">3</div><div className="guide-step-body"><strong>Name / PestPac Username</strong> — Type in the FIND field to search across all technicians by name or PestPac username instantly.</div></div>
        <div style={{marginTop:12,padding:"10px 14px",background:"#eff6ff",borderRadius:6,border:"1px solid rgba(245,158,11,.15)",fontSize:13,color:"#475569",lineHeight:1.6}}>
          <strong style={{color:"#2563eb"}}>Supervisor guard:</strong> Supervisors only appear when the <strong>Supervisor</strong> type is explicitly selected. Supervisors are tagged with their specialty, so combine <strong>Supervisor + GHP</strong> (or Lawn, Termite, etc.) to find the right one — Branch Managers appear under Supervisor alone. Trouble Call and Production never filter supervisors — they match by service type only.
        </div>
        <div style={{marginTop:8,padding:"10px 14px",background:"#f8fafc",borderRadius:6,border:"1px solid #e2e8f0",fontSize:13,color:"#94a3b8",lineHeight:1.6}}>
          <strong style={{color:"#475569"}}>No coverage?</strong> When a search returns nothing, the right supervisors for that branch appear automatically as tap-to-call contacts, labeled by department.
        </div>
      </div>

      {/* ── Call Type ── */}
      <div className="guide-card">
        <div className="guide-card-title">📟 Trouble Call vs Production</div>
        <div style={{fontSize:13,color:"#475569",lineHeight:1.8}}>
          The first two buttons pick the <strong>call type</strong>: <strong style={{color:"#2563eb"}}>Trouble Call</strong> shows new-start, floater, and callback techs; <strong style={{color:"#2563eb"}}>Production</strong> shows everyone else (standard route techs). They're opposites, so selecting one clears the other. Combine with a service — e.g. Trouble Call + Res GHP — for precise results.
        </div>
      </div>

      {/* ── Codes Page ── */}
      <div className="guide-card">
        <div className="guide-card-title">🧾 Service Code Cheat Sheet</div>
        <div style={{fontSize:13,color:"#475569",lineHeight:1.8}}>
          The <strong>Cheat Sheet</strong> page in the navigation is a full CS reference: ~75 service codes organized by category (GHP, TurnerGuard, Lawn, SMART, service calls, and more) with coverage talking points — what's included ✓ and what's not ✗. Search by code, pest, or service, and tap any code to copy it straight into PestPac.
        </div>
      </div>

      {/* ── Saved Shortcuts ── */}
      <div className="guide-card">
        <div className="guide-card-title">⚡ Saved Filter Shortcuts</div>
        <div style={{fontSize:13,color:"#475569",lineHeight:1.8}}>
          Once you have a ZIP or branch selected with service types chosen, a <strong style={{color:"#2563eb"}}>☆ Save</strong> button appears above the service type grid. Tap it to save that combination as a one-tap shortcut pill. Up to 5 shortcuts can be saved — they persist between sessions and can be deleted with the × on each pill.
        </div>
      </div>

      {/* ── Service Types ── */}
      <div className="guide-card">
        <div className="guide-card-title">🏷️ Service Types</div>
        {[
          ["GHP",            "General Household Pest — standard residential service"],
          ["Lawn",           "Lawn & outdoor treatment"],
          ["Termite",        "Termite inspection and control"],
          ["Mosquito",       "Mosquito reduction and barrier treatment"],
          ["Commercial",     "Commercial accounts and properties"],
          ["Bed Bugs",       "Bed bug treatment and heat services"],
          ["Exclusion",      "Wildlife and pest exclusion work"],
          ["Wildlife",       "Wildlife removal and relocation"],
          ["TAP",            "TAP insulation installation"],
          ["Sentricon",      "Sentricon termite baiting system"],
          ["SMART",          "SMART monitoring and connected services"],
          ["Pre Treat",      "Pre-construction termite pre-treatment"],
          ["Post Treat",     "Post-construction termite treatment"],
          ["Field Inspector","Property inspection services"],
          ["Trouble Call",   "New starts, floaters & callback specialists"],
          ["Production",     "Lookup-only filter — every tech WITHOUT the Trouble Call tag (standard route techs). Does not apply to supervisors"],
          ["Supervisor",     "Lead technicians and area supervisors"],
        ].map(([type, desc]) => (
          <div key={type} className="guide-row">
            <TypeBadge type={type} highlight/>
            <span className="guide-row-desc">{desc}</span>
          </div>
        ))}
      </div>

      {/* ── Status Meanings ── */}
      <div className="guide-card">
        <div className="guide-card-title">🔖 Technician Status</div>
        <div className="guide-row"><StatusBadge status="best-fit"/><span className="guide-row-desc">Confirmed best match for this call — prioritize first</span></div>
        <div className="guide-row"><StatusBadge status="manual-schedule"/><span className="guide-row-desc">Requires manual scheduling coordination before booking</span></div>
        <div className="guide-row"><StatusBadge status="in-training"/><span className="guide-row-desc">Currently in training — verify availability before scheduling</span></div>
        <div className="guide-row"><StatusBadge status="pto"/><span className="guide-row-desc">On PTO — not available</span></div>
        <div className="guide-row"><StatusBadge status="do-not-schedule"/><span className="guide-row-desc">Do not assign — check notes or contact a supervisor</span></div>
        <div style={{marginTop:8,fontSize:12,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:".04em"}}>No badge = status not set · Results sort by status with Best Fit first</div>
      </div>

      {/* ── Reading a Card ── */}
      <div className="guide-card">
        <div className="guide-card-title">📋 Reading a Result Card</div>
        <div style={{fontSize:13,color:"#475569",lineHeight:2}}>
          <div><span style={{color:"#2563eb",fontFamily:"'DM Mono',monospace",fontSize:11,marginRight:8}}>PHONE</span>Tap to call directly · Copy button copies number to clipboard</div>
          <div><span style={{color:"#2563eb",fontFamily:"'DM Mono',monospace",fontSize:11,marginRight:8}}>PESTPAC</span>Copy button copies the username — paste directly into PestPac</div>
          <div><span style={{color:"#2563eb",fontFamily:"'DM Mono',monospace",fontSize:11,marginRight:8}}>TYPES</span>Matched service types are highlighted in their badge color</div>
          <div><span style={{color:"#2563eb",fontFamily:"'DM Mono',monospace",fontSize:11,marginRight:8}}>ZIP</span>Shows matched ZIP · "+N more" means additional coverage areas</div>
          <div><span style={{color:"#2563eb",fontFamily:"'DM Mono',monospace",fontSize:11,marginRight:8}}>⚠ WARN</span>Red banner indicates a note requiring attention before scheduling</div>
        </div>
      </div>

      {/* ── Pop-Out Window ── */}
      <div className="guide-card">
        <div className="guide-card-title">⧉ Desktop Pop-Out Window</div>
        <div style={{fontSize:13,color:"#475569",lineHeight:1.8}}>
          On any desktop browser, tap the <strong style={{color:"#2563eb"}}>⧉</strong> button in the top-right navigation to open a compact floating window. Keep the lookup visible on screen while working in other tabs or systems — no need to switch back and forth.
        </div>
      </div>

      {/* ── Admin Panel ── */}
      <div className="guide-card">
        <div className="guide-card-title">🔐 Admin Panel</div>
        <div style={{fontSize:13,color:"#475569",lineHeight:1.9}}>
          Access via <strong>Manage Techs</strong> in the navigation. Requires a manager or master access code.
        </div>
        <div style={{fontSize:13,color:"#475569",lineHeight:1.9,marginTop:8}}>
          <div><span style={{color:"#2563eb",fontFamily:"'DM Mono',monospace",fontSize:11,marginRight:8}}>TECHNICIANS</span>Add, edit, or delete technicians · Quick status toggle in the table · Select multiple techs for bulk status updates · Filter by branch or search by name · Export and import roster as JSON</div>
          <div style={{marginTop:6}}><span style={{color:"#2563eb",fontFamily:"'DM Mono',monospace",fontSize:11,marginRight:8}}>REPORTS</span>Coverage Gap report shows which service types lack coverage per branch · Usage Analytics tracks search patterns over time</div>
          <div style={{marginTop:6}}><span style={{color:"#2563eb",fontFamily:"'DM Mono',monospace",fontSize:11,marginRight:8}}>BACKUPS</span>Every save auto-creates a backup · Restore any of the last 10 states in one tap</div>
          <div style={{marginTop:6}}><span style={{color:"#2563eb",fontFamily:"'DM Mono',monospace",fontSize:11,marginRight:8}}>ACCESS CODES</span>Master only · Manage named manager codes and change the master password</div>
        </div>
      </div>

      {/* ── Keyboard Shortcuts ── */}
      <div className="guide-card">
        <div className="guide-card-title">⌨️ Keyboard Shortcuts</div>
        {[
          { keys:"Ctrl + K", desc:"Jump to Lookup and focus the ZIP field from anywhere in the app" },
          { keys:"Esc",      desc:"Close any open modal or dialog" },
        ].map(({keys,desc}) => (
          <div key={keys} className="guide-row" style={{alignItems:"center"}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:700,
              background:"#111827",border:"1px solid #e2e8f0",borderRadius:5,
              padding:"3px 9px",color:"#2563eb",whiteSpace:"nowrap",flexShrink:0}}>
              {keys}
            </span>
            <span className="guide-row-desc">{desc}</span>
          </div>
        ))}
        <div style={{marginTop:10,fontSize:12,color:"#3d5068",fontFamily:"'DM Mono',monospace",letterSpacing:".03em"}}>
          Mac users: use ⌘ in place of Ctrl
        </div>
      </div>

      {/* ── Important Reminders ── */}
      <div className="guide-card" style={{borderColor:"rgba(37,99,235,.2)",background:"rgba(245,158,11,.04)"}}>
        <div className="guide-card-title">⚠️ Important Reminders</div>
        <div style={{fontSize:13,color:"#475569",lineHeight:1.8}}>
          All scheduling decisions remain subject to established drive times, technician duties, and standard operating procedures.
          When uncertain about the appropriate technician, consult a router or supervisor before proceeding.
        </div>
      </div>

      {/* ── Contact ── */}
      <div className="guide-card">
        <div className="guide-card-title">📞 Contact & Support</div>
        <div style={{fontSize:12,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:".04em",marginBottom:8}}>Questions or requests about this app:</div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:700,color:"#475569",marginBottom:6}}>Brett Wingert</div>
        <a href="tel:+12396899888" style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:13,color:"#64748b",textDecoration:"none",marginBottom:4,transition:"color .18s"}}>(239) 689-9888</a>
        <a href="mailto:bmwco89@gmail.com" style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:13,color:"#64748b",textDecoration:"none",transition:"color .18s"}}>bmwco89@gmail.com</a>
      </div>
    </div>
  );
}

// ─── CHANGELOG PAGE ───────────────────────────────────────────────────────────
function EntryModal({ mode, entry, onSave, onClose }) {
  const [form,   setForm]   = useState({ title:entry?.title||"", body:entry?.body||"" });
  const [err,    setErr]    = useState("");
  const [saving, setSaving] = useState(false);
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));
  const submit = async () => {
    if (!form.title.trim()) { setErr("Title is required."); return; }
    setSaving(true);
    await onSave({ ...entry, ...form });
    setSaving(false);
  };
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title">{mode==="add"?"New Log Entry":"Edit Entry"}</div>
        {err && <div className="err-box">{err}</div>}
        <div className="field">
          <label className="field-label">Title</label>
          <input className="field-input" value={form.title} onChange={e=>{upd("title",e.target.value);setErr("");}} placeholder="e.g. Added Melbourne branch technicians" autoFocus/>
        </div>
        <div className="field">
          <label className="field-label">Details</label>
          <textarea className="field-textarea" style={{minHeight:100}} value={form.body} onChange={e=>upd("body",e.target.value)} placeholder="Describe what changed..."/>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" disabled={saving} onClick={submit}>
            {saving?"Saving…":mode==="add"?"Post Entry":"Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangelogPage({ authLevel, authCode, authLabel }) {
  const [entries,    setEntries]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchErr,   setFetchErr]   = useState("");
  const [modal,      setModal]      = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const canEdit = authLevel==="master" || authLevel==="manager";

  useEffect(()=>{
    fetch("/api/changelog")
      .then(r=>r.json())
      .then(d=>{ setEntries(d.entries||[]); setLoading(false); })
      .catch(()=>{ setFetchErr("Could not load changelog."); setLoading(false); });
  },[]);

  const handleSave = async (entryData) => {
    const action = modal==="add" ? "add" : "update";
    const res = await fetch("/api/changelog",{
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action, code:authCode, entry:entryData })
    });
    const data = await res.json();
    if (data.entries) { setEntries(data.entries); setModal(null); }
  };

  const handleDelete = async (id) => {
    if (confirmDel===id) {
      const res = await fetch("/api/changelog",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"delete", code:authCode, id })
      });
      const data = await res.json();
      if (data.entries) setEntries(data.entries);
      setConfirmDel(null);
    } else {
      setConfirmDel(id);
      setTimeout(()=>setConfirmDel(p=>p===id?null:p), 3000);
    }
  };

  return (
    <div style={{maxWidth:720,margin:"0 auto",padding:"32px 20px 60px"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:28,flexWrap:"wrap",gap:12}}>
        <div>
          <div className="hero-eyebrow">// Release Notes</div>
          <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:900,lineHeight:1}}>Change Log</h2>
        </div>
        {canEdit && <button className="btn-add" onClick={()=>setModal("add")}>+ Add Entry</button>}
      </div>

      {loading && <div style={{textAlign:"center",padding:"48px 0",color:"#64748b",fontFamily:"'DM Mono',monospace",fontSize:12}}>Loading…</div>}
      {fetchErr && <div className="err-box">{fetchErr}</div>}

      {!loading && !fetchErr && entries.length===0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-title">No Entries Yet</div>
          <div className="empty-text">{canEdit?"Post the first entry to get started.":"No changelog entries have been posted yet."}</div>
        </div>
      )}

      {entries.map((entry,i)=>(
        <div key={entry.id} className="tech-card" style={{animationDelay:`${i*40}ms`,flexDirection:"column",gap:0}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#64748b",letterSpacing:".08em",marginBottom:4}}>{entry.date}</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:700,lineHeight:1.1}}>{entry.title}</div>
            </div>
            {canEdit && (
              <div style={{display:"flex",gap:7,flexShrink:0}}>
                <button className="btn-edit" onClick={()=>setModal({mode:"edit",entry})}>Edit</button>
                <button className={confirmDel===entry.id?"btn-del-confirm":"btn-del"} onClick={()=>handleDelete(entry.id)}>
                  {confirmDel===entry.id?"Confirm?":"Delete"}
                </button>
              </div>
            )}
          </div>
          {entry.body && <div style={{fontSize:13,color:"#475569",lineHeight:1.75,whiteSpace:"pre-wrap",marginTop:4}}>{entry.body}</div>}
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#3d5068",marginTop:12,letterSpacing:".04em"}}>
            {entry.author}
          </div>
        </div>
      ))}

      {modal && (
        <EntryModal
          mode={modal==="add"?"add":"edit"}
          entry={modal?.entry}
          onSave={handleSave}
          onClose={()=>setModal(null)}
        />
      )}
    </div>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-copy">
          Designed and built by Brett Wingert. All application designs and functionality are the
          property of Brett Wingert. Misuse of any of this application's features will result in
          application access being revoked.
        </div>
        <div className="footer-divider"/>
        <div className="footer-contact">
          <div className="footer-contact-label">Contact For Questions and Requests</div>
          <div className="footer-contact-name">Brett Wingert</div>
          <a href="tel:+12396899888"       className="footer-link">(239) 689-9888</a>
          <a href="mailto:bmwco89@gmail.com" className="footer-link">bmwco89@gmail.com</a>
        </div>
      </div>
    </footer>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [techs,      setTechs]      = useState([]);
  const [ready,      setReady]      = useState(false);
  const [loadErr,    setLoadErr]    = useState(false);
  const [view,       setView]       = useState("search");
  const [zipInput,   setZipInput]   = useState("");
  const [result,     setResult]     = useState(null);
  const [modal,      setModal]      = useState(null);
  const [confirmId,  setConfirmId]  = useState(null);
  const [authLevel,  setAuthLevel]  = useState(null);
  const [authLabel,  setAuthLabel]  = useState("");
  const [authCode,   setAuthCode]   = useState("");   // kept in memory for API writes
  const [showLogin,  setShowLogin]  = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "ok" | "err"
  const [isOffline,  setIsOffline]  = useState(typeof navigator!=="undefined"&&!navigator.onLine);
  // ── Agent session + supervisor help-desk ───────────────────────────────────
  const [agentSession,   setAgentSession]   = useState(()=>{
    try {
      const s = JSON.parse(localStorage.getItem('dispatch_agent')||'null');
      const last = parseInt(localStorage.getItem('dispatch_agent_last')||'0', 10);
      if (s && Date.now() - last > 600000) { localStorage.removeItem('dispatch_agent'); return null; }
      return s;
    } catch { return null; }
  });
  const [showAgentLogin, setShowAgentLogin] = useState(false);
  const [showHelpModal,  setShowHelpModal]  = useState(false);
  const [myRequest,      setMyRequest]      = useState(null);
  const [helpReqs,       setHelpReqs]       = useState({ open:[], recent:[], sups:[] });
  const [showHelpPanel,  setShowHelpPanel]  = useState(false);
  const [navOpen,        setNavOpen]        = useState(false);
  const [installPrompt,  setInstallPrompt]  = useState(null);
  const [showInstall,    setShowInstall]    = useState(false);
  const isStandalone = typeof window!=="undefined" &&
    (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
  const [alertReq, setAlertReq] = useState(null);
  const prevOpenRef = useRef([]);
  const titleRef    = useRef(null);
  const audioRef    = useRef(null);
  const prevAvailRef = useRef(false);

  // ── Load technicians from API on mount ─────────────────────────────────────
  const loadTechs = useCallback(async () => {
    setLoadErr(false);
    try {
      const data = await api.getTechs();
      setTechs(Array.isArray(data) ? data : []);
    } catch {
      setLoadErr(true);
    }
    setReady(true);
  }, []);

  useEffect(() => { loadTechs(); }, [loadTechs]);

  // ── PWA install prompt capture ─────────────────────────────────────────────
  useEffect(()=>{
    const onPrompt = e => {
      e.preventDefault();
      setInstallPrompt(e);
      try { if (!localStorage.getItem('dispatch_install_dismissed')) setShowInstall(true); } catch { setShowInstall(true); }
    };
    const onInstalled = () => { setInstallPrompt(null); setShowInstall(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return ()=>{ window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  const doInstall = async () => {
    if (!installPrompt) return;
    setShowInstall(false);
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch {}
    setInstallPrompt(null);
  };
  const dismissInstall = () => {
    setShowInstall(false);
    try { localStorage.setItem('dispatch_install_dismissed','1'); } catch {}
  };

  // ── Agent session: verify stored token on mount ────────────────────────────
  useEffect(()=>{
    if (!agentSession) return;
    fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'verify', username: agentSession.username, token: agentSession.token }) })
      .then(r=>r.json())
      .then(d=>{ if (!d.ok) { setAgentSession(null); try { localStorage.removeItem('dispatch_agent'); } catch {} } })
      .catch(()=>{});
    // eslint-disable-next-line
  }, []);

  // ── Agent: poll my open request (10s while one is open) ────────────────────
  const refreshMine = useCallback(async ()=>{
    if (!agentSession) return;
    try {
      const d = await fetch('/api/help', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'mine', username: agentSession.username, token: agentSession.token }) }).then(r=>r.json());
      setMyRequest(d.request || null);
    } catch {}
  }, [agentSession]);
  useEffect(()=>{ if (!agentSession) { setMyRequest(null); return; } refreshMine(); }, [agentSession, refreshMine]);
  useEffect(()=>{
    if (!agentSession || !myRequest) return;
    const id = setInterval(refreshMine, 6000);
    return ()=>clearInterval(id);
  }, [agentSession, myRequest, refreshMine]);

  // ── Supervisor: poll open requests (15s while signed in) ───────────────────
  const refreshHelp = useCallback(async ()=>{
    if (!authCode) return;
    try {
      const d = await fetch('/api/help', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'list', code: authCode }) }).then(r=>r.json());
      if (d.open) setHelpReqs({ open: d.open, recent: d.recent || [], sups: d.sups || [] });
    } catch {}
  }, [authCode]);
  const isAvailNow = (helpReqs.sups||[]).includes(authLabel);
  useEffect(()=>{
    if (!authCode) { setHelpReqs({ open:[], recent:[], sups:[] }); setShowHelpPanel(false); return; }
    refreshHelp();
    let id;
    const start = () => {
      clearInterval(id);
      const hidden = typeof document !== "undefined" && document.hidden;
      // Available + tab visible → near-instant (4s). Hidden → 10s. Away → 30s.
      const ms = isAvailNow ? (hidden ? 10000 : 4000) : 30000;
      id = setInterval(refreshHelp, ms);
    };
    start();
    const onVis = () => { if (!document.hidden) refreshHelp(); start(); };
    document.addEventListener("visibilitychange", onVis);
    return ()=>{ clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [authCode, refreshHelp, isAvailNow]);

  // ── Alert audio: one beep every 5s for 60s (12 plays), stoppable ───────────
  const stopAlertAudio = useCallback(()=>{
    if (audioRef.current) { clearInterval(audioRef.current); audioRef.current = null; }
  }, []);
  const startAlertAudio = useCallback(()=>{
    stopAlertAudio();
    beep();
    let plays = 1;
    audioRef.current = setInterval(()=>{
      beep();
      if (++plays >= 12) stopAlertAudio();
    }, 5000);
  }, [stopAlertAudio]);
  useEffect(()=>()=>stopAlertAudio(), [stopAlertAudio]);
  const dismissAlert = useCallback(()=>{ stopAlertAudio(); setAlertReq(null); }, [stopAlertAudio]);

  // ── New-request alert — only for supervisors marked AVAILABLE ──────────────
  useEffect(()=>{
    const ids = helpReqs.open.map(r=>r.id);
    const fresh = ids.filter(id=>!prevOpenRef.current.includes(id));
    const isAvail = (helpReqs.sups||[]).includes(authLabel);
    const becameAvail = isAvail && !prevAvailRef.current;
    const target = (fresh.length > 0)
      ? helpReqs.open.find(x=>x.id===fresh[0])
      : (becameAvail ? helpReqs.open.find(x=>!x.claimedBy) : null);
    prevAvailRef.current = isAvail;
    if (target && authCode && isAvail) {
      const r = target;
      setAlertReq(r || null);
      startAlertAudio();
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("🆘 Supervisor requested", {
            body: (r?.agentName || "An agent") + " needs help" + (r?.context?.branch ? " · " + r.context.branch : "") });
        }
      } catch {}
      let flashes = 0; const orig = "Tech Dispatch";
      clearInterval(titleRef.current);
      titleRef.current = setInterval(()=>{
        document.title = document.title === orig ? "🆘 HELP REQUESTED" : orig;
        if (++flashes > 9) { clearInterval(titleRef.current); document.title = orig; }
      }, 900);
    }
    prevOpenRef.current = ids;
  }, [helpReqs.open, helpReqs.sups, authLabel, authCode, startAlertAudio]);

  const toggleAvail = async () => {
    const next = !(helpReqs.sups||[]).includes(authLabel);
    setHelpReqs(prev=>({ ...prev, sups: next
      ? [...new Set([...(prev.sups||[]), authLabel])]
      : (prev.sups||[]).filter(l=>l!==authLabel) }));
    try { await fetch('/api/help', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'avail', code: authCode, available: next }) }); } catch {}
    refreshHelp();
  };

  // ── Agent inactivity auto-logout: 10 minutes ───────────────────────────────
  useEffect(()=>{
    if (!agentSession) return;
    const bump = ()=>{ try { localStorage.setItem('dispatch_agent_last', String(Date.now())); } catch {} };
    bump();
    const evs = ['pointerdown','keydown'];
    evs.forEach(e=>window.addEventListener(e, bump));
    const id = setInterval(()=>{
      const last = parseInt(localStorage.getItem('dispatch_agent_last')||'0', 10);
      if (Date.now() - last > 600000) {
        setAgentSession(null); setMyRequest(null);
        try { localStorage.removeItem('dispatch_agent'); } catch {}
      }
    }, 30000);
    return ()=>{ evs.forEach(e=>window.removeEventListener(e, bump)); clearInterval(id); };
  }, [agentSession]);

  const agentSignOut = () => {
    setAgentSession(null); setMyRequest(null);
    try { localStorage.removeItem('dispatch_agent'); } catch {}
  };
  const cancelMyRequest = async () => {
    if (!agentSession || !myRequest) return;
    try { await fetch('/api/help', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'cancel', id: myRequest.id, username: agentSession.username, token: agentSession.token }) }); } catch {}
    setMyRequest(null);
  };
  const claimReq = async id => {
    try { await fetch('/api/help', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'claim', id, code: authCode }) }); } catch {}
    refreshHelp();
  };
  const resolveReq = async id => {
    try { await fetch('/api/help', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'resolve', id, code: authCode }) }); } catch {}
    refreshHelp();
  };

  // ── Persist technicians to API (optimistic) ────────────────────────────────
  const persistTechs = useCallback(async (next, code, reason) => {
    setTechs(next);
    setSaveStatus("saving");
    try {
      const res = await api.saveTechs(next, code, reason || "Manual edit");
      setSaveStatus(res.ok ? "ok" : "err");
    } catch {
      setSaveStatus("err");
    }
    setTimeout(() => setSaveStatus(null), 2500);
  }, []);

  // ── Auth ───────────────────────────────────────────────────────────────────
  const handleAdminClick = () => { authLevel ? setView("admin") : setShowLogin(true); };

  const openPopout = () => {
    const w = 440, h = 740;
    const l = Math.max(0, (window.screen.availWidth || window.screen.width) - w - 20);
    window.open(window.location.origin, "TechDispatch",
      `width=${w},height=${h},left=${l},top=20,resizable=yes,scrollbars=yes`);
  };

  const handleLogin = async (action, code) => {
    const data = await api.auth({ action: action === "setup" ? "setup" : "login", code });
    if (data.needsSetup) return "needsSetup"; // shouldn't reach here (modal handles it)
    if (data.error === "wrong") return "wrong";
    if (data.error) return data.error;
    setAuthLevel(data.level);
    setAuthLabel(data.label);
    setAuthCode(code);
    setShowLogin(false);
    setView("admin");
    return null;
  };

  const handleSignOut = () => {
    setAuthLevel(null); setAuthLabel(""); setAuthCode(""); setView("search");
  };

  // When master changes their own code, keep authCode in sync
  // When master restores a backup, update the techs state immediately
  useEffect(()=>{
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
    const on_  = ()=>setIsOffline(false);
    const off_ = ()=>setIsOffline(true);
    window.addEventListener('online', on_); window.addEventListener('offline', off_);
    const kbd = (e)=>{
      if ((e.ctrlKey||e.metaKey) && e.key==='k') {
        e.preventDefault();
        setView('search');
        setTimeout(()=>document.querySelector('.zip-input')?.focus(), 60);
      }
    };
    document.addEventListener('keydown', kbd);
    return ()=>{ window.removeEventListener('online',on_); window.removeEventListener('offline',off_); document.removeEventListener('keydown',kbd); };
  },[]);

  const handleStatusChange = useCallback((id, newStatus) => {
    const t = techs.find(t=>t.id===id);
    if (!t || !authCode) return;
    persistTechs(techs.map(x=>x.id===id?{...x,status:newStatus}:x), authCode, `Status: ${t.name} → ${newStatus}`);
  },[techs, authCode, persistTechs]);

  const handleBulkStatus = useCallback((ids, newStatus) => {
    if (!authCode || !ids.length) return;
    const idSet = new Set(ids);
    const label = newStatus==="none" ? "None" : newStatus.replace(/-/g," ");
    persistTechs(
      techs.map(t=>idSet.has(t.id)?{...t,status:newStatus}:t),
      authCode,
      `Bulk status: ${ids.length} tech${ids.length>1?"s":""} → ${label}`
    );
  },[techs, authCode, persistTechs]);

  const handleRestoreComplete = useCallback((restoredTechs) => {
    setTechs(restoredTechs);
  }, []);

  const handleMasterCodeChanged = useCallback((newCode) => {
    setAuthCode(newCode);
  }, []);

  // ── Technician CRUD ────────────────────────────────────────────────────────
  const handleSaveTech = (data) => {
    const reason = modal?.mode==="edit" ? `Edited: ${data.name}` : `Added: ${data.name}`;
    const next = modal?.mode==="edit"
      ? techs.map(t=>t.id===data.id?data:t)
      : [...techs,{...data,id:uid()}];
    persistTechs(next, authCode, reason);
    setModal(null);
  };

  const handleDelete = (id) => {
    if (confirmId===id) {
      const tech = techs.find(t=>t.id===id);
      persistTechs(techs.filter(t=>t.id!==id), authCode, `Deleted: ${tech?.name||"tech"}`);
      setConfirmId(null);
    } else {
      setConfirmId(id);
      setTimeout(()=>setConfirmId(p=>p===id?null:p),3000);
    }
  };

  const handleImport = (newTechs) => {
    persistTechs(newTechs.map(t=>({...t,id:t.id||uid()})), authCode, `Imported ${newTechs.length} technicians`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!ready) return (
    <div style={{minHeight:"100vh",background:"#f8fafc",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:18}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@900&family=DM+Mono:wght@500&display=swap');
        @keyframes tdPulse{0%,100%{opacity:.35;transform:scale(.85);}50%{opacity:1;transform:scale(1);}}`}</style>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:34,letterSpacing:".06em",color:"#0f172a",lineHeight:1}}>
        TECH<span style={{color:"#2563eb"}}> DISPATCH</span>
      </div>
      <div style={{display:"flex",gap:7}}>
        {[0,1,2].map(i=>(
          <span key={i} style={{width:8,height:8,borderRadius:"50%",background:"#2563eb",
            animation:`tdPulse 1.1s ease-in-out ${i*0.18}s infinite`}}/>
        ))}
      </div>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:".14em",textTransform:"uppercase",color:"#94a3b8"}}>Loading roster</div>
    </div>
  );

  if (loadErr) return (
    <div style={{minHeight:"100vh",background:"#f8fafc",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{fontSize:36}}>⚠️</div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:700}}>Connection Failed</div>
      <div style={{fontSize:13,color:"#64748b",maxWidth:300,textAlign:"center",lineHeight:1.6}}>Couldn't reach the server. Check your internet connection and try again.</div>
      <button className="btn-add" onClick={loadTechs}>Retry</button>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <header className="top-bar">
          <button className="brand" onClick={()=>{setView("search");setResult(null);setZipInput("");}}
            title="Back to Lookup">
            <div className="brand-name">TECH<span>DISPATCH</span></div>
          </button>
          <nav className="top-nav" style={{alignItems:"center"}}>
            {authCode && (
              <button className="nav-pill" style={{flexShrink:0,
                  color:(helpReqs.sups||[]).includes(authLabel)?"#15803d":"#94a3b8",
                  borderColor:(helpReqs.sups||[]).includes(authLabel)?"rgba(21,128,61,.4)":"#e2e8f0",
                  background:(helpReqs.sups||[]).includes(authLabel)?"rgba(21,128,61,.07)":"transparent"}}
                title="Toggle availability — help-request alerts only ring supervisors marked Available"
                onClick={()=>{ toggleAvail(); try { if (typeof Notification!=="undefined" && Notification.permission==="default") Notification.requestPermission(); } catch {} }}>
                {(helpReqs.sups||[]).includes(authLabel) ? "● Available" : "○ Away"}
              </button>
            )}
            {authCode && (
              <div style={{position:"relative",flexShrink:0}}>
                <button className="nav-pill bell-btn" title="Help requests"
                  onClick={()=>{ setShowHelpPanel(v=>!v); dismissAlert(); try { if (typeof Notification!=="undefined" && Notification.permission==="default") Notification.requestPermission(); } catch {} }}>
                  🔔{helpReqs.open.length>0 && <span className="bell-badge">{helpReqs.open.length}</span>}
                </button>
                {showHelpPanel && (
                  <div className="help-panel">
                    <div style={{padding:"10px 14px",borderBottom:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15}}>Help Requests</span>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#94a3b8"}}>{helpReqs.open.length} open</span>
                    </div>
                    {helpReqs.open.length===0 && <div style={{padding:"18px 14px",fontSize:12,color:"#94a3b8",textAlign:"center"}}>No open requests 🎉</div>}
                    {helpReqs.open.map(r=>(
                      <div key={r.id} className="help-item">
                        <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:3}}>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:"#0f172a"}}>{r.agentName}</span>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#dc2626",flexShrink:0}}>{timeAgo(r.ts)}</span>
                        </div>
                        {(r.context?.zip || r.context?.branch || (r.context?.types||[]).length>0) && (
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#64748b",marginBottom:3,letterSpacing:".04em"}}>
                            {[r.context.branch || r.context.zip, (r.context.types||[]).slice(0,3).join(" + ")].filter(Boolean).join(" · ")}
                          </div>
                        )}
                        {r.note && <div style={{fontSize:12,color:"#475569",marginBottom:6,lineHeight:1.5}}>"{r.note}"</div>}
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          {r.claimedBy
                            ? <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#1e40af"}}>✋ Claimed by {r.claimedBy}</span>
                            : <button className="btn-edit" style={{fontSize:11,padding:"3px 10px"}} onClick={()=>claimReq(r.id)}>✋ Claim</button>}
                          <button className="btn-edit" style={{fontSize:11,padding:"3px 10px",marginLeft:"auto"}} onClick={()=>resolveReq(r.id)}>✓ Resolve</button>
                        </div>
                      </div>
                    ))}
                    {helpReqs.recent.length>0 && <div style={{padding:"7px 14px",background:"#f8fafc",fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:".1em",color:"#94a3b8",textTransform:"uppercase"}}>Recent</div>}
                    {helpReqs.recent.slice(0,4).map(r=>(
                      <div key={r.id} className="help-item" style={{opacity:.55}}>
                        <span style={{fontSize:12,color:"#475569"}}>{r.agentName}</span>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#94a3b8",marginLeft:8}}>{r.status==="cancelled"?"cancelled":"resolved"} · {timeAgo(r.resolvedAt||r.ts)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button className="nav-pill" style={{flexShrink:0,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}
              title={agentSession?("Signed in as "+agentSession.name+" — tap to sign out"):"Agent sign in"}
              onClick={()=> agentSession ? (window.confirm("Sign out "+agentSession.name+"?") && agentSignOut()) : setShowAgentLogin(true)}>
              {agentSession ? "👤 "+agentSession.name.split(" ")[0] : "👤"}
            </button>
            <div style={{position:"relative",flexShrink:0}}>
              <button className={`nav-pill${navOpen?" nav-active":""}`} onClick={()=>setNavOpen(v=>!v)} title="Menu">
                ☰<span className="menu-label">&nbsp;{({search:"Lookup",cheats:"Cheat Sheet",guide:"Help",changelog:"Log",admin:"Manage Techs"})[view]||"Menu"}</span>
              </button>
              {navOpen && (
                <>
                  <div className="nav-backdrop" onClick={()=>setNavOpen(false)}/>
                  <div className="nav-panel">
                    {[
                      { id:"search",    icon:"🔍", label:"Lookup" },
                      { id:"cheats",    icon:"🧾", label:"Cheat Sheet" },
                      { id:"guide",     icon:"❓", label:"Help" },
                      { id:"changelog", icon:"📜", label:"Log" },
                    ].map(({id,icon,label})=>(
                      <button key={id} className={`nav-item${view===id?" nav-item-active":""}`}
                        onClick={()=>{ setNavOpen(false); if(id==="search"){setView("search");setResult(null);setZipInput("");} else setView(id); }}>
                        <span className="nav-item-icon">{icon}</span>{label}
                      </button>
                    ))}
                    <button className={`nav-item${view==="admin"?" nav-item-active":""}`}
                      onClick={()=>{ setNavOpen(false); handleAdminClick(); }}>
                      <span className="nav-item-icon">{authLevel?"🔧":"🔒"}</span>Manage Techs
                    </button>
                    <div className="nav-divider"/>
                    {installPrompt && !isStandalone && (
                      <button className="nav-item" onClick={()=>{ setNavOpen(false); doInstall(); }}>
                        <span className="nav-item-icon">⬇️</span>Install App
                      </button>
                    )}
                    <button className="nav-item" onClick={()=>{ setNavOpen(false); openPopout(); }}>
                      <span className="nav-item-icon">⧉</span>Pop-Out Window
                    </button>
                  </div>
                </>
              )}
            </div>
          </nav>
        </header>
        {isOffline && (
          <div className="offline-banner">
            ⚡ Offline — showing cached data · Changes cannot be saved until reconnected
          </div>
        )}

        {view==="search"    && <SearchView techs={techs} zipInput={zipInput} setZipInput={setZipInput} result={result} setResult={setResult}/>}
        {view==="cheats"    && <CheatSheetPage/>}
        {view==="guide"     && <GuidePage/>}
        {view==="changelog" && <ChangelogPage authLevel={authLevel} authCode={authCode} authLabel={authLabel}/>}
        {view==="admin"     && <AdminView  techs={techs} confirmId={confirmId} authLevel={authLevel} authLabel={authLabel}
              authCode={authCode} onSignOut={handleSignOut} onMasterCodeChanged={handleMasterCodeChanged}
              onRestoreComplete={handleRestoreComplete} onStatusChange={handleStatusChange} onBulkStatus={handleBulkStatus}
              onAdd={()=>setModal({mode:"add"})} onEdit={t=>setModal({mode:"edit",tech:t})}
              onDelete={handleDelete} onImport={handleImport} saveStatus={saveStatus}/>}

        {modal     && <TechModal  mode={modal.mode} tech={modal.tech} allTechs={techs} onSave={handleSaveTech} onClose={()=>setModal(null)}/>}
        {view!=="admin" && !showHelpModal && !showAgentLogin && (
          myRequest
            ? <div className="fab-chip">
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <span style={{fontSize:17,flexShrink:0}}>🆘</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:"#0f172a",lineHeight:1.2}}>
                      {myRequest.claimedBy ? myRequest.claimedBy+" is on the way" : "Waiting for a supervisor…"}
                    </div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#94a3b8",marginTop:2}}>
                      {myRequest.claimedBy?"✋ Claimed":"Sent"} · {timeAgo(myRequest.ts)}
                    </div>
                  </div>
                  <button onClick={cancelMyRequest} title="Cancel request"
                    style={{background:"none",border:"none",color:"#94a3b8",fontSize:14,cursor:"pointer",flexShrink:0,padding:2}}>✕</button>
                </div>
              </div>
            : <button className="fab-help" onClick={()=> agentSession ? setShowHelpModal(true) : setShowAgentLogin(true)}>🆘 Supervisor</button>
        )}
        {alertReq && (
          <div className="alert-overlay">
            <div className="alert-box">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <span style={{fontSize:30,lineHeight:1}}>🆘</span>
                <div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,color:"#dc2626",lineHeight:1}}>SUPERVISOR NEEDED</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#94a3b8",letterSpacing:".08em",marginTop:3}}>{timeAgo(alertReq.ts)}</div>
                </div>
              </div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:700,color:"#0f172a",marginBottom:4}}>{alertReq.agentName}</div>
              {(alertReq.context?.zip || alertReq.context?.branch || (alertReq.context?.types||[]).length>0) && (
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#1e40af",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,padding:"6px 10px",marginBottom:8,letterSpacing:".04em"}}>
                  {[alertReq.context.branch || alertReq.context.zip, (alertReq.context.types||[]).slice(0,3).join(" + ")].filter(Boolean).join(" · ")}
                </div>
              )}
              {alertReq.note && <div style={{fontSize:13,color:"#475569",lineHeight:1.6,marginBottom:12}}>"{alertReq.note}"</div>}
              <div style={{display:"flex",gap:10,marginTop:14}}>
                <button className="btn-cancel" style={{flex:1}} onClick={dismissAlert}>Dismiss</button>
                <button className="btn-save" style={{flex:2}} onClick={()=>{ claimReq(alertReq.id); dismissAlert(); setShowHelpPanel(true); }}>✋ Claim — I'm Going</button>
              </div>
            </div>
          </div>
        )}
        {showInstall && installPrompt && !isStandalone && (
          <div style={{position:"fixed",left:12,right:12,bottom:12,zIndex:160,maxWidth:440,margin:"0 auto",
            background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,boxShadow:"0 10px 30px rgba(0,0,0,.16)",
            padding:"13px 15px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:38,height:38,borderRadius:9,background:"#2563eb",color:"#fff",flexShrink:0,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:17}}>TD</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,color:"#0f172a",lineHeight:1.1}}>Install Tech Dispatch</div>
              <div style={{fontSize:11.5,color:"#64748b",marginTop:2}}>Add to your home screen for one-tap access &amp; offline use.</div>
            </div>
            <button onClick={dismissInstall} style={{background:"none",border:"none",color:"#94a3b8",fontSize:13,cursor:"pointer",
              fontFamily:"'DM Mono',monospace",letterSpacing:".04em",flexShrink:0}}>Not now</button>
            <button className="btn-save" style={{flexShrink:0,padding:"8px 14px"}} onClick={doInstall}>Install</button>
          </div>
        )}
        {showLogin && <LoginModal onLogin={handleLogin} onClose={()=>setShowLogin(false)}/>}
        {showAgentLogin && <AgentLoginModal onClose={()=>setShowAgentLogin(false)}
          onLoggedIn={s=>{ setAgentSession(s); try { localStorage.setItem('dispatch_agent', JSON.stringify(s)); } catch {} setShowAgentLogin(false); }}/>}
        {showHelpModal && agentSession && <HelpRequestModal agent={agentSession}
          onClose={()=>setShowHelpModal(false)}
          onRaised={r=>{ setMyRequest(r); setShowHelpModal(false); }}/>}
        <Footer/>
      </div>
    </>
  );
}
