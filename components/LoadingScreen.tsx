'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface LoadingScreenProps {
  visible: boolean;
  message?: string;
}

const DOT_COUNT = 3;

export function LoadingScreen({ visible, message = 'Syncing atmospheric & validation data...' }: LoadingScreenProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loading-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: 'easeInOut' }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              'radial-gradient(ellipse at center, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.97) 100%)',
            backdropFilter: 'blur(2px)',
            gap: '2rem',
          }}
        >
          {/* Logo / title */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            style={{ textAlign: 'center' }}
          >
            <h1
              style={{
                fontSize: '3rem',
                fontWeight: 900,
                letterSpacing: '-0.05em',
                background: 'linear-gradient(135deg, #ffffff 0%, #93c5fd 50%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: '0.25rem',
              }}
            >
              Apna AQI
            </h1>
            <p
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              Multi-Source Intelligence
            </p>
          </motion.div>

          {/* Animated ring spinner */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            style={{ position: 'relative', width: 72, height: 72 }}
          >
            {/* Outer ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '3px solid transparent',
                borderTopColor: '#60a5fa',
                borderRightColor: '#818cf8',
              }}
            />
            {/* Inner ring */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute',
                inset: 10,
                borderRadius: '50%',
                border: '2px solid transparent',
                borderTopColor: '#a78bfa',
                borderBottomColor: '#34d399',
              }}
            />
            {/* Center dot */}
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{
                position: 'absolute',
                inset: '50%',
                transform: 'translate(-50%, -50%)',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
                top: '50%',
                left: '50%',
              }}
            />
          </motion.div>

          {/* Status message + animated dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'rgba(255,255,255,0.45)',
              fontSize: '0.8125rem',
              fontWeight: 500,
            }}
          >
            <span>{message}</span>
            <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              {Array.from({ length: DOT_COUNT }).map((_, i) => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                  style={{
                    display: 'inline-block',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#60a5fa',
                  }}
                />
              ))}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
