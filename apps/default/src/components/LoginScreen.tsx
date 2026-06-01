import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, ArrowLeft, Delete } from 'lucide-react';
import { AppLogo } from './AppLogo';
import { login, register, usernameExists } from '../lib/auth';
import type { AuthUser } from '../lib/auth';

type Mode = 'home' | 'login' | 'register';

interface Props {
  onAuth: (user: AuthUser) => void;
}

// ── PIN Pad ────────────────────────────────────────────────────────────────────
function PinDots({ value }: { value: string }) {
  return (
    <div className="flex gap-3 justify-center my-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
            value.length > i
              ? 'bg-blue-500 border-blue-500 scale-110'
              : 'bg-transparent border-[#aeaea2] scale-100'
          }`}
        />
      ))}
    </div>
  );
}

function PinPad({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  const press = (k: string, e: React.PointerEvent) => {
    e.preventDefault();
    if (k === 'del') {
      onChange(value.slice(0, -1));
    } else if (k !== '' && value.length < 4) {
      onChange(value + k);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-[240px] mx-auto">
      {keys.map((k, i) => {
        if (k === '') return <div key={i} />;
        return (
          <button
            key={k}
            type="button"
            onPointerDown={(e) => press(k, e)}
            className={[
              'h-14 rounded-2xl flex items-center justify-center text-lg font-semibold',
              'select-none touch-none',
              '[touch-action:manipulation]',
              '[-webkit-tap-highlight-color:transparent]',
              'transition-transform duration-75 active:scale-90',
              k === 'del'
                ? 'bg-[#f2f2f7] border border-[#e5e5ea]/80 text-[#8e8e93] active:bg-[#e5e5ea] active:text-[#1c1c1e]'
                : 'bg-[#f2f2f7] border border-[#e5e5ea]/80 text-[#1c1c1e] active:bg-blue-500/20 active:text-blue-600',
            ].join(' ')}
          >
            {k === 'del' ? <Delete className="w-4 h-4" /> : k}
          </button>
        );
      })}
    </div>
  );
}

// ── Auth Form ──────────────────────────────────────────────────────────────────
function AuthForm({
  mode,
  onAuth,
  onBack,
}: {
  mode: 'login' | 'register';
  onAuth: (user: AuthUser) => void;
  onBack: () => void;
}) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'username' | 'pin'>('username');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'username') inputRef.current?.focus();
  }, [step]);

  const handleUsernameNext = async () => {
    const trimmed = username.trim();
    if (trimmed.length < 2) {
      setError('Mínimo 2 caracteres');
      return;
    }
    setError('');

    if (mode === 'login') {
      setLoading(true);
      try {
        const exists = await usernameExists(trimmed);
        if (!exists) {
          setError('Este usuario no está registrado');
          return;
        }
      } catch {
        setError('Error al verificar el usuario');
        return;
      } finally {
        setLoading(false);
      }
    }

    setStep('pin');
  };

  const handlePinComplete = async (finalPin: string) => {
    if (finalPin.length < 4) return;
    setLoading(true);
    setError('');
    try {
      const user =
        mode === 'login'
          ? await login(username.trim(), finalPin)
          : await register(username.trim(), finalPin);
      onAuth(user);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
      setPin('');
      setLoading(false);
    }
  };

  const handlePinChange = (v: string) => {
    setPin(v);
    setError('');
    if (v.length === 4) handlePinComplete(v);
  };

  const isLogin = mode === 'login';

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Back */}
      <button
        type="button"
        onClick={step === 'pin' ? () => { setStep('username'); setPin(''); setError(''); } : onBack}
        className="self-start flex items-center gap-1.5 text-[#8e8e93] hover:text-[#1c1c1e] text-sm transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver
      </button>

      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-[#1c1c1e]">
          {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
        </h2>
        <p className="text-[#8e8e93] text-sm mt-1">
          {step === 'username'
            ? 'Elige tu nombre de usuario'
            : isLogin
            ? `Hola ${username.trim()} — introduce tu PIN`
            : `Elige un PIN de 4 dígitos`}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === 'username' ? (
          <motion.div
            key="username"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="w-full flex flex-col gap-4"
          >
            <input
              ref={inputRef}
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleUsernameNext()}
              placeholder="nombre de usuario"
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              className="w-full px-4 py-3.5 rounded-2xl bg-[#f2f2f7] border border-[#e5e5ea] text-[#1c1c1e] placeholder-[#aeaeb2] text-center text-lg font-medium tracking-wide focus:outline-none focus:border-blue-500/50 focus:bg-white transition-all"
            />
            {error && (
              <p className="text-red-500 text-xs text-center">{error}</p>
            )}
            <button
              type="button"
              onClick={handleUsernameNext}
              disabled={username.trim().length < 2 || loading}
              className="w-full py-3.5 rounded-2xl bg-[#007aff] text-white font-semibold text-sm hover:bg-[#1a8aff] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Verificando...
                </>
              ) : (
                'Continuar'
              )}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="pin"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="w-full flex flex-col items-center gap-5"
          >
            <PinDots value={pin} />
            <PinPad value={pin} onChange={handlePinChange} />
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-xs text-center"
              >
                {error}
              </motion.p>
            )}
            {loading && (
              <div className="flex items-center gap-2 text-[#8e8e93] text-xs">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-[#e5e5ea] border-t-blue-500 animate-spin" />
                {isLogin ? 'Verificando...' : 'Creando cuenta...'}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main LoginScreen ───────────────────────────────────────────────────────────
export function LoginScreen({ onAuth }: Props) {
  const [mode, setMode] = useState<Mode>('home');

  return (
    <div className="min-h-screen bg-[#f2f2f7] text-[#1c1c1e] flex flex-col items-center justify-center relative overflow-hidden px-6">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/3 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Card */}
        <div className="bg-white border border-[#e5e5ea] rounded-3xl p-8 shadow-xl shadow-black/[0.04] backdrop-blur-sm">
          <AnimatePresence mode="wait">
            {mode === 'home' ? (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center gap-8"
              >
                {/* Logo con rebote de entrada */}
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.05 }}
                >
                  <AppLogo size="lg" />
                </motion.div>

                <motion.div
                  className="text-center space-y-2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                >
                  <h1 className="text-2xl font-bold text-[#1c1c1e] tracking-tight">
                    ¡Bienvenido a tu espacio de estudio!
                  </h1>
                  <p className="text-[#8e8e93] text-sm leading-relaxed">
                    Organiza tus asignaturas y avanza a tu ritmo 📚
                  </p>
                </motion.div>

                <motion.div
                  className="w-full flex flex-col gap-3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.25 }}
                >
                  <button
                    onClick={() => setMode('login')}
                    className="w-full py-3.5 rounded-2xl bg-[#007aff] text-white font-semibold text-sm hover:bg-[#1a8aff] transition-all shadow-md active:scale-[0.99]"
                  >
                    Iniciar sesión
                  </button>
                  <button
                    onClick={() => setMode('register')}
                    className="w-full py-3.5 rounded-2xl bg-white border border-[#e5e5ea] text-[#1c1c1e] font-medium text-sm hover:bg-[#f2f2f7] transition-all active:scale-[0.99]"
                  >
                    Crear cuenta nueva
                  </button>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <AuthForm
                  mode={mode}
                  onAuth={onAuth}
                  onBack={() => setMode('home')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-1.5 text-[#aeaeb2] text-xs mt-6 font-medium"
        >
          <Sparkles className="w-3 h-3 text-[#007aff]" />
          Powered by Taskade
        </motion.p>
      </motion.div>
    </div>
  );
}
