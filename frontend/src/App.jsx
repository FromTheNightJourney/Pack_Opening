import { useState } from 'react';
import './App.css';
import cardBackImg from './assets/cardback.png';
import defaultBg from './assets/wood.png'; 

function App() {
  const [setCode, setSetCode] = useState('woe');
  const [pack, setPack] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [bgImg, setBgImg] = useState(defaultBg);
  const [currentIndex, setCurrentIndex] = useState(0); 
  const [cardFlipped, setCardFlipped] = useState(false); 
  const [revealedCards, setRevealedCards] = useState([]); 
  
  const [edgeStep, setEdgeStep] = useState(0); 

  const [totalSpent, setTotalSpent] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0); // 👈 Added tracking for card sales
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
      const res = await fetch(`http://localhost:3005/api/open-pack?set=${cleanSetCode}`);
      const data = await res.json();
      
      if (res.ok) {
        setPack(data);
        console.table(data.map((c, i) => ({ Slot: i + 1, Name: c.name, Set: c.set, Rarity: c.rarity })));
        
        // Add pack price to total spent
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
      const side = Math.random() < 0.5 ? -1 : 1;
      const xOffset = side * (Math.random() * 400 + 180); 
      const yOffset = (Math.random() - 0.5) * 500; 
      const rotation = (Math.random() - 0.5) * 60; 

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
      setTotalEarned(prev => prev + amount); // 👈 Adds to your earnings/revenue
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
      
      {/* Profit Loss */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        padding: '12px 18px',
        borderRadius: '8px',
        border: '1px solid #374151',
        fontFamily: 'monospace',
        fontSize: '1.1rem',
        fontWeight: 'bold',
        zIndex: 9999,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ color: '#d1d5db' }}>Profit/Loss:</span>
          <span style={{ color: isProfit ? '#4ade80' : '#ef4444' }}>
            {profitLoss.toLocaleString()} IDR
          </span>
        </div>
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDeduct();
          }}
          style={{
            backgroundColor: '#374151',
            color: '#d1d5db',
            border: '1px solid #4b5563',
            padding: '4px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 'normal',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#4b5563'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#374151'}
          title="Add earnings from card sales"
        >
          + Add Amount
        </button>
      </div>

      <div className="content-overlay">
        
        <header className="header-controls">
          <h1>"Need to Rip Packs" Syndrome</h1>
          <div className="controls" style={{ gap: '15px', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
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
              👀 Edge this card
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
          pointerEvents: 'auto'
        }} onClick={() => setIsDeductOpen(false)}>
          <div style={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            padding: '24px',
            borderRadius: '12px',
            width: '320px',
            color: 'white',
            fontFamily: 'sans-serif',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Add Card Sale Earnings</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#9ca3af' }}>How much was your hit?:</p>
            <input 
              type="number"
              value={deductInput}
              onChange={(e) => setDeductInput(e.target.value)}
              placeholder="e.g. 50000"
              autoFocus
              style={{
                backgroundColor: '#111827',
                border: '1px solid #4b5563',
                color: 'white',
                padding: '10px',
                borderRadius: '6px',
                fontSize: '1rem',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button 
                onClick={() => setIsDeductOpen(false)}
                style={{
                  backgroundColor: 'transparent',
                  color: '#9ca3af',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDeduction}
                style={{
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Add Earnings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;