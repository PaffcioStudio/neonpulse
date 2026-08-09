import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import MusicPlayer from './components/MusicPlayer';
import './index.css';
import './i18n/config';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<div className="text-white">...</div>}>
      <MusicPlayer />
    </Suspense>
  </React.StrictMode>,
);
