import { mount } from 'svelte'
import App from './shell/App.svelte'
import './shell/global.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Elemen #root tidak ditemukan di index.html')
}

mount(App, { target: rootElement })
