import { mount } from 'svelte'
import './index.css'
import App from './App.svelte'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Elemen #root tidak ditemukan di index.html')
}

mount(App, { target: rootElement })
