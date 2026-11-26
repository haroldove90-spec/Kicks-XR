import React, {useEffect, useRef, useState} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Briefcase,
  Camera,
  Check,
  Delete,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Mail,
  MapPin,
  Package,
  Phone,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  User,
  Users,
  X,
} from 'lucide-react';
import welcomeMascotImg from '../assets/images/homeli_welcome_mascot_1795718271921.jpg';
import heartMascotImg from '../assets/images/homeli_heart_mascot_1795718294797.jpg';
import phoneMascotImg from '../assets/images/homeli_phone_mascot_1795718272587.jpg';
import notifyMascotImg from '../assets/images/homeli_notify_mascot_1795718273393.jpg';
import {api, setAuthToken} from '../lib/api';
import {compressImageFile} from '../lib/image';
import type {
  AuthUser,
  HomeliAccountMode,
  HomeliLanguage,
  PopupAlert,
} from '../types';
import {BrandLogo} from './BrandLogo';

export type OnboardingStep =
  | 'welcome'
  | 'language'
  | 'usage'
  | 'location'
  | 'auth-hub'
  | 'phone'
  | 'otp'
  | 'email-login'
  | 'register'
  | 'complete-profile'
  | 'notifications';

interface HomeliOnboardingFlowProps {
  isReturningUser: boolean;
  rememberedEmail?: string;
  initialLanguage?: HomeliLanguage;
  onAuthenticated: (user: AuthUser, rememberEmail?: string) => void;
  onAdminAccess: () => void;
  onPushAlert: (alert: Omit<PopupAlert, 'id'>) => void;
}

const CITIES_MX = [
  'Puebla, México',
  'Ciudad de México, México',
  'Guadalajara, México',
  'Monterrey, México',
  'Querétaro, México',
  'Mérida, México',
  'León, México',
  'Tijuana, México',
  'Cancún, México',
  'Toluca, México',
  'Otra ciudad',
];

const INTEREST_OPTIONS: Array<{id: string; es: string; en: string}> = [
  {id: 'Servicios del hogar', es: 'Servicios del hogar', en: 'Home services'},
  {id: 'Compras', es: 'Compras', en: 'Shopping'},
  {id: 'Fitness', es: 'Fitness', en: 'Fitness'},
  {id: 'Mascotas', es: 'Mascotas', en: 'Pets'},
  {id: 'Tecnología', es: 'Tecnología', en: 'Technology'},
  {id: 'Lavado de tenis', es: 'Lavado de tenis', en: 'Sneaker care'},
];

const GoogleMark: React.FC = () => (
  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.85z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.07 7.93-2.89l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.09A12 12 0 0 0 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.31A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.58.38-2.31V6.6H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l4-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.6l4 3.09C6.23 6.86 8.88 4.75 12 4.75z"
    />
  </svg>
);

const AppleMark: React.FC = () => (
  <svg className="h-5 w-5 shrink-0 fill-[#111827]" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M16.365 1.43c0 1.14-.465 2.265-1.24 3.07-.81.84-2.11 1.49-3.27 1.395-.145-1.125.435-2.31 1.21-3.09.84-.84 2.225-1.455 3.3-1.375zm4.59 16.585c-.38.865-.83 1.66-1.38 2.385-.725.955-1.32 1.615-1.78 1.98-.71.61-1.47.925-2.285.945-.585 0-1.29-.165-2.11-.505-.82-.335-1.575-.5-2.26-.5-.72 0-1.495.165-2.325.5-.83.34-1.505.515-2.025.53-.78.03-1.56-.295-2.345-.97-.5-.43-1.12-1.12-1.855-2.07-.795-1.035-1.45-2.235-1.965-3.6C.28 15.245 0 13.88 0 12.605c0-1.57.39-2.925 1.17-4.065.61-.895 1.425-1.6 2.445-2.115 1.02-.515 2.12-.78 3.3-.8.65 0 1.5.2 2.555.59 1.05.395 1.725.595 2.025.595.225 0 .99-.235 2.29-.7 1.23-.435 2.27-.615 3.125-.55 2.31.185 4.045 1.095 5.205 2.735-2.065 1.25-3.085 3.005-3.06 5.26.02 1.755.66 3.215 1.915 4.38.57.54 1.24.955 2.01 1.245-.16.47-.335.92-.525 1.355z" />
  </svg>
);

const FacebookMark: React.FC = () => (
  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#1877F2" />
    <path
      fill="#FFFFFF"
      d="M15.12 12.88l.46-3h-2.88V7.93c0-.82.4-1.62 1.69-1.62h1.31V3.76S14.51 3.55 13.38 3.55c-2.37 0-3.92 1.44-3.92 4.04v2.29H6.82v3h2.64V20.5a10.6 10.6 0 0 0 3.24 0v-7.62h2.42z"
    />
  </svg>
);

const MexicoFlag: React.FC<{className?: string}> = ({className = 'h-6 w-6'}) => (
  <svg viewBox="0 0 32 32" className={`${className} rounded-full shrink-0 shadow-xs`} aria-hidden="true">
    <rect x="0" y="0" width="11" height="32" fill="#006847" />
    <rect x="11" y="0" width="10" height="32" fill="#FFFFFF" />
    <rect x="21" y="0" width="11" height="32" fill="#CE1126" />
    <circle cx="16" cy="16" r="2.7" fill="#8C6239" />
  </svg>
);

const UsFlag: React.FC<{className?: string}> = ({className = 'h-6 w-6'}) => (
  <svg viewBox="0 0 32 32" className={`${className} rounded-full shrink-0 shadow-xs`} aria-hidden="true">
    <rect width="32" height="32" fill="#FFFFFF" />
    <rect y="0" width="32" height="4" fill="#B22234" />
    <rect y="8" width="32" height="4" fill="#B22234" />
    <rect y="16" width="32" height="4" fill="#B22234" />
    <rect y="24" width="32" height="4" fill="#B22234" />
    <rect x="0" y="0" width="15" height="16" fill="#3C3B6E" />
  </svg>
);

const MapPinIllustration: React.FC = () => (
  <svg viewBox="0 0 120 90" className="h-20 w-28 mx-auto" fill="none" aria-hidden="true">
    <path
      d="M14 68L40 56L72 68L106 54L96 22L66 34L36 22L8 34L14 68Z"
      fill="#DDF2DC"
      stroke="#9FD9A0"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path d="M40 56L36 22" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
    <path d="M72 68L66 34" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
    <path d="M16 50L96 42" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
    <ellipse cx="64" cy="52" rx="14" ry="5" fill="#0B1A42" fillOpacity="0.16" />
    <path
      d="M64 10C53.5 10 45 18.5 45 29C45 42.5 64 53 64 53C64 53 83 42.5 83 29C83 18.5 74.5 10 64 10Z"
      fill="#EF4444"
    />
    <circle cx="64" cy="28" r="7.5" fill="#FFFFFF" />
  </svg>
);

const GlobeRocketIllustration: React.FC = () => (
  <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] via-[#2563EB] to-[#1D4ED8] shadow-lg shadow-blue-500/25">
    <Globe className="h-9 w-9 text-white/95" />
    <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#F5B71A] text-[#0B1A42] shadow-sm">
      <Sparkles className="h-3.5 w-3.5" />
    </span>
  </div>
);

