import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "pt-flashcards-v4";

// ─── WORD LIST ───
// Words are hardcoded here — study progress (box, reviews) is saved locally.
// To add more words, ask Claude to update this list.
const MASTER_WORDS = [
  { id: "1", pt: "Mole", en: "Soft / easy / weak", group: 1 },
  { id: "2", pt: "Pingando", en: "Dripping", group: 1 },
  { id: "3", pt: "Cascavel", en: "Rattlesnake", group: 1 },
  { id: "4", pt: "Bater um papo", en: "Having a chat", group: 1 },
  { id: "5", pt: "Pretender", en: "To intend / to plan", group: 1 },
  { id: "6", pt: "Carimbado", en: "Stamped / certified", group: 1 },
  { id: "7", pt: "Por engano", en: "By mistake", group: 1 },
  { id: "8", pt: "Capoeira", en: "Brazilian martial art / dance", group: 1 },
  { id: "9", pt: "Encomenda", en: "Order / package", group: 1 },
  { id: "10", pt: "Calota", en: "Hubcap", group: 1 },
  { id: "11", pt: "Roda", en: "Wheel / circle / round", group: 1 },
  { id: "12", pt: "Cagando", en: "Taking a dump (vulgar/casual)", group: 1 },
  { id: "13", pt: "Fedondo", en: "Stinky / smelly", group: 1 },
  { id: "14", pt: "Sombra", en: "Shadow / shade", group: 1 },
  { id: "15", pt: "Recolher", en: "To collect / to gather", group: 1 },
  { id: "16", pt: "De propósito", en: "On purpose", group: 1 },
  { id: "17", pt: "Deapegando", en: "Letting it go / detaching", group: 1 },
  { id: "18", pt: "Bate-papo", en: "Chat / Q&A / casual talk", group: 1 },
  { id: "19", pt: "Encanador", en: "Plumber", group: 1 },
  { id: "20", pt: "Macho", en: "Male (as opposed to female)", group: 1 },
  { id: "21", pt: "Fêmea", en: "Female", group: 1 },
  { id: "22", pt: "Gavetas", en: "Drawers (furniture)", group: 1 },
  { id: "23", pt: "Gravar", en: "To record / to engrave", group: 1 },
  { id: "24", pt: "Gorjeta", en: "Tip (gratuity)", group: 1 },
  { id: "25", pt: "Aperta de mão", en: "Handshake", group: 1 },
  { id: "26", pt: "Pesadelo", en: "Nightmare", group: 1 },
  { id: "27", pt: "Apertar", en: "To tighten / to press / to click", group: 1 },
  { id: "28", pt: "Magoado", en: "Hurt", group: 2 },
  { id: "29", pt: "Desafiar", en: "To challenge / to defy", group: 2 },
  { id: "30", pt: "Prejudicar", en: "To harm / to damage / to jeopardize", group: 2 },
  { id: "31", pt: "Desabafar", en: "To vent / to open up / to let off steam", group: 2 },
  { id: "32", pt: "Apreciar", en: "To appreciate / to enjoy / to esteem", group: 2 },
  { id: "33", pt: "Enxergar", en: "To see / to perceive / to distinguish visually", group: 2 },
  { id: "34", pt: "Lidar", en: "To deal with / to cope with / to handle", group: 2 },
  { id: "35", pt: "Picar", en: "To chop / to sting / to stink", group: 2 },
  { id: "36", pt: "Desempenho", en: "Performance / throughput", group: 2 },
  { id: "37", pt: "Comprovar", en: "To prove / to verify / to confirm", group: 2 },
  { id: "38", pt: "Abordar", en: "To approach / to address / to tackle", group: 2 },
  { id: "39", pt: "A queda", en: "The drop / the fall", group: 2 },
  { id: "40", pt: "Surgir", en: "To arise / to appear / to emerge", group: 2 },
];

const getNextReview = (box) => Date.now() + Math.pow(2, box) * 60000;
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const BOX_COLORS = ["#8a9bae", "#d4940a", "#c06420", "#3a7fdc", "#7c5ce0", "#1a9d56"];
const BOX_LABELS = ["New", "Lv 1", "Lv 2", "Lv 3", "Lv 4", "Mastered"];

