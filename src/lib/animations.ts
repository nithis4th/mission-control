import { Variants } from 'framer-motion';

// Card เลื่อนขึ้นมาทีละใบ (stagger)
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const fadeSlideUp: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.97,
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
};

// Sidebar menu items
export const sidebarItemVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
};

// Page transition
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

// Glow pulse สำหรับ WORKING status
export const glowPulse: Variants = {
  idle: {
    boxShadow: '0 0 10px rgba(0, 212, 255, 0.15), 0 0 30px rgba(0, 212, 255, 0.05)',
  },
  pulse: {
    boxShadow: [
      '0 0 10px rgba(0, 212, 255, 0.15), 0 0 30px rgba(0, 212, 255, 0.05)',
      '0 0 25px rgba(0, 212, 255, 0.35), 0 0 60px rgba(0, 212, 255, 0.12)',
      '0 0 10px rgba(0, 212, 255, 0.15), 0 0 30px rgba(0, 212, 255, 0.05)',
    ],
    transition: {
      duration: 2.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Badge count เปลี่ยนค่า
export const counterPop = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.3, 1],
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

// Scan line effect
export const scanLine = {
  animate: {
    y: ['-100vh', '100vh'],
    transition: {
      duration: 8,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};
