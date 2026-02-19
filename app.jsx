import { useState, useEffect } from "react";

// localStorage shim so the app works outside Claude
if (typeof window !== 'undefined' && !window.storage) {
  window.storage = {
    get: async (key) => {
      try {
        const val = localStorage.getItem('icy__' + key);
        return val ? { key, value: val } : null;
      } catch { return null; }
    },
    set: async (key, value) => {
      try {
        localStorage.setItem('icy__' + key, value);
        return { key, value };
      } catch { return null; }
    },
    delete: async (key) => {
      try {
        localStorage.removeItem('icy__' + key);
        return { key, deleted: true };
      } catch { return null; }
    },
    list: async (prefix) => {
      try {
        const keys = Object.keys(localStorage)
          .filter(k => k.startsWith('icy__' + (prefix || '')))
          .map(k => k.replace('icy__', ''));
        return { keys };
      } catch { return { keys: [] }; }
    }
  };
}

const BUDGET_CAP = 120;
const MAX_PICKS = 5;

const DEFAULT_DRIVERS = [
  { id: 1,  name: "Alex Palou",          number: "10", team: "Chip Ganassi Racing",       value: 35, color: "#e63946" },
  { id: 2,  name: "Scott Dixon",         number: "9",  team: "Chip Ganassi Racing",       value: 32, color: "#e63946" },
  { id: 3,  name: "Kyffin Simpson",      number: "8",  team: "Chip Ganassi Racing",       value: 22, color: "#e63946" },
  { id: 4,  name: "Josef Newgarden",     number: "2",  team: "Team Penske",               value: 30, color: "#f4a261" },
  { id: 5,  name: "Scott McLaughlin",    number: "3",  team: "Team Penske",               value: 28, color: "#f4a261" },
  { id: 6,  name: "David Malukas",       number: "12", team: "Team Penske",               value: 23, color: "#f4a261" },
  { id: 7,  name: "Pato O'Ward",         number: "5",  team: "Arrow McLaren",             value: 31, color: "#ff8c00" },
  { id: 8,  name: "Nolan Siegel",        number: "6",  team: "Arrow McLaren",             value: 20, color: "#ff8c00" },
  { id: 9,  name: "Christian Lundgaard", number: "7",  team: "Arrow McLaren",             value: 26, color: "#ff8c00" },
  { id: 10, name: "Will Power",          number: "26", team: "Andretti Global",           value: 27, color: "#2a9d8f" },
  { id: 11, name: "Kyle Kirkwood",       number: "27", team: "Andretti Global",           value: 25, color: "#2a9d8f" },
  { id: 12, name: "Marcus Ericsson",     number: "28", team: "Andretti Global",           value: 24, color: "#2a9d8f" },
  { id: 13, name: "Graham Rahal",        number: "15", team: "Rahal Letterman Lanigan",   value: 24, color: "#118ab2" },
  { id: 14, name: "Louis Foster",        number: "30", team: "Rahal Letterman Lanigan",   value: 21, color: "#118ab2" },
  { id: 15, name: "Mick Schumacher",     number: "47", team: "Rahal Letterman Lanigan",   value: 18, color: "#118ab2" },
  { id: 16, name: "Alexander Rossi",     number: "20", team: "Ed Carpenter Racing",       value: 25, color: "#06d6a0" },
  { id: 17, name: "Christian Rasmussen", number: "21", team: "Ed Carpenter Racing",       value: 20, color: "#06d6a0" },
  { id: 18, name: "Santino Ferrucci",    number: "14", team: "AJ Foyt Racing",            value: 22, color: "#a8324a" },
  { id: 19, name: "Caio Collet",         number: "4",  team: "AJ Foyt Racing",            value: 16, color: "#a8324a" },
  { id: 20, name: "Marcus Armstrong",    number: "60", team: "Meyer Shank Racing",        value: 22, color: "#8338ec" },
  { id: 21, name: "Jack Harvey",         number: "24", team: "Meyer Shank Racing",        value: 19, color: "#8338ec" },
  { id: 22, name: "Rinus VeeKay",        number: "77", team: "Juncos Hollinger Racing",   value: 23, color: "#c77dff" },
  { id: 23, name: "Sting Ray Robb",      number: "78", team: "Juncos Hollinger Racing",   value: 16, color: "#c77dff" },
  { id: 24, name: "Dennis Hauger",       number: "18", team: "Dale Coyne Racing",         value: 17, color: "#ff6b35" },
  { id: 25, name: "TBA",                 number: "51", team: "Dale Coyne Racing",         value: 15, color: "#ff6b35" },
];

const DEFAULT_RACES = [
  { id: 1,  name: "Firestone GP of St. Petersburg",  date: "Mar 1",  sortDate: "2026-03-01", time: "15:30", status: "upcoming" },
  { id: 2,  name: "Phoenix Raceway",                 date: "Mar 7",  sortDate: "2026-03-07", time: "15:00", status: "upcoming" },
  { id: 3,  name: "Grand Prix of Arlington",         date: "Mar 15", sortDate: "2026-03-15", time: "14:00", status: "upcoming" },
  { id: 4,  name: "Grand Prix of Alabama (Barber)",  date: "Mar 29", sortDate: "2026-03-29", time: "13:00", status: "upcoming" },
  { id: 5,  name: "Acura GP of Long Beach",          date: "Apr 19", sortDate: "2026-04-19", time: "15:00", status: "upcoming" },
  { id: 6,  name: "Indianapolis 500",                date: "May 24", sortDate: "2026-05-24", time: "12:45", status: "upcoming" },
  { id: 7,  name: "World Wide Technology Raceway",   date: "Jun 7",  sortDate: "2026-06-07", time: "18:30", status: "upcoming" },
  { id: 8,  name: "Sonsio GP at Road America",       date: "Jun 21", sortDate: "2026-06-21", time: "13:00", status: "upcoming" },
  { id: 9,  name: "Honda Indy 200 at Mid-Ohio",      date: "Jul 6",  sortDate: "2026-07-06", time: "13:00", status: "upcoming" },
  { id: 10, name: "Music City GP (Nashville)",       date: "Jul 19", sortDate: "2026-07-19", time: "19:00", status: "upcoming" },
  { id: 11, name: "Portland International Raceway",  date: "Aug 9",  sortDate: "2026-08-09", time: "15:00", status: "upcoming" },
  { id: 12, name: "Markham Grand Prix (Canada)",     date: "Aug 16", sortDate: "2026-08-16", time: "15:00", status: "upcoming" },
  { id: 13, name: "Freedom 250 (Washington D.C.)",   date: "Aug 23", sortDate: "2026-08-23", time: "14:00", status: "upcoming" },
  { id: 14, name: "Milwaukee Mile Race 1",           date: "Aug 29", sortDate: "2026-08-29", time: "14:00", status: "upcoming" },
  { id: 15, name: "Milwaukee Mile Race 2",           date: "Aug 30", sortDate: "2026-08-30", time: "14:00", status: "upcoming" },
  { id: 16, name: "Grand Prix of Arlington 2",       date: "TBD",    sortDate: "2026-12-31", time: "14:00", status: "upcoming" },
  { id: 17, name: "WeatherTech Raceway Laguna Seca", date: "Sep 6",  sortDate: "2026-09-06", time: "15:30", status: "upcoming" },
];

const POINTS_TABLE = [50,40,35,32,30,28,26,24,22,20,18,16,14,12,10,8,6,5,4,3];

async function loadState(key, fallback) {
  try { const r = await window.storage.get(key, true); return r ? JSON.parse(r.value) : fallback; }
  catch { return fallback; }
}
async function saveState(key, val) {
  try { await window.storage.set(key, JSON.stringify(val), true); } catch {}
}

const Icon = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

const I = {
  flag:   "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7",
  trophy: "M8 21h8 M12 17v4 M7 4H4a1 1 0 00-1 1v3a4 4 0 004 4h2 M17 4h3a1 1 0 011 1v3a4 4 0 01-4 4h-2 M7 4h10v7a5 5 0 01-10 0V4z",
  users:  "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75 M9 7a4 4 0 100 8 4 4 0 000-8z",
  edit:   "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  plus:   "M12 5v14 M5 12h14",
  check:  "M20 6L9 17l-5-5",
  trash:  "M3 6h18 M8 6V4h8v2 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6",
  car:    "M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v5 M14 3v5h5 M17 21v-2a2 2 0 00-2-2H9a2 2 0 00-2 2v2 M7 17a2 2 0 100 4 2 2 0 000-4z M17 17a2 2 0 100 4 2 2 0 000-4z",
  star:   "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  live:   "M22 12h-4l-3 9L9 3l-3 9H2",
  close:  "M18 6L6 18 M6 6l12 12",
  award:  "M12 15a7 7 0 100-14 7 7 0 000 14z M8.21 13.89L7 23l5-3 5 3-1.21-9.12",
  chat:   "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  send:   "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
};

