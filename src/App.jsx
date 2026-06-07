import { useState, useEffect, useCallback, useRef } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const STATUS_ORDER = { "none": 4, "trouble-call": 0, "in-training": 1, "pto": 2, "do-not-schedule": 3,
                        available: 0, "on-call": 2, "off-duty": 3 }; // legacy aliases
const TECH_TYPES   = ["GHP","Lawn","Termite","Mosquito","Bed Bugs","Commercial","Exclusion","Wildlife","TAP","Sentricon","SMART","Pre Treat","Post Treat","Field Inspector","Trouble Call","Supervisor"];
const BRANCHES     = ["Jax N","Jax E","Jax W","Jax S","St. Augustine","Melbourne","Ocala","Sarasota","Ft. Myers/Naples","Tampa","Orlando","WPB-FTL","Daytona"];
const TYPE_CFG     = {
  GHP:               { color:"#38bdf8", bg:"rgba(56,189,248,.13)",  bd:"rgba(56,189,248,.32)"  },
  Lawn:              { color:"#4ade80", bg:"rgba(74,222,128,.13)",  bd:"rgba(74,222,128,.32)"  },
  Termite:           { color:"#fb923c", bg:"rgba(251,146,60,.13)",  bd:"rgba(251,146,60,.32)"  },
  Supervisor:        { color:"#c084fc", bg:"rgba(192,132,252,.13)", bd:"rgba(192,132,252,.32)" },
  "Trouble Call":    { color:"#f87171", bg:"rgba(248,113,113,.13)", bd:"rgba(248,113,113,.32)" },
  Commercial:        { color:"#22d3ee", bg:"rgba(34,211,238,.13)",  bd:"rgba(34,211,238,.32)"  },
  Mosquito:          { color:"#a3e635", bg:"rgba(163,230,53,.13)",  bd:"rgba(163,230,53,.32)"  },
  Exclusion:         { color:"#fbbf24", bg:"rgba(251,191,36,.13)",  bd:"rgba(251,191,36,.32)"  },
  Wildlife:          { color:"#e879f9", bg:"rgba(232,121,249,.13)", bd:"rgba(232,121,249,.32)" },
  TAP:               { color:"#f472b6", bg:"rgba(244,114,182,.13)", bd:"rgba(244,114,182,.32)" },
  "Pre Treat":       { color:"#818cf8", bg:"rgba(129,140,248,.13)", bd:"rgba(129,140,248,.32)" },
  "Post Treat":      { color:"#34d399", bg:"rgba(52,211,153,.13)",  bd:"rgba(52,211,153,.32)"  },
  SMART:             { color:"#f0abfc", bg:"rgba(240,171,252,.13)", bd:"rgba(240,171,252,.32)" },
  Sentricon:         { color:"#67e8f9", bg:"rgba(103,232,249,.13)", bd:"rgba(103,232,249,.32)" },
  "Bed Bugs":        { color:"#fb7185", bg:"rgba(251,113,133,.13)", bd:"rgba(251,113,133,.32)" },
  "Field Inspector": { color:"#94a3b8", bg:"rgba(148,163,184,.13)", bd:"rgba(148,163,184,.32)" },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
const mid = () => "m" + Date.now().toString(36);
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

.app{min-height:100vh;background:#090e1a;color:#dde3f0;font-family:'Barlow',sans-serif;
  background-image:radial-gradient(ellipse at 18% 60%,rgba(245,158,11,.05) 0%,transparent 55%),
  radial-gradient(ellipse at 82% 15%,rgba(34,197,94,.03) 0%,transparent 50%);}

.top-bar{display:flex;align-items:center;justify-content:space-between;padding:13px 24px;
  border-bottom:1px solid #151e30;background:rgba(9,14,26,.97);backdrop-filter:blur(12px);
  position:sticky;top:0;z-index:99;}
.brand{display:flex;align-items:center;gap:10px;}
.brand-icon{width:32px;height:32px;background:#f59e0b;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:15px;}
.brand-name{font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:.05em;color:#e2e8f0;line-height:1.15;}
.brand-name span{color:#f59e0b;display:block;}
.nav-pill{padding:7px 15px;border-radius:6px;border:1px solid #151e30;background:transparent;color:#64748b;
  font-family:'Barlow',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .18s;flex-shrink:0;}
.nav-pill:hover{border-color:#f59e0b;color:#f59e0b;}
.nav-active{background:rgba(245,158,11,.1);border-color:#f59e0b!important;color:#f59e0b!important;}

.search-hero{max-width:600px;margin:60px auto 0;padding:0 20px;text-align:center;}
.hero-eyebrow{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#f59e0b;margin-bottom:12px;}
.hero-title{font-family:'Barlow Condensed',sans-serif;font-size:clamp(44px,8vw,68px);font-weight:900;line-height:.95;margin-bottom:12px;letter-spacing:-.02em;}
.hero-sub{color:#64748b;font-size:15px;margin-bottom:28px;line-height:1.6;}
.search-bar{display:flex;border:1.5px solid #151e30;border-radius:10px;overflow:hidden;background:#0d1322;transition:border-color .2s,box-shadow .2s;}
.search-bar:focus-within{border-color:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.08);}
.zip-input{flex:1;padding:16px 20px;font-family:'DM Mono',monospace;font-size:28px;font-weight:500;letter-spacing:.15em;background:transparent;border:none;outline:none;color:#e2e8f0;}
.zip-input::placeholder{color:#2d4463;}
.type-section{margin-top:14px;}
.type-label{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:#64748b;margin-bottom:10px;text-align:left;}
.type-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
.type-btn{padding:16px 8px;border-radius:9px;border:1.5px solid #1d2d44;background:#0d1322;color:#6b8299;
  cursor:pointer;transition:none;display:flex;flex-direction:column;align-items:center;gap:5px;
  outline:none;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;}
.type-btn:hover:not(:disabled){border-color:#263a52;color:#8097b1;}
.type-btn:active:not(:disabled){background:#0d1322;border-color:#1d2d44;color:#6b8299;transform:none;}
.type-btn:disabled{opacity:.5;cursor:not-allowed;}
.type-btn-label{font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;}
.type-btn-sub{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.08em;text-transform:uppercase;text-align:center;}
.type-btn.ghp-active  {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.lawn-active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.tmte-active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.spvr-active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.tc-active   {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.ghp-active:active  {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.lawn-active:active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.tmte-active:active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.spvr-active:active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.tc-active:active   {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.comm-active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.mosq-active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.excl-active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.wild-active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.tap-active  {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.pret-active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.post-active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.smrt-active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.sent-active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.bbug-active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.finsp-active{border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.comm-active:active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.mosq-active:active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.excl-active:active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.wild-active:active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.tap-active:active  {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.pret-active:active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.post-active:active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.smrt-active:active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.sent-active:active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.bbug-active:active {border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.type-btn.finsp-active:active{border-color:#f59e0b;background:rgba(245,158,11,.2);color:#fbbf24;box-shadow:0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18);}
.results-wrap{max-width:600px;margin:24px auto 0;padding:0 20px 60px;}
.results-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #151e30;}
.results-label{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#64748b;}

.tech-card{background:#0d1322;border:1px solid #151e30;border-radius:9px;padding:18px;margin-bottom:9px;
  display:flex;gap:14px;animation:slideIn .3s ease both;transition:border-color .2s,transform .15s;}
.tech-card:hover{border-color:rgba(245,158,11,.3);transform:translateY(-1px);}
@keyframes slideIn{from{opacity:0;transform:translateY(9px);}to{opacity:1;transform:translateY(0);}}
.tech-avatar{width:44px;height:44px;border-radius:50%;background:#151e30;border:2px solid #1e2e43;
  display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;color:#f59e0b;flex-shrink:0;}
.tech-name{font-family:'Barlow Condensed',sans-serif;font-size:21px;font-weight:700;}
.tech-phone{display:block;font-family:'DM Mono',monospace;font-size:13px;color:#94a3b8;text-decoration:none;margin-bottom:7px;}
.tech-phone:hover{color:#f59e0b;}
.tech-notes{font-size:13px;color:#64748b;margin-bottom:8px;}
.tag-row{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:7px;}
.zip-tags{display:flex;flex-wrap:wrap;gap:5px;}
.zip-tag{font-family:'DM Mono',monospace;font-size:11px;padding:2px 8px;background:#111a28;border:1px solid #1a2a3d;border-radius:4px;color:#64748b;}
.zip-hl{background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.32);color:#f59e0b;font-weight:500;}
.zip-more{font-family:'DM Mono',monospace;font-size:11px;padding:2px 8px;background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.2);border-radius:4px;color:#f59e0b;font-weight:500;}
.empty-state{text-align:center;padding:52px 20px;}
.empty-icon{font-size:42px;margin-bottom:13px;}
.empty-title{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:700;margin-bottom:7px;}
.empty-text{color:#64748b;font-size:14px;line-height:1.6;max-width:300px;margin:0 auto;}

/* Disclaimer */
.disclaimer{background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.22);border-radius:8px;
  padding:13px 15px;margin-top:16px;display:flex;gap:10px;align-items:flex-start;text-align:left;}
.disclaimer-icon{font-size:15px;flex-shrink:0;margin-top:1px;opacity:.8;}
.disclaimer-text{font-size:12px;color:#64748b;line-height:1.65;}
.disclaimer-text strong{color:#f59e0b;font-weight:600;}

.admin-view{max-width:980px;margin:0 auto;padding:32px 20px 60px;}
.admin-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;}
.admin-head-left{display:flex;flex-direction:column;gap:5px;}
.admin-title{font-family:'Barlow Condensed',sans-serif;font-size:30px;font-weight:900;}
.admin-meta{font-family:'DM Mono',monospace;font-size:11px;color:#64748b;letter-spacing:.08em;}
.admin-meta span{color:#f59e0b;}
.admin-head-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.session-badge{display:flex;align-items:center;gap:7px;background:#0d1322;border:1px solid #151e30;
  border-radius:20px;padding:5px 12px;font-family:'DM Mono',monospace;font-size:11px;color:#64748b;letter-spacing:.06em;}
.session-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.btn-signout{padding:6px 13px;background:transparent;border:1px solid #151e30;border-radius:6px;
  color:#64748b;font-size:12px;cursor:pointer;transition:all .18s;font-family:'Barlow',sans-serif;}
.btn-signout:hover{border-color:rgba(239,68,68,.4);color:#ef4444;}
.btn-add{padding:9px 18px;background:#f59e0b;border:none;border-radius:6px;color:#090e1a;
  font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;transition:background .18s;}
.btn-add:hover{background:#fbbf24;}
.btn-outline{padding:7px 14px;background:transparent;border:1px solid #1e2e43;border-radius:6px;
  color:#64748b;font-family:'Barlow',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .18s;display:flex;align-items:center;gap:6px;}
.btn-outline:hover{border-color:#f59e0b;color:#f59e0b;}
.admin-tabs{display:flex;gap:2px;margin-bottom:24px;border-bottom:1px solid #151e30;}
.admin-tab{padding:10px 18px;background:transparent;border:none;border-bottom:2px solid transparent;
  color:#64748b;font-family:'Barlow',sans-serif;font-size:14px;font-weight:500;cursor:pointer;transition:all .18s;margin-bottom:-1px;}
.admin-tab:hover{color:#94a3b8;}
.tab-active{color:#f59e0b!important;border-bottom-color:#f59e0b!important;}
.import-banner{background:#0d1322;border:1px solid rgba(245,158,11,.3);border-radius:9px;padding:16px 20px;margin-bottom:20px;animation:slideIn .25s ease both;}
.import-banner-title{font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:700;margin-bottom:4px;}
.import-banner-sub{font-size:13px;color:#64748b;margin-bottom:14px;line-height:1.5;}
.import-banner-actions{display:flex;gap:8px;}

/* save status toast */
.save-toast{display:flex;align-items:center;gap:8px;font-family:'DM Mono',monospace;font-size:11px;
  letter-spacing:.06em;padding:5px 12px;border-radius:6px;border:1px solid transparent;transition:all .3s;}
.save-saving{color:#f59e0b;border-color:rgba(245,158,11,.25);background:rgba(245,158,11,.08);}
.save-ok    {color:#22c55e;border-color:rgba(34,197,94,.25); background:rgba(34,197,94,.08);}
.save-err   {color:#ef4444;border-color:rgba(239,68,68,.25); background:rgba(239,68,68,.08);}

.table-wrap{border:1px solid #151e30;border-radius:9px;overflow:hidden;}
.tech-table{width:100%;border-collapse:collapse;}
.tech-table th{background:#0b1120;padding:10px 14px;text-align:left;font-family:'DM Mono',monospace;
  font-size:9px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #151e30;}
.tech-table td{padding:12px 14px;border-bottom:1px solid #151e30;vertical-align:middle;}
.tech-table tr:last-child td{border-bottom:none;}
.tech-table tbody tr:hover td{background:#0b1120;}
.row-avatar{width:30px;height:30px;border-radius:50%;background:#151e30;flex-shrink:0;display:flex;
  align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:#f59e0b;}
.btn-edit{padding:5px 12px;background:transparent;border:1px solid #1e2e43;border-radius:5px;
  color:#94a3b8;font-size:12px;cursor:pointer;font-family:'Barlow',sans-serif;transition:all .18s;}
.btn-edit:hover{border-color:#f59e0b;color:#f59e0b;}
.btn-del{padding:5px 12px;background:transparent;border:1px solid rgba(239,68,68,.2);border-radius:5px;
  color:#ef4444;font-size:12px;cursor:pointer;font-family:'Barlow',sans-serif;transition:all .18s;}
.btn-del:hover{background:rgba(239,68,68,.08);}
.btn-del-confirm{padding:5px 12px;background:rgba(239,68,68,.15);border:1px solid #ef4444;border-radius:5px;
  color:#ef4444;font-size:12px;cursor:pointer;font-family:'Barlow',sans-serif;font-weight:600;animation:pulse .6s ease infinite alternate;}
@keyframes pulse{from{opacity:.8;}to{opacity:1;}}

.code-section{background:#0d1322;border:1px solid #151e30;border-radius:9px;padding:22px;}
.code-section+.code-section{margin-top:20px;}
.code-section-title{font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:700;margin-bottom:3px;}
.code-section-sub{font-size:13px;color:#64748b;margin-bottom:16px;line-height:1.5;}
.code-row-display{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.code-masked{font-family:'DM Mono',monospace;font-size:16px;letter-spacing:.12em;color:#94a3b8;}
.change-form-wrap{background:#090e1a;border:1px solid #151e30;border-radius:7px;padding:16px;margin-top:14px;}

.overlay{position:fixed;inset:0;background:rgba(0,0,0,.82);backdrop-filter:blur(5px);
  display:flex;align-items:center;justify-content:center;z-index:200;padding:20px;}
.modal{background:#0d1322;border:1px solid #1a2a3d;border-radius:12px;padding:28px;
  width:100%;max-width:480px;max-height:90vh;overflow-y:auto;animation:modalIn .2s ease;}
.modal-sm{max-width:380px;}
@keyframes modalIn{from{opacity:0;transform:scale(.96) translateY(8px);}to{opacity:1;transform:scale(1) translateY(0);}}
.modal-title{font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:800;margin-bottom:22px;}
.err-box{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.28);border-radius:6px;padding:9px 13px;margin-bottom:16px;font-size:13px;color:#ef4444;}
.field{margin-bottom:17px;}
.field-label{display:block;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:#64748b;margin-bottom:7px;}
.field-input,.field-textarea{width:100%;padding:10px 12px;background:#090e1a;border:1px solid #1a2a3d;
  border-radius:6px;color:#e2e8f0;font-family:'Barlow',sans-serif;font-size:14px;outline:none;transition:border-color .18s;}
.field-input:focus,.field-textarea:focus{border-color:#f59e0b;}
.field-textarea{resize:vertical;min-height:68px;font-family:'DM Mono',monospace;font-size:12px;line-height:1.5;}
.code-input-row{display:flex;gap:8px;}
.code-input-row .field-input{flex:1;}
.eye-btn{padding:10px 14px;background:transparent;border:1px solid #1a2a3d;border-radius:6px;
  color:#64748b;font-size:12px;font-family:'Barlow',sans-serif;cursor:pointer;flex-shrink:0;transition:all .18s;white-space:nowrap;}
.eye-btn:hover{border-color:#f59e0b;color:#f59e0b;}
.eye-btn-sm{padding:4px 10px;background:transparent;border:1px solid #1a2a3d;border-radius:5px;
  color:#64748b;font-size:11px;font-family:'Barlow',sans-serif;cursor:pointer;transition:all .18s;white-space:nowrap;}
.eye-btn-sm:hover{border-color:#f59e0b;color:#f59e0b;}
.type-toggle-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
.type-toggle{padding:10px 6px;border-radius:7px;border:1.5px solid #1a2a3d;background:#090e1a;
  color:#64748b;cursor:pointer;transition:all .18s;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:.08em;text-align:center;text-transform:uppercase;}
.type-toggle:hover{border-color:#263a52;color:#64748b;}
.tt-ghp.on  {border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.13);color:#fbbf24;}
.tt-lawn.on {border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.13);color:#fbbf24;}
.tt-tmte.on {border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.13);color:#fbbf24;}
.tt-spvr.on {border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.13);color:#fbbf24;}
.tt-tc.on   {border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.13);color:#fbbf24;}
.tt-comm.on {border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.13);color:#fbbf24;}
.tt-mosq.on {border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.13);color:#fbbf24;}
.tt-excl.on {border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.13);color:#fbbf24;}
.tt-wild.on {border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.13);color:#fbbf24;}
.tt-tap.on  {border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.13);color:#fbbf24;}
.tt-pret.on {border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.13);color:#fbbf24;}
.tt-post.on {border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.13);color:#fbbf24;}
.tt-smrt.on {border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.13);color:#fbbf24;}
.tt-sent.on {border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.13);color:#fbbf24;}
.tt-bbug.on {border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.13);color:#fbbf24;}
.tt-finsp.on{border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.13);color:#fbbf24;}
.zip-entry-row{display:flex;gap:8px;}
.zip-entry-row .field-input{flex:1;}
.zip-tags-edit{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;min-height:24px;}
.zip-tag-edit{display:inline-flex;align-items:center;gap:5px;font-family:'DM Mono',monospace;
  font-size:11px;padding:3px 9px;background:#111a28;border:1px solid #1a2a3d;border-radius:4px;color:#94a3b8;}
.zip-rm{background:none;border:none;color:#64748b;cursor:pointer;padding:0;font-size:14px;line-height:1;transition:color .15s;}
.zip-rm:hover{color:#ef4444;}
.btn-add-zip{padding:10px 16px;background:#f59e0b;border:none;border-radius:6px;color:#090e1a;
  font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0;transition:background .18s;}
.btn-add-zip:hover{background:#fbbf24;}

/* Copy button (PestPac username) */
.copy-btn{padding:2px 9px;background:transparent;border:1px solid #1a2a3d;border-radius:4px;
  color:#64748b;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.04em;cursor:pointer;
  transition:all .18s;flex-shrink:0;white-space:nowrap;}
.copy-btn:hover{border-color:#f59e0b;color:#f59e0b;}
.copy-btn-ok{border-color:rgba(34,197,94,.4)!important;color:#22c55e!important;background:rgba(34,197,94,.08)!important;}

/* Pop-out nav button */
.btn-popout{font-size:15px;padding:6px 10px!important;letter-spacing:0!important;}
.paste-toggle{background:none;border:none;color:#64748b;font-family:'DM Mono',monospace;
  font-size:10px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;
  padding:7px 0 0;display:flex;align-items:center;gap:5px;transition:color .18s;}
.paste-toggle:hover{color:#f59e0b;}
.bulk-wrap{margin-top:8px;background:#090e1a;border:1px solid #1a2a3d;border-radius:6px;padding:12px;}
.bulk-textarea{width:100%;min-height:88px;padding:9px 11px;background:#0d1322;border:1px solid #1a2a3d;
  border-radius:5px;color:#e2e8f0;font-family:'DM Mono',monospace;font-size:12px;line-height:1.7;
  outline:none;resize:vertical;margin-bottom:9px;transition:border-color .18s;}
.bulk-textarea:focus{border-color:#f59e0b;}
.bulk-textarea::placeholder{color:#3d5068;}
.bulk-footer{display:flex;align-items:center;gap:10px;}
.bulk-msg{font-family:'DM Mono',monospace;font-size:11px;flex:1;}
.modal-footer{display:flex;gap:10px;justify-content:flex-end;margin-top:22px;padding-top:18px;border-top:1px solid #151e30;}
.btn-cancel{padding:9px 18px;background:transparent;border:1px solid #151e30;border-radius:6px;
  color:#64748b;font-family:'Barlow',sans-serif;font-size:14px;cursor:pointer;transition:all .18s;}
.btn-cancel:hover{border-color:#2d3f52;color:#94a3b8;}
.btn-save{padding:9px 20px;background:#f59e0b;border:none;border-radius:6px;color:#090e1a;
  font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:.05em;cursor:pointer;transition:background .18s;}
.btn-save:hover{background:#fbbf24;}
.btn-save:disabled{background:#2d3f52;color:#4a5568;cursor:not-allowed;}
.btn-save-full{width:100%;}
@keyframes shake{10%,90%{transform:translate3d(-2px,0,0)}20%,80%{transform:translate3d(3px,0,0)}30%,50%,70%{transform:translate3d(-4px,0,0)}40%,60%{transform:translate3d(4px,0,0)}}
.shake{animation:shake .45s cubic-bezier(.36,.07,.19,.97) both;}

/* Footer */
.app-footer{border-top:1px solid #0f1826;background:#070b14;padding:32px 24px 28px;}
.footer-inner{max-width:980px;margin:0 auto;display:flex;gap:36px;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;}
.footer-copy{flex:2;min-width:260px;font-size:12px;color:#3d5068;line-height:1.75;}
.footer-divider{width:1px;background:#0f1826;align-self:stretch;flex-shrink:0;}
.footer-contact{flex:1;min-width:190px;}
.footer-contact-label{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#263047;margin-bottom:11px;}
.footer-contact-name{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:700;color:#64748b;margin-bottom:7px;}
.footer-link{display:block;font-family:'DM Mono',monospace;font-size:12px;color:#64748b;text-decoration:none;margin-bottom:4px;transition:color .18s;letter-spacing:.04em;}
.footer-link:hover{color:#f59e0b;}
::-webkit-scrollbar{width:5px;}
::-webkit-scrollbar-track{background:#090e1a;}
::-webkit-scrollbar-thumb{background:#151e30;border-radius:3px;}
::-webkit-scrollbar-thumb:hover{background:#1e2e43;}

.type-group-divider{height:1px;background:linear-gradient(to right,transparent,#1d2d44 20%,#1d2d44 80%,transparent);margin:9px 0;}

.lookup-or{display:flex;align-items:center;gap:12px;margin:12px 0 10px;color:#64748b;
  font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.15em;text-transform:uppercase;}
.lookup-or::before,.lookup-or::after{content:'';flex:1;height:1px;}
.lookup-or::before{background:linear-gradient(to right,transparent,#1e2e43);}
.lookup-or::after{background:linear-gradient(to left,transparent,#1e2e43);}
.branch-select{width:100%;padding:16px 18px;background:#0d1322;border:2px solid #151e30;
  border-radius:10px;color:#64748b;font-family:'Barlow',sans-serif;font-size:17px;font-weight:500;
  outline:none;cursor:pointer;transition:border-color .2s,box-shadow .2s;
  -webkit-appearance:none;appearance:none;}
.branch-select:focus{border-color:rgba(245,158,11,.5);box-shadow:0 0 0 3px rgba(245,158,11,.08);}
.branch-select.branch-active{border-color:#f59e0b;color:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.08);}

/* ─ GUIDE & CHANGELOG ─ */
.guide-card{background:#0d1322;border:1px solid #151e30;border-radius:9px;padding:20px;margin-bottom:14px;}
.guide-card-title{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:700;margin-bottom:14px;letter-spacing:.02em;}
.guide-step{display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;}
.guide-step-num{font-family:'DM Mono',monospace;font-size:11px;color:#f59e0b;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
.guide-step-body{font-size:13px;color:#94a3b8;line-height:1.7;padding-top:2px;}
.guide-row{display:flex;align-items:center;gap:10px;margin-bottom:9px;}
.guide-row-desc{font-size:13px;color:#94a3b8;line-height:1.5;}

/* Scrollable nav — hides scrollbar visually, still scrollable */
.top-nav{display:flex;gap:6px;overflow-x:auto;-ms-overflow-style:none;scrollbar-width:none;min-width:0;}
.top-nav::-webkit-scrollbar{display:none;}

/* ─ RESPONSIVE ──────────────────────────────────────────────────────────── */

/* Tablets and large phones (≤768px) */
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

/* Standard phones (≤480px) */
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

/* Very small phones (≤360px) */
@media(max-width:360px){
  .brand-icon{width:28px;height:28px;font-size:13px;border-radius:6px;}
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
    "trouble-call":    { label:"Trouble Call",    bg:"rgba(34,197,94,.13)",   color:"#22c55e", bd:"rgba(34,197,94,.28)"   },
    "in-training":     { label:"In Training",     bg:"rgba(45,212,191,.13)",  color:"#2dd4bf", bd:"rgba(45,212,191,.28)"  },
    "pto":             { label:"PTO",              bg:"rgba(251,191,36,.13)",  color:"#fbbf24", bd:"rgba(251,191,36,.28)"  },
    "do-not-schedule": { label:"DO NOT SCHEDULE", bg:"rgba(239,68,68,.18)",   color:"#ef4444", bd:"rgba(239,68,68,.4)"    },
    // Legacy aliases (existing techs in DB)
    "available":       { label:"Trouble Call",    bg:"rgba(34,197,94,.13)",   color:"#22c55e", bd:"rgba(34,197,94,.28)"   },
    "on-call":         { label:"PTO",             bg:"rgba(251,191,36,.13)",  color:"#fbbf24", bd:"rgba(251,191,36,.28)"  },
    "off-duty":        { label:"DO NOT SCHEDULE", bg:"rgba(239,68,68,.18)",   color:"#ef4444", bd:"rgba(239,68,68,.4)"    },
  }[status] || { label:status, bg:"transparent", color:"#94a3b8", bd:"#263047" };
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
      letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:500,transition:"all .18s",
      background:highlight?c.bg:"rgba(255,255,255,.04)",color:highlight?c.color:"#64748b",
      border:highlight?`1px solid ${c.bd}`:"1px solid #1a2a3d"}}>{type}</span>
  );
}

// ─── TECH CARD ────────────────────────────────────────────────────────────────
function TechCard({ tech, highlightZip, highlightTypes, index }) {
  const extraZips = tech.zipCodes.length - 1;
  const [copiedPhone,    setCopiedPhone]    = useState(false);
  const [copiedUsername, setCopiedUsername] = useState(false);

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
    <div className="tech-card" style={{animationDelay:`${index*55}ms`}}>
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
              PestPac:&nbsp;<span style={{color:"#64748b"}}>{tech.pestpacUsername}</span>
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
        <div className="zip-tags">
          {highlightZip
            ? <><span className="zip-tag zip-hl">{highlightZip}</span>{extraZips>0&&<span className="zip-more">+{extraZips} more</span>}</>
            : <span className="zip-more">{tech.zipCodes.length} ZIP{tech.zipCodes.length!==1?"s":""}</span>
          }
        </div>
      </div>
    </div>
  );
}

// ─── SEARCH VIEW ─────────────────────────────────────────────────────────────
const TYPE_ACTIVE_CLASS = {
  GHP:"ghp-active", Lawn:"lawn-active", Termite:"tmte-active",
  Supervisor:"spvr-active", "Trouble Call":"tc-active"
};
const TYPE_SUB = {
  GHP:"General Household", Lawn:"Lawn & Outdoor", Termite:"Termite Control",
  Supervisor:"Lead / Oversight", "Trouble Call":"Trouble Calls"
};

function SearchView({ techs, zipInput, setZipInput, result, setResult }) {
  const [selTypes,  setSelTypes]  = useState([]);
  const [selBranch, setSelBranch] = useState("");
  const zipReady    = zipInput.length === 5;
  const lookupReady = zipReady || !!selBranch;

  // Unique branches present in the current tech list, sorted
  const branchOptions = [...new Set(techs.map(t=>t.branch).filter(Boolean))].sort();

  const toggleType = (type) => {
    setSelTypes(prev =>
      prev.includes(type) ? prev.filter(t=>t!==type) : [...prev, type]
    );
  };

  // Re-run search whenever zip, branch, or selected types change
  useEffect(()=>{
    if (!lookupReady || selTypes.length===0) { setResult(null); return; }

    const supervisorOk = (tt) => tt.includes("Supervisor") ? selTypes.includes("Supervisor") : true;

    if (selBranch) {
      const matches = techs
        .filter(t => {
          const tt = t.types||[];
          return t.branch===selBranch && selTypes.every(st=>tt.includes(st)) && supervisorOk(tt);
        })
        .sort((a,b)=>(STATUS_ORDER[a.status]??3)-(STATUS_ORDER[b.status]??3));
      setResult({ zip:null, branch:selBranch, types:[...selTypes], matches });
    } else {
      const zip = zipInput.trim();
      const matches = techs
        .filter(t => {
          const tt = t.types||[];
          return t.zipCodes.includes(zip) && selTypes.every(st=>tt.includes(st)) && supervisorOk(tt);
        })
        .sort((a,b)=>(STATUS_ORDER[a.status]??3)-(STATUS_ORDER[b.status]??3));
      setResult({ zip, branch:null, types:[...selTypes], matches });
    }
  }, [selTypes, zipInput, selBranch, techs]);

  return (
    <>
      <div className="search-hero">
        <div className="hero-eyebrow">// Technician Availability</div>
        <h1 className="hero-title">Dispatch Lookup</h1>
        <p className="hero-sub">Enter a ZIP code or select a branch, then choose a service type.</p>
        <div className="search-bar">
          <input className="zip-input" type="text" inputMode="numeric" placeholder="00000"
            value={zipInput} maxLength={5} autoFocus
            onChange={e=>{
              const v=e.target.value.replace(/\D/g,"").slice(0,5);
              setZipInput(v);
              if(v) setSelBranch(""); // typing ZIP clears branch
            }}/>
        </div>

        <div className="lookup-or">or</div>

        <select
          className={`branch-select${selBranch?" branch-active":""}`}
          value={selBranch}
          onChange={e=>{
            setSelBranch(e.target.value);
            if(e.target.value) setZipInput(""); // selecting branch clears ZIP
          }}>
          <option value="">Select a branch…</option>
          {branchOptions.map(b=><option key={b} value={b}>{b}</option>)}
        </select>
        <div className="type-section">
          <div className="type-label" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span>Select service type{selTypes.length>1?" (multiple)":""}</span>
            {selTypes.length>0 && (
              <button onClick={()=>setSelTypes([])}
                style={{background:"none",border:"none",color:"#64748b",fontFamily:"'DM Mono',monospace",
                  fontSize:9,letterSpacing:".1em",textTransform:"uppercase",cursor:"pointer",padding:0}}>
                Clear
              </button>
            )}
          </div>
          <div className="type-grid" style={{gridTemplateColumns:"repeat(4,1fr)"}}>
            {["GHP","Lawn","Termite","Mosquito"].map(type=>(
              <button key={type} className="type-btn"
                style={selTypes.includes(type)?{borderColor:"#f59e0b",background:"rgba(245,158,11,.2)",color:"#fbbf24",boxShadow:"0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18)"}:{}}
                disabled={!lookupReady} onClick={()=>toggleType(type)}>
                <div className="type-btn-label">{type}</div>
              </button>
            ))}
          </div>
          <div className="type-group-divider"/>
          <div className="type-grid" style={{gridTemplateColumns:"repeat(4,1fr)"}}>
            {["Commercial","Bed Bugs","Exclusion","Wildlife"].map(type=>(
              <button key={type} className="type-btn"
                style={selTypes.includes(type)?{borderColor:"#f59e0b",background:"rgba(245,158,11,.2)",color:"#fbbf24",boxShadow:"0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18)"}:{}}
                disabled={!lookupReady} onClick={()=>toggleType(type)}>
                <div className="type-btn-label">{type}</div>
              </button>
            ))}
          </div>
          <div className="type-group-divider"/>
          <div className="type-grid" style={{gridTemplateColumns:"repeat(4,1fr)"}}>
            {["TAP","Sentricon","SMART","Pre Treat"].map(type=>(
              <button key={type} className="type-btn"
                style={selTypes.includes(type)?{borderColor:"#f59e0b",background:"rgba(245,158,11,.2)",color:"#fbbf24",boxShadow:"0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18)"}:{}}
                disabled={!lookupReady} onClick={()=>toggleType(type)}>
                <div className="type-btn-label">{type}</div>
              </button>
            ))}
          </div>
          <div className="type-group-divider"/>
          <div className="type-grid" style={{gridTemplateColumns:"repeat(4,1fr)"}}>
            {["Post Treat","Field Inspector","Trouble Call","Supervisor"].map(type=>(
              <button key={type} className="type-btn"
                style={selTypes.includes(type)?{borderColor:"#f59e0b",background:"rgba(245,158,11,.2)",color:"#fbbf24",boxShadow:"0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.18)"}:{}}
                disabled={!lookupReady} onClick={()=>toggleType(type)}>
                <div className="type-btn-label">{type}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {result ? (
        <div className="results-wrap">
          <div className="results-head">
            <span className="results-label">
              <span style={{color:"#f59e0b"}}>{result.branch || result.zip}</span>&nbsp;·&nbsp;
              {result.types.map((t,i)=>(
                <span key={t}>
                  <span style={{color:TYPE_CFG[t]?.color}}>{t}</span>
                  {i<result.types.length-1&&<span style={{color:"#3d5068"}}>&nbsp;+&nbsp;</span>}
                </span>
              ))}
            </span>
            <span className="results-label" style={{color:"#64748b"}}>
              {result.matches.length===0?"no techs found":`${result.matches.length} tech${result.matches.length>1?"s":""} found`}
            </span>
          </div>
          {result.matches.length===0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <div className="empty-title">No Coverage Found</div>
              <div className="empty-text">
                No technicians matching&nbsp;
                <strong style={{color:"#f59e0b"}}>{result.types.join(" + ")}</strong>
                {result.branch
                  ? <>&nbsp;are assigned to the <strong style={{color:"#f59e0b"}}>{result.branch}</strong> branch.</>
                  : <>&nbsp;are assigned to ZIP&nbsp;<strong style={{color:"#f59e0b"}}>{result.zip}</strong>.</>
                }
              </div>
            </div>
          ) : result.matches.map((tech,i)=>(
            <TechCard key={tech.id} tech={tech} highlightZip={result.zip} highlightTypes={result.types} index={i}/>
          ))}
        </div>
      ) : (
        <div style={{textAlign:"center",marginTop:48,color:"#2a3f58"}}>
          <div style={{fontSize:48,marginBottom:10}}>📍</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.13em",textTransform:"uppercase"}}>
            {lookupReady ? "Select a service type above" : "Enter a ZIP or choose a branch"}
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
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:"#94a3b8",letterSpacing:".1em"}}>
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
      <div style={{marginBottom:20,padding:"14px 18px",background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.18)",borderRadius:8}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:700,marginBottom:4}}>Automatic Backups</div>
        <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.6}}>
          A snapshot is saved automatically every time technicians are added, edited, deleted, or imported.
          The last <strong style={{color:"#f59e0b"}}>10 backups</strong> are kept. Older ones are removed automatically.
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

// ─── ADMIN VIEW ───────────────────────────────────────────────────────────────
function AdminView({ techs, confirmId, authLevel, authLabel, authCode,
                     onSignOut, onMasterCodeChanged, onRestoreComplete,
                     onAdd, onEdit, onDelete, onImport, saveStatus }) {
  const [tab,           setTab]           = useState("techs");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [importPending, setImportPending] = useState(null);
  const [importErr,     setImportErr]     = useState("");
  const fileRef = useRef(null);
  const uniqueZips = new Set(techs.flatMap(t=>t.zipCodes)).size;

  const filteredTechs = searchQuery.trim()
    ? techs.filter(t=>t.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : techs;

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
            <span className="session-dot" style={{background:authLevel==="master"?"#f59e0b":"#38bdf8"}}/>
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

      {authLevel==="master" && (
        <div className="admin-tabs">
          <button className={`admin-tab${tab==="techs"?" tab-active":""}`} onClick={()=>{setTab("techs");setSearchQuery("");}}>Technicians</button>
          <button className={`admin-tab${tab==="backups"?" tab-active":""}`} onClick={()=>setTab("backups")}>💾 Backups</button>
          <button className={`admin-tab${tab==="codes"?" tab-active":""}`} onClick={()=>setTab("codes")}>🔐 Access Codes</button>
        </div>
      )}

      {tab==="techs" && (
        <>
          {/* Search bar */}
          <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
            <div style={{flex:1,position:"relative"}}>
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
            <div className="admin-meta" style={{marginBottom:16}}>
              Showing <span>{filteredTechs.length}</span> of {techs.length} technicians
            </div>
          )}
          {importErr && (
            <div className="err-box" style={{marginBottom:16}}>
              {importErr}&nbsp;<span style={{cursor:"pointer",textDecoration:"underline"}} onClick={()=>setImportErr("")}>Dismiss</span>
            </div>
          )}
          {importPending && (
            <div className="import-banner">
              <div className="import-banner-title">📁 {importPending.filename}</div>
              <div className="import-banner-sub">
                <strong style={{color:"#f59e0b"}}>{importPending.techs.length} technicians</strong> found.
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
              <table className="tech-table">
                <thead>
                  <tr><th>Technician</th><th>Phone</th><th>Status</th><th>Branch</th><th>Service Types</th><th>ZIP Codes</th><th>Notes</th><th></th></tr>
                </thead>
                <tbody>
                  {filteredTechs.map(tech=>(
                    <tr key={tech.id}>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:9}}>
                          <div className="row-avatar">{ini(tech.name)}</div>
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:17,fontWeight:700}}>{tech.name}</span>
                        </div>
                      </td>
                      <td style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#64748b"}}>{tech.phone}</td>
                      <td><StatusBadge status={tech.status}/></td>
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
  const blank = {name:"",pestpacUsername:"",phone:"",status:"none",branch:"",types:[],zipCodes:[],notes:""};
  const [form,     setForm]     = useState(mode==="edit"?{...tech,types:tech.types||[],branch:tech.branch||"",pestpacUsername:tech.pestpacUsername||""}:blank);
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
        </div>
        <div className="field">
          <label className="field-label">Phone Number</label>
          <input className="field-input" value={form.phone} onChange={e=>{upd("phone",formatPhone(e.target.value));setErr("");}} placeholder="(555) 000-0000"/>
        </div>
        <div style={{display:"flex",gap:12}}>
          <div className="field" style={{flex:1}}>
            <label className="field-label">Status</label>
            <select className="field-input" value={form.status} onChange={e=>upd("status",e.target.value)}>
              <option value="none">None</option>
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
              <button key={type} className="type-toggle" style={form.types.includes(type)?{borderColor:"rgba(245,158,11,.55)",background:"rgba(245,158,11,.13)",color:"#fbbf24"}:{}}
                onClick={()=>{toggleType(type);setErr("");}}>
                {type}
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
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={submit}>{mode==="edit"?"Save Changes":"Add Technician"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── GUIDE PAGE ───────────────────────────────────────────────────────────────
function GuidePage() {
  return (
    <div style={{maxWidth:640,margin:"0 auto",padding:"40px 20px 60px"}}>
      <div style={{marginBottom:28,textAlign:"center"}}>
        <div className="hero-eyebrow">// Reference</div>
        <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(36px,7vw,54px)",fontWeight:900,lineHeight:.95,marginBottom:10,letterSpacing:"-.02em"}}>How To Use</h1>
        <p style={{color:"#64748b",fontSize:14,lineHeight:1.6}}>A quick reference for Trouble-Call Dispatch</p>
      </div>

      <div className="guide-card">
        <div className="guide-card-title">📍 Looking Up a Technician</div>
        <div className="guide-step"><div className="guide-step-num">1</div><div className="guide-step-body"><strong>Enter the 5-digit ZIP code</strong> for the service location in the search bar at the top.</div></div>
        <div className="guide-step"><div className="guide-step-num">2</div><div className="guide-step-body"><strong>Select one or more service types.</strong> You can combine types to find a technician who covers all of them.</div></div>
        <div className="guide-step"><div className="guide-step-num">3</div><div className="guide-step-body">Results appear automatically, sorted by status — available technicians show first.</div></div>
        <div style={{marginTop:12,padding:"10px 14px",background:"rgba(245,158,11,.06)",borderRadius:6,border:"1px solid rgba(245,158,11,.15)",fontSize:13,color:"#94a3b8",lineHeight:1.6}}>
          <strong style={{color:"#f59e0b"}}>Important:</strong> Supervisors only appear when the <strong>Supervisor</strong> button is selected — this prevents accidental scheduling.
        </div>
      </div>

      <div className="guide-card">
        <div className="guide-card-title">🏷️ Service Types</div>
        <div className="guide-row"><TypeBadge type="GHP" highlight/><span className="guide-row-desc">General Household Pest — standard residential services</span></div>
        <div className="guide-row"><TypeBadge type="Lawn" highlight/><span className="guide-row-desc">Lawn & Outdoor services</span></div>
        <div className="guide-row"><TypeBadge type="Termite" highlight/><span className="guide-row-desc">Termite inspection and control</span></div>
        <div className="guide-row"><TypeBadge type="Trouble Call" highlight/><span className="guide-row-desc">Trouble call response technicians</span></div>
        <div className="guide-row"><TypeBadge type="Supervisor" highlight/><span className="guide-row-desc">Lead technicians and area supervisors</span></div>
      </div>

      <div className="guide-card">
        <div className="guide-card-title">🔖 Status Meanings</div>
        <div className="guide-row"><StatusBadge status="in-training"/><span className="guide-row-desc">Technician is in training — verify before scheduling</span></div>
        <div className="guide-row"><StatusBadge status="pto"/><span className="guide-row-desc">On PTO — not available</span></div>
        <div className="guide-row"><StatusBadge status="do-not-schedule"/><span className="guide-row-desc">Do not assign this technician</span></div>
        <div style={{marginTop:8,fontSize:12,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:".04em"}}>No badge shown = status not set</div>
      </div>

      <div className="guide-card">
        <div className="guide-card-title">📋 Reading a Result Card</div>
        <div style={{fontSize:13,color:"#94a3b8",lineHeight:2}}>
          <div><span style={{color:"#f59e0b",fontFamily:"'DM Mono',monospace",fontSize:11,marginRight:8}}>PHONE</span>Tap to call · Copy button copies to clipboard</div>
          <div><span style={{color:"#f59e0b",fontFamily:"'DM Mono',monospace",fontSize:11,marginRight:8}}>PESTPAC</span>One-tap Copy button copies the username</div>
          <div><span style={{color:"#f59e0b",fontFamily:"'DM Mono',monospace",fontSize:11,marginRight:8}}>TYPES</span>Matched types are highlighted in color</div>
          <div><span style={{color:"#f59e0b",fontFamily:"'DM Mono',monospace",fontSize:11,marginRight:8}}>ZIP</span>Shows matched ZIP · "+N more" = additional coverage</div>
        </div>
      </div>

      <div className="guide-card" style={{borderColor:"rgba(245,158,11,.25)",background:"rgba(245,158,11,.04)"}}>
        <div className="guide-card-title">⚠️ Important Reminders</div>
        <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.8}}>
          All scheduling decisions remain subject to established drive times, technician duties, and standard operating procedures.
          When uncertain about the appropriate technician, consult a router or supervisor before proceeding.
        </div>
      </div>

      <div className="guide-card">
        <div className="guide-card-title">📞 Contact & Support</div>
        <div style={{fontSize:12,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:".04em",marginBottom:8}}>Questions or requests about this app:</div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:700,color:"#94a3b8",marginBottom:6}}>Brett Wingert</div>
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
          {entry.body && <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.75,whiteSpace:"pre-wrap",marginTop:4}}>{entry.body}</div>}
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
    window.open(window.location.origin, "TroubleCallDispatch",
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
    <div style={{minHeight:"100vh",background:"#090e1a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:"#3d5068"}}>Connecting to database…</div>
    </div>
  );

  if (loadErr) return (
    <div style={{minHeight:"100vh",background:"#090e1a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{fontSize:36}}>⚠️</div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:700}}>Connection Failed</div>
      <div style={{fontSize:13,color:"#64748b",maxWidth:300,textAlign:"center",lineHeight:1.6}}>Could not reach the database. Check your environment variables and Supabase project status.</div>
      <button className="btn-add" onClick={loadTechs}>Retry</button>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <header className="top-bar">
          <div className="brand">
            <div className="brand-icon">🐀</div>
            <div className="brand-name">TROUBLE-CALL<span>DISPATCH</span></div>
          </div>
          <nav className="top-nav">
            <button className={`nav-pill${view==="search"?" nav-active":""}`}
              onClick={()=>{setView("search");setResult(null);setZipInput("");}}>Lookup</button>
            <button className={`nav-pill${view==="guide"?" nav-active":""}`}
              onClick={()=>setView("guide")}>Help</button>
            <button className={`nav-pill${view==="changelog"?" nav-active":""}`}
              onClick={()=>setView("changelog")}>Log</button>
            <button className={`nav-pill${view==="admin"?" nav-active":""}`} onClick={handleAdminClick}>
              {!authLevel&&<span style={{marginRight:5,fontSize:11,opacity:.7}}>🔒</span>}Manage Techs
            </button>
            <button className="nav-pill btn-popout" onClick={openPopout} title="Open in mini window">⧉</button>
          </nav>
        </header>

        {view==="search"    && <SearchView techs={techs} zipInput={zipInput} setZipInput={setZipInput} result={result} setResult={setResult}/>}
        {view==="guide"     && <GuidePage/>}
        {view==="changelog" && <ChangelogPage authLevel={authLevel} authCode={authCode} authLabel={authLabel}/>}
        {view==="admin"     && <AdminView  techs={techs} confirmId={confirmId} authLevel={authLevel} authLabel={authLabel}
              authCode={authCode} onSignOut={handleSignOut} onMasterCodeChanged={handleMasterCodeChanged}
              onRestoreComplete={handleRestoreComplete}
              onAdd={()=>setModal({mode:"add"})} onEdit={t=>setModal({mode:"edit",tech:t})}
              onDelete={handleDelete} onImport={handleImport} saveStatus={saveStatus}/>}

        {modal     && <TechModal  mode={modal.mode} tech={modal.tech} allTechs={techs} onSave={handleSaveTech} onClose={()=>setModal(null)}/>}
        {showLogin && <LoginModal onLogin={handleLogin} onClose={()=>setShowLogin(false)}/>}
        <Footer/>
      </div>
    </>
  );
}
