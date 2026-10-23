import { useRef, useState } from 'react';
import { useFeedback } from './use-feedback';
export function useDurableAction() {
  const notify = useFeedback();
  const lock = useRef(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const run = async (operation: () => Promise<unknown>, success = '') => {
    if (lock.current) return false; lock.current = true; setBusy(true); setError(''); setMessage('');
    try { await operation(); if (success) { setMessage(success); notify('success'); } return true; } catch (cause) { setError(cause instanceof Error ? cause.message : 'Couldn’t save this change. Please try again.'); return false; } finally { lock.current = false; setBusy(false); }
  };
  return { busy, error, message, run, setError, setMessage };
}