export default function App() {
  // Progress stored locally: { [id]: { box, reviews, correct, wrong, nextReview } }
  const [progress, setProgress] = useState({});
  const [view, setView] = useState("home");
  const [loading, setLoading] = useState(true);

  // Adding words
  const [newPt, setNewPt] = useState("");
  const [newEn, setNewEn] = useState("");
  const [newGroup, setNewGroup] = useState(1);
  const [extraWords, setExtraWords] = useState([]); // words added via UI this session
  const [justAdded, setJustAdded] = useState(false);

  // Group creation
  const [newGroupNum, setNewGroupNum] = useState("");
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [customGroups, setCustomGroups] = useState([]);

  // Study
  const [session, setSession] = useState([]);
  const [sIdx, setSIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dir, setDir] = useState("pt");
  const [feedback, setFeedback] = useState(null);
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });
  const [studyGroup, setStudyGroup] = useState(null);
  const [studyDir, setStudyDir] = useState("random"); // "pt", "en", "random"
  const [pendingGroup, setPendingGroup] = useState(null);

  // List
  const [listFilter, setListFilter] = useState("All");
  const [editId, setEditId] = useState(null);
  const [editPt, setEditPt] = useState("");
  const [editEn, setEditEn] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Load progress from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.progress) setProgress(data.progress);
        if (data.extraWords) setExtraWords(data.extraWords);
        if (data.customGroups) setCustomGroups(data.customGroups);
      }
    } catch {}
    setLoading(false);
  }, []);

  const saveProgress = useCallback((p, extra, groups) => {
    const np = p !== undefined ? p : progress;
    const ne = extra !== undefined ? extra : extraWords;
    const ng = groups !== undefined ? groups : customGroups;
    if (p !== undefined) setProgress(np);
    if (extra !== undefined) setExtraWords(ne);
    if (groups !== undefined) setCustomGroups(ng);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ progress: np, extraWords: ne, customGroups: ng }));
    } catch {}
  }, [progress, extraWords, customGroups]);

  // All words = master + extra added via UI
  const allWords = [...MASTER_WORDS, ...extraWords];

  // Merge word with its progress
  const getCard = useCallback((word) => ({
    ...word,
    box: progress[word.id]?.box ?? 0,
    reviews: progress[word.id]?.reviews ?? 0,
    correct: progress[word.id]?.correct ?? 0,
    wrong: progress[word.id]?.wrong ?? 0,
    nextReview: progress[word.id]?.nextReview ?? 0,
  }), [progress]);

  const cards = allWords.map(getCard);

  // All groups
  const allGroupNums = [...new Set([...cards.map(c => c.group), ...customGroups])].sort((a, b) => a - b);
  const maxGroup = allGroupNums.length > 0 ? Math.max(...allGroupNums) : 1;

  const groupStats = (g) => {
    const pool = g === "All" ? cards : cards.filter(c => c.group === g);
    const m = pool.filter(c => c.box >= 4).length;
    return { total: pool.length, mastered: m, pct: pool.length ? Math.round((m / pool.length) * 100) : 0 };
  };

  // Add word via UI
  const addWord = useCallback(() => {
    if (!newPt.trim() || !newEn.trim()) return;
    const word = {
      id: `u-${Date.now()}`,
      pt: newPt.trim(),
      en: newEn.trim(),
      group: newGroup,
    };
    const updated = [...extraWords, word];
    saveProgress(undefined, updated, undefined);
    setNewPt(""); setNewEn("");
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  }, [newPt, newEn, newGroup, extraWords, saveProgress]);

  // Add new group
  const addGroup = useCallback(() => {
    const num = parseInt(newGroupNum);
    if (!num || num < 1 || allGroupNums.includes(num)) return;
    const updated = [...customGroups, num].sort((a, b) => a - b);
    saveProgress(undefined, undefined, updated);
    setNewGroup(num);
    setNewGroupNum("");
    setShowGroupInput(false);
  }, [newGroupNum, allGroupNums, customGroups, saveProgress]);

  // Delete extra word
  const deleteWord = useCallback((id) => {
    if (MASTER_WORDS.find(w => w.id === id)) return; // can't delete master words
    const updated = extraWords.filter(w => w.id !== id);
    saveProgress(undefined, updated, undefined);
    setDeleteConfirm(null);
  }, [extraWords, saveProgress]);

  const pickDir = useCallback((d) => d === "random" ? (Math.random() < 0.5 ? "pt" : "en") : d, []);

  // Study — groupNum is the group, direction overrides studyDir if passed
  const startStudy = useCallback((groupNum, direction) => {
    const pool = groupNum === "All" ? cards : cards.filter(c => c.group === groupNum);
    if (!pool.length) return;
    const chosenDir = direction || studyDir;
    const now = Date.now();
    const sorted = [...pool].sort((a, b) => {
      const ad = a.nextReview <= now ? 0 : 1;
      const bd = b.nextReview <= now ? 0 : 1;
      if (ad !== bd) return ad - bd;
      return a.box - b.box;
    });
    const s = shuffle(sorted.slice(0, Math.min(10, sorted.length)));
    setSession(s); setSIdx(0); setStudyGroup(groupNum);
    setFlipped(false); setFeedback(null);
    setDir(chosenDir === "random" ? (Math.random() < 0.5 ? "pt" : "en") : chosenDir);
    setStats({ correct: 0, wrong: 0 });
    setPendingGroup(null);
    setView("study");
  }, [cards, studyDir]);

  const answer = useCallback((ok) => {
    const card = session[sIdx];
    if (!card || feedback) return;
    setFeedback(ok ? "correct" : "wrong");
    const cur = progress[card.id] ?? { box: 0, reviews: 0, correct: 0, wrong: 0, nextReview: 0 };
    const newBox = ok ? Math.min(cur.box + 1, 5) : Math.max(cur.box - 1, 0);
    const updated = {
      ...progress,
      [card.id]: {
        box: newBox,
        reviews: cur.reviews + 1,
        correct: cur.correct + (ok ? 1 : 0),
        wrong: cur.wrong + (ok ? 0 : 1),
        nextReview: getNextReview(newBox),
      },
    };
    saveProgress(updated, undefined, undefined);
    setStats(s => ({ correct: s.correct + (ok ? 1 : 0), wrong: s.wrong + (ok ? 0 : 1) }));
  }, [session, sIdx, feedback, progress, saveProgress]);

  const nextCard = useCallback(() => {
    const next = sIdx + 1;
    if (next >= session.length) { setView("results"); return; }
    setSIdx(next); setFlipped(false); setFeedback(null);
    setDir(studyDir === "random" ? (Math.random() < 0.5 ? "pt" : "en") : studyDir);
  }, [sIdx, session, studyDir]);

  const current = session[sIdx] ? getCard(session[sIdx]) : null;
  const mastered = cards.filter(c => c.box >= 4).length;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f8faf9" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1a9d56" }} />
    </div>
  );

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Source+Sans+3:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px);} to {opacity:1;transform:translateY(0);} }
        @keyframes popIn { from {opacity:0;transform:scale(0.9);} to {opacity:1;transform:scale(1);} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(26,157,86,.3);}50%{box-shadow:0 0 0 10px rgba(26,157,86,0);} }
        input:focus { outline:none; border-color:#1a9d56!important; box-shadow:0 0 0 3px rgba(26,157,86,.12)!important; }
        button { font-family:'Source Sans 3',sans-serif; }
        button:active { transform:scale(.97); }
      `}</style>

      <nav style={S.nav}>
        <button onClick={() => { setView("home"); setEditId(null); setDeleteConfirm(null); }} style={S.logoBtn}>
          <span style={{ fontSize: 20 }}>🇧🇷</span>
          <span style={S.logoTxt}>Cartões</span>
        </button>
        {!["home","results"].includes(view) && (
          <button onClick={() => { setView("home"); setEditId(null); }} style={S.navBack}>← Back</button>
        )}
      </nav>

      <div style={S.content}>

        {/* HOME */}
        {view === "home" && (
          <div style={{ animation: "fadeUp .4s ease" }}>
            <div style={S.hero}>
              <h1 style={S.heroTitle}>Aprenda<br/>Português</h1>
              <p style={S.heroSub}>{cards.length} words · {allGroupNums.length} group{allGroupNums.length !== 1 ? "s" : ""} · {mastered} mastered</p>
            </div>

            <div style={S.grid}>
              <button onClick={() => setView("pickGroup")} style={{ ...S.tile, ...S.tileStudy }}>
                <span style={S.tileIcon}>📖</span>
                <span style={S.tileName}>Study</span>
                <span style={S.tileHint}>Pick a group</span>
              </button>
              <button onClick={() => setView("add")} style={{ ...S.tile, ...S.tileAdd }}>
                <span style={S.tileIcon}>✏️</span>
                <span style={S.tileName}>Add Word</span>
                <span style={S.tileHint}>New vocabulary</span>
              </button>
              <button onClick={() => setView("list")} style={{ ...S.tile, ...S.tileList }}>
                <span style={S.tileIcon}>📋</span>
                <span style={S.tileName}>Word List</span>
                <span style={S.tileHint}>{cards.length} words</span>
              </button>
            </div>

            {/* Groups */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={S.sectionLabel}>Groups</span>
                <button onClick={() => setShowGroupInput(!showGroupInput)} style={S.addGroupBtn}>+ New Group</button>
              </div>

              {showGroupInput && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12, animation: "fadeUp .2s ease" }}>
                  <input type="number" value={newGroupNum} onChange={e => setNewGroupNum(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addGroup()}
                    placeholder="Group number (e.g. 2)" style={{ ...S.input, flex: 1, padding: "9px 12px", fontSize: 14 }} autoFocus />
                  <button onClick={addGroup} disabled={!newGroupNum} style={{ ...S.miniGreen, opacity: newGroupNum ? 1 : 0.4 }}>Add</button>
                  <button onClick={() => { setShowGroupInput(false); setNewGroupNum(""); }} style={S.miniGray}>✗</button>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {allGroupNums.map(g => {
                  const gs = groupStats(g);
                  return (
                    <div key={g} style={S.groupCard}>
                      <div style={S.groupNum}>{g}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, color: "#1e2e26", fontSize: 15 }}>Group {g}</span>
                          <span style={{ fontSize: 12, color: "#8a9b92" }}>{gs.total} word{gs.total !== 1 ? "s" : ""}</span>
                          {gs.pct === 100 && gs.total > 0 && <span style={{ fontSize: 11, color: "#1a9d56", fontWeight: 700 }}>✓ Done</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(0,0,0,.06)", maxWidth: 140 }}>
                            <div style={{ height: "100%", borderRadius: 2, background: gs.pct === 100 ? "#1a9d56" : "#3a7fdc", width: `${gs.pct}%`, transition: "width .3s" }} />
                          </div>
                          <span style={{ fontSize: 11, color: gs.pct === 100 ? "#1a9d56" : "#8a9b92", fontWeight: 600 }}>{gs.pct}%</span>
                        </div>
                      </div>
                      {gs.total > 0 && (
                        <button onClick={() => { setPendingGroup(g); setView("pickGroup"); }} style={S.studySmallBtn}>Study</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={S.progressWrap}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={S.progLabel}>Overall Mastery</span>
                <span style={S.progPct}>{cards.length ? Math.round((mastered / cards.length) * 100) : 0}%</span>
              </div>
              <div style={S.progTrack}>
                <div style={{ ...S.progFill, width: `${cards.length ? (mastered / cards.length) * 100 : 0}%` }} />
              </div>
              <div style={S.boxGrid}>
                {[0,1,2,3,4,5].map(b => (
                  <div key={b} style={S.boxItem}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: BOX_COLORS[b] }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1e2e26" }}>{cards.filter(c => c.box === b).length}</span>
                    <span style={{ fontSize: 10, color: "#8a9b92" }}>{BOX_LABELS[b]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PICK GROUP */}
        {view === "pickGroup" && !pendingGroup && (
          <div style={{ animation: "fadeUp .35s ease", maxWidth: 440, margin: "0 auto" }}>
            <h2 style={S.secTitle}>Choose a Group</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => setPendingGroup("All")} style={S.groupPickBtn}>
                <div>
                  <span style={{ fontWeight: 700, color: "#1e2e26" }}>All Words</span>
                  <span style={{ fontSize: 12, color: "#8a9b92", marginLeft: 8 }}>{cards.length} cards</span>
                </div>
                <span style={{ fontSize: 18, color: "#8a9b92" }}>→</span>
              </button>
              {allGroupNums.map(g => {
                const gs = groupStats(g);
                return (
                  <button key={g} onClick={() => setPendingGroup(g)} style={S.groupPickBtn}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={S.groupNum}>{g}</div>
                      <div>
                        <span style={{ fontWeight: 700, color: "#1e2e26" }}>Group {g}</span>
                        <span style={{ fontSize: 12, color: "#8a9b92", marginLeft: 8 }}>{gs.total} cards · {gs.pct}% mastered</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 18, color: "#8a9b92" }}>→</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* PICK DIRECTION */}
        {view === "pickGroup" && pendingGroup && (
          <div style={{ animation: "fadeUp .3s ease", maxWidth: 440, margin: "0 auto" }}>
            <button onClick={() => setPendingGroup(null)} style={{ ...S.navBack, marginBottom: 20 }}>← Back</button>
            <h2 style={S.secTitle}>Study Direction</h2>
            <p style={{ fontSize: 14, color: "#8a9b92", marginBottom: 20, marginTop: -16 }}>
              {pendingGroup === "All" ? "All Words" : `Group ${pendingGroup}`}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { value: "pt", label: "🇧🇷  Portuguese → English", hint: "See the Portuguese word, guess the English" },
                { value: "en", label: "🇬🇧  English → Portuguese", hint: "See the English word, guess the Portuguese" },
                { value: "random", label: "🔀  Random", hint: "Mix of both directions" },
              ].map(opt => (
                <button key={opt.value} onClick={() => { setStudyDir(opt.value); startStudy(pendingGroup, opt.value); }}
                  style={{
                    ...S.groupPickBtn,
                    flexDirection: "column", alignItems: "flex-start", gap: 4,
                    borderColor: studyDir === opt.value ? "#1a9d56" : "rgba(0,0,0,.06)",
                    background: studyDir === opt.value ? "rgba(26,157,86,.04)" : "#fff",
                  }}>
                  <span style={{ fontWeight: 700, color: "#1e2e26", fontSize: 15 }}>{opt.label}</span>
                  <span style={{ fontSize: 12, color: "#8a9b92" }}>{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ADD */}
        {view === "add" && (
          <div style={{ animation: "fadeUp .35s ease", maxWidth: 420, margin: "0 auto" }}>
            <h2 style={S.secTitle}>Add New Word</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Group</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {allGroupNums.map(g => (
                  <button key={g} onClick={() => setNewGroup(g)} style={{
                    width: 44, height: 44, borderRadius: 10, fontSize: 16, fontWeight: 700,
                    border: newGroup === g ? "2px solid #1a9d56" : "1px solid rgba(0,0,0,.1)",
                    background: newGroup === g ? "rgba(26,157,86,.06)" : "#fff",
                    color: newGroup === g ? "#1a9d56" : "#3a4a42",
                    cursor: "pointer", transition: "all .15s",
                  }}>{g}</button>
                ))}
                <button onClick={() => setView("home")} style={{ ...S.miniGray, height: 44, padding: "0 12px", fontSize: 12 }}>
                  + New Group
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Português</label>
              <input value={newPt} onChange={e => setNewPt(e.target.value)}
                onKeyDown={e => e.key === "Enter" && document.getElementById("en-inp")?.focus()}
                placeholder="e.g. saudade" style={S.input} autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>English</label>
              <input id="en-inp" value={newEn} onChange={e => setNewEn(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addWord()}
                placeholder="e.g. longing, nostalgia" style={S.input} />
            </div>
            <button onClick={addWord} disabled={!newPt.trim() || !newEn.trim()}
              style={{ ...S.primaryBtn, opacity: (!newPt.trim() || !newEn.trim()) ? .35 : 1,
                ...(justAdded ? { animation: "pulse .6s ease" } : {}) }}>
              {justAdded ? "✓ Added!" : "Add Card"}
            </button>
            <p style={{ fontSize: 12, color: "#8a9b92", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
              Words you add here are saved on this device.<br/>For a permanent list, send words to Claude in chat.
            </p>
          </div>
        )}

        {/* STUDY */}
        {view === "study" && current && (
          <div style={{ animation: "fadeUp .35s ease", maxWidth: 440, margin: "0 auto", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#8a9b92", minWidth: 40 }}>{sIdx + 1}/{session.length}</span>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(0,0,0,.06)" }}>
                <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#1a9d56,#15803d)", width: `${((sIdx + 1) / session.length) * 100}%`, transition: "width .3s" }} />
              </div>
            </div>
            <div style={{ marginBottom: 6, fontSize: 12, color: "#3a7fdc", fontWeight: 700 }}>Group {current.group}</div>
            <div style={{ marginBottom: 20, fontSize: 18, color: "#8a9b92" }}>
              {dir === "pt" ? "🇧🇷  →  🇬🇧" : "🇬🇧  →  🇧🇷"}
            </div>
            <div onClick={() => !feedback && !flipped && setFlipped(true)} style={{
              ...S.card,
              ...(feedback === "correct" ? { borderColor: "#1a9d56", boxShadow: "0 0 30px rgba(26,157,86,.08)" } : {}),
              ...(feedback === "wrong" ? { borderColor: "#dc2626", boxShadow: "0 0 30px rgba(220,38,38,.08)" } : {}),
              cursor: flipped || feedback ? "default" : "pointer",
              animation: "popIn .3s ease",
            }}>
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#8a9b92", fontWeight: 600 }}>
                {dir === "pt" ? "Português" : "English"}
              </span>
              <span style={S.cardWord}>{dir === "pt" ? current.pt : current.en}</span>
              {flipped && (
                <>
                  <div style={{ width: 40, height: 1, background: "rgba(0,0,0,.08)", margin: "16px auto" }} />
                  <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#8a9b92", fontWeight: 600 }}>
                    {dir === "pt" ? "English" : "Português"}
                  </span>
                  <span style={S.cardAnswer}>{dir === "pt" ? current.en : current.pt}</span>
                </>
              )}
              {!flipped && !feedback && <span style={{ fontSize: 12, color: "#bcc5c0", marginTop: 20 }}>Tap to reveal</span>}
            </div>
            {flipped && !feedback && (
              <div style={{ display: "flex", gap: 12, marginTop: 20, animation: "fadeUp .25s ease" }}>
                <button onClick={() => answer(false)} style={S.wrongBtn}>✗ Wrong</button>
                <button onClick={() => answer(true)} style={S.correctBtn}>✓ Correct</button>
              </div>
            )}
            {feedback && (
              <button onClick={nextCard} style={{ ...S.primaryBtn, marginTop: 20 }}>
                {sIdx + 1 >= session.length ? "See Results →" : "Next Card →"}
              </button>
            )}
          </div>
        )}

        {/* RESULTS */}
        {view === "results" && (
          <div style={{ animation: "popIn .4s ease", textAlign: "center", maxWidth: 380, margin: "0 auto", paddingTop: 30 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>{stats.correct >= stats.wrong ? "🎉" : "💪"}</div>
            <h2 style={{ ...S.secTitle, textAlign: "center" }}>Session Complete</h2>
            {studyGroup !== null && (
              <p style={{ fontSize: 14, color: "#8a9b92", marginTop: -16, marginBottom: 20 }}>
                {studyGroup === "All" ? "All Words" : `Group ${studyGroup}`}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "center", gap: 40, margin: "30px 0" }}>
              <div>
                <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "'Playfair Display',serif", color: "#1a9d56" }}>{stats.correct}</div>
                <div style={{ fontSize: 13, color: "#8a9b92", fontWeight: 600 }}>Correct</div>
              </div>
              <div style={{ width: 1, background: "rgba(0,0,0,.08)" }} />
              <div>
                <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "'Playfair Display',serif", color: "#dc2626" }}>{stats.wrong}</div>
                <div style={{ fontSize: 13, color: "#8a9b92", fontWeight: 600 }}>Wrong</div>
              </div>
            </div>
            <button onClick={() => startStudy(studyGroup, studyDir)} style={{ ...S.primaryBtn, marginBottom: 12 }}>Study Again</button>
            <button onClick={() => { setPendingGroup(null); setView("pickGroup"); }} style={{ ...S.ghostBtn, marginBottom: 12 }}>Different Group</button>
            <button onClick={() => setView("home")} style={S.ghostBtn}>Home</button>
          </div>
        )}

        {/* LIST */}
        {view === "list" && (
          <div style={{ animation: "fadeUp .35s ease" }}>
            <h2 style={S.secTitle}>Your Words <span style={S.badge}>{cards.length}</span></h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {["All", ...allGroupNums].map(g => (
                <button key={g} onClick={() => setListFilter(g)} style={{
                  padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: listFilter === g ? "1.5px solid #1a9d56" : "1px solid rgba(0,0,0,.08)",
                  background: listFilter === g ? "rgba(26,157,86,.06)" : "#fff",
                  color: listFilter === g ? "#1a9d56" : "#6b7c72", transition: "all .2s",
                }}>
                  {g === "All" ? "All" : `Group ${g}`}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {cards.filter(c => listFilter === "All" || c.group === listFilter).sort((a, b) => a.pt.localeCompare(b.pt)).map(card => (
                <div key={card.id} style={S.listItem}>
                  {editId === card.id ? (
                    <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap", alignItems: "center" }}>
                      <input value={editPt} onChange={e => setEditPt(e.target.value)} style={{ ...S.input, flex: 1, minWidth: 100, padding: "8px 10px", fontSize: 14 }} />
                      <input value={editEn} onChange={e => setEditEn(e.target.value)} style={{ ...S.input, flex: 1, minWidth: 100, padding: "8px 10px", fontSize: 14 }}
                        onKeyDown={e => e.key === "Enter" && saveEdit()} />
                      <button onClick={() => {
                        const updated = extraWords.map(w => w.id === editId ? { ...w, pt: editPt.trim(), en: editEn.trim() } : w);
                        saveProgress(undefined, updated, undefined);
                        setEditId(null);
                      }} style={S.miniGreen}>✓</button>
                      <button onClick={() => setEditId(null)} style={S.miniGray}>✗</button>
                    </div>
                  ) : deleteConfirm === card.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                      <span style={{ fontSize: 13, color: "#5a6b62" }}>Delete <strong>{card.pt}</strong>?</span>
                      <button onClick={() => deleteWord(card.id)} style={{ ...S.miniGreen, background: "rgba(220,38,38,.1)", color: "#dc2626" }}>Yes</button>
                      <button onClick={() => setDeleteConfirm(null)} style={S.miniGray}>No</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, color: "#1e2e26" }}>{card.pt}</span>
                          <span style={{ opacity: .3 }}>→</span>
                          <span style={{ color: "#5a6b62" }}>{card.en}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(58,127,220,.08)", color: "#3a7fdc" }}>G{card.group}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: BOX_COLORS[card.box] + "20", color: BOX_COLORS[card.box] }}>{BOX_LABELS[card.box]}</span>
                          {card.reviews > 0 && <span style={{ fontSize: 11, color: "#aab5ae" }}>{card.correct}/{card.reviews}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {!MASTER_WORDS.find(w => w.id === card.id) && (
                          <>
                            <button onClick={() => { setEditId(card.id); setEditPt(card.pt); setEditEn(card.en); }} style={S.iconBtn}>✎</button>
                            <button onClick={() => setDeleteConfirm(card.id)} style={{ ...S.iconBtn, color: "#dc2626" }}>×</button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", background: "linear-gradient(165deg,#f8faf9 0%,#eef5f0 50%,#f5f9f7 100%)", color: "#3a4a42", fontFamily: "'Source Sans 3',sans-serif" },
  nav: { position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(20px)", background: "rgba(248,250,249,.9)", borderBottom: "1px solid rgba(0,0,0,.06)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px" },
  logoBtn: { display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0 },
  logoTxt: { fontSize: 19, fontWeight: 900, color: "#1a9d56", fontFamily: "'Playfair Display',serif", letterSpacing: "-0.3px" },
  navBack: { background: "rgba(0,0,0,.04)", border: "1px solid rgba(0,0,0,.08)", color: "#6b7c72", fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer" },
  content: { padding: "24px 20px 60px", maxWidth: 540, margin: "0 auto" },
  hero: { marginBottom: 32 },
  heroTitle: { fontFamily: "'Playfair Display',serif", fontSize: 42, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-1px", marginBottom: 10, background: "linear-gradient(135deg,#1e2e26 0%,#1a9d56 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  heroSub: { fontSize: 15, color: "#5a6b62", lineHeight: 1.5 },
  sectionLabel: { fontSize: 13, fontWeight: 700, color: "#5a6b62", textTransform: "uppercase", letterSpacing: 1 },
  addGroupBtn: { background: "none", border: "1px solid rgba(26,157,86,.25)", color: "#1a9d56", fontSize: 13, fontWeight: 700, padding: "5px 12px", borderRadius: 8, cursor: "pointer" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 28 },
  tile: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "22px 10px 18px", borderRadius: 14, border: "1px solid rgba(0,0,0,.06)", cursor: "pointer", transition: "all .2s", background: "#fff" },
  tileStudy: { background: "#f0faf4", borderColor: "rgba(26,157,86,.2)" },
  tileAdd: { background: "#fef9f0", borderColor: "rgba(210,140,40,.18)" },
  tileList: { background: "#f0f5ff", borderColor: "rgba(60,130,240,.18)" },
  tileIcon: { fontSize: 26 },
  tileName: { fontSize: 14, fontWeight: 700, color: "#1e2e26" },
  tileHint: { fontSize: 11, color: "#8a9b92" },
  groupCard: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid rgba(0,0,0,.04)" },
  groupNum: { width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(58,127,220,.08)", color: "#3a7fdc", fontWeight: 900, fontSize: 15, flexShrink: 0 },
  groupPickBtn: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderRadius: 12, background: "#fff", border: "1px solid rgba(0,0,0,.06)", cursor: "pointer", transition: "all .2s", textAlign: "left", width: "100%" },
  studySmallBtn: { padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: "1px solid rgba(26,157,86,.2)", cursor: "pointer", background: "rgba(26,157,86,.06)", color: "#1a9d56" },
  progressWrap: { background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,.06)", padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,.04)" },
  progLabel: { fontSize: 13, fontWeight: 700, color: "#6b7c72" },
  progPct: { fontSize: 13, fontWeight: 700, color: "#1a9d56" },
  progTrack: { height: 5, borderRadius: 3, background: "rgba(0,0,0,.06)", marginBottom: 14 },
  progFill: { height: "100%", borderRadius: 3, background: "linear-gradient(90deg,#1a9d56,#15803d)", transition: "width .4s" },
  boxGrid: { display: "flex", justifyContent: "space-between" },
  boxItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 36 },
  secTitle: { fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 900, color: "#1e2e26", marginBottom: 24, letterSpacing: "-0.5px" },
  label: { display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#8a9b92", marginBottom: 6 },
  input: { width: "100%", padding: "12px 14px", fontSize: 16, borderRadius: 10, border: "1px solid rgba(0,0,0,.12)", background: "#fff", color: "#1e2e26", fontFamily: "'Source Sans 3',sans-serif", transition: "all .2s" },
  primaryBtn: { width: "100%", padding: "14px 20px", fontSize: 15, fontWeight: 700, background: "linear-gradient(135deg,#1a9d56,#15803d)", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", transition: "all .2s" },
  ghostBtn: { width: "100%", padding: "12px 20px", fontSize: 14, fontWeight: 600, background: "transparent", color: "#6b7c72", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, cursor: "pointer" },
  chip: { fontSize: 12, padding: "4px 10px", borderRadius: 20, background: "rgba(0,0,0,.03)", border: "1px solid rgba(0,0,0,.06)", color: "#5a6b62" },
  card: { padding: "40px 28px", borderRadius: 20, background: "#fff", border: "1.5px solid rgba(0,0,0,.08)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "all .3s", minHeight: 200, justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,.04)" },
  cardWord: { fontFamily: "'Playfair Display',serif", fontSize: 32, fontWeight: 900, color: "#1e2e26", marginTop: 4 },
  cardAnswer: { fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 700, color: "#1a9d56", marginTop: 4 },
  wrongBtn: { flex: 1, padding: "14px", fontSize: 15, fontWeight: 700, background: "rgba(220,38,38,.06)", color: "#dc2626", border: "1px solid rgba(220,38,38,.15)", borderRadius: 12, cursor: "pointer" },
  correctBtn: { flex: 1, padding: "14px", fontSize: 15, fontWeight: 700, background: "rgba(26,157,86,.06)", color: "#1a9d56", border: "1px solid rgba(26,157,86,.15)", borderRadius: 12, cursor: "pointer" },
  badge: { fontSize: 13, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: "rgba(26,157,86,.1)", color: "#1a9d56", marginLeft: 8, verticalAlign: "middle" },
  listItem: { display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, background: "#fff", border: "1px solid rgba(0,0,0,.05)" },
  iconBtn: { background: "none", border: "none", color: "#6b7c72", fontSize: 18, cursor: "pointer", padding: "4px 6px", borderRadius: 6, opacity: .5 },
  miniGreen: { background: "rgba(26,157,86,.1)", color: "#1a9d56", border: "none", fontSize: 14, fontWeight: 700, padding: "6px 12px", borderRadius: 8, cursor: "pointer" },
  miniGray: { background: "rgba(0,0,0,.05)", color: "#6b7c72", border: "none", fontSize: 14, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer" },
};