export const HomeliOnboardingFlow: React.FC<HomeliOnboardingFlowProps> = ({
  isReturningUser,
  rememberedEmail = '',
  initialLanguage = 'es',
  onAuthenticated,
  onAdminAccess,
  onPushAlert,
}) => {
  const [step, setStep] = useState<OnboardingStep>(
    isReturningUser ? 'email-login' : 'welcome',
  );
  const [language, setLanguage] = useState<HomeliLanguage>(initialLanguage);
  const [accountMode, setAccountMode] = useState<HomeliAccountMode>('usuario');
  const [locationGranted, setLocationGranted] = useState(false);
  const [detectedMapsUrl, setDetectedMapsUrl] = useState<string | undefined>(
    undefined,
  );
  const [requestingLocation, setRequestingLocation] = useState(false);

  // Authenticated user during post-auth steps (11 & 12)
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);
  const [pendingRememberEmail, setPendingRememberEmail] = useState<
    string | undefined
  >(undefined);

  // Email Login state (Screen 9)
  const [loginEmail, setLoginEmail] = useState(rememberedEmail);
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Register state (Screen 10)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  // Phone OTP state (Screens 7 & 8)
  const [otpPhone, setOtpPhone] = useState('');
  const [otpMaskedPhone, setOtpMaskedPhone] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpInstantCode, setOtpInstantCode] = useState<string | null>(null);

  // Complete Profile state (Screen 11)
  const [profName, setProfName] = useState('');
  const [profCity, setProfCity] = useState('Puebla, México');
  const [profBirthDate, setProfBirthDate] = useState('');
  const [profGender, setProfGender] = useState('Masculino');
  const [profInterests, setProfInterests] = useState<string[]>([
    'Servicios del hogar',
    'Lavado de tenis',
  ]);
  const [profAvatar, setProfAvatar] = useState<string | undefined>(undefined);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // UI feedback states
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<{title: string; body: string} | null>(
    null,
  );

  const isEn = language === 'en';

  // Password live validators (Screen 10)
  const passHasLen = regPassword.length >= 8;
  const passHasCase = /[a-z]/.test(regPassword) && /[A-Z]/.test(regPassword);
  const passHasNumOrSym = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(
    regPassword,
  );

  // OTP countdown timer
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const t = window.setInterval(() => {
      setOtpCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [otpCountdown]);

  // Allow keyboard typing on OTP step (Screen 8)
  useEffect(() => {
    if (step !== 'otp') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleOtpDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        handleOtpBackspace();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, otpDigits, busy]);

  const goToStep = (next: OnboardingStep) => {
    setError(null);
    setStep(next);
  };

  const handleRequestLocation = () => {
    setError(null);
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setLocationGranted(false);
      goToStep('auth-hub');
      return;
    }
    setRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRequestingLocation(false);
        setLocationGranted(true);
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setDetectedMapsUrl(`https://www.google.com/maps?q=${lat},${lng}`);
        onPushAlert({
          title: isEn ? 'Location enabled' : 'Ubicación activada',
          message: isEn
            ? 'We will show nearby services and faster delivery options.'
            : 'Mostraremos servicios cercanos y entregas más rápidas en tu zona.',
          tone: 'success',
        });
        goToStep('auth-hub');
      },
      () => {
        setRequestingLocation(false);
        setLocationGranted(false);
        goToStep('auth-hub');
      },
      {timeout: 6000, maximumAge: 60000},
    );
  };

  const handleSocialClick = (provider: 'Google' | 'Apple' | 'Facebook') => {
    setInfoModal({
      title: isEn ? `Continue with ${provider}` : `Continuar con ${provider}`,
      body: isEn
        ? `${provider} sign-in is ready to connect once ${provider} OAuth credentials are configured in production. Meanwhile, sign in or register instantly using your Email or Phone number.`
        : `El acceso con ${provider} está preparado en la interfaz y se activará al enlazar tus credenciales oficiales de ${provider}. Mientras tanto, puedes ingresar o crear tu cuenta al instante con tu Correo electrónico o Teléfono.`,
    });
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginEmail.trim() || !loginPassword) {
      setError(
        isEn
          ? 'Enter your email and password.'
          : 'Ingresa tu correo electrónico y contraseña.',
      );
      return;
    }
    setBusy(true);
    try {
      const res = await api.loginClient({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      setAuthToken(res.token);
      const remembered = rememberMe ? loginEmail.trim() : undefined;

      if (!res.user.profileCompleted && !isReturningUser) {
        setPendingUser(res.user);
        setPendingRememberEmail(remembered);
        setProfName(res.user.name || '');
        if (res.user.city) setProfCity(res.user.city);
        goToStep('complete-profile');
      } else {
        onAuthenticated(res.user, remembered);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Invalid credentials.'
            : 'No se pudo iniciar sesión. Verifica tus datos.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (regName.trim().length < 2) {
      setError(isEn ? 'Enter your full name.' : 'Ingresa tu nombre completo.');
      return;
    }
    if (!regEmail.includes('@')) {
      setError(
        isEn ? 'Enter a valid email address.' : 'Ingresa un correo electrónico válido.',
      );
      return;
    }
    if (regPhone.replace(/\D/g, '').length < 10) {
      setError(
        isEn
          ? 'Enter a valid 10-digit phone number.'
          : 'Ingresa un número de teléfono válido (10 dígitos).',
      );
      return;
    }
    if (!passHasLen || !passHasCase || !passHasNumOrSym) {
      setError(
        isEn
          ? 'Your password must meet all 3 security requirements.'
          : 'Tu contraseña debe cumplir los 3 requisitos de seguridad.',
      );
      return;
    }
    if (!acceptedTerms) {
      setError(
        isEn
          ? 'Please accept the Terms and Privacy Policy to continue.'
          : 'Acepta los Términos y Condiciones para crear tu cuenta.',
      );
      return;
    }

    setBusy(true);
    try {
      const res = await api.registerClient({
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        whatsapp: regPhone.trim(),
        password: regPassword,
        language,
        accountMode,
        locationGranted,
        mapsUrl: detectedMapsUrl,
      });
      setAuthToken(res.token);
      setPendingUser(res.user);
      setPendingRememberEmail(regEmail.trim().toLowerCase());
      setProfName(res.user.name || regName.trim());
      goToStep('complete-profile');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not create account.'
            : 'No se pudo crear tu cuenta.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    if (otpPhone.replace(/\D/g, '').length < 10) {
      setError(
        isEn
          ? 'Enter a valid 10-digit phone number.'
          : 'Ingresa un número de teléfono válido (10 dígitos).',
      );
      return;
    }
    setBusy(true);
    try {
      const res = await api.requestPhoneOtp({
        phone: otpPhone.trim(),
        countryCode: '+52',
      });
      setOtpMaskedPhone(res.maskedPhone);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpCountdown(30);
      setOtpInstantCode(res.instantCode || null);
      goToStep('otp');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not send verification code.'
            : 'No se pudo enviar el código de verificación.',
      );
    } finally {
      setBusy(false);
    }
  };

  const submitOtpCode = async (fullCode: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.verifyPhoneOtp({
        phone: otpPhone.trim(),
        code: fullCode,
        language,
        accountMode,
        locationGranted,
      });
      setAuthToken(res.token);
      if (res.isNewUser) {
        setPendingUser(res.user);
        setProfName(
          res.user.name && res.user.name !== 'Usuario Homeli' ? res.user.name : '',
        );
        goToStep('complete-profile');
      } else {
        onAuthenticated(res.user, res.user.email || res.user.whatsapp);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Invalid code. Try again.'
            : 'Código incorrecto. Intenta nuevamente.',
      );
      setOtpDigits(['', '', '', '', '', '']);
    } finally {
      setBusy(false);
    }
  };

  const handleOtpDigitPress = (digit: string) => {
    if (busy) return;
    setError(null);
    const nextIdx = otpDigits.findIndex((d) => d === '');
    if (nextIdx === -1) return;
    const updated = [...otpDigits];
    updated[nextIdx] = digit;
    setOtpDigits(updated);
    if (nextIdx === 5) {
      void submitOtpCode(updated.join(''));
    }
  };

  const handleOtpBackspace = () => {
    if (busy) return;
    setError(null);
    const updated = [...otpDigits];
    for (let i = 5; i >= 0; i -= 1) {
      if (updated[i] !== '') {
        updated[i] = '';
        setOtpDigits(updated);
        return;
      }
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setProfAvatar(compressed);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar la fotografía.',
      );
    }
    e.target.value = '';
  };

  const toggleInterest = (id: string) => {
    setProfInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleProfileContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.completeClientOnboarding({
        name: profName.trim() || pendingUser?.name || 'Usuario Homeli',
        city: profCity,
        birthDate: profBirthDate || undefined,
        gender: profGender,
        interests: profInterests,
        avatarDataUrl: profAvatar,
        language,
        accountMode,
        locationGranted,
        mapsUrl: detectedMapsUrl,
        profileCompleted: true,
      });
      setPendingUser(res.user);
      goToStep('notifications');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar tu perfil. Intenta de nuevo.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleFinishNotifications = async (enablePush: boolean) => {
    setBusy(true);
    let granted = false;
    if (enablePush && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        granted = perm === 'granted';
      } catch {
        granted = false;
      }
    }

    try {
      const res = await api.completeClientOnboarding({
        notificationsGranted: granted || enablePush,
        profileCompleted: true,
      });
      onAuthenticated(res.user, pendingRememberEmail);
    } catch {
      if (pendingUser) {
        onAuthenticated(
          {
            ...pendingUser,
            notificationsGranted: granted || enablePush,
            profileCompleted: true,
          },
          pendingRememberEmail,
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const formatCountdown = (secs: number) =>
    `00:${String(Math.max(0, secs)).padStart(2, '0')}`;

  return (
    <div className="min-h-screen w-full bg-[#E9EEF8] sm:py-6 sm:px-4 flex items-center justify-center">
      <div className="w-full max-w-[430px] min-h-screen sm:min-h-[780px] sm:rounded-[34px] bg-gradient-to-b from-[#F5F7FE] via-[#F9FAFF] to-[#EEF2FC] sm:shadow-2xl sm:shadow-[#0B1A42]/15 sm:border sm:border-white flex flex-col justify-between overflow-hidden relative">
        {/* Main Step Viewport */}
        <div className="flex-1 flex flex-col px-6 pt-6 pb-5">
          {/* ========================================================== */}
          {/* SCREEN 2: WELCOME ("Todo para tu hogar en una sola app")   */}
          {/* ========================================================== */}
          {step === 'welcome' && (
            <div className="flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => goToStep('email-login')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#0B1A42]/70 hover:text-[#0B1A42] min-h-[38px] px-2 -ml-2 cursor-pointer"
                >
                  <span>{isEn ? 'Already have an account?' : 'Ya tengo cuenta'}</span>
                </button>
                <button
                  type="button"
                  onClick={onAdminAccess}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B1A42]/45 hover:text-[#0B1A42] min-h-[36px] px-2 cursor-pointer"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Admin</span>
                </button>
              </div>

              <div className="text-center space-y-2.5 pt-2">
                <h1 className="font-display text-[28px] font-extrabold text-[#0B1A42] leading-[1.15] tracking-tight">
                  {isEn ? (
                    <>
                      Everything for your home
                      <br />
                      in one app
                    </>
                  ) : (
                    <>
                      Todo para tu hogar
                      <br />
                      en una sola app
                    </>
                  )}
                </h1>
                <p className="text-xs sm:text-[13px] font-medium text-[#4A5778]">
                  {isEn
                    ? 'Services · Shopping · Businesses · Messages · Deliveries'
                    : 'Servicios · Compras · Negocios · Mensajes · Entregas'}
                </p>
              </div>

              <div className="my-4 relative rounded-3xl overflow-hidden shadow-md shadow-[#0B1A42]/10 border border-white">
                <img
                  src={welcomeMascotImg}
                  alt="Mascota Homeli"
                  className="w-full h-64 sm:h-72 object-cover select-none"
                />
              </div>

              <div className="space-y-4 pb-1">
                <div className="flex items-center justify-center gap-2" aria-hidden="true">
                  <span className="h-2 w-2 rounded-full bg-[#0B1A42]" />
                  <span className="h-2 w-2 rounded-full bg-[#CBD5E8]" />
                  <span className="h-2 w-2 rounded-full bg-[#CBD5E8]" />
                </div>

                <button
                  type="button"
                  onClick={() => goToStep('language')}
                  className="w-full min-h-[54px] rounded-2xl bg-[#0B1A42] px-6 text-base font-bold text-white shadow-lg shadow-[#0B1A42]/20 hover:bg-[#132963] active:scale-[0.98] transition-all flex items-center justify-center gap-2 relative cursor-pointer"
                >
                  <span>{isEn ? 'Get started' : 'Comenzar'}</span>
                  <ArrowRight className="h-5 w-5 absolute right-5" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* SCREEN 3: SELECT LANGUAGE                                  */}
          {/* ========================================================== */}
          {step === 'language' && (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => goToStep('welcome')}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#0B1A42] hover:bg-[#0B1A42]/5 -ml-2 cursor-pointer"
                  aria-label="Regresar"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

                <div className="mt-4 text-center space-y-3">
                  <GlobeRocketIllustration />
                  <h1 className="font-display text-2xl font-extrabold text-[#0B1A42] leading-tight">
                    {isEn ? 'Select your language' : 'Selecciona tu idioma'}
                  </h1>
                </div>

                <div className="mt-7 space-y-3">
                  <button
                    type="button"
                    onClick={() => setLanguage('es')}
                    className={`w-full rounded-2xl border-2 p-4 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
                      language === 'es'
                        ? 'border-[#3B82F6] bg-[#EAF2FF]'
                        : 'border-[#DCE3F2] bg-white hover:border-[#B6C4E2]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <MexicoFlag className="h-9 w-9" />
                      <div>
                        <div className="font-display text-base font-extrabold text-[#0B1A42]">
                          Español
                        </div>
                        <div className="text-xs text-[#556282]">
                          Idioma principal
                        </div>
                      </div>
                    </div>
                    {language === 'es' && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0B1A42] text-white">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`w-full rounded-2xl border-2 p-4 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
                      language === 'en'
                        ? 'border-[#3B82F6] bg-[#EAF2FF]'
                        : 'border-[#DCE3F2] bg-white hover:border-[#B6C4E2]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <UsFlag className="h-9 w-9" />
                      <div>
                        <div className="font-display text-base font-extrabold text-[#0B1A42]">
                          English
                        </div>
                        <div className="text-xs text-[#556282]">
                          Secondary language
                        </div>
                      </div>
                    </div>
                    {language === 'en' && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0B1A42] text-white">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => goToStep('usage')}
                className="mt-8 w-full min-h-[54px] rounded-2xl bg-[#0B1A42] px-6 text-base font-bold text-white shadow-lg shadow-[#0B1A42]/20 hover:bg-[#132963] active:scale-[0.98] transition-all flex items-center justify-center relative cursor-pointer"
              >
                <span>{isEn ? 'Continue' : 'Continuar'}</span>
                <ArrowRight className="h-5 w-5 absolute right-5" />
              </button>
            </div>
          )}

          {/* ========================================================== */}
          {/* SCREEN 4: HOW WILL YOU USE HOMELI?                         */}
          {/* ========================================================== */}
          {step === 'usage' && (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => goToStep('language')}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#0B1A42] hover:bg-[#0B1A42]/5 -ml-2 cursor-pointer"
                  aria-label="Regresar"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

                <div className="text-center space-y-1.5">
                  <img
                    src={heartMascotImg}
                    alt="Mascota Homeli"
                    className="h-28 w-auto mx-auto object-contain rounded-2xl mix-blend-multiply select-none"
                  />
                  <h1 className="font-display text-2xl font-extrabold text-[#0B1A42] leading-tight">
                    {isEn ? 'How will you use Homeli?' : '¿Cómo usarás Homeli?'}
                  </h1>
                  <p className="text-xs font-medium text-[#5A6787]">
                    {isEn ? 'You can change this later' : 'Puedes cambiarlo después'}
                  </p>
                </div>

                <div className="mt-5 space-y-3">
                  {(
                    [
                      {
                        id: 'usuario',
                        title: isEn ? 'User' : 'Usuario',
                        desc: isEn
                          ? 'To receive services, shop and enjoy'
                          : 'Para recibir servicios, comprar y disfrutar',
                        icon: User,
                        badgeBg: 'bg-blue-100 text-blue-600',
                      },
                      {
                        id: 'negocio',
                        title: isEn ? 'Business / Company' : 'Negocio / Empresa',
                        desc: isEn
                          ? 'To offer services and sell products'
                          : 'Para ofrecer servicios y vender productos',
                        icon: Store,
                        badgeBg: 'bg-amber-100 text-amber-600',
                      },
                      {
                        id: 'ambos',
                        title: isEn ? 'Both' : 'Ambos',
                        desc: isEn
                          ? 'Enjoy services and grow your business'
                          : 'Disfruta y haz crecer tu negocio',
                        icon: Users,
                        badgeBg: 'bg-indigo-100 text-indigo-600',
                      },
                    ] as const
                  ).map((opt) => {
                    const Icon = opt.icon;
                    const active = accountMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAccountMode(opt.id)}
                        className={`w-full rounded-2xl border-2 p-3.5 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
                          active
                            ? 'border-[#3B82F6] bg-[#EAF2FF]'
                            : 'border-[#DCE3F2] bg-white hover:border-[#B6C4E2]'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${opt.badgeBg}`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-display text-sm sm:text-base font-extrabold text-[#0B1A42]">
                              {opt.title}
                            </div>
                            <div className="text-xs text-[#556282] leading-snug">
                              {opt.desc}
                            </div>
                          </div>
                        </div>
                        {active && (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0B1A42] text-white">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => goToStep('location')}
                className="mt-6 w-full min-h-[54px] rounded-2xl bg-[#0B1A42] px-6 text-base font-bold text-white shadow-lg shadow-[#0B1A42]/20 hover:bg-[#132963] active:scale-[0.98] transition-all flex items-center justify-center relative cursor-pointer"
              >
                <span>{isEn ? 'Continue' : 'Continuar'}</span>
                <ArrowRight className="h-5 w-5 absolute right-5" />
              </button>
            </div>
          )}

          {/* ========================================================== */}
          {/* SCREEN 5: ALLOW LOCATION                                   */}
          {/* ========================================================== */}
          {step === 'location' && (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => goToStep('usage')}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#0B1A42] hover:bg-[#0B1A42]/5 -ml-2 cursor-pointer"
                  aria-label="Regresar"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

                <div className="mt-4 text-center space-y-2.5">
                  <MapPinIllustration />
                  <h1 className="font-display text-2xl font-extrabold text-[#0B1A42]">
                    {isEn ? 'Allow location' : 'Permitir ubicación'}
                  </h1>
                  <p className="text-xs sm:text-sm text-[#556282] max-w-[260px] mx-auto leading-relaxed">
                    {isEn
                      ? 'We will show you services, deals and businesses near you'
                      : 'Te mostraremos servicios, ofertas y negocios cerca de ti'}
                  </p>
                </div>

                <div className="mt-7 rounded-2xl bg-white border border-[#DCE3F2] divide-y divide-[#EEF2FA] overflow-hidden">
                  {[
                    isEn ? 'Local deals & offers' : 'Ofertas locales',
                    isEn ? 'Nearby providers' : 'Proveedores cercanos',
                    isEn ? 'Faster delivery' : 'Entrega más rápida',
                  ].map((label) => (
                    <div
                      key={label}
                      className="flex items-center justify-between px-4 py-3.5"
                    >
                      <div className="flex items-center gap-3">
                        <Check className="h-4 w-4 text-[#2563EB]" />
                        <span className="text-sm font-bold text-[#0B1A42]">
                          {label}
                        </span>
                      </div>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#22C55E] text-white">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 space-y-3 text-center">
                <button
                  type="button"
                  disabled={requestingLocation}
                  onClick={handleRequestLocation}
                  className="w-full min-h-[54px] rounded-2xl bg-[#0B1A42] px-6 text-base font-bold text-white shadow-lg shadow-[#0B1A42]/20 hover:bg-[#132963] active:scale-[0.98] transition-all flex items-center justify-center relative disabled:opacity-60 cursor-pointer"
                >
                  <span>
                    {requestingLocation
                      ? isEn
                        ? 'Enabling...'
                        : 'Activando...'
                      : isEn
                        ? 'Enable location'
                        : 'Activar ubicación'}
                  </span>
                  <ArrowRight className="h-5 w-5 absolute right-5" />
                </button>
                <button
                  type="button"
                  onClick={() => goToStep('auth-hub')}
                  className="w-full min-h-[40px] text-sm font-bold text-[#0B1A42]/75 hover:text-[#0B1A42] cursor-pointer"
                >
                  {isEn ? 'Not now' : 'Ahora no'}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* SCREEN 6: SIGN IN OR REGISTER HUB                          */}
          {/* ========================================================== */}
          {step === 'auth-hub' && (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  {!isReturningUser ? (
                    <button
                      type="button"
                      onClick={() => goToStep('location')}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-[#0B1A42] hover:bg-[#0B1A42]/5 -ml-2 cursor-pointer"
                      aria-label="Regresar"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  ) : (
                    <div className="w-10" />
                  )}
                  <BrandLogo
                    variant="homeli"
                    className="h-14 w-auto object-contain rounded-xl shadow-sm"
                  />
                  <div className="w-10" />
                </div>

                <div className="mt-4 text-center space-y-1.5">
                  <h1 className="font-display text-2xl font-extrabold text-[#0B1A42] leading-tight">
                    {isEn ? 'Sign in or Register' : 'Iniciar sesión o Registrarse'}
                  </h1>
                  <p className="text-xs text-[#556282] max-w-[260px] mx-auto">
                    {isEn
                      ? 'Sign in to keep enjoying all Homeli services'
                      : 'Ingresa para seguir disfrutando de todos los servicios de Homeli'}
                  </p>
                </div>

                <div className="mt-5 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => handleSocialClick('Google')}
                    className="w-full min-h-[48px] rounded-2xl border border-[#DCE3F2] bg-white px-4 text-sm font-bold text-[#0B1A42] hover:bg-slate-50 active:scale-[0.99] transition-all flex items-center justify-center gap-3 shadow-2xs cursor-pointer"
                  >
                    <GoogleMark />
                    <span>{isEn ? 'Continue with Google' : 'Continuar con Google'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSocialClick('Apple')}
                    className="w-full min-h-[48px] rounded-2xl border border-[#DCE3F2] bg-white px-4 text-sm font-bold text-[#0B1A42] hover:bg-slate-50 active:scale-[0.99] transition-all flex items-center justify-center gap-3 shadow-2xs cursor-pointer"
                  >
                    <AppleMark />
                    <span>{isEn ? 'Continue with Apple' : 'Continuar con Apple'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSocialClick('Facebook')}
                    className="w-full min-h-[48px] rounded-2xl border border-[#DCE3F2] bg-white px-4 text-sm font-bold text-[#0B1A42] hover:bg-slate-50 active:scale-[0.99] transition-all flex items-center justify-center gap-3 shadow-2xs cursor-pointer"
                  >
                    <FacebookMark />
                    <span>{isEn ? 'Continue with Facebook' : 'Continuar con Facebook'}</span>
                  </button>
                </div>

                <div className="my-4 flex items-center gap-3 text-xs font-semibold text-[#7A86A3]">
                  <span className="h-px flex-1 bg-[#DCE3F2]" />
                  <span>{isEn ? 'or' : 'o'}</span>
                  <span className="h-px flex-1 bg-[#DCE3F2]" />
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => goToStep('phone')}
                    className="w-full min-h-[48px] rounded-2xl border border-[#DCE3F2] bg-white px-4 text-sm font-bold text-[#0B1A42] hover:border-[#3B82F6] hover:bg-[#F5F9FF] active:scale-[0.99] transition-all flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <Phone className="h-4 w-4 text-[#2563EB]" />
                    <span>{isEn ? 'Continue with phone' : 'Ingresar con teléfono'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => goToStep('email-login')}
                    className="w-full min-h-[48px] rounded-2xl border border-[#DCE3F2] bg-white px-4 text-sm font-bold text-[#0B1A42] hover:border-[#3B82F6] hover:bg-[#F5F9FF] active:scale-[0.99] transition-all flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <Mail className="h-4 w-4 text-[#2563EB]" />
                    <span>{isEn ? 'Continue with email' : 'Ingresar con correo'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => goToStep('register')}
                    className="w-full min-h-[48px] rounded-2xl bg-[#F5B71A] px-4 text-sm font-extrabold text-[#0B1A42] hover:bg-[#E5A60D] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <span>{isEn ? 'Create new account' : 'Crear cuenta nueva'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-2.5 text-center">
                <div className="inline-flex items-center justify-center gap-2 text-[11px] font-medium text-[#5A6787]">
                  <Shield className="h-4 w-4 text-[#2563EB] shrink-0" />
                  <span>
                    {isEn
                      ? 'One access for all your Homeli services'
                      : 'Un solo acceso para todos tus servicios Homeli'}
                  </span>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={onAdminAccess}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1A42]/50 hover:text-[#0B1A42] py-1 cursor-pointer"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Acceso Administrador</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* SCREEN 7: ENTER PHONE NUMBER                               */}
          {/* ========================================================== */}
          {step === 'phone' && (
            <form
              onSubmit={handleRequestOtp}
              className="flex-1 flex flex-col justify-between"
            >
              <div>
                <button
                  type="button"
                  onClick={() => goToStep('auth-hub')}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#0B1A42] hover:bg-[#0B1A42]/5 -ml-2 cursor-pointer"
                  aria-label="Regresar"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

                <div className="mt-2 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#2563EB]">
                    <Phone className="h-6 w-6" />
                  </div>
                  <h1 className="font-display text-2xl font-extrabold text-[#0B1A42] leading-tight">
                    {isEn ? 'Enter your phone number' : 'Ingresa tu número de teléfono'}
                  </h1>
                </div>

                {error && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
                    {error}
                  </div>
                )}

                <div className="mt-6">
                  <div className="flex items-center gap-2.5 rounded-2xl border border-[#DCE3F2] bg-white px-3.5 min-h-[54px] focus-within:border-[#3B82F6] focus-within:ring-2 focus-within:ring-[#3B82F6]/20 shadow-2xs">
                    <MexicoFlag className="h-6 w-6" />
                    <span className="font-mono text-sm font-extrabold text-[#0B1A42]">
                      +52
                    </span>
                    <span className="h-5 w-px bg-[#DCE3F2]" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      required
                      value={otpPhone}
                      onChange={(e) => setOtpPhone(e.target.value)}
                      placeholder="222 628 5414"
                      className="flex-1 bg-transparent font-mono text-base font-bold text-[#0B1A42] placeholder:text-[#9AA6C0] focus:outline-none"
                    />
                  </div>
                  <p className="mt-2.5 text-center text-xs font-medium text-[#5A6787]">
                    {isEn
                      ? 'We will send you a verification code via SMS'
                      : 'Te enviaremos un código por SMS'}
                  </p>
                </div>

                <div className="mt-4">
                  <img
                    src={phoneMascotImg}
                    alt="Mascota Homeli con teléfono"
                    className="h-44 w-auto mx-auto object-contain rounded-2xl mix-blend-multiply select-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="mt-4 w-full min-h-[54px] rounded-2xl bg-[#F5B71A] px-6 text-base font-extrabold text-[#0B1A42] shadow-md shadow-[#F5B71A]/30 hover:bg-[#E5A60D] active:scale-[0.98] transition-all flex items-center justify-center relative disabled:opacity-60 cursor-pointer"
              >
                <span>
                  {busy
                    ? isEn
                      ? 'Sending...'
                      : 'Enviando...'
                    : isEn
                      ? 'Send code'
                      : 'Enviar código'}
                </span>
                <ArrowRight className="h-5 w-5 absolute right-5" />
              </button>
            </form>
          )}

          {/* ========================================================== */}
          {/* SCREEN 8: VERIFY 6-DIGIT OTP CODE + KEYPAD                 */}
          {/* ========================================================== */}
          {step === 'otp' && (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => goToStep('phone')}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#0B1A42] hover:bg-[#0B1A42]/5 -ml-2 cursor-pointer"
                  aria-label="Regresar"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

                <div className="mt-1 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white shadow-md shadow-blue-500/25">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h1 className="font-display text-2xl font-extrabold text-[#0B1A42]">
                    {isEn ? 'Verify your code' : 'Verifica tu código'}
                  </h1>
                  <p className="text-xs text-[#556282]">
                    {isEn ? 'We sent a code to' : 'Hemos enviado un código a'}{' '}
                    <strong className="font-mono text-[#0B1A42]">
                      {otpMaskedPhone || `+52 ${otpPhone}`}
                    </strong>
                  </p>
                </div>

                {/* Instant verification helper banner when Twilio SMS is not yet linked */}
                {otpInstantCode && (
                  <div className="mt-3 rounded-xl border border-[#3B82F6]/30 bg-[#EAF2FF] px-3 py-2 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#0B1A42]">
                      {isEn ? 'Your code:' : 'Tu código:'}{' '}
                      <strong className="font-mono text-sm tracking-widest text-[#1D4ED8]">
                        {otpInstantCode}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const arr = otpInstantCode.split('').slice(0, 6);
                        setOtpDigits(arr);
                        void submitOtpCode(otpInstantCode);
                      }}
                      className="rounded-lg bg-[#0B1A42] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#162F70] cursor-pointer"
                    >
                      {isEn ? 'Auto-fill' : 'Usar código'}
                    </button>
                  </div>
                )}

                {error && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 text-center">
                    {error}
                  </div>
                )}

                {/* 6 OTP Boxes */}
                <div className="mt-5 grid grid-cols-6 gap-2">
                  {otpDigits.map((digit, i) => (
                    <div
                      key={i}
                      className={`h-13 rounded-xl border-2 bg-white flex items-center justify-center font-mono text-xl font-extrabold text-[#0B1A42] transition-all ${
                        digit
                          ? 'border-[#0B1A42] shadow-2xs'
                          : 'border-[#DCE3F2]'
                      }`}
                    >
                      {digit}
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-center">
                  {otpCountdown > 0 ? (
                    <span className="text-xs font-medium text-[#5A6787]">
                      {isEn ? 'Resend code in' : 'Reenviar código en'}{' '}
                      <strong className="font-mono text-[#0B1A42]">
                        {formatCountdown(otpCountdown)}
                      </strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleRequestOtp()}
                      className="text-xs font-bold text-[#2563EB] hover:underline cursor-pointer"
                    >
                      {isEn ? 'Resend code now' : 'Reenviar código ahora'}
                    </button>
                  )}
                </div>
              </div>

              {/* On-Screen Numeric Keypad matching reference */}
              <div className="mt-5 -mx-6 -mb-5 bg-[#E6ECF7] px-3 pt-3 pb-4 rounded-t-3xl grid grid-cols-3 gap-2">
                {[
                  {n: '1', sub: ''},
                  {n: '2', sub: 'ABC'},
                  {n: '3', sub: 'DEF'},
                  {n: '4', sub: 'GHI'},
                  {n: '5', sub: 'JKL'},
                  {n: '6', sub: 'MNO'},
                  {n: '7', sub: 'PQRS'},
                  {n: '8', sub: 'TUV'},
                  {n: '9', sub: 'WXYZ'},
                ].map((k) => (
                  <button
                    key={k.n}
                    type="button"
                    disabled={busy}
                    onClick={() => handleOtpDigitPress(k.n)}
                    className="h-12 rounded-xl bg-white shadow-2xs hover:bg-slate-50 active:scale-95 transition-all flex flex-col items-center justify-center cursor-pointer"
                  >
                    <span className="font-display text-lg font-bold text-[#0B1A42] leading-none">
                      {k.n}
                    </span>
                    {k.sub && (
                      <span className="text-[9px] font-bold tracking-wider text-[#64748B] mt-0.5">
                        {k.sub}
                      </span>
                    )}
                  </button>
                ))}
                <div />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleOtpDigitPress('0')}
                  className="h-12 rounded-xl bg-white shadow-2xs hover:bg-slate-50 active:scale-95 transition-all font-display text-lg font-bold text-[#0B1A42] cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleOtpBackspace}
                  aria-label="Borrar dígito"
                  className="h-12 rounded-xl bg-white/60 hover:bg-white active:scale-95 transition-all flex items-center justify-center text-[#0B1A42] cursor-pointer"
                >
                  <Delete className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* SCREEN 9: SIGN IN WITH EMAIL (RETURNING USER DEFAULT)      */}
          {/* ========================================================== */}
          {step === 'email-login' && (
            <form
              onSubmit={handleEmailLogin}
              className="flex-1 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => goToStep('auth-hub')}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-[#0B1A42] hover:bg-[#0B1A42]/5 -ml-2 cursor-pointer"
                    aria-label="Opciones de acceso"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  {isReturningUser && (
                    <BrandLogo
                      variant="homeli"
                      className="h-10 w-auto object-contain rounded-lg"
                    />
                  )}
                  <button
                    type="button"
                    onClick={onAdminAccess}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B1A42]/45 hover:text-[#0B1A42] min-h-[36px] px-2 cursor-pointer"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Admin</span>
                  </button>
                </div>

                <div className="mt-3 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white shadow-md shadow-blue-500/20">
                    <Mail className="h-6 w-6" />
                  </div>
                  <h1 className="font-display text-2xl font-extrabold text-[#0B1A42] leading-tight">
                    {isEn ? 'Sign in with email' : 'Iniciar sesión con correo'}
                  </h1>
                </div>

                {error && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
                    {error}
                  </div>
                )}

                <div className="mt-5 space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-[#0B1A42] mb-1.5">
                      {isEn ? 'Email address' : 'Correo electrónico'}
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="w-full min-h-[48px] rounded-xl border border-[#DCE3F2] bg-white px-4 text-sm text-[#0B1A42] placeholder:text-[#9AA6C0] focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0B1A42] mb-1.5">
                      {isEn ? 'Password' : 'Contraseña'}
                    </label>
                    <div className="relative">
                      <input
                        type={showLoginPass ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full min-h-[48px] rounded-xl border border-[#DCE3F2] bg-white pl-4 pr-11 text-sm text-[#0B1A42] placeholder:text-[#9AA6C0] focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPass((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:text-[#0B1A42] cursor-pointer"
                        aria-label="Mostrar contraseña"
                      >
                        {showLoginPass ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <label className="inline-flex items-center gap-2 font-semibold text-[#0B1A42] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded accent-[#2563EB]"
                      />
                      <span>{isEn ? 'Remember me' : 'Recordarme'}</span>
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setInfoModal({
                          title: isEn
                            ? 'Password recovery'
                            : 'Recuperar contraseña',
                          body: isEn
                            ? 'You can sign in instantly with your registered phone number via SMS code, or contact Homeli support to reset your password.'
                            : 'Puedes ingresar al instante usando tu número de teléfono con código de verificación, o solicitar al equipo de Homeli el restablecimiento de tu contraseña.',
                        })
                      }
                      className="font-semibold text-[#2563EB] hover:underline cursor-pointer"
                    >
                      {isEn ? 'Forgot password?' : '¿Olvidaste tu contraseña?'}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-2 w-full min-h-[52px] rounded-2xl bg-[#0B1A42] px-6 text-base font-bold text-white shadow-lg shadow-[#0B1A42]/20 hover:bg-[#132963] active:scale-[0.98] transition-all flex items-center justify-center relative disabled:opacity-60 cursor-pointer"
                  >
                    <span>
                      {busy
                        ? isEn
                          ? 'Signing in...'
                          : 'Ingresando...'
                        : isEn
                          ? 'Sign in'
                          : 'Iniciar sesión'}
                    </span>
                    <ArrowRight className="h-5 w-5 absolute right-5" />
                  </button>
                </div>

                <div className="my-5 flex items-center gap-3 text-xs font-medium text-[#7A86A3]">
                  <span className="h-px flex-1 bg-[#DCE3F2]" />
                  <span>{isEn ? 'or continue with' : 'o continuar con'}</span>
                  <span className="h-px flex-1 bg-[#DCE3F2]" />
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSocialClick('Google')}
                    aria-label="Google"
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE3F2] bg-white hover:bg-slate-50 shadow-2xs cursor-pointer"
                  >
                    <GoogleMark />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSocialClick('Apple')}
                    aria-label="Apple"
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE3F2] bg-white hover:bg-slate-50 shadow-2xs cursor-pointer"
                  >
                    <AppleMark />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSocialClick('Facebook')}
                    aria-label="Facebook"
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE3F2] bg-white hover:bg-slate-50 shadow-2xs cursor-pointer"
                  >
                    <FacebookMark />
                  </button>
                  <button
                    type="button"
                    onClick={() => goToStep('phone')}
                    aria-label="Teléfono"
                    title="Ingresar con teléfono"
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE3F2] bg-white hover:bg-slate-50 text-[#2563EB] shadow-2xs cursor-pointer"
                  >
                    <Phone className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="mt-6 text-center space-y-2">
                <p className="text-xs font-medium text-[#5A6787]">
                  {isEn ? "Don't have an account yet?" : '¿Aún no tienes cuenta?'}{' '}
                  <button
                    type="button"
                    onClick={() => goToStep('register')}
                    className="font-extrabold text-[#0B1A42] hover:underline cursor-pointer"
                  >
                    {isEn ? 'Register' : 'Regístrate'}
                  </button>
                </p>
                {isReturningUser && (
                  <button
                    type="button"
                    onClick={() => goToStep('welcome')}
                    className="text-[11px] font-medium text-[#7A86A3] hover:text-[#0B1A42] cursor-pointer"
                  >
                    {isEn ? 'View welcome tour' : 'Ver presentación de bienvenida'}
                  </button>
                )}
              </div>
            </form>
          )}

          {/* ========================================================== */}
          {/* SCREEN 10: CREATE ACCOUNT (Usuario / Negocio + Validators) */}
          {/* ========================================================== */}
          {step === 'register' && (
            <form
              onSubmit={handleRegisterSubmit}
              className="flex-1 flex flex-col justify-between"
            >
              <div>
                <button
                  type="button"
                  onClick={() => goToStep('auth-hub')}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#0B1A42] hover:bg-[#0B1A42]/5 -ml-2 cursor-pointer"
                  aria-label="Regresar"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

                <div className="text-center space-y-1.5">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FEF3C7] text-[#F59E0B]">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h1 className="font-display text-2xl font-extrabold text-[#0B1A42]">
                    {isEn ? 'Create account' : 'Crear cuenta'}
                  </h1>
                </div>

                {/* Usuario / Negocio Tabs */}
                <div className="mt-4 grid grid-cols-2 rounded-xl bg-[#E8EEF9] p-1">
                  <button
                    type="button"
                    onClick={() => setAccountMode('usuario')}
                    className={`min-h-[38px] rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      accountMode !== 'negocio'
                        ? 'bg-white text-[#2563EB] shadow-2xs'
                        : 'text-[#5A6787]'
                    }`}
                  >
                    {isEn ? 'User' : 'Usuario'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountMode('negocio')}
                    className={`min-h-[38px] rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      accountMode === 'negocio'
                        ? 'bg-white text-[#2563EB] shadow-2xs'
                        : 'text-[#5A6787]'
                    }`}
                  >
                    {isEn ? 'Business' : 'Negocio'}
                  </button>
                </div>

                {error && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
                    {error}
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0B1A42] mb-1">
                      {isEn ? 'Full name' : 'Nombre completo'}
                    </label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder={isEn ? 'Your full name' : 'Tu nombre completo'}
                      className="w-full min-h-[44px] rounded-xl border border-[#DCE3F2] bg-white px-3.5 text-sm text-[#0B1A42] placeholder:text-[#9AA6C0] focus:border-[#3B82F6] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0B1A42] mb-1">
                      {isEn ? 'Email address' : 'Correo electrónico'}
                    </label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="w-full min-h-[44px] rounded-xl border border-[#DCE3F2] bg-white px-3.5 text-sm text-[#0B1A42] placeholder:text-[#9AA6C0] focus:border-[#3B82F6] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0B1A42] mb-1">
                      {isEn ? 'Phone number' : 'Teléfono'}
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border border-[#DCE3F2] bg-white px-3 min-h-[44px] focus-within:border-[#3B82F6]">
                      <MexicoFlag className="h-5 w-5" />
                      <span className="font-mono text-xs font-bold text-[#0B1A42]">
                        +52
                      </span>
                      <input
                        type="tel"
                        required
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="222 628 5414"
                        className="flex-1 bg-transparent font-mono text-sm text-[#0B1A42] placeholder:text-[#9AA6C0] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0B1A42] mb-1">
                      {isEn ? 'Password' : 'Contraseña'}
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPass ? 'text' : 'password'}
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full min-h-[44px] rounded-xl border border-[#DCE3F2] bg-white pl-3.5 pr-10 text-sm text-[#0B1A42] placeholder:text-[#9AA6C0] focus:border-[#3B82F6] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPass((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] cursor-pointer"
                        aria-label="Mostrar contraseña"
                      >
                        {showRegPass ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* 3 Live Password Rules */}
                    <div className="mt-2 space-y-1 text-[11px] font-semibold">
                      {[
                        {
                          ok: passHasLen,
                          label: isEn ? '8+ characters' : '8+ caracteres',
                        },
                        {
                          ok: passHasCase,
                          label: isEn
                            ? 'Uppercase and lowercase'
                            : 'Mayúscula y minúscula',
                        },
                        {
                          ok: passHasNumOrSym,
                          label: isEn ? 'Number or symbol' : 'Número o símbolo',
                        },
                      ].map((rule) => (
                        <div
                          key={rule.label}
                          className={`flex items-center gap-2 ${
                            rule.ok ? 'text-[#15803D]' : 'text-[#64748B]'
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded-full ${
                              rule.ok
                                ? 'bg-[#22C55E] text-white'
                                : 'bg-[#DCE3F2] text-white'
                            }`}
                          >
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </span>
                          <span>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 pt-1 text-[11px] text-[#556282] cursor-pointer leading-snug">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded accent-[#2563EB] shrink-0"
                    />
                    <span>
                      {isEn ? (
                        <>
                          I accept the{' '}
                          <strong className="text-[#0B1A42]">
                            Terms & Conditions
                          </strong>{' '}
                          and{' '}
                          <strong className="text-[#0B1A42]">
                            Privacy Policy
                          </strong>
                        </>
                      ) : (
                        <>
                          Acepto los{' '}
                          <strong className="text-[#0B1A42]">
                            Términos y Condiciones
                          </strong>{' '}
                          y la{' '}
                          <strong className="text-[#0B1A42]">
                            Política de Privacidad
                          </strong>
                        </>
                      )}
                    </span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="mt-5 w-full min-h-[52px] rounded-2xl bg-[#F5B71A] px-6 text-base font-extrabold text-[#0B1A42] shadow-md shadow-[#F5B71A]/30 hover:bg-[#E5A60D] active:scale-[0.98] transition-all flex items-center justify-center relative disabled:opacity-60 cursor-pointer"
              >
                <span>
                  {busy
                    ? isEn
                      ? 'Creating account...'
                      : 'Creando cuenta...'
                    : isEn
                      ? 'Create account'
                      : 'Crear cuenta'}
                </span>
                <ArrowRight className="h-5 w-5 absolute right-5" />
              </button>
            </form>
          )}

          {/* ========================================================== */}
          {/* SCREEN 11: COMPLETE YOUR PROFILE                           */}
          {/* ========================================================== */}
          {step === 'complete-profile' && (
            <form
              onSubmit={handleProfileContinue}
              className="flex-1 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10" />
                  <h1 className="font-display text-xl font-extrabold text-[#0B1A42]">
                    {isEn ? 'Complete your profile' : 'Completa tu perfil'}
                  </h1>
                  <button
                    type="button"
                    onClick={() => goToStep('notifications')}
                    className="text-xs font-bold text-[#64748B] hover:text-[#0B1A42] cursor-pointer"
                  >
                    {isEn ? 'Skip' : 'Omitir'}
                  </button>
                </div>

                {/* Avatar picker */}
                <div className="mt-4 flex flex-col items-center">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="sr-only"
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="relative group cursor-pointer"
                    aria-label="Subir foto de perfil"
                  >
                    <div className="h-20 w-20 rounded-full border-4 border-white shadow-md overflow-hidden bg-[#EAF2FF] flex items-center justify-center text-[#2563EB]">
                      {profAvatar ? (
                        <img
                          src={profAvatar}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-9 w-9" />
                      )}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#F5B71A] text-[#0B1A42] border-2 border-white shadow-sm group-hover:scale-105 transition-transform">
                      <Camera className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </div>

                {error && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700">
                    {error}
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0B1A42] mb-1">
                      {isEn ? 'Name' : 'Nombre'}
                    </label>
                    <input
                      type="text"
                      required
                      value={profName}
                      onChange={(e) => setProfName(e.target.value)}
                      placeholder={isEn ? 'Your name' : 'Tu nombre'}
                      className="w-full min-h-[44px] rounded-xl border border-[#DCE3F2] bg-white px-3.5 text-sm text-[#0B1A42] focus:border-[#3B82F6] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0B1A42] mb-1">
                      {isEn ? 'City' : 'Ciudad'}
                    </label>
                    <select
                      value={profCity}
                      onChange={(e) => setProfCity(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[#DCE3F2] bg-white px-3.5 text-sm font-medium text-[#0B1A42] focus:border-[#3B82F6] focus:outline-none"
                    >
                      {CITIES_MX.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#0B1A42] mb-1">
                        {isEn ? 'Birth date' : 'Fecha de nacimiento'}
                      </label>
                      <input
                        type="date"
                        value={profBirthDate}
                        onChange={(e) => setProfBirthDate(e.target.value)}
                        className="w-full min-h-[44px] rounded-xl border border-[#DCE3F2] bg-white px-3 text-xs sm:text-sm text-[#0B1A42] focus:border-[#3B82F6] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#0B1A42] mb-1">
                        {isEn ? 'Gender' : 'Género'}
                      </label>
                      <select
                        value={profGender}
                        onChange={(e) => setProfGender(e.target.value)}
                        className="w-full min-h-[44px] rounded-xl border border-[#DCE3F2] bg-white px-3 text-xs sm:text-sm text-[#0B1A42] focus:border-[#3B82F6] focus:outline-none"
                      >
                        <option value="Masculino">
                          {isEn ? 'Male' : 'Masculino'}
                        </option>
                        <option value="Femenino">
                          {isEn ? 'Female' : 'Femenino'}
                        </option>
                        <option value="Prefiero no decirlo">
                          {isEn ? 'Prefer not to say' : 'Prefiero no decirlo'}
                        </option>
                        <option value="Otro">{isEn ? 'Other' : 'Otro'}</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0B1A42] mb-1.5">
                      {isEn ? 'Interests' : 'Intereses'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {INTEREST_OPTIONS.map((item) => {
                        const selected = profInterests.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleInterest(item.id)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer ${
                              selected
                                ? 'border-[#3B82F6] bg-[#DCEBFF] text-[#1D4ED8]'
                                : 'border-[#DCE3F2] bg-white text-[#4A5778] hover:border-[#B6C4E2]'
                            }`}
                          >
                            {isEn ? item.en : item.es}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="mt-5 w-full min-h-[52px] rounded-2xl bg-[#0B1A42] px-6 text-base font-bold text-white shadow-lg shadow-[#0B1A42]/20 hover:bg-[#132963] active:scale-[0.98] transition-all flex items-center justify-center relative disabled:opacity-60 cursor-pointer"
              >
                <span>
                  {busy
                    ? isEn
                      ? 'Saving...'
                      : 'Guardando...'
                    : isEn
                      ? 'Continue'
                      : 'Continuar'}
                </span>
                <ArrowRight className="h-5 w-5 absolute right-5" />
              </button>
            </form>
          )}

          {/* ========================================================== */}
          {/* SCREEN 12: STAY INFORMED (NOTIFICATIONS)                   */}
          {/* ========================================================== */}
          {step === 'notifications' && (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => goToStep('complete-profile')}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#0B1A42] hover:bg-[#0B1A42]/5 -ml-2 cursor-pointer"
                  aria-label="Regresar"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

                <div className="text-center space-y-1.5">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white shadow-md shadow-blue-500/20">
                    <Bell className="h-6 w-6" />
                  </div>
                  <h1 className="font-display text-2xl font-extrabold text-[#0B1A42] leading-tight">
                    {isEn ? 'Stay always informed' : 'Mantente siempre informado'}
                  </h1>
                </div>

                <div className="mt-4 space-y-2">
                  {[
                    {
                      icon: Tag,
                      color: 'bg-amber-100 text-amber-600',
                      label: isEn ? 'Deals and promotions' : 'Ofertas y promociones',
                    },
                    {
                      icon: Bell,
                      color: 'bg-rose-100 text-rose-600',
                      label: isEn
                        ? 'Service updates'
                        : 'Actualizaciones de servicios',
                    },
                    {
                      icon: Briefcase,
                      color: 'bg-purple-100 text-purple-600',
                      label: isEn ? 'New businesses' : 'Nuevos negocios',
                    },
                    {
                      icon: Package,
                      color: 'bg-emerald-100 text-emerald-600',
                      label: isEn ? 'Status of your orders' : 'Estado de tus pedidos',
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className="rounded-xl bg-white border border-[#E2E8F5] px-3.5 py-2.5 flex items-center gap-3 shadow-2xs"
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.color}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-[#0B1A42]">
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3">
                  <img
                    src={notifyMascotImg}
                    alt="Mascota Homeli con megáfono"
                    className="h-36 w-auto mx-auto object-contain rounded-2xl mix-blend-multiply select-none"
                  />
                </div>
              </div>

              <div className="mt-3 space-y-2 text-center">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleFinishNotifications(true)}
                  className="w-full min-h-[52px] rounded-2xl bg-[#F5B71A] px-6 text-base font-extrabold text-[#0B1A42] shadow-md shadow-[#F5B71A]/30 hover:bg-[#E5A60D] active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
                >
                  {busy
                    ? isEn
                      ? 'Finishing...'
                      : 'Finalizando...'
                    : isEn
                      ? 'Enable notifications'
                      : 'Activar notificaciones'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleFinishNotifications(false)}
                  className="w-full min-h-[38px] text-sm font-bold text-[#0B1A42]/75 hover:text-[#0B1A42] cursor-pointer"
                >
                  {isEn ? 'Not now' : 'Ahora no'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Security & Trust Bar (hidden on OTP keypad step for spacious keypad) */}
        {step !== 'otp' && (
          <div className="grid grid-cols-2 border-t border-[#DCE3F2] bg-[#EAF0FC]/80 px-4 py-3 text-[11px]">
            <div className="flex items-center gap-2 pr-2 border-r border-[#DCE3F2]">
              <Shield className="h-4 w-4 text-[#0B1A42] shrink-0" />
              <div className="leading-tight">
                <div className="font-extrabold text-[#0B1A42]">
                  {isEn ? 'Secure' : 'Seguro'}
                </div>
                <div className="text-[10px] text-[#556282]">
                  {isEn ? 'Bank-level encryption' : 'Encriptación de nivel bancario'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-3">
              <Lock className="h-4 w-4 text-[#0B1A42] shrink-0" />
              <div className="leading-tight">
                <div className="font-extrabold text-[#0B1A42]">
                  {isEn ? 'Easy access' : 'Fácil acceso'}
                </div>
                <div className="text-[10px] text-[#556282]">
                  {isEn ? 'Email, phone or social' : 'Email, teléfono o redes'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Informative Modal for Social OAuth / Password Recovery */}
        {infoModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#06102B]/70 backdrop-blur-xs p-5"
            onClick={() => setInfoModal(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-lg font-extrabold text-[#0B1A42]">
                  {infoModal.title}
                </h2>
                <button
                  type="button"
                  onClick={() => setInfoModal(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-[#4A5778] leading-relaxed">
                {infoModal.body}
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setInfoModal(null);
                    goToStep('phone');
                  }}
                  className="flex-1 min-h-[44px] rounded-xl bg-[#F5B71A] text-xs font-extrabold text-[#0B1A42] hover:bg-[#E5A60D] cursor-pointer"
                >
                  {isEn ? 'Use Phone' : 'Usar Teléfono'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInfoModal(null);
                    goToStep('email-login');
                  }}
                  className="flex-1 min-h-[44px] rounded-xl bg-[#0B1A42] text-xs font-bold text-white hover:bg-[#132963] cursor-pointer"
                >
                  {isEn ? 'Use Email' : 'Usar Correo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
