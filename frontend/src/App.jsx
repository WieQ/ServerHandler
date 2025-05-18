import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const tabs = ['Serwer', 'Backup', 'Logi', 'Terminal', 'O aplikacji'];

export default function App() {
  const [activeTab, setActiveTab] = useState('Serwer');
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState([]);
  const [backups, setBackups] = useState([]);
  const [autoBackup, setAutoBackup] = useState(false);
  const [isDarkMode] = useState(true);

  const [serverStatus, setServerStatus] = useState('');
  const [autoRestart, setAutoRestart] = useState(false);
  const [restartInterval, setRestartInterval] = useState(10);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [terminalCommand, setTerminalCommand] = useState('');

  const terminalInputRef = useRef(null); // <-- ref do pola tekstowego

  useEffect(() => {
    localStorage.setItem('terminalLogs', JSON.stringify(terminalLogs));
  }, [terminalLogs]);

  useEffect(() => {
    localStorage.setItem('logs', JSON.stringify(logs));
  }, [logs]);


  useEffect(() => {
    if (activeTab === 'Terminal' && terminalInputRef.current) {
      terminalInputRef.current.focus();
    }
  }, [activeTab]);

  useEffect(() => {
    const savedTerminalLogs = JSON.parse(localStorage.getItem('terminalLogs') || '[]');
    const savedLogs = JSON.parse(localStorage.getItem('logs') || '[]');
    setTerminalLogs(savedTerminalLogs);
    setLogs(savedLogs);
  }, []);

  // 1. Funkcja do pobierania backupów
  const fetchBackups = () => {
    fetch('http://localhost:5000/list-backups')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.backups)) {
          setBackups(data.backups); // <- już zawiera id, name, path
        }
      })
      .catch((err) => console.error('Błąd pobierania backupów:', err));
  };

  // 2. useEffect używa tej funkcji
  useEffect(() => {
    if (activeTab === 'Backup') {
      fetchBackups();
    }
  }, [activeTab]);



  // Aktualizacja statusu serwera co 5s
  useEffect(() => {
    const fetchStatus = () => {
      fetch('http://localhost:5000/server-status')
        .then((res) => res.json())
        .then((data) => setServerStatus(data.status || 'Nieznany'));
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Ustanawianie połączenia z backendem, aby odbierać logi w czasie rzeczywistym
  useEffect(() => {
    const fetchLogs = () => {
      fetch('http://localhost:5000/get-logs')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.logs)) {
            const newLines = data.logs
              .map(line => line.trim())
              .filter(line => line !== '');
            setLogs((prev) => [...prev, ...newLines]);
          }
        })
        .catch((err) => console.error('Błąd logów:', err));
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);


  useEffect(() => {
    const fetchTerminalLogs = () => {
      fetch('http://localhost:5000/read-terminal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.logs)) {
            const newLines = data.logs
              .map(line => line.trim())
              .filter(line => line !== '');
            setTerminalLogs((prev) => [...prev, ...newLines]);
          }
        })
        .catch((err) => console.error('Błąd terminala:', err));
    };

    fetchTerminalLogs();
    const interval = setInterval(fetchTerminalLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleClearTerminalLogs = () => {
    setTerminalLogs([]);
    localStorage.removeItem('terminalLogs');
  };

  const handleReloadLogs = () => {
    fetch('http://localhost:5000/get-all-logs')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.logs)) {
          const lines = data.logs.map(line => line.trim()).filter(line => line !== '');
          setLogs(lines);
          localStorage.setItem('logs', JSON.stringify(lines));
        }
      })
      .catch((err) => console.error('Błąd ponownego pobierania logów:', err));
  };


  const handleStartServer = () => {
    fetch('http://localhost:5000/start-server', { method: 'POST' });
  };

  const handleStopServer = () => {
    fetch('http://localhost:5000/stop-server', { method: 'POST' })
      .then(() => setMessage('Serwer zatrzymany'))
      .catch((err) => setMessage(`Błąd: ${err.message}`));
  };

  const handleCreateBackup = () => {
    fetch('http://localhost:5000/create-backup', { method: 'POST' })
      .then((res) => res.json())
      .then((result) => {
        if (result.newBackup) {
          setMessage(`Backup utworzony: ${result.newBackup.name}`);
          setBackups((prev) => [result.newBackup, ...prev]);
          fetchBackups()
        } else {
          setMessage(result.status || 'Błąd tworzenia backupu');
        }
      });
  };


  const handleAutoBackupChange = () => {
    setAutoBackup((prevState) => {
      const newAutoBackup = !prevState;
      fetch('http://localhost:5000/set-auto-backup', {
        method: 'POST',
        body: JSON.stringify({ enable: newAutoBackup }),
        headers: { 'Content-Type': 'application/json' },
      })
        .then(() => {
          setMessage(`Automatyczny backup ${newAutoBackup ? 'włączony' : 'wyłączony'}`);
        })
        .catch((err) => setMessage(`Błąd: ${err.message}`));
      return newAutoBackup;
    });
  };

  const handleDeleteBackup = (backupName) => {
    setBackups((prev) => prev.filter((b) => b.name !== backupName));

    fetch(`http://localhost:5000/delete-backup?id=${encodeURIComponent(backupName)}`, {
      method: 'DELETE',
    }).catch((err) => console.error('Błąd usuwania backupu:', err));
  };

  const handleClearLogs = () => {
    setLogs([]);
    localStorage.removeItem('logs');
  };

  const handleSendCommand = (e) => {
    e.preventDefault();
    const trimmed = terminalCommand.trim();
    if (trimmed === '') return;

    // Dodaj komendę jako linię logu
    setTerminalLogs((prev) => [...prev, `> ${trimmed}`]);

    fetch('http://localhost:5000/send-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command: trimmed }),
    })
      .then(() => setTerminalCommand(''))
      .catch((err) => {
        setTerminalLogs((prev) => [...prev, `[Błąd]: ${err.message}`]);
        console.error('Błąd wysyłania komendy:', err);
      });
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Serwer':
        return (
          <div className="server-tab">
            <div className="button-group">
              <button className="btn" onClick={handleStartServer}>🚀 Uruchom</button>
              <button className="btn" onClick={handleStopServer}>🛑 Zatrzymaj</button>
            </div>
            <p><strong>Status serwera:</strong> {serverStatus}</p>
            <label>
              <input
                type="checkbox"
                checked={autoRestart}
                onChange={(e) => setAutoRestart(e.target.checked)}
              />
              Automatyczny restart serwera
            </label>
            <div style={{ marginTop: '0.5rem' }}>
              <label>
                Interwał restartu (min. 10 minut):&nbsp;
                <input
                  type="number"
                  min="10"
                  value={restartInterval}
                  onChange={(e) => setRestartInterval(Math.max(10, parseInt(e.target.value) || 10))}
                  style={{ width: '60px' }}
                />
              </label>
              <button
                className="btn small-btn"
                onClick={() => {
                  fetch('http://localhost:5000/set-restart-server', {
                    method: 'POST',
                    body: JSON.stringify({
                      enable: autoRestart,
                      interval: restartInterval,
                    }),
                    headers: { 'Content-Type': 'application/json' },
                  })
                    .then(() => setMessage('Ustawiono automatyczny restart'))
                    .catch((err) => setMessage(`Błąd: ${err.message}`));
                }}
              >
                Zapisz ustawienia
              </button>
            </div>
            <p>{message}</p>
          </div>
        );
      case 'Backup':
        return (
          <div>
            <button className="btn" onClick={handleCreateBackup}>🗄️ Utwórz backup</button>
            <div>
              <h3>Dostępne backupy:</h3>
              <div className="backup-list">
                <ul className="data-list">
                  {backups.map((backup) => (
                    <li key={backup.id} className="backup-item">
                      <span>{backup.name}</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn small-btn"
                          onClick={() => handleLoadBackup(backup.name)}
                        >
                          Wczytaj backup
                        </button>
                        <button
                          className="btn small-btn danger"
                          onClick={() => handleDeleteBackup(backup.name)} // ← poprawka
                        >
                          🗑 Usuń
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={autoBackup}
                  onChange={handleAutoBackupChange}
                />
                Automatyczne backupy
              </label>
              <div style={{ marginTop: '0.5rem' }}>
                <label>
                  Interwał backupu (w minutach):&nbsp;
                  <input
                    type="number"
                    min="1"
                    value={restartInterval}
                    onChange={(e) => setRestartInterval(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: '60px' }}
                  />
                </label>
                <button
                  className="btn small-btn"
                  onClick={() => {
                    fetch('http://localhost:5000/set-backup-interval', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ interval: restartInterval }),
                    })
                      .then(() => setMessage('Zapisano interwał backupu'))
                      .catch((err) => setMessage(`Błąd: ${err.message}`));
                  }}
                >
                  Zapisz interwał
                </button>
              </div>
            </div>
            <p>{message}</p>
          </div>
        );
      case 'Terminal':
        return (
          <div className="logs-panel">
            <pre className="log-list">
              {terminalLogs.join('\n')}
            </pre>
            <form
              onSubmit={handleSendCommand}
              style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}
            >
              <input
                ref={terminalInputRef}
                type="text"
                value={terminalCommand}
                onChange={(e) => setTerminalCommand(e.target.value)}
                placeholder="Wpisz komendę"
                style={{ flexGrow: 1, padding: '0.5rem' }}
              />
              <button type="submit" className="btn">Wyślij</button>
              <button
                type="button"
                className="btn"
                onClick={() => handleClearTerminalLogs()}
              >
                🧹 Wyczyść terminal
              </button>
            </form>
          </div>
        );
      case 'Logi':
        return (
          <div className="logs-panel">
            <pre className="log-list">
              {logs.join('\n')}
            </pre>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn" onClick={handleReloadLogs}>🔄 Wczytaj ponownie</button>
              <button className="btn" onClick={handleClearLogs}>🧹 Wyczyść logi</button>
            </div>
          </div>
        );
      case 'O aplikacji':
        return <p>To jest prosty frontend React + backend REST API.</p>;
      default:
        return null;
    }
  };

  return (
    <div className={`container`}>
      <header>
        Minecraft Server
        <div className={`status-lamp ${serverStatus.includes('uruchomiony') ? 'green' : 'red'}`} />
      </header>
      <div className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="main-split">
        <div className="main-content">{renderTabContent()}</div>
      </div>
    </div>
  );
}