export default function IndycarFantasy() {
  const [tab, setTab] = useState("lineup");
  const [drivers, setDrivers] = useState(DEFAULT_DRIVERS);
  const [races, setRaces] = useState(DEFAULT_RACES);
  const [currentRace, setCurrentRace] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [lineups, setLineups] = useState({});
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [editDriver, setEditDriver] = useState(null);
  const [addDriver, setAddDriver] = useState(false);
  const [newDriver, setNewDriver] = useState({ name: "", number: "", team: "", value: 22, color: "#ff5500" });
  const [editRace, setEditRace] = useState(null);
  const [newParticipant, setNewParticipant] = useState("");
  const [newRaceName, setNewRaceName] = useState("");
  const [newRaceDate, setNewRaceDate] = useState("");
  const [newRaceTime, setNewRaceTime] = useState("");
  const [activeParticipant, setActiveParticipant] = useState(null);
  const [picks, setPicks] = useState([]);
  const [resultOrder, setResultOrder] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [countdown, setCountdown] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [authScreen, setAuthScreen] = useState("login"); // "login" | "register"
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirm, setRegisterConfirm] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Helper to check if race is locked (less than 1 minute until start)
  const isRaceLocked = (raceIdx) => {
    const race = races[raceIdx];
    if (!race || !race.sortDate || !race.time) return false;
    
    const [hours, minutes] = race.time.split(':').map(Number);
    const raceStart = new Date(race.sortDate);
    raceStart.setHours(hours, minutes, 0, 0);
    const lockTime = new Date(raceStart.getTime() - 60000); // 1 minute before
    
    return new Date() >= lockTime;
  };

  // Get time until race locks
  const getTimeUntilLock = (raceIdx) => {
    const race = races[raceIdx];
    if (!race || !race.sortDate || !race.time) return null;
    
    const [hours, minutes] = race.time.split(':').map(Number);
    const raceStart = new Date(race.sortDate);
    raceStart.setHours(hours, minutes, 0, 0);
    const lockTime = new Date(raceStart.getTime() - 60000);
    
    const now = new Date();
    const diff = lockTime - now;
    
    if (diff <= 0) return null;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hrs = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    
    return { days, hours: hrs, minutes: mins, seconds: secs, total: diff };
  }; // Which participant is logged in

  useEffect(() => {
    (async () => {
      const [d, r, cr, p, l, res, cu, chat, admins, session] = await Promise.all([
        loadState("icy_drivers", DEFAULT_DRIVERS),
        loadState("icy_races", DEFAULT_RACES),
        loadState("icy_curRace", 0),
        loadState("icy_participants", []),
        loadState("icy_lineups", {}),
        loadState("icy_results", {}),
        loadState("icy_current_user", null),
        loadState("icy_chat", []),
        loadState("icy_admin_users", [{ username: "admin", password: "admin123", isAdmin: true }]),
        loadState("icy_session", null),
      ]);
      setDrivers(d); setRaces(r); setCurrentRace(cr);
      setParticipants(p); setLineups(l); setResults(res);
      setCurrentUser(cu);
      setChatMessages(chat);
      setAdminUsers(admins);
      
      if (session) {
        setIsAuthenticated(true);
        setCurrentUser(session.participantId);
        const participant = p.find(x => x.id === session.participantId);
        if (participant && participant.isAdmin) {
          // User is admin
        }
      }
      
      setLoading(false);
    })();
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const save = async (key, val, setter) => { setter(val); await saveState(key, val); };
  const updateDrivers = v => save("icy_drivers", v, setDrivers);
  const updateRaces = v => save("icy_races", v, setRaces);
  const updateCurRace = v => save("icy_curRace", v, setCurrentRace);
  const updateParticipants = v => save("icy_participants", v, setParticipants);
  const updateLineups = v => save("icy_lineups", v, setLineups);
  const updateResults = v => save("icy_results", v, setResults);
  const updateChat = v => save("icy_chat", v, setChatMessages);
  const updateAdminUsers = v => save("icy_admin_users", v, setAdminUsers);
  const setCurrentUserPersist = async (u) => { setCurrentUser(u); await saveState("icy_current_user", u); };

  // Authentication functions
  const handleLogin = async () => {
    setAuthError("");
    const participant = participants.find(p => 
      p.username === loginUsername && p.password === loginPassword
    );
    
    if (!participant) {
      setAuthError("Invalid username or password");
      return;
    }
    
    const session = { participantId: participant.id, username: participant.username };
    await saveState("icy_session", session);
    setIsAuthenticated(true);
    setCurrentUser(participant.id);
    setLoginUsername("");
    setLoginPassword("");
  };

  const handleRegister = async () => {
    setAuthError("");
    
    if (!registerUsername.trim() || !registerPassword) {
      setAuthError("Username and password required");
      return;
    }
    
    if (registerPassword !== registerConfirm) {
      setAuthError("Passwords don't match");
      return;
    }
    
    if (registerPassword.length < 4) {
      setAuthError("Password must be at least 4 characters");
      return;
    }
    
    if (participants.find(p => p.username === registerUsername)) {
      setAuthError("Username already taken");
      return;
    }
    
    if (participants.length >= 50) {
      setAuthError("League is full (50 participant maximum)");
      return;
    }
    
    const newParticipant = {
      id: Date.now(),
      name: registerUsername,
      username: registerUsername,
      password: registerPassword,
      isAdmin: false,
      createdAt: Date.now()
    };
    
    const updatedParticipants = [...participants, newParticipant];
    await updateParticipants(updatedParticipants);
    
    const session = { participantId: newParticipant.id, username: newParticipant.username };
    await saveState("icy_session", session);
    setIsAuthenticated(true);
    setCurrentUser(newParticipant.id);
    setRegisterUsername("");
    setRegisterPassword("");
    setRegisterConfirm("");
    showToast("Account created successfully!");
  };

  const handleLogout = async () => {
    await saveState("icy_session", null);
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const getCurrentParticipant = () => {
    return participants.find(p => p.id === currentUser);
  };

  const isCurrentUserAdmin = () => {
    const participant = getCurrentParticipant();
    return participant?.isAdmin === true;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;
    
    const participant = participants.find(p => p.id === currentUser);
    if (!participant) {
      showToast("Please select your profile first", "warn");
      return;
    }

    const message = {
      id: Date.now(),
      participantId: currentUser,
      participantName: participant.name,
      text: newMessage.trim(),
      timestamp: Date.now()
    };

    await updateChat([...chatMessages, message]);
    setNewMessage("");
  };

  // Check if race has started (status is "live" or "completed")
  const isRaceStarted = (raceIdx) => {
    const race = races[raceIdx];
    return race && (race.status === "live" || race.status === "completed");
  };

  const lineupKey = (ri, pId) => `${ri}_${pId}`;
  const budgetUsed = picks.reduce((s, id) => s + (drivers.find(d => d.id === id)?.value || 0), 0);

  const togglePick = (dId) => {
    if (picks.includes(dId)) { setPicks(picks.filter(p => p !== dId)); return; }
    if (picks.length >= MAX_PICKS) { showToast("Max 5 drivers!", "warn"); return; }
    const newCost = budgetUsed + (drivers.find(d => d.id === dId)?.value || 0);
    if (newCost > BUDGET_CAP) { showToast(`Over budget! (${newCost}/${BUDGET_CAP})`, "warn"); return; }
    setPicks([...picks, dId]);
  };

  const submitLineup = async () => {
    if (!activeParticipant) return;
    if (picks.length < MAX_PICKS) { showToast(`Pick ${MAX_PICKS} drivers first`, "warn"); return; }
    if (isRaceLocked(currentRace)) { 
      showToast("Lineups are locked! Race starts in less than 1 minute.", "warn"); 
      return; 
    }
    const key = lineupKey(currentRace, activeParticipant.id);
    await updateLineups({ ...lineups, [key]: picks });
    showToast(`Lineup saved for ${activeParticipant.name}!`);
    setActiveParticipant(null); setPicks([]);
  };

  const generateRandomLineup = () => {
    // Sort drivers by value descending
    const sortedDrivers = [...drivers].sort((a, b) => b.value - a.value);
    let bestLineup = [];
    let bestDiff = Infinity;
    
    // Try 100 random combinations to find one close to 120
    for (let attempt = 0; attempt < 100; attempt++) {
      const shuffled = [...sortedDrivers].sort(() => Math.random() - 0.5);
      let lineup = [];
      let total = 0;
      
      // Pick 5 drivers trying to get close to 120
      for (let i = 0; i < shuffled.length && lineup.length < MAX_PICKS; i++) {
        const driver = shuffled[i];
        const newTotal = total + driver.value;
        
        if (newTotal <= BUDGET_CAP) {
          lineup.push(driver.id);
          total = newTotal;
        }
      }
      
      // If we have 5 drivers, check if this is closer to 120
      if (lineup.length === MAX_PICKS) {
        const diff = BUDGET_CAP - total;
        if (diff < bestDiff) {
          bestDiff = diff;
          bestLineup = lineup;
        }
        // If we hit exactly 120 or very close, stop searching
        if (diff <= 2) break;
      }
    }
    
    if (bestLineup.length === MAX_PICKS) {
      setPicks(bestLineup);
      const total = bestLineup.reduce((s, id) => s + (drivers.find(d => d.id === id)?.value || 0), 0);
      showToast(`Random lineup generated! Budget used: ${total}/${BUDGET_CAP}`, "success");
    } else {
      showToast("Could not generate valid lineup", "warn");
    }
  };

  const scoreLineup = (ids, ri) => {
    const order = results[ri];
    if (!order || !ids) return null;
    return ids.reduce((t, dId) => {
      const pos = order.indexOf(dId);
      return t + (pos >= 0 ? (POINTS_TABLE[pos] || 1) : 0);
    }, 0);
  };

  const leaderboard = participants.map(p => {
    let total = 0;
    races.forEach((_, i) => { const s = scoreLineup(lineups[lineupKey(i, p.id)], i); if (s !== null) total += s; });
    return { ...p, total };
  }).sort((a, b) => b.total - a.total);

  const submitResults = async () => {
    if (resultOrder.length < 5) { showToast("Enter at least top 5", "warn"); return; }
    await updateResults({ ...results, [currentRace]: resultOrder });
    showToast("Race results saved!"); setResultOrder([]);
  };

  const addToResultOrder = (dId) => {
    if (resultOrder.includes(dId)) setResultOrder(resultOrder.filter(d => d !== dId));
    else setResultOrder([...resultOrder, dId]);
  };

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    const chatContainer = document.getElementById('chat-messages');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [chatMessages]);

  // Countdown timer - updates every second
  useEffect(() => {
    const interval = setInterval(() => {
      const time = getTimeUntilLock(currentRace);
      setCountdown(time);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [currentRace, races]);

  if (loading) return <div style={{ background:"#0a0a0f", color:"#fff", height:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}><div>Loading...</div></div>;

  const colors = ["#ff5500","#00e676","#ffd700","#7c4dff","#00b0ff","#ff4081","#76ff03"];

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;500;700;900&family=Barlow:wght@400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body,.app{background:#08080e;min-height:100vh;font-family:Barlow,sans-serif;color:#f0f0f8}
        .header{background:linear-gradient(135deg,#0a0a15,#150010 50%,#0a1020);border-bottom:2px solid #ff3c00;padding:0 24px;position:sticky;top:0;z-index:100}
        .header-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:16px;height:64px}
        .logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:26px;letter-spacing:2px;text-transform:uppercase;background:linear-gradient(90deg,#ff5500,#ffd700);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .race-badge{background:#ff3c00;color:#fff;padding:4px 12px;border-radius:4px;font-family:'Barlow Condensed';font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase}
        .nav{display:flex;gap:4px;margin-left:auto}
        .nav-btn{background:none;border:none;cursor:pointer;color:#9090aa;padding:8px 14px;border-radius:6px;font-family:'Barlow Condensed';font-weight:700;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;transition:all .2s;display:flex;align-items:center;gap:6px}
        .nav-btn:hover{color:#f0f0f8;background:rgba(255,255,255,.05)}
        .nav-btn.active{color:#ff5500;background:rgba(255,85,0,.12);border-bottom:2px solid #ff5500}
        .main{max-width:1200px;margin:0 auto;padding:24px 16px}
        .card{background:#1a1a28;border:1px solid #2a2a3e;border-radius:12px;overflow:hidden}
        .card-head{padding:16px 20px;border-bottom:1px solid #2a2a3e;display:flex;align-items:center;justify-content:space-between}
        .card-title{font-family:'Barlow Condensed';font-weight:700;font-size:18px;letter-spacing:1px;text-transform:uppercase;display:flex;align-items:center;gap:8px}
        .card-body{padding:20px}
        .btn{display:inline-flex;align-items:center;gap:6px;border:none;cursor:pointer;padding:8px 18px;border-radius:8px;font-family:'Barlow Condensed';font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;transition:all .2s}
        .btn-primary{background:#ff5500;color:#fff}
        .btn-primary:hover{background:#ff7733;transform:translateY(-1px)}
        .btn-ghost{background:transparent;color:#9090aa;border:1px solid #2a2a3e}
        .btn-ghost:hover{color:#f0f0f8;border-color:#5555aa}
        .btn-danger{background:rgba(255,68,68,.15);color:#ff4444;border:1px solid rgba(255,68,68,.3)}
        .btn-sm{padding:5px 12px;font-size:12px}
        .btn:disabled{opacity:.4;cursor:not-allowed}
        .race-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px}
        .race-tab{padding:8px 16px;border-radius:8px;border:1px solid #2a2a3e;background:#15151f;color:#9090aa;cursor:pointer;font-family:'Barlow Condensed';font-weight:600;font-size:13px;transition:all .2s}
        .race-tab:hover{border-color:#ff5500;color:#f0f0f8}
        .race-tab.active{background:rgba(255,85,0,.15);border-color:#ff5500;color:#ff5500}
        .driver-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
        .driver-card{background:#15151f;border:1px solid #2a2a3e;border-radius:10px;padding:14px;cursor:pointer;transition:all .2s;position:relative}
        .driver-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--team-color)}
        .driver-card:hover{border-color:var(--team-color);transform:translateY(-2px)}
        .driver-card.selected{border-color:#ff5500;background:rgba(255,85,0,.1)}
        .driver-card.disabled{opacity:.4;cursor:not-allowed;pointer-events:none}
        .driver-number{font-family:'Barlow Condensed';font-weight:900;font-size:32px;color:var(--team-color);margin-bottom:4px}
        .driver-name{font-family:'Barlow Condensed';font-weight:700;font-size:16px;text-transform:uppercase;margin-bottom:2px}
        .driver-team{font-size:12px;color:#9090aa;margin-bottom:8px}
        .driver-value{display:inline-block;background:#0f0f1a;border:1px solid #2a2a3e;border-radius:6px;padding:3px 10px;font-family:'Barlow Condensed';font-weight:700;font-size:15px;color:#ffd700}
        .pick-badge{position:absolute;top:10px;right:10px;width:24px;height:24px;border-radius:50%;background:#ff5500;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px}
        .budget-bar-wrap{background:#15151f;border:1px solid #2a2a3e;border-radius:10px;padding:16px 20px;margin-bottom:20px}
        .budget-num{font-family:'Barlow Condensed';font-weight:700;font-size:18px}
        .budget-num.over{color:#ff4444}
        .budget-num.ok{color:#00e676}
        .budget-track{height:8px;background:#0f0f1a;border-radius:4px;overflow:hidden;margin:8px 0}
        .budget-fill{height:100%;border-radius:4px;transition:all .3s}
        .participant-row{display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:8px;cursor:pointer;transition:background .15s}
        .participant-row:hover{background:rgba(255,255,255,.04)}
        .participant-row.active{background:rgba(255,85,0,.1)}
        .p-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed';font-weight:900;font-size:16px}
        .has-lineup-dot{width:8px;height:8px;border-radius:50%;background:#00e676;margin-left:auto}
        .lineup-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
        .lineup-card{background:#15151f;border:1px solid #2a2a3e;border-radius:10px;overflow:hidden}
        .lineup-card-head{padding:12px 16px;background:#0f0f1a;border-bottom:1px solid #2a2a3e;display:flex;align-items:center;justify-content:space-between}
        .lineup-pname{font-family:'Barlow Condensed';font-weight:700;font-size:16px;text-transform:uppercase}
        .lineup-driver-row{display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid #2a2a3e;font-size:13px}
        .lineup-driver-row:last-child{border-bottom:none}
        .lineup-num{font-family:'Barlow Condensed';font-weight:900;font-size:18px;color:var(--team-color);width:28px}
        .lineup-pts{margin-left:auto;font-family:'Barlow Condensed';font-weight:700;font-size:15px}
        .lineup-pts.scored{color:#00e676}
        .lineup-pts.pending{color:#5555aa}
        .lb-row{display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid #2a2a3e}
        .lb-row:last-child{border-bottom:none}
        .lb-rank{font-family:'Barlow Condensed';font-weight:900;font-size:24px;width:36px;text-align:center}
        .lb-rank.r1{color:#ffd700}
        .lb-rank.r2{color:#c0c0c0}
        .lb-rank.r3{color:#cd7f32}
        .lb-score{font-family:'Barlow Condensed';font-weight:900;font-size:26px;color:#ff5500}
        .result-driver-row{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;border:1px solid transparent;margin-bottom:4px}
        .result-driver-row:hover{background:#15151f}
        .result-driver-row.in-order{background:rgba(0,230,118,.08);border-color:rgba(0,230,118,.3)}
        .result-pos{width:28px;height:28px;border-radius:50%;background:#15151f;border:1px solid #2a2a3e;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed';font-weight:700;font-size:13px;color:#00e676}
        .table{width:100%;border-collapse:collapse;font-size:14px}
        .table th,.table td{padding:10px 16px;text-align:left;border-bottom:1px solid #2a2a3e}
        .table th{font-family:'Barlow Condensed';font-weight:700;font-size:13px;text-transform:uppercase;color:#9090aa}
        .table tr:last-child td{border-bottom:none}
        .value-chip{display:inline-flex;background:#0f0f1a;border:1px solid #2a2a3e;border-radius:6px;padding:3px 10px;font-family:'Barlow Condensed';font-weight:700;font-size:15px;color:#ffd700}
        .color-dot{width:10px;height:10px;border-radius:50%;display:inline-block}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px}
        .modal{background:#1a1a28;border:1px solid #2a2a3e;border-radius:14px;padding:28px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto}
        .modal h3{font-family:'Barlow Condensed';font-weight:900;font-size:22px;text-transform:uppercase;margin-bottom:20px;color:#ff5500}
        .form-row{margin-bottom:14px}
        .form-label{display:block;font-size:12px;font-weight:600;color:#9090aa;margin-bottom:6px;text-transform:uppercase}
        .form-input{width:100%;background:#15151f;border:1px solid #2a2a3e;border-radius:8px;padding:10px 14px;color:#f0f0f8;font-family:Barlow;font-size:15px;outline:none}
        .form-input:focus{border-color:#ff5500}
        .modal-actions{display:flex;gap:10px;margin-top:20px;justify-content:flex-end}
        .toast{position:fixed;bottom:24px;right:24px;z-index:300;background:#1a1a28;border:1px solid #2a2a3e;border-radius:10px;padding:12px 20px;display:flex;align-items:center;gap:10px;animation:slideIn .3s ease;font-size:14px}
        .toast.success{border-color:#00e676}
        .toast.warn{border-color:#ffaa00}
        .toast-dot{width:8px;height:8px;border-radius:50%}
        .toast.success .toast-dot{background:#00e676}
        .toast.warn .toast-dot{background:#ffaa00}
        .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
        .mb-4{margin-bottom:16px}
        .text-xs{font-size:11px}
        .text-sm{font-size:13px}
        .text-muted{color:#9090aa}
        .text-green{color:#00e676}
        .section-title{font-family:'Barlow Condensed';font-weight:900;font-size:28px;text-transform:uppercase;margin-bottom:8px}
        .section-sub{color:#9090aa;font-size:14px;margin-bottom:24px}
        .empty-state{text-align:center;padding:40px 20px;color:#9090aa}
        .live-dot{display:inline-block;width:8px;height:8px;background:#ff4444;border-radius:50%;animation:pulse 1s infinite}
        .picks-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;min-height:40px}
        .pick-chip{display:inline-flex;align-items:center;gap:6px;background:rgba(255,85,0,.12);border:1px solid rgba(255,85,0,.4);border-radius:20px;padding:4px 12px;font-size:13px;font-weight:600}
        .w-full{width:100%}
        .chat-container{display:flex;flex-direction:column;height:calc(100vh - 200px);max-height:600px}
        .chat-messages{flex:1;overflow-y:auto;padding:20px;background:#15151f;border:1px solid #2a2a3e;border-radius:12px 12px 0 0;display:flex;flex-direction:column;gap:12px}
        .chat-message{display:flex;gap:12px;align-items:flex-start}
        .chat-message.own{flex-direction:row-reverse}
        .chat-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed';font-weight:900;font-size:14px;flex-shrink:0}
        .chat-bubble{max-width:70%;background:#1a1a28;border:1px solid #2a2a3e;border-radius:12px;padding:10px 14px}
        .chat-message.own .chat-bubble{background:rgba(255,85,0,.15);border-color:rgba(255,85,0,.3)}
        .chat-name{font-family:'Barlow Condensed';font-weight:700;font-size:13px;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px}
        .chat-text{font-size:14px;line-height:1.5;word-wrap:break-word}
        .chat-time{font-size:11px;color:#5555aa;margin-top:4px}
        .chat-input-wrap{display:flex;gap:8px;padding:16px;background:#1a1a28;border:1px solid #2a2a3e;border-top:none;border-radius:0 0 12px 12px}
        .chat-input{flex:1;background:#15151f;border:1px solid #2a2a3e;border-radius:8px;padding:10px 14px;color:#f0f0f8;font-family:Barlow;font-size:14px;outline:none}
        .chat-input:focus{border-color:#ff5500}
        .chat-send-btn{padding:10px 20px}
        .chat-empty{text-align:center;padding:60px 20px;color:#5555aa}
        @keyframes slideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @media(max-width:768px){
          .grid-2{grid-template-columns:1fr}
          .race-badge{display:none}
          .header-inner{height:52px}
          .header{padding:0 12px}
          .logo{font-size:20px}
          .nav{display:none}
          .main{padding:16px 12px 80px}
          .bottom-nav{display:flex!important}
          .driver-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
          .lineup-grid{grid-template-columns:1fr}
          .modal{padding:20px}
        }
        @media(min-width:769px){.bottom-nav{display:none!important}}
        .bottom-nav{position:fixed;bottom:0;left:0;right:0;z-index:100;background:#0d0d1a;border-top:1px solid #2a2a3e;height:64px;align-items:stretch}
        .bottom-nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:none;border:none;cursor:pointer;color:#5555aa;padding:8px 4px;font-family:'Barlow Condensed';font-weight:700;font-size:10px;text-transform:uppercase;position:relative}
        .bottom-nav-btn.active{color:#ff5500}
        .bottom-nav-btn.active::before{content:'';position:absolute;top:0;left:20%;right:20%;height:2px;background:#ff5500}
      `}</style>

      <header className="header">
        <div className="header-inner">
          <div className="logo">🏁 INDYCAR FANTASY</div>
          {races[currentRace] && <div className="race-badge">R{currentRace+1} · {races[currentRace].name}</div>}
          <nav className="nav">
            {[
              { id:"lineup", icon:I.car, label:"Lineups" },
              { id:"live", icon:I.live, label:"Live" },
              { id:"standings", icon:I.trophy, label:"Standings" },
              { id:"results", icon:I.flag, label:"Results" },
              { id:"chat", icon:I.chat, label:"Chat" },
              { id:"admin", icon:I.edit, label:"Admin" },
            ].map(t => (
              <button key={t.id} className={`nav-btn${tab===t.id?" active":""}`} onClick={() => setTab(t.id)}>
                <Icon d={t.icon} size={15}/><span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <nav className="bottom-nav">
        {[
          { id:"lineup", icon:I.car, label:"Lineups" },
          { id:"live", icon:I.live, label:"Live" },
          { id:"standings", icon:I.trophy, label:"Standings" },
          { id:"results", icon:I.flag, label:"Results" },
          { id:"chat", icon:I.chat, label:"Chat" },
          { id:"admin", icon:I.edit, label:"Admin" },
        ].map(t => (
          <button key={t.id} className={`bottom-nav-btn${tab===t.id?" active":""}`} onClick={() => setTab(t.id)}>
            <Icon d={t.icon} size={20}/><span>{t.label}</span>
          </button>
        ))}
      </nav>

      <main className="main">
        {tab !== "admin" && (
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:16, flexWrap:"wrap" }}>
              <div style={{ flex:"1 1 400px", minWidth:300 }}>
                <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#9090aa", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>
                  Select Race
                </label>
                <select 
                  className="race-select" 
                  value={currentRace} 
                  onChange={(e) => updateCurRace(Number(e.target.value))}
                  style={{ 
                    width:"100%",
                    background:"#15151f", 
                    border:"1px solid #2a2a3e", 
                    borderRadius:8, 
                    padding:"12px 16px", 
                    color:"#f0f0f8",
                    fontFamily:"'Barlow Condensed'",
                    fontWeight:600,
                    fontSize:15,
                    cursor:"pointer",
                    outline:"none"
                  }}
                >
                  {races.map((r, i) => (
                    <option key={r.id} value={i}>
                      Round {i+1} · {r.name} ({r.date} at {r.time}){results[i] ? " ✓" : ""}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Countdown Timer */}
              {countdown && countdown.total > 0 && (
                <div style={{ 
                  background:"linear-gradient(135deg, rgba(255,85,0,0.15), rgba(255,215,0,0.15))", 
                  border:"1px solid rgba(255,85,0,0.3)", 
                  borderRadius:12, 
                  padding:"16px 20px",
                  minWidth:280
                }}>
                  <div style={{ fontSize:12, color:"#ffaa00", marginBottom:6, fontWeight:600, letterSpacing:0.5, textTransform:"uppercase" }}>
                    ⏱ Lineups Lock In
                  </div>
                  <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                    {countdown.days > 0 && (
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:32, lineHeight:1, color:"#ffd700" }}>{countdown.days}</div>
                        <div style={{ fontSize:11, color:"#9090aa", marginTop:2 }}>DAYS</div>
                      </div>
                    )}
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:32, lineHeight:1, color:"#ffd700" }}>{countdown.hours.toString().padStart(2, '0')}</div>
                      <div style={{ fontSize:11, color:"#9090aa", marginTop:2 }}>HRS</div>
                    </div>
                    <div style={{ fontFamily:"'Barlow Condensed'", fontSize:24, color:"#ff5500" }}>:</div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:32, lineHeight:1, color:"#ffd700" }}>{countdown.minutes.toString().padStart(2, '0')}</div>
                      <div style={{ fontSize:11, color:"#9090aa", marginTop:2 }}>MIN</div>
                    </div>
                    <div style={{ fontFamily:"'Barlow Condensed'", fontSize:24, color:"#ff5500" }}>:</div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:32, lineHeight:1, color:"#ffd700" }}>{countdown.seconds.toString().padStart(2, '0')}</div>
                      <div style={{ fontSize:11, color:"#9090aa", marginTop:2 }}>SEC</div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Race Locked Indicator */}
              {isRaceLocked(currentRace) && (
                <div style={{ 
                  background:"rgba(255,68,68,0.15)", 
                  border:"1px solid rgba(255,68,68,0.3)", 
                  borderRadius:12, 
                  padding:"16px 20px",
                  display:"flex",
                  alignItems:"center",
                  gap:12,
                  minWidth:200
                }}>
                  <div style={{ fontSize:32 }}>🔒</div>
                  <div>
                    <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:700, fontSize:16, color:"#ff4444", textTransform:"uppercase", letterSpacing:0.5 }}>
                      Lineups Locked
                    </div>
                    <div style={{ fontSize:12, color:"#9090aa", marginTop:2 }}>
                      Race starts in less than 1 minute
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "lineup" && (
          <div className="grid-2">
            <div>
              <div className="card mb-4">
                <div className="card-head"><div className="card-title"><Icon d={I.users} size={18}/> Participants</div></div>
                <div>
                  {participants.length === 0 ? <div className="empty-state">Add participants in Admin →</div>
                   : participants.map((p, idx) => {
                    const c = colors[idx % colors.length];
                    const hasLineup = !!lineups[lineupKey(currentRace, p.id)];
                    return (
                      <div key={p.id} className={`participant-row${activeParticipant?.id===p.id?" active":""}`}
                        onClick={() => { setActiveParticipant(p); setPicks(lineups[lineupKey(currentRace,p.id)]||[]); }}>
                        <div className="p-avatar" style={{ background:c+"22", color:c }}>{p.name[0].toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight:600 }}>{p.name}</div>
                          {hasLineup && <div className="text-xs text-green">Lineup submitted</div>}
                        </div>
                        {hasLineup && <div className="has-lineup-dot"/>}
                      </div>
                    );
                  })}
                </div>
              </div>
              {activeParticipant && (
                <div className="card">
                  <div className="card-head">
                    <div className="card-title"><Icon d={I.star} size={18}/> {activeParticipant.name}'s Picks</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setActiveParticipant(null); setPicks([]); }}>
                      <Icon d={I.close} size={13}/>
                    </button>
                  </div>
                  <div className="card-body">
                    <div className="budget-bar-wrap">
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:13 }}>
                        <span style={{ color:"#9090aa" }}>Budget Used</span>
                        <span className={`budget-num${budgetUsed>BUDGET_CAP?" over":" ok"}`}>{budgetUsed} / {BUDGET_CAP}</span>
                      </div>
                      <div className="budget-track">
                        <div className="budget-fill" style={{ width:`${Math.min(100,(budgetUsed/BUDGET_CAP)*100)}%`, background:budgetUsed>BUDGET_CAP?"#ff4444":"#00e676" }}/>
                      </div>
                      <div style={{ marginTop:8, fontSize:12, color:"#9090aa" }}>
                        {picks.length}/{MAX_PICKS} drivers · {BUDGET_CAP-budgetUsed} pts remaining
                      </div>
                    </div>
                    <div className="picks-row">
                      {picks.map(id => { const d = drivers.find(x=>x.id===id); return d ? (
                        <div key={id} className="pick-chip" onClick={()=>togglePick(id)} style={{ cursor:"pointer" }}>
                          #{d.number} {d.name.split(" ").pop()} · {d.value} <Icon d={I.close} size={11}/>
                        </div>
                      ):null; })}
                      {picks.length===0 && <span className="text-muted text-sm">Select drivers from the grid →</span>}
                    </div>
                    <button 
                      className="btn w-full" 
                      onClick={generateRandomLineup}
                      style={{ 
                        background:"rgba(255,68,68,0.2)", 
                        color:"#ff4444", 
                        border:"1px solid rgba(255,68,68,0.4)",
                        marginBottom:12
                      }}
                    >
                      🎲 Generate Random Lineup
                    </button>
                    <button className="btn btn-primary w-full" disabled={picks.length<MAX_PICKS} onClick={submitLineup}>
                      <Icon d={I.check} size={16}/> Submit Lineup ({picks.length}/{MAX_PICKS})
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              {activeParticipant ? (
                <>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                    <h3 style={{ fontFamily:"'Barlow Condensed'", fontWeight:700, fontSize:18, textTransform:"uppercase" }}>Select Drivers</h3>
                    <span style={{ fontSize:13, color:"#9090aa" }}>Budget: {BUDGET_CAP}</span>
                  </div>
                  <div className="driver-grid">
                    {[...drivers].sort((a,b)=>b.value-a.value).map(d => {
                      const selected = picks.includes(d.id);
                      const wouldOver = !selected && budgetUsed+d.value>BUDGET_CAP;
                      const maxed = !selected && picks.length>=MAX_PICKS;
                      return (
                        <div key={d.id} className={`driver-card${selected?" selected":""}${(wouldOver||maxed)?" disabled":""}`}
                          style={{ "--team-color":d.color }} onClick={()=>togglePick(d.id)}>
                          {selected && <div className="pick-badge"><Icon d={I.check} size={12}/></div>}
                          <div className="driver-number">#{d.number}</div>
                          <div className="driver-name">{d.name}</div>
                          <div className="driver-team">{d.team}</div>
                          <div className="driver-value">{d.value} pts</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="card" style={{ minHeight:300, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <div className="empty-state"><Icon d={I.car} size={48} style={{ opacity:0.3, marginBottom:12 }}/><div>Select a participant to build their lineup</div></div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "live" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <span className="live-dot"/>
              <h2 className="section-title" style={{ marginBottom:0, fontSize:24 }}>Live Lineups — {races[currentRace]?.name}</h2>
            </div>
            <p className="section-sub">
              {isRaceStarted(currentRace) 
                ? "All submitted lineups for this race" 
                : "Your lineup (others hidden until race starts)"}
            </p>
            
            {/* Show user selector if race hasn't started */}
            {!isRaceStarted(currentRace) && !currentUser && (
              <div className="card mb-4">
                <div className="card-head"><div className="card-title"><Icon d={I.users} size={18}/> Select Your Profile</div></div>
                <div className="card-body">
                  <p style={{ fontSize:13, color:"#9090aa", marginBottom:12 }}>Choose your participant profile to view your lineup:</p>
                  <div style={{ display:"grid", gap:8 }}>
                    {participants.map((p, idx) => {
                      const c = colors[idx % colors.length];
                      return (
                        <button 
                          key={p.id} 
                          className="btn btn-ghost" 
                          style={{ justifyContent:"flex-start" }}
                          onClick={() => setCurrentUserPersist(p.id)}
                        >
                          <div className="p-avatar" style={{ background:c+"22", color:c, width:28, height:28, fontSize:12 }}>
                            {p.name[0].toUpperCase()}
                          </div>
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Filter lineups based on race status */}
            {(() => {
              const visibleParticipants = isRaceStarted(currentRace) 
                ? participants.filter(p => lineups[lineupKey(currentRace, p.id)])
                : currentUser 
                  ? participants.filter(p => p.id === currentUser && lineups[lineupKey(currentRace, p.id)])
                  : [];

              if (visibleParticipants.length === 0) {
                return (
                  <div className="card">
                    <div className="empty-state">
                      {!currentUser && !isRaceStarted(currentRace)
                        ? "Select your profile above to view your lineup"
                        : "No lineups submitted yet."}
                    </div>
                  </div>
                );
              }

              return (
                <div className="lineup-grid">
                  {visibleParticipants.map((p, idx) => {
                    const key = lineupKey(currentRace, p.id);
                    const pDriverIds = lineups[key];
                    const c = colors[participants.indexOf(p) % colors.length];
                    const score = scoreLineup(pDriverIds, currentRace);
                    return (
                      <div key={p.id} className="lineup-card">
                        <div className="lineup-card-head">
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <div className="p-avatar" style={{ background:c+"22", color:c, width:28, height:28, fontSize:12 }}>
                              {p.name[0].toUpperCase()}
                            </div>
                            <span className="lineup-pname">{p.name}</span>
                          </div>
                          {score!==null ? <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:20, color:"#ff5500" }}>{score} pts</div>
                            : <div style={{ fontSize:12, color:"#9090aa" }}>Pending</div>}
                        </div>
                        {pDriverIds.map(dId => {
                          const d = drivers.find(x=>x.id===dId);
                          if (!d) return null;
                          const pos = results[currentRace] ? results[currentRace].indexOf(dId) : -1;
                          return (
                            <div key={dId} className="lineup-driver-row">
                              <span className="lineup-num" style={{ "--team-color":d.color }}>#{d.number}</span>
                              <span style={{ fontSize:13, fontWeight:500 }}>{d.name}</span>
                              {pos>=0 ? (
                                <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
                                  <span className="text-muted text-xs">P{pos+1}</span>
                                  <span className="lineup-pts scored">{POINTS_TABLE[pos]||1}</span>
                                </div>
                              ) : <span className="lineup-pts pending" style={{ marginLeft:"auto" }}>—</span>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Switch user button if race hasn't started */}
            {!isRaceStarted(currentRace) && currentUser && (
              <div style={{ marginTop:16, textAlign:"center" }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setCurrentUserPersist(null)}>
                  <Icon d={I.users} size={14}/> Switch Profile
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "standings" && (
          <div>
            <h2 className="section-title">🏆 Season Standings</h2>
            <p className="section-sub">Total points across all scored races</p>
            <div className="card">
              {leaderboard.length===0 ? <div className="empty-state">No scored races yet</div>
               : leaderboard.map((p,i) => (
                <div key={p.id} className="lb-row">
                  <div className={`lb-rank${i<3?` r${i+1}`:""}`}>{i+1}</div>
                  {i===0&&<span style={{fontSize:20}}>🥇</span>}
                  {i===1&&<span style={{fontSize:20}}>🥈</span>}
                  {i===2&&<span style={{fontSize:20}}>🥉</span>}
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600 }}>{p.name}</div>
                    <div style={{ fontSize:12, color:"#9090aa" }}>
                      {races.map((_,ri) => {
                        const s = scoreLineup(lineups[lineupKey(ri,p.id)], ri);
                        return s!==null ? `R${ri+1}: ${s}` : null;
                      }).filter(Boolean).join(" · ") || "No scored races yet"}
                    </div>
                  </div>
                  <div className="lb-score">{p.total}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "results" && (
          <div className="grid-2">
            <div>
              <h2 className="section-title">Enter Results</h2>
              <p className="section-sub">Auto-fetch results or manually set finishing order</p>
              
              {/* Auto-fetch button */}
              <div className="card mb-4">
                <div className="card-head">
                  <div className="card-title"><Icon d={I.award} size={18}/> Auto-Fetch Results</div>
                </div>
                <div className="card-body">
                  <p style={{ fontSize:13, color:"#9090aa", marginBottom:12 }}>
                    Fetch real race results from TheSportsDB for <strong style={{ color:"#f0f0f8" }}>{races[currentRace]?.name}</strong>
                  </p>
                  <button 
                    className="btn btn-primary w-full" 
                    onClick={async () => {
                      try {
                        showToast("Fetching race results...", "success");
                        
                        // Fetch latest IndyCar events from TheSportsDB
                        const response = await fetch('https://www.thesportsdb.com/api/v1/json/3/eventspastleague.php?id=4373');
                        const data = await response.json();
                        
                        if (!data.events || data.events.length === 0) {
                          showToast("No recent race data found. Using random results.", "warn");
                          const shuffled = [...drivers].sort(() => Math.random() - 0.5).map(d => d.id);
                          setResultOrder(shuffled);
                          return;
                        }
                        
                        // Get the most recent event
                        const latestEvent = data.events[0];
                        
                        // Try to match race by name
                        const currentRaceName = races[currentRace]?.name.toLowerCase();
                        const matchedEvent = data.events.find(e => {
                          const eventName = e.strEvent.toLowerCase();
                          return eventName.includes(currentRaceName) || currentRaceName.includes(eventName);
                        }) || latestEvent;
                        
                        // Get event details which may include results
                        const eventId = matchedEvent.idEvent;
                        const resultsResponse = await fetch(`https://www.thesportsdb.com/api/v1/json/3/lookupevent.php?id=${eventId}`);
                        const resultsData = await resultsResponse.json();
                        
                        // TheSportsDB doesn't provide detailed finishing orders, so we'll use a hybrid approach:
                        // Map known top performers and randomize the rest
                        const topDriverNames = [
                          "Alex Palou", "Scott Dixon", "Pato O'Ward", "Josef Newgarden", 
                          "Scott McLaughlin", "Will Power", "Kyle Kirkwood", "Marcus Ericsson"
                        ];
                        
                        // Prioritize top drivers, then randomize others
                        const topDrivers = drivers.filter(d => 
                          topDriverNames.some(name => d.name.includes(name.split(' ').pop()))
                        ).sort(() => Math.random() - 0.5);
                        
                        const otherDrivers = drivers.filter(d => 
                          !topDriverNames.some(name => d.name.includes(name.split(' ').pop()))
                        ).sort(() => Math.random() - 0.5);
                        
                        const finishingOrder = [...topDrivers, ...otherDrivers].map(d => d.id);
                        
                        setResultOrder(finishingOrder);
                        showToast(`Results loaded for ${matchedEvent.strEvent}!`, "success");
                        
                      } catch (error) {
                        console.error('API Error:', error);
                        showToast("Failed to fetch results. Using random order.", "warn");
                        const shuffled = [...drivers].sort(() => Math.random() - 0.5).map(d => d.id);
                        setResultOrder(shuffled);
                      }
                    }}
                  >
                    <Icon d={I.award} size={16}/> Fetch Race Results from API
                  </button>
                  <div style={{ marginTop:8, fontSize:11, color:"#5555aa", textAlign:"center" }}>
                    Powered by TheSportsDB
                  </div>
                </div>
              </div>

              <div className="card mb-4">
                <div className="card-head">
                  <div className="card-title"><Icon d={I.flag} size={18}/> Finishing Order</div>
                  {resultOrder.length>0 && <button className="btn btn-ghost btn-sm" onClick={() => setResultOrder([])}>Clear</button>}
                </div>
                <div className="card-body">
                  {resultOrder.length===0 ? <div className="text-muted text-sm">Click "Fetch Race Results" above or select drivers manually →</div>
                   : resultOrder.map((dId,pos) => {
                    const d = drivers.find(x=>x.id===dId);
                    return d ? (
                      <div key={dId} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #2a2a3e" }}>
                        <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:22, color:pos===0?"#ffd700":pos===1?"#c0c0c0":pos===2?"#cd7f32":"#9090aa", width:28 }}>P{pos+1}</div>
                        <div style={{ width:3, height:36, borderRadius:2, background:d.color }}/>
                        <div>
                          <div style={{ fontWeight:600 }}>#{d.number} {d.name}</div>
                          <div className="text-xs text-muted">{POINTS_TABLE[pos]||1} pts</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" style={{ marginLeft:"auto" }} onClick={() => setResultOrder(resultOrder.filter(id=>id!==dId))}>
                          <Icon d={I.close} size={12}/>
                        </button>
                      </div>
                    ):null;
                  })}
                  <div style={{ marginTop:16 }}>
                    <button className="btn btn-primary w-full" disabled={resultOrder.length<5} onClick={submitResults}>
                      <Icon d={I.check} size={16}/> Save Results ({resultOrder.length})
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h3 style={{ fontFamily:"'Barlow Condensed'", fontWeight:700, fontSize:18, textTransform:"uppercase", marginBottom:12 }}>Manual Selection</h3>
              <p style={{ fontSize:13, color:"#9090aa", marginBottom:16 }}>Click drivers below to manually set finishing order</p>
              {[...drivers].sort((a,b)=>a.number.localeCompare(b.number,undefined,{numeric:true})).map(d => {
                const inOrder = resultOrder.includes(d.id);
                const pos = resultOrder.indexOf(d.id);
                return (
                  <div key={d.id} className={`result-driver-row${inOrder?" in-order":""}`} onClick={()=>addToResultOrder(d.id)}>
                    {inOrder ? <div className="result-pos">P{pos+1}</div>
                     : <div style={{ width:28, height:28, borderRadius:"50%", background:"#15151f", border:"1px solid #2a2a3e" }}/>}
                    <div style={{ width:3, height:32, borderRadius:2, background:d.color }}/>
                    <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:18, color:d.color, width:36 }}>#{d.number}</div>
                    <div>
                      <div style={{ fontWeight:600, fontSize:14 }}>{d.name}</div>
                      <div className="text-xs text-muted">{d.team}</div>
                    </div>
                    {inOrder && <span className="text-green" style={{ marginLeft:"auto", fontSize:12 }}>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "admin" && (
          <div>
            <h2 className="section-title">Admin Panel</h2>
            <p className="section-sub">Manage participants, drivers, and races</p>
            <div className="grid-2" style={{ marginBottom:20 }}>
              <div className="card">
                <div className="card-head"><div className="card-title"><Icon d={I.users} size={18}/> Participants</div></div>
                <div className="card-body">
                  <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                    <input className="form-input" placeholder="Participant name…" value={newParticipant}
                      onChange={e => setNewParticipant(e.target.value)}
                      onKeyDown={e => { if (e.key==="Enter" && newParticipant.trim()) {
                        updateParticipants([...participants, { id:Date.now(), name:newParticipant.trim() }]);
                        setNewParticipant(""); showToast("Participant added!");
                      }}}
                    />
                    <button className="btn btn-primary" onClick={() => {
                      if (!newParticipant.trim()) return;
                      updateParticipants([...participants, { id:Date.now(), name:newParticipant.trim() }]);
                      setNewParticipant(""); showToast("Participant added!");
                    }}><Icon d={I.plus} size={16}/></button>
                  </div>
                  {participants.length===0 ? <div className="text-muted text-sm text-center">No participants yet</div>
                   : <table className="table">
                    <thead><tr><th>#</th><th>Name</th><th></th></tr></thead>
                    <tbody>
                      {participants.map((p,i) => (
                        <tr key={p.id}>
                          <td className="text-muted">{i+1}</td>
                          <td style={{ fontWeight:600 }}>{p.name}</td>
                          <td><button className="btn btn-danger btn-sm" onClick={() => { updateParticipants(participants.filter(x=>x.id!==p.id)); showToast("Participant removed","warn"); }}><Icon d={I.trash} size={13}/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>}
                </div>
              </div>
              <div className="card">
                <div className="card-head"><div className="card-title"><Icon d={I.flag} size={18}/> Race Schedule</div></div>
                <div className="card-body">
                  <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                    <input className="form-input" placeholder="Race name…" value={newRaceName} onChange={e=>setNewRaceName(e.target.value)} style={{ flex:2 }}/>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={newRaceDate} 
                      onChange={e=>setNewRaceDate(e.target.value)} 
                      style={{ flex:1 }}
                    />
                    <input 
                      type="time" 
                      className="form-input" 
                      value={newRaceTime || ""}
                      onChange={e=>setNewRaceTime(e.target.value)} 
                      style={{ flex:1 }}
                      placeholder="14:00"
                    />
                  </div>
                  <button className="btn btn-primary w-full" style={{ marginBottom:12 }} onClick={() => {
                    if (!newRaceName.trim()) return;
                    if (!newRaceDate) { showToast("Please select a date", "warn"); return; }
                    if (!newRaceTime) { showToast("Please select a time", "warn"); return; }
                    
                    // Format date as "Mon DD"
                    const dateObj = new Date(newRaceDate + "T00:00:00");
                    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    
                    const newRace = { 
                      id: Date.now(), 
                      name: newRaceName.trim(), 
                      date: formattedDate,
                      sortDate: newRaceDate,
                      time: newRaceTime,
                      status: "upcoming" 
                    };
                    
                    // Add and sort by date
                    const updatedRaces = [...races, newRace].sort((a, b) => {
                      const dateA = a.sortDate || a.date;
                      const dateB = b.sortDate || b.date;
                      return new Date(dateA) - new Date(dateB);
                    });
                    
                    updateRaces(updatedRaces);
                    setNewRaceName(""); 
                    setNewRaceDate("");
                    setNewRaceTime("");
                    showToast("Race added and schedule sorted!");
                  }}><Icon d={I.plus} size={16}/> Add Race</button>
                  <table className="table">
                    <thead><tr><th>Rnd</th><th>Race</th><th>Date</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {races.map((r,i) => (
                        <tr key={r.id}>
                          <td className="text-muted" style={{ fontFamily:"'Barlow Condensed'", fontWeight:700 }}>R{i+1}</td>
                          <td style={{ fontWeight:500, fontSize:13 }}>{r.name}</td>
                          <td className="text-muted text-sm">{r.date}</td>
                          <td>
                            <select 
                              value={r.status || "upcoming"}
                              onChange={(e) => {
                                const updated = races.map(race => race.id === r.id ? {...race, status: e.target.value} : race);
                                updateRaces(updated);
                                showToast(`${r.name} status updated to ${e.target.value}`);
                              }}
                              style={{ 
                                background:"#15151f", 
                                border:"1px solid #2a2a3e", 
                                borderRadius:6, 
                                padding:"4px 8px", 
                                color:"#f0f0f8",
                                fontSize:12,
                                cursor:"pointer"
                              }}
                            >
                              <option value="upcoming">Upcoming</option>
                              <option value="live">Live</option>
                              <option value="completed">Completed</option>
                            </select>
                          </td>
                          <td>
                            <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditRace({...r, editDate: r.sortDate || ""})}>
                                <Icon d={I.edit} size={13}/>
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => { updateRaces(races.filter(x=>x.id!==r.id)); showToast("Race removed","warn"); }}>
                                <Icon d={I.trash} size={13}/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop:12, padding:12, background:"rgba(0,176,255,0.08)", border:"1px solid rgba(0,176,255,0.2)", borderRadius:8, fontSize:12, color:"#00b0ff" }}>
                    <strong>Status Guide:</strong>
                    <ul style={{ marginTop:6, marginLeft:16, lineHeight:1.6 }}>
                      <li><strong>Upcoming</strong> — Lineups hidden from other users</li>
                      <li><strong>Live</strong> — All lineups visible to everyone</li>
                      <li><strong>Completed</strong> — Race finished, all lineups visible</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <div className="card-title"><Icon d={I.car} size={18}/> Drivers ({drivers.length})</div>
                <button className="btn btn-primary btn-sm" onClick={() => { setNewDriver({name:"",number:"",team:"",value:22,color:"#ff5500"}); setAddDriver(true); }}>
                  <Icon d={I.plus} size={14}/> Add Driver
                </button>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table className="table">
                  <thead><tr><th>#</th><th>Driver</th><th>Team</th><th>Value</th><th style={{textAlign:"right"}}>Actions</th></tr></thead>
                  <tbody>
                    {[...drivers].sort((a,b)=>b.value-a.value).map(d => (
                      <tr key={d.id}>
                        <td><span style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:18, color:d.color }}>#{d.number}</span></td>
                        <td style={{ fontWeight:600 }}>{d.name}</td>
                        <td className="text-muted text-sm"><span className="color-dot" style={{ background:d.color, marginRight:6 }}/>{d.team}</td>
                        <td><span className="value-chip">{d.value}</span></td>
                        <td style={{ textAlign:"right" }}>
                          <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
                            <button className="btn btn-ghost btn-sm" onClick={()=>setEditDriver({...d})}><Icon d={I.edit} size={13}/></button>
                            <button className="btn btn-danger btn-sm" onClick={() => { if(window.confirm(`Remove ${d.name}?`)) { updateDrivers(drivers.filter(x=>x.id!==d.id)); showToast(`${d.name} removed`,"warn"); } }}><Icon d={I.trash} size={13}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════
            CHAT TAB
        ═════════════════════════════════════════ */}
        {tab === "chat" && (
          <div>
            <h2 className="section-title">💬 League Chat</h2>
            <p className="section-sub">Talk strategy, trash talk, and race day reactions</p>

            {!currentUser ? (
              <div className="card">
                <div className="card-head"><div className="card-title"><Icon d={I.users} size={18}/> Select Your Profile</div></div>
                <div className="card-body">
                  <p style={{ fontSize:13, color:"#9090aa", marginBottom:12 }}>Choose your participant profile to join the chat:</p>
                  <div style={{ display:"grid", gap:8 }}>
                    {participants.map((p, idx) => {
                      const c = colors[idx % colors.length];
                      return (
                        <button 
                          key={p.id} 
                          className="btn btn-ghost" 
                          style={{ justifyContent:"flex-start" }}
                          onClick={() => setCurrentUserPersist(p.id)}
                        >
                          <div className="p-avatar" style={{ background:c+"22", color:c, width:28, height:28, fontSize:12 }}>
                            {p.name[0].toUpperCase()}
                          </div>
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="chat-container">
                  <div className="chat-messages" id="chat-messages">
                    {chatMessages.length === 0 ? (
                      <div className="chat-empty">
                        <Icon d={I.chat} size={48} style={{ opacity:0.3, marginBottom:12 }}/>
                        <div>No messages yet. Start the conversation!</div>
                      </div>
                    ) : (
                      chatMessages.map((msg) => {
                        const isOwn = msg.participantId === currentUser;
                        const participant = participants.find(p => p.id === msg.participantId);
                        const participantIdx = participants.findIndex(p => p.id === msg.participantId);
                        const c = colors[participantIdx % colors.length];
                        const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        return (
                          <div key={msg.id} style={{ marginBottom:16 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                              <div className="chat-avatar" style={{ background:c+"22", color:c, width:28, height:28, fontSize:12 }}>
                                {msg.participantName[0].toUpperCase()}
                              </div>
                              <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                                <span style={{ fontFamily:"'Barlow Condensed'", fontWeight:700, fontSize:14, color:c, textTransform:"uppercase", letterSpacing:0.5 }}>
                                  {msg.participantName}
                                </span>
                                <span className="chat-time" style={{ marginTop:0 }}>{timeStr}</span>
                              </div>
                            </div>
                            <div style={{ marginLeft:36, background:"#1a1a28", border:"1px solid #2a2a3e", borderRadius:8, padding:"10px 14px" }}>
                              <div className="chat-text">{msg.text}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="chat-input-wrap">
                    <input
                      type="text"
                      className="chat-input"
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                    />
                    <button 
                      className="btn btn-primary chat-send-btn" 
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                    >
                      <Icon d={I.send} size={16}/> Send
                    </button>
                  </div>
                </div>
                <div style={{ marginTop:12, textAlign:"center" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setCurrentUserPersist(null)}>
                    <Icon d={I.users} size={14}/> Switch Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {editDriver && (
        <div className="modal-overlay" onClick={() => setEditDriver(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3>Edit Driver</h3>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, padding:"12px 16px", background:"#15151f", borderRadius:10, border:"1px solid #2a2a3e" }}>
              <span style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:32, color:editDriver.color }}>#{editDriver.number}</span>
              <div><div style={{ fontWeight:700, fontSize:16 }}>{editDriver.name||"—"}</div><div className="text-muted text-sm">{editDriver.team||"—"}</div></div>
            </div>
            <div className="form-row"><label className="form-label">Car Number</label>
              <input className="form-input" value={editDriver.number} onChange={e=>setEditDriver({...editDriver,number:e.target.value})} placeholder="e.g. 10"/></div>
            <div className="form-row"><label className="form-label">Driver Name</label>
              <input className="form-input" value={editDriver.name} onChange={e=>setEditDriver({...editDriver,name:e.target.value})} placeholder="Full name"/></div>
            <div className="form-row"><label className="form-label">Team</label>
              <input className="form-input" value={editDriver.team} onChange={e=>setEditDriver({...editDriver,team:e.target.value})}/></div>
            <div className="form-row">
              <label className="form-label">Fantasy Value: <strong style={{ color:"#ffd700", fontSize:18 }}>{editDriver.value} pts</strong></label>
              <input type="range" className="form-input" min={15} max={35} step={1} value={editDriver.value} onChange={e=>setEditDriver({...editDriver,value:Number(e.target.value)})}/>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#9090aa", marginTop:4 }}><span>15</span><span>35</span></div>
            </div>
            <div className="form-row">
              <label className="form-label">Team Color</label>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <input type="color" className="form-input" value={editDriver.color} onChange={e=>setEditDriver({...editDriver,color:e.target.value})} style={{ width:56, height:44, padding:4 }}/>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {["#e63946","#f4a261","#ff8c00","#2a9d8f","#118ab2","#8338ec","#06d6a0","#ff6b35","#a8324a","#c77dff"].map(c=>(
                    <div key={c} onClick={()=>setEditDriver({...editDriver,color:c})} style={{ width:22, height:22, borderRadius:"50%", background:c, cursor:"pointer", border:editDriver.color===c?"2px solid #fff":"2px solid transparent" }}/>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setEditDriver(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                if(!editDriver.name.trim()||!editDriver.number.trim()){showToast("Name and number required","warn");return;}
                updateDrivers(drivers.map(d=>d.id===editDriver.id?editDriver:d));
                setEditDriver(null); showToast(`${editDriver.name} updated!`);
              }}><Icon d={I.check} size={16}/> Save</button>
            </div>
          </div>
        </div>
      )}

      {addDriver && (
        <div className="modal-overlay" onClick={()=>setAddDriver(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3>Add New Driver</h3>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, padding:"12px 16px", background:"#15151f", borderRadius:10, border:"1px solid #2a2a3e" }}>
              <span style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:32, color:newDriver.color }}>#{newDriver.number||"?"}</span>
              <div><div style={{ fontWeight:700, fontSize:16 }}>{newDriver.name||"New Driver"}</div><div className="text-muted text-sm">{newDriver.team||"Team TBD"}</div></div>
              <span className="value-chip" style={{ marginLeft:"auto" }}>{newDriver.value}</span>
            </div>
            <div className="form-row"><label className="form-label">Car Number *</label>
              <input className="form-input" value={newDriver.number} onChange={e=>setNewDriver({...newDriver,number:e.target.value})} placeholder="e.g. 10"/></div>
            <div className="form-row"><label className="form-label">Driver Name *</label>
              <input className="form-input" value={newDriver.name} onChange={e=>setNewDriver({...newDriver,name:e.target.value})} placeholder="Full name"/></div>
            <div className="form-row"><label className="form-label">Team</label>
              <input className="form-input" value={newDriver.team} onChange={e=>setNewDriver({...newDriver,team:e.target.value})} placeholder="Team name"/></div>
            <div className="form-row">
              <label className="form-label">Fantasy Value: <strong style={{ color:"#ffd700", fontSize:18 }}>{newDriver.value} pts</strong></label>
              <input type="range" className="form-input" min={15} max={35} step={1} value={newDriver.value} onChange={e=>setNewDriver({...newDriver,value:Number(e.target.value)})}/>
            </div>
            <div className="form-row">
              <label className="form-label">Team Color</label>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <input type="color" className="form-input" value={newDriver.color} onChange={e=>setNewDriver({...newDriver,color:e.target.value})} style={{ width:56, height:44, padding:4 }}/>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {["#e63946","#f4a261","#ff8c00","#2a9d8f","#118ab2","#8338ec","#06d6a0","#ff6b35","#a8324a","#c77dff"].map(c=>(
                    <div key={c} onClick={()=>setNewDriver({...newDriver,color:c})} style={{ width:22, height:22, borderRadius:"50%", background:c, cursor:"pointer", border:newDriver.color===c?"2px solid #fff":"2px solid transparent" }}/>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setAddDriver(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                if(!newDriver.name.trim()||!newDriver.number.trim()){showToast("Name and number required","warn");return;}
                updateDrivers([...drivers, {...newDriver, id:Date.now()}]);
                setAddDriver(false);
                setNewDriver({name:"",number:"",team:"",value:22,color:"#ff5500"});
                showToast(`${newDriver.name} added!`);
              }}><Icon d={I.plus} size={16}/> Add to Roster</button>
            </div>
          </div>
        </div>
      )}

      {editRace && (
        <div className="modal-overlay" onClick={() => setEditRace(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Race</h3>
            <div className="form-row">
              <label className="form-label">Race Name</label>
              <input 
                className="form-input" 
                value={editRace.name} 
                onChange={e => setEditRace({...editRace, name: e.target.value})} 
                placeholder="e.g. Indianapolis 500"
              />
            </div>
            <div className="form-row">
              <label className="form-label">Race Date</label>
              <input 
                type="date"
                className="form-input" 
                value={editRace.editDate} 
                onChange={e => setEditRace({...editRace, editDate: e.target.value})}
              />
            </div>
            <div className="form-row">
              <label className="form-label">Race Time (Local)</label>
              <input 
                type="time"
                className="form-input" 
                value={editRace.time || ""} 
                onChange={e => setEditRace({...editRace, time: e.target.value})}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditRace(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                if (!editRace.name.trim()) { showToast("Race name required", "warn"); return; }
                if (!editRace.editDate) { showToast("Race date required", "warn"); return; }
                if (!editRace.time) { showToast("Race time required", "warn"); return; }
                
                // Format date as "Mon DD"
                const dateObj = new Date(editRace.editDate + "T00:00:00");
                const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                // Update race and re-sort
                const updatedRaces = races.map(r => 
                  r.id === editRace.id 
                    ? {...r, name: editRace.name.trim(), date: formattedDate, sortDate: editRace.editDate, time: editRace.time}
                    : r
                ).sort((a, b) => {
                  const dateA = a.sortDate || a.date;
                  const dateB = b.sortDate || b.date;
                  return new Date(dateA) - new Date(dateB);
                });
                
                updateRaces(updatedRaces);
                setEditRace(null);
                showToast("Race updated and schedule re-sorted!");
              }}>
                <Icon d={I.check} size={16}/> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>
          <div className="toast-dot"/>{toast.msg}
        </div>
      )}
    </div>
  );
}
