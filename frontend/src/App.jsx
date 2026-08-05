import { useState } from 'react';
import './App.css';
import cardBackImg from './assets/cardback.png';
import defaultBg from './assets/wood.png'; 

function App() {
  const [setCode, setSetCode] = useState('spm');
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [pack, setPack] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [bgImg, setBgImg] = useState(defaultBg);
  const [currentIndex, setCurrentIndex] = useState(0); 
  const [cardFlipped, setCardFlipped] = useState(false); 
  const [revealedCards, setRevealedCards] = useState([]); 
  
  const [edgeStep, setEdgeStep] = useState(0); 

  const [totalSpent, setTotalSpent] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [isDeductOpen, setIsDeductOpen] = useState(false);
  const [deductInput, setDeductInput] = useState('');

  const packPrices = {
    spm: 80000,  
    fin: 120000,  
    tla: 110000,  
    msh: 100000,
    cmm: 280000,
    fdn: 75000,
    mkm: 80000,
    blb: 85000,
    default: 90000
  };

  const handleBgUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setBgImg(url);
    }
  };

  const openPack = async () => {
    setLoading(true);
    setErrorMsg('');
    setPack([]);
    setRevealedCards([]);
    setCurrentIndex(0);
    setCardFlipped(false);
    setEdgeStep(0);
    
    try {
      const cleanSetCode = setCode.trim().toLowerCase();
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005';
      const res = await fetch(`${API_URL}/api/open-pack?set=${cleanSetCode}`);
      const data = await res.json();
      
      if (res.ok) {
        setPack(data);
        console.table(data.map((c, i) => ({ Slot: i + 1, Name: c.name, Set: c.set, Rarity: c.rarity })));
        
        const price = packPrices[cleanSetCode] || packPrices.default;
        setTotalSpent(prev => prev + price);

      } else {
        setErrorMsg(data.error || "Could not generate pack.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to connect to backend. Is your Node server running?");
    } finally {
      setLoading(false);
    }
  };

const handleStackClick = () => {
    if (!cardFlipped) {
      setCardFlipped(true);
    } else {
      const isMobile = window.innerWidth < 768;
      
      // 1. INCREASED MINIMUMS: Ensure they clear the center stack's width
      const baseMin = isMobile ? 110 : 180; 
      const baseMax = isMobile ? 160 : 380;
      const yMax = isMobile ? 180 : 350; // Tightened Y so they don't fly off screen
      const rotMax = isMobile ? 20 : 40; 

      // 2. ALTERNATE SIDES: Even index goes left (-1), odd goes right (1)
      const side = (currentIndex % 2 === 0) ? -1 : 1; 
      
      // Calculate positions
      const xOffset = side * (Math.random() * (baseMax - baseMin) + baseMin); 
      const yOffset = (Math.random() - 0.5) * yMax; 
      
      // 3. OUTWARD TILT: Base rotation outward so they look like a natural fan
      const baseRotation = side * 15; 
      const rotation = baseRotation + (Math.random() - 0.5) * rotMax; 

      const newlyRevealed = {
        ...pack[currentIndex],
        scatterStyle: {
          '--x': `${xOffset}px`,
          '--y': `${yOffset}px`,
          '--rot': `${rotation}deg`
        }
      };

      setRevealedCards([...revealedCards, newlyRevealed]);
      setCurrentIndex(currentIndex + 1);
      setCardFlipped(false);
    }
  };

  const handleOpenDeduct = () => {
    setDeductInput('');
    setIsDeductOpen(true);
  };

  const handleConfirmDeduction = () => {
    const amount = parseFloat(deductInput);
    if (!isNaN(amount) && amount > 0) {
      setTotalEarned(prev => prev + amount); 
      setIsDeductOpen(false);
    } else {
      alert("Please enter a valid positive number.");
    }
  };

  const triggerEdge = (e) => {
    e.stopPropagation(); 
    setEdgeStep(1);
  };

  const handleEdgeClick = () => {
    if (edgeStep === 1) {
      setEdgeStep(2); 
    } else if (edgeStep === 2) {
      setEdgeStep(3); 
    } else if (edgeStep === 3) {
      setEdgeStep(0); 
      setCardFlipped(true); 
    }
  };

  const profitLoss = totalEarned - totalSpent;
  const isProfit = profitLoss >= 0;

  return (
    <div className="app-wrapper" style={{ backgroundImage: `url(${bgImg})` }}>
      
      {/* 📊 Profit Loss (Now uses CSS classes for mobile styling) */}
      <div className="profit-tracker">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ color: '#d1d5db' }}>Profit/Loss:</span>
          <span style={{ color: isProfit ? '#4ade80' : '#ef4444' }}>
            {profitLoss.toLocaleString()} IDR
          </span>
        </div>
        <button 
          type="button"
          className="add-amount-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDeduct();
          }}
          title="Add earnings from card sales"
        >
          + Add Amount
        </button>
      </div>

      <div className="content-overlay">
        
        <header className="header-controls">
          <h1>MTG Pack Simulator</h1>
          <div className="controls">
            <input 
              type="text" 
              value={setCode} 
              onChange={(e) => setSetCode(e.target.value)} 
              placeholder="Set Code (woe, mh3)"
              maxLength={5}
            />
            <button onClick={openPack} disabled={loading}>
              {loading ? "Opening..." : "Open Pack"}
            </button>
            <label className="bg-upload">
              Upload Playmat
              <input type="file" accept="image/*" onChange={handleBgUpload} />
            </label>
          </div>
          {errorMsg && <div className="error-message">{errorMsg}</div>}
        </header>

        {/* scatter area calculation */}
        <div className="revealed-area">
          {revealedCards.map((card, idx) => (
            <div key={`${card.id}-${idx}`} className="revealed-card" style={card.scatterStyle}>
              <div className={`revealed-card-inner ${card.isFoil ? 'foil' : ''}`}>
                <img src={card.image || cardBackImg} alt={card.name || 'Revealed Card'} />
              </div>
            </div>
          ))}
        </div>

        {/* current stack */}
        {pack.length > 0 && currentIndex < pack.length && (
          <div className="stack-area">
            <div className="stack-container" onClick={handleStackClick}>
              
              {/* deck depth */}
              {Array.from({ length: Math.min(4, pack.length - currentIndex - 1) }).map((_, i) => (
                <img 
                  key={`depth-${i}`} 
                  src={cardBackImg} 
                  className="stack-depth-card" 
                  style={{ transform: `translate(${ (i + 1) * 3 }px, ${ (i + 1) * 3 }px)` }} 
                  alt="Stack depth"
                />
              ))}
              
              <div key={currentIndex} className={`card-container top-card ${cardFlipped ? 'flipped' : ''}`}>
                <div className="card-inner">
                  <div className="card-front">
                    <img src={cardBackImg} alt="Card Back" />
                  </div>
                  <div className={`card-back ${pack[currentIndex].isFoil ? 'foil' : ''}`}>
                    <img src={pack[currentIndex].image || cardBackImg} alt={pack[currentIndex].name || 'Unknown Card'} />
                  </div>
                </div>
              </div>
            </div>

            {currentIndex + 1 < pack.length && pack[currentIndex + 1]?.image && (
              <img src={pack[currentIndex + 1].image} style={{ display: 'none' }} alt="preload" />
            )}

            <button 
              className="edge-btn" 
              onClick={triggerEdge}
              style={{ visibility: cardFlipped ? 'hidden' : 'visible' }}
            >
              Peek at the Rarity/Card ID?
            </button>
          </div>
        )}

        {pack.length > 0 && currentIndex >= pack.length && (
          <div className="pack-complete-msg">Nothing to see here...</div>
        )}
      </div>

      {edgeStep > 0 && pack[currentIndex] && (
        <div className="edge-overlay" onClick={handleEdgeClick}>
          <div className="edge-card-container">
            <div className={`edge-rare ${pack[currentIndex].isFoil ? 'foil' : ''}`}>
              <img src={pack[currentIndex].image || cardBackImg} alt="The Card" />
            </div>
            
            <img 
              src={cardBackImg} 
              className={`edge-cover ${edgeStep === 2 ? 'peeking' : ''} ${edgeStep === 3 ? 'revealed' : ''}`} 
              alt="Cover Card" 
            />
          </div>
          <p className="edge-hint">
            {edgeStep === 1 && "Click to peek..."}
            {edgeStep === 2 && "Click to reveal!"}
            {edgeStep === 3 && "Click to return to stack"}
          </p>
        </div>
      )}

      {isDeductOpen && (
        <div className="modal-overlay" onClick={() => setIsDeductOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Add Card Sale Earnings</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#9ca3af' }}>How much was your hit?:</p>
            <input 
              type="number"
              value={deductInput}
              onChange={(e) => setDeductInput(e.target.value)}
              placeholder="e.g. 50000"
              autoFocus
            />
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setIsDeductOpen(false)}>
                Cancel
              </button>
              <button className="confirm-btn" onClick={handleConfirmDeduction}>
                Add Earnings
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🛑 Startup Disclaimer Modal */}
      {showDisclaimer && (
        <div className="modal-overlay" style={{ zIndex: 15000 }}>
          <div className="modal-content" style={{ textAlign: 'center', maxWidth: '400px' }}>
            <h2 style={{ color: '#f87171', marginTop: 0, marginBottom: '10px' }}>DISCLAIMER!</h2>
            
            <p style={{ fontSize: '0.95rem', lineHeight: '1.5', margin: '10px 0', color: '#d1d5db' }}>
              This is an unofficial fan project. All card images, text, and icons are the intellectual property of Wizards of the Coast.
            </p>
            
            <p style={{ fontSize: '0.95rem', lineHeight: '1.5', margin: '10px 0', color: '#d1d5db' }}>
              Please note that drop rates and card treatments are simulated. You might occasionally pull Collector Booster exclusive art in these Play Boosters, so keep that in mind!
            </p>

            <p style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '15px 0', color: 'white' }}>
              Enjoy!
            </p>

            <button 
              onClick={() => setShowDisclaimer(false)}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '1rem',
                marginTop: '10px',
                width: '100%'
              }}
            >
              I Understand
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;