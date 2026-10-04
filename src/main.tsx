import { render } from 'preact';
import { App } from './app/App';
import './ui/fuentes.css';
import './ui/tokens.css';
import './app/base.css';

const raiz = document.getElementById('app');
if (raiz) render(<App />, raiz);
