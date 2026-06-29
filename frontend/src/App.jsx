import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, Send, Clock, QrCode, CheckCircle2, BrainCircuit, Activity, Smartphone } from 'lucide-react';

const socket = io('http://localhost:3001');

function App() {
  const [time, setTime] = useState('08:00');
  const [status, setStatus] = useState('disconnected'); // disconnected, waiting_qr, qr_ready, authenticated
  const [qrCode, setQrCode] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [reportText, setReportText] = useState('');
  const [notification, setNotification] = useState('');
  const [scheduledTime, setScheduledTime] = useState(null);
  const [testMessage, setTestMessage] = useState('hii');
  const [isSendingTest, setIsSendingTest] = useState(false);

  const setTimePlusOneMinute = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setTime(`${hours}:${minutes}`);
  };

  useEffect(() => {
    setTimePlusOneMinute();

    socket.on('connect', () => {
      // Once connected, ask backend to initialize whatsapp
      fetch('http://localhost:3001/api/init-whatsapp', { method: 'POST' });
    });

    socket.on('qr', (url) => {
      setQrCode(url);
      setStatus('qr_ready');
    });

    socket.on('ready', () => {
      setStatus('authenticated');
    });

    socket.on('authenticated', () => {
      setStatus('authenticated');
    });

    socket.on('disconnected', () => {
      setStatus('disconnected');
    });

    socket.on('research_started', () => {
      setIsResearching(true);
      setReportText('');
      showNotification('AI is researching current coffee markets...');
    });

    socket.on('research_completed', (text) => {
      setIsResearching(false);
      setReportText(text);
      showNotification('Research complete! Sending via WhatsApp...');
    });

    socket.on('message_sent', () => {
      showNotification('Report sent successfully! ✅');
    });

    socket.on('error', (err) => {
      setIsResearching(false);
      showNotification(`Error: ${err}`);
    });

    return () => {
      socket.off('connect');
      socket.off('qr');
      socket.off('ready');
      socket.off('authenticated');
      socket.off('disconnected');
      socket.off('research_started');
      socket.off('research_completed');
      socket.off('message_sent');
      socket.off('error');
    };
  }, []);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 5000);
  };

  const handleStart = async () => {
    if (status !== 'authenticated') {
      showNotification('Please authenticate WhatsApp first!');
      return;
    }

    try {
      const res = await fetch('http://localhost:3001/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time })
      });
      const data = await res.json();
      if (data.success) {
        setScheduledTime(time);
        showNotification(`Scheduled successfully for ${time}!`);
      }
    } catch (err) {
      showNotification('Failed to start automation.');
    }
  };

  const handleSendTestMessage = async () => {
    if (!testMessage.trim()) return;
    setIsSendingTest(true);
    try {
      const res = await fetch('http://localhost:3001/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMessage })
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Test message sent successfully! ✅');
      } else {
        showNotification('Failed to send test message: ' + data.error);
      }
    } catch (err) {
      showNotification('Error sending test message.');
    }
    setIsSendingTest(false);
  };

  return (
    <>
      <div className="glass-panel">
        <div className="pulse-circle"></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--primary)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
              <Coffee size={24} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '700', lineHeight: '1.2' }}>CoffeeAI</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Automated Market Intelligence</p>
            </div>
          </div>

          <div className="status-badge">
            <div className={`status-dot ${status === 'authenticated' ? 'status-connected' : status === 'qr_ready' ? 'status-waiting' : 'status-disconnected'}`}></div>
            <span style={{ textTransform: 'capitalize' }}>
              {status === 'authenticated' ? 'Connected' : status === 'qr_ready' ? 'Scan QR' : 'Connecting'}
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {status !== 'authenticated' && (
            <motion.div
              key="qr-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="qr-container"
            >
              {status === 'qr_ready' && qrCode ? (
                <>
                  <img src={qrCode} alt="WhatsApp QR Code" style={{ width: '220px', height: '220px', borderRadius: '8px' }} />
                  <p style={{ color: '#1E293B', marginTop: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Smartphone size={18} />
                    Scan with WhatsApp to link
                  </p>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', color: '#1E293B' }}>
                  <QrCode size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                  <div className="loader" style={{ borderColor: '#E2E8F0', borderTopColor: 'var(--primary)' }}></div>
                  <p style={{ marginTop: '16px', fontWeight: '500', textAlign: 'center' }}>
                  Starting secure connection...<br/>
                  <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 'normal' }}>This can take up to 60 seconds if waking up a saved session.</span>
                </p>
                </div>
              )}
            </motion.div>
          )}

          {status === 'authenticated' && (
            <motion.div
              key="control-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckCircle2 color="#10B981" />
                <div>
                  <h3 style={{ color: '#10B981', fontSize: '0.95rem', fontWeight: '600' }}>Device Linked Successfully</h3>
                  <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.8rem', marginTop: '2px' }}>Ready to broadcast insights.</p>
                </div>
              </div>

              {/* Manual Test Message Box */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Smartphone size={16} /> Manual Connection Test
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input 
                    type="text" 
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Type a test message..."
                    className="time-input"
                    style={{ flex: 1, padding: '12px', fontSize: '1rem', textAlign: 'left', letterSpacing: 'normal' }}
                  />
                  <button 
                    onClick={handleSendTestMessage}
                    disabled={isSendingTest}
                    style={{ 
                      background: 'var(--primary)', 
                      border: 'none', 
                      color: 'white', 
                      borderRadius: '12px', 
                      padding: '0 20px', 
                      cursor: isSendingTest ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      fontSize: '0.95rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      opacity: isSendingTest ? 0.7 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    {isSendingTest ? <div className="loader" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div> : <Send size={16} />}
                    Test
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} /> Daily Broadcast Time
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="time-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    onClick={setTimePlusOneMinute}
                    style={{
                      background: 'rgba(92, 225, 230, 0.1)',
                      border: '1px solid rgba(92, 225, 230, 0.3)',
                      color: 'var(--primary-dark)',
                      borderRadius: '12px',
                      padding: '0 16px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.9rem',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(92, 225, 230, 0.2)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(92, 225, 230, 0.1)'}
                  >
                    +1 Min
                  </button>
                </div>
              </div>

              {scheduledTime && (
                <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '0.85rem', color: '#10B981', fontWeight: '500' }}>
                  ✓ Automation is currently scheduled to run daily at {scheduledTime}
                </div>
              )}

              <button
                className="btn"
                onClick={handleStart}
                disabled={isResearching}
                style={{ marginTop: '16px' }}
              >
                {isResearching ? (
                  <>
                    <div className="loader"></div>
                    Initializing AI Agent...
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    {scheduledTime ? 'Update Schedule' : 'Start Automation Engine'}
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isResearching && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ marginTop: '32px', padding: '24px', background: 'rgba(15, 23, 42, 0.8)', borderRadius: '16px', border: '1px solid rgba(92, 225, 230, 0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <BrainCircuit size={48} color="var(--primary-dark)" className="brain-glow" style={{ marginBottom: '16px' }} />
                <h3 className="research-text-gradient" style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '8px' }}>
                  Gemini Pro is Researching...
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={14} className="brain-glow" /> Scanning global coffee markets & fetching latest magazine links.
                </p>

                <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', marginTop: '24px', overflow: 'hidden', position: 'relative' }}>
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                    style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '50%', background: 'linear-gradient(90deg, transparent, var(--primary-dark), transparent)' }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed',
              bottom: '32px',
              left: '32px',
              background: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(8px)',
              padding: '12px 24px',
              borderRadius: '30px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '0.85rem',
              fontWeight: '500',
              color: 'white',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              zIndex: 9999,
              width: 'max-content',
              maxWidth: '90%',
              textAlign: 'center'
            }}
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default App;
