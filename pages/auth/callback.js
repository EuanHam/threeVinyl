import { useEffect, useState } from 'react';
import { handleRedirect } from '../../src/spotifyAuth';

export default function Callback() {
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const processAuth = async () => {
      try {
        await handleRedirect();
        setStatus('Authentication complete! Redirecting...');
        setTimeout(() => {
          window.location.replace('/');
        }, 1000);
      } catch (error) {
        console.error('Auth error:', error);
        setStatus('Authentication failed. Redirecting...');
        setTimeout(() => {
          window.location.replace('/');
        }, 2000);
      }
    };
    processAuth();
  }, []);

  return (
    <div>
      <p>{status}</p>
    </div>
  );
}
