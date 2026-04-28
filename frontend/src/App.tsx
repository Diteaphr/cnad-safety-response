import { useState } from 'react';
import axios from 'axios';

function App() {
  const [status, setStatus] = useState<string | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);

  const requestLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      });
    } else {
      alert("Geolocation not supported");
    }
  };

  const submitStatus = async (safetyStatus: string) => {
    setStatus("Submitting...");
    try {
      const payload = {
        event_id: 1, // Mock
        user_id: 123, // Mock
        status: safetyStatus,
        location_lat: location?.lat || null,
        location_lng: location?.lng || null,
        comment: "Mobile quick report"
      };
      
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      await axios.post(`${API_URL}/reports`, payload);
      
      setStatus(`Submitted: ${safetyStatus} successfully!`);
    } catch (err) {
      setStatus(`Error: Failed to submit status.`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{ color: '#D32F2F' }}>Emergency Reporting</h1>
      <p>Please report your status immediately</p>
      
      <button onClick={requestLocation} style={{ padding: '10px', marginBottom: '20px' }}>
        {location ? "Location Captured ✓" : "Attach My Location"}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <button 
          onClick={() => submitStatus("safe")}
          style={{ background: '#4CAF50', color: 'white', padding: '20px', fontSize: '20px', border: 'none', borderRadius: '8px' }}>
          I AM SAFE
        </button>
        <button 
          onClick={() => submitStatus("need_help")}
          style={{ background: '#D32F2F', color: 'white', padding: '20px', fontSize: '20px', border: 'none', borderRadius: '8px' }}>
          I NEED HELP
        </button>
      </div>

      {status && <p style={{ marginTop: '20px', fontWeight: 'bold' }}>{status}</p>}
    </div>
  );
}

export default App;