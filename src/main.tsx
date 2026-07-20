import ReactDOM from 'react-dom/client';
import App from './app/App';
import { TestPage } from './app/TestPage';
import './index.css';

// Check if we're on the test page
const isTestPage = window.location.pathname === '/test' || window.location.search.includes('test');

ReactDOM.createRoot(document.getElementById('root')!).render(
  isTestPage ? <TestPage /> : <App />
);
