import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

// X5 / QQ 内置浏览器等老内核：关掉吸顶、毛玻璃、阴影，减少滚动重绘
const ua = navigator.userAgent || ''
if (/MQQBrowser|TBS\/|X5|MicroMessenger/i.test(ua)) {
  document.documentElement.classList.add('lite')
}

// 不支持 color-mix 的内核（Chrome < 111）走纯色兜底
const supportsMix =
  typeof CSS !== 'undefined' && CSS.supports && CSS.supports('color', 'color-mix(in srgb, red, blue)')
if (!supportsMix) document.documentElement.classList.add('no-mix')

createApp(App).mount('#app')
