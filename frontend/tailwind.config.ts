import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // 模型品牌色（静态，不跟随主题变化）
        gpt: {
          DEFAULT: '#10A37F',
          dim: '#10A37F33',
          glow: '#10A37F66',
        },
        gemini: {
          DEFAULT: '#A855F7',
          end: '#06B6D4',
          dim: '#A855F733',
        },
        grok: {
          DEFAULT: '#00D4FF',
          dim: '#00D4FF33',
          glow: '#00D4FF66',
        },
        // bg-* 和 text-* 颜色通过 CSS @layer utilities 定义
        // 以支持动态主题切换（Tailwind JIT 会把 config 中的 CSS 变量值烤死）
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.4s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'typing': 'typing 1.2s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'gradient-x': 'gradientX 3s ease infinite',
        'slide-in-left': 'slideInLeft 0.3s ease-out forwards',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        typing: {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '30%': { transform: 'translateY(-4px)', opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        gradientX: {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
      },
      backgroundSize: {
        '200': '200% 200%',
      },
      boxShadow: {
        'gpt': '0 0 20px rgba(16,163,127,0.3)',
        'gemini': '0 0 20px rgba(168,85,247,0.3)',
        'grok': '0 0 20px rgba(0,212,255,0.3)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'input': '0 8px 32px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
} satisfies Config
