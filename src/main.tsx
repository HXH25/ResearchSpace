import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from '@/app/App';
import '@/ui/styles.css';
import '@/ui/themes.css';
import '@/ui/preferences.css';
import '@/ui/integrations.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><HashRouter><App /></HashRouter></React.StrictMode>);
