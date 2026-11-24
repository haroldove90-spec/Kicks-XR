import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  IdCard,
  Image as ImageIcon,
  ImageOff,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
  ZoomIn,
} from 'lucide-react';
import {api} from '../lib/api';
import {compressImageFile} from '../lib/image';
import type {
  CreatedCredentials,
  ManagedAdminUser,
  ManagedClientUser,
  PopupAlert,
} from '../types';
import {isSafePhotoDataUrl} from './AdminOrderDetailModal';
import {CameraCaptureModal} from './CameraCaptureModal';

interface AdminUsersModuleProps {
  currentAdminId: string;
  onPushAlert: (alert: Omit<PopupAlert, 'id'>) => void;
}

function generateStrongPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '#@!%$';
  const pick = (pool: string) => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return pool[arr[0] % pool.length];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  };
  return `Kxr${pick(upper)}${pick(lower)}${pick(lower)}${pick(symbols)}${pick(digits)}${pick(digits)}${pick(digits)}`;
}

export const AdminUsersModule: React.FC<AdminUsersModuleProps> = ({
  currentAdminId,
  onPushAlert,
}) => {
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<ManagedAdminUser[]>([]);
  const [clients, setClients] = useState<ManagedClientUser[]>([]);
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  // Create form state
  const [createRole, setCreateRole] = useState<'client' | 'admin'>('client');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState(() => generateStrongPassword());
  const [showPassword, setShowPassword] = useState(true);
  const [inePhotoDataUrl, setInePhotoDataUrl] = useState<string | undefined>(
    undefined,
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Camera & gallery inputs for INE
  const [cameraTarget, setCameraTarget] = useState<'create' | 'detail' | null>(
    null,
  );
  const createIneInputRef = useRef<HTMLInputElement | null>(null);
  const detailIneInputRef = useRef<HTMLInputElement | null>(null);

  // Directory state
  const [directoryTab, setDirectoryTab] = useState<'clients' | 'admins'>('clients');
  const [search, setSearch] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  // Client detail + INE viewer modal
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [updatingDetailIne, setUpdatingDetailIne] = useState(false);
  const [zoomedIne, setZoomedIne] = useState<{
    url: string;
    name: string;
    username?: string;
  } | null>(null);

  // Created / Reset credentials modal card
  const [latestCredentials, setLatestCredentials] =
    useState<CreatedCredentials | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId],
  );

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.getAdminUsers();
      setAdmins(data.admins);
      setClients(data.clients);
      setSupabaseConnected(data.supabaseConnected);
    } catch (err) {
      onPushAlert({
        title: 'Error cargando usuarios',
        message:
          err instanceof Error
            ? err.message
            : 'No se pudo consultar el directorio de usuarios.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [onPushAlert]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreateIneFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError(null);
    try {
      const compressed = await compressImageFile(file);
      setInePhotoDataUrl(compressed);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'No se pudo procesar la foto del INE.',
      );
    }
    e.target.value = '';
  };

  const handleSaveDetailIne = async (dataUrl: string) => {
    if (!selectedClient) return;
    setUpdatingDetailIne(true);
    try {
      await api.updateClientUser(selectedClient.id, {inePhotoDataUrl: dataUrl});
      await loadUsers();
      onPushAlert({
        title: 'INE actualizada',
        message: `Se guardó la identificación oficial de ${selectedClient.name}.`,
        tone: 'success',
      });
    } catch (err) {
      onPushAlert({
        title: 'Error guardando INE',
        message:
          err instanceof Error
            ? err.message
            : 'No se pudo actualizar la identificación.',
        tone: 'error',
      });
    } finally {
      setUpdatingDetailIne(false);
    }
  };

  const handleDetailIneFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      await handleSaveDetailIne(compressed);
    } catch (err) {
      onPushAlert({
        title: 'Error al procesar imagen',
        message:
          err instanceof Error
            ? err.message
            : 'No se pudo leer la foto seleccionada.',
        tone: 'error',
      });
    }
    e.target.value = '';
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    setCopied(false);

    try {
      if (createRole === 'admin') {
        const res = await api.createAdminUser({
          name: name.trim(),
          username: username.trim().toLowerCase(),
          email: email.trim() || undefined,
          whatsapp: whatsapp.trim() || undefined,
          password,
        });
        setLatestCredentials(res.credentials);
        onPushAlert({
          title: 'Administrador registrado',
          message: `${res.admin.name} (@${res.admin.username}) creado${res.supabaseSynced ? ' y guardado en Supabase' : ''}. Listo para compartir por WhatsApp.`,
          tone: 'success',
          whatsappUrl: res.credentials.whatsappUrl,
        });
        setDirectoryTab('admins');
      } else {
        const res = await api.createClientUser({
          name: name.trim(),
          username: username.trim().toLowerCase(),
          whatsapp: whatsapp.trim(),
          address: address.trim(),
          password,
          inePhotoDataUrl,
        });
        setLatestCredentials(res.credentials);
        onPushAlert({
          title: 'Cliente / alumno registrado',
          message: `${res.client.name}${res.client.username ? ` (@${res.client.username})` : ''} creado${res.supabaseSynced ? ' y guardado en Supabase' : ''}. Listo para enviar credenciales por WhatsApp.`,
          tone: 'success',
          whatsappUrl: res.credentials.whatsappUrl,
        });
        setDirectoryTab('clients');
      }

      setName('');
      setUsername('');
      setEmail('');
      setWhatsapp('');
      setAddress('');
      setInePhotoDataUrl(undefined);
      setPassword(generateStrongPassword());
      await loadUsers();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No se pudo registrar el usuario.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAdminActive = async (adm: ManagedAdminUser) => {
    setBusyUserId(adm.id);
    try {
      await api.updateAdminUser(adm.id, {active: !adm.active});
      onPushAlert({
        title: !adm.active ? 'Administrador reactivado' : 'Administrador desactivado',
        message: `La cuenta @${adm.username} ahora está ${!adm.active ? 'activa' : 'inactiva'}.`,
        tone: 'info',
      });
      await loadUsers();
    } catch (err) {
      onPushAlert({
        title: 'No se pudo actualizar',
        message: err instanceof Error ? err.message : 'Error actualizando cuenta.',
        tone: 'error',
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleResetPassword = async (
    role: 'admin' | 'client',
    id: string,
    label: string,
  ) => {
    setBusyUserId(id);
    setCopied(false);
    const nextPassword = generateStrongPassword();
    try {
      const res =
        role === 'admin'
          ? await api.updateAdminUser(id, {password: nextPassword})
          : await api.updateClientUser(id, {password: nextPassword});
      if (res.credentials) {
        setLatestCredentials(res.credentials);
        onPushAlert({
          title: 'Nueva contraseña generada',
          message: `Se actualizaron las credenciales de ${label}. Compártelas por WhatsApp.`,
          tone: 'success',
          whatsappUrl: res.credentials.whatsappUrl,
        });
      }
      await loadUsers();
    } catch (err) {
      onPushAlert({
        title: 'Error restableciendo clave',
        message: err instanceof Error ? err.message : 'No se pudo cambiar la clave.',
        tone: 'error',
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleCopyCredentials = async () => {
    if (!latestCredentials) return;
    try {
      await navigator.clipboard.writeText(latestCredentials.shareMessage);
      setCopied(true);
      onPushAlert({
        title: 'Credenciales copiadas',
        message: 'El mensaje de acceso está copiado en tu portapapeles.',
        tone: 'info',
      });
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      onPushAlert({
        title: 'Copia manual',
        message: 'Usa el botón de WhatsApp o selecciona el texto de la tarjeta.',
        tone: 'warning',
      });
    }
  };

  const filteredAdmins = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.username.toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.whatsapp || '').toLowerCase().includes(q),
    );
  }, [admins, search]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.username || '').toLowerCase().includes(q) ||
        c.whatsapp.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q),
    );
  }, [clients, search]);

  const clientsWithIneCount = useMemo(
    () => clients.filter((c) => isSafePhotoDataUrl(c.inePhotoDataUrl)).length,
    [clients],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#000000]">
            Clientes, Alumnos y Credenciales
          </h1>
          <p className="text-sm text-slate-600">
            Consulta los datos de registro e identificación oficial (INE) de tus clientes o alumnos, y administra cuentas de acceso.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#000831]">
            <IdCard className="h-4 w-4 text-[#109173]" />
            <span>
              INE verificada: {clientsWithIneCount}/{clients.length}
            </span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#000831]">
            <Database className="h-4 w-4 text-[#109173]" />
            <span>
              {supabaseConnected
                ? 'Sincronizado con Supabase'
                : 'Guardado local activo'}
            </span>
          </div>
        </div>
      </div>

      {/* Latest Created / Reset Credentials Card */}
      {latestCredentials && (
        <div className="rounded-2xl border-2 border-[#109173] bg-[#E6F7F3]/50 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#109173] text-white shrink-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-extrabold text-[#000000]">
                  Credenciales listas para compartir
                </h2>
                <p className="text-xs sm:text-sm text-slate-700">
                  {latestCredentials.role === 'admin'
                    ? 'Cuenta de Administrador'
                    : 'Cuenta de Cliente / Alumno'}{' '}
                  · {latestCredentials.name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLatestCredentials(null)}
              className="text-xs font-bold text-slate-500 hover:text-[#000831] cursor-pointer"
            >
              Cerrar tarjeta
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white border border-slate-200 p-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Usuario
              </div>
              <div className="mt-1 font-mono text-sm font-extrabold text-[#000831] break-all">
                {latestCredentials.identifier}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Contraseña asignada
              </div>
              <div className="mt-1 font-mono text-sm font-extrabold text-[#109173] break-all">
                {latestCredentials.password}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Rol de acceso
              </div>
              <div className="mt-1 text-sm font-extrabold text-[#000831]">
                {latestCredentials.role === 'admin' ? 'Administrador' : 'Cliente'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={latestCredentials.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-[#109173] px-5 text-sm font-bold text-white hover:bg-[#0B755C] transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Compartir credenciales por WhatsApp</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              type="button"
              onClick={handleCopyCredentials}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-[#000831] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {copied ? (
                <Check className="h-4 w-4 text-[#109173]" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span>{copied ? 'Mensaje copiado' : 'Copiar credenciales'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Create User Form */}
        <div className="xl:col-span-5 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#000831] text-white shrink-0">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-extrabold text-[#000000]">
                Registrar nuevo usuario
              </h2>
              <p className="text-xs text-slate-600">
                Crea credenciales y envíalas al instante por WhatsApp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 mb-5">
            <button
              type="button"
              onClick={() => {
                setCreateRole('client');
                setFormError(null);
              }}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                createRole === 'client'
                  ? 'bg-white text-[#000831] shadow-xs'
                  : 'text-slate-600 hover:text-[#000831]'
              }`}
            >
              <UserCheck className="h-4 w-4 text-[#109173]" />
              <span>Cliente / Alumno</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateRole('admin');
                setFormError(null);
              }}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                createRole === 'admin'
                  ? 'bg-white text-[#000831] shadow-xs'
                  : 'text-slate-600 hover:text-[#000831]'
              }`}
            >
              <ShieldCheck className="h-4 w-4 text-[#109173]" />
              <span>Administrador</span>
            </button>
          </div>

          {formError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#000831] mb-1.5">
                Nombre completo
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    createRole === 'admin'
                      ? 'Ej. Carlos Méndez'
                      : 'Ej. Ana López'
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#000831] mb-1.5">
                Usuario de acceso
              </label>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  minLength={3}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={
                    createRole === 'admin' ? 'Ej. admin_2' : 'Ej. ana.lopez'
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 font-mono text-sm text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                />
              </div>
            </div>

            {createRole === 'admin' && (
              <div>
                <label className="block text-sm font-semibold text-[#000831] mb-1.5">
                  Correo (opcional)
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@kicksxr.com"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-[#000831] mb-1.5">
                {createRole === 'admin'
                  ? 'WhatsApp del admin (para enviar credenciales)'
                  : 'Teléfono / WhatsApp (notificaciones y envío de credenciales)'}
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  required={createRole === 'client'}
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="55 1234 5678"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                />
              </div>
            </div>

            {createRole === 'client' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-[#000831] mb-1.5">
                    Dirección de entrega
                  </label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Calle, número, colonia y CP"
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                    />
                  </div>
                </div>

                {/* Optional INE capture when admin creates a client */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#000831]">
                      <IdCard className="h-4 w-4 text-[#109173]" />
                      <span>Identificación INE (opcional)</span>
                    </label>
                    {inePhotoDataUrl && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#109173]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Adjunta</span>
                      </span>
                    )}
                  </div>
                  <input
                    ref={createIneInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCreateIneFile}
                    className="hidden"
                  />
                  {inePhotoDataUrl ? (
                    <div className="space-y-2">
                      <img
                        src={inePhotoDataUrl}
                        alt="Vista previa INE"
                        className="max-h-32 w-full rounded-lg border border-slate-200 bg-white object-contain p-1"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCameraTarget('create')}
                          className="flex-1 min-h-[36px] inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-[#000831] cursor-pointer"
                        >
                          <Camera className="h-3.5 w-3.5 text-[#109173]" />
                          <span>Otra foto</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInePhotoDataUrl(undefined)}
                          className="min-h-[36px] inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-bold text-red-700 cursor-pointer"
                          aria-label="Quitar INE"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCameraTarget('create')}
                        className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#000831] px-3 text-xs font-bold text-white hover:bg-black cursor-pointer"
                      >
                        <Camera className="h-3.5 w-3.5 text-[#109173]" />
                        <span>Cámara</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => createIneInputRef.current?.click()}
                        className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-[#000831] hover:border-[#109173] cursor-pointer"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>Subir INE</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-[#000831]">
                  Contraseña asignada
                </label>
                <button
                  type="button"
                  onClick={() => setPassword(generateStrongPassword())}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#109173] hover:underline cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Generar clave</span>
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-11 font-mono text-sm text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-[#000831] cursor-pointer"
                  aria-label="Mostrar u ocultar contraseña"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] rounded-xl bg-[#109173] px-5 text-sm font-bold text-white hover:bg-[#0B755C] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {submitting
                ? 'Creando credenciales...'
                : createRole === 'admin'
                  ? 'Crear Administrador y generar credenciales'
                  : 'Crear Cliente y generar credenciales'}
            </button>
          </form>
        </div>

        {/* Right: Directory of Registered Admins & Clients */}
        <div className="xl:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
              <button
                type="button"
                onClick={() => setDirectoryTab('clients')}
                className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                  directoryTab === 'clients'
                    ? 'bg-white text-[#000831] shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Clientes / Alumnos ({clients.length})
              </button>
              <button
                type="button"
                onClick={() => setDirectoryTab('admins')}
                className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                  directoryTab === 'admins'
                    ? 'bg-white text-[#000831] shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Administradores ({admins.length})
              </button>
            </div>

            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, usuario o teléfono..."
                className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-[#000831] focus:border-[#109173] focus:outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-slate-100 animate-pulse"
                />
              ))}
            </div>
          ) : directoryTab === 'admins' ? (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {filteredAdmins.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No se encontraron administradores con ese criterio.
                </div>
              ) : (
                filteredAdmins.map((adm) => (
                  <div
                    key={adm.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-extrabold text-[#000831]">
                          {adm.name}
                        </span>
                        <span className="font-mono text-xs font-bold text-[#109173]">
                          @{adm.username}
                        </span>
                        <span
                          className={`text-[11px] font-bold ${
                            adm.active ? 'text-[#109173]' : 'text-slate-400'
                          }`}
                        >
                          · {adm.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
                        {adm.email && <span>{adm.email}</span>}
                        {adm.whatsapp && <span>WA: {adm.whatsapp}</span>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyUserId === adm.id}
                        onClick={() =>
                          handleResetPassword('admin', adm.id, adm.name)
                        }
                        className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg border border-[#109173]/30 bg-[#E6F7F3] px-3 text-xs font-bold text-[#109173] hover:bg-[#109173] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Nueva clave + WA</span>
                      </button>
                      {adm.id !== currentAdminId && (
                        <button
                          type="button"
                          disabled={busyUserId === adm.id}
                          onClick={() => handleToggleAdminActive(adm)}
                          className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:text-[#000831] cursor-pointer disabled:opacity-50"
                        >
                          {adm.active ? 'Desactivar' : 'Reactivar'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {filteredClients.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="h-9 w-9 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-[#000831]">
                    Aún no hay clientes o alumnos registrados.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Cuando los clientes se registren desde la app o los des de alta aquí, aparecerán sus datos completos e INE.
                  </p>
                </div>
              ) : (
                filteredClients.map((cli) => {
                  const hasIne = isSafePhotoDataUrl(cli.inePhotoDataUrl);
                  return (
                    <div
                      key={cli.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedClientId(cli.id)}
                          title={
                            hasIne
                              ? 'Ver ficha e identificación INE'
                              : 'Ver datos de registro'
                          }
                          className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                            hasIne
                              ? 'border-[#109173]/40 bg-white hover:border-[#109173]'
                              : 'border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-slate-400'
                          }`}
                        >
                          {hasIne ? (
                            <img
                              src={cli.inePhotoDataUrl}
                              alt={`INE de ${cli.name}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center px-1 text-center">
                              <IdCard className="h-4 w-4 mb-0.5" />
                              <span className="text-[9px] font-bold leading-none">
                                Sin INE
                              </span>
                            </div>
                          )}
                        </button>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-sm font-extrabold text-[#000831]">
                              {cli.name}
                            </span>
                            {cli.username && (
                              <span className="font-mono text-xs font-bold text-[#109173]">
                                @{cli.username}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                hasIne
                                  ? 'bg-[#E6F7F3] text-[#109173]'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              <IdCard className="h-3 w-3" />
                              <span>{hasIne ? 'INE adjunta' : 'Pendiente INE'}</span>
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
                            <span className="font-mono">{cli.whatsapp}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500">
                              Alta: {new Date(cli.createdAt).toLocaleDateString('es-MX')}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 truncate">
                            {cli.address}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedClientId(cli.id)}
                          className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg border border-[#000831]/20 bg-[#000831] px-3 text-xs font-bold text-white hover:bg-black transition-colors cursor-pointer"
                        >
                          <IdCard className="h-3.5 w-3.5 text-[#109173]" />
                          <span>Ver ficha e INE</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyUserId === cli.id}
                          onClick={() =>
                            handleResetPassword('client', cli.id, cli.name)
                          }
                          className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg border border-[#109173]/30 bg-[#E6F7F3] px-3 text-xs font-bold text-[#109173] hover:bg-[#109173] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>Nueva clave + WA</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Client Registration Details & INE Modal */}
      {selectedClient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#000831]/70 p-3 sm:p-5 backdrop-blur-xs"
          onClick={() => setSelectedClientId(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Ficha de registro de ${selectedClient.name}`}
        >
          <div
            className="w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 bg-[#000831] px-5 py-4 text-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#109173] text-white shrink-0">
                  <IdCard className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-extrabold truncate">
                    {selectedClient.name}
                  </h3>
                  <p className="text-xs text-white/75 truncate">
                    Datos de registro e identificación oficial (INE)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClientId(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                aria-label="Cerrar ficha"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 sm:p-6 space-y-5">
              {/* Registration fields grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Nombre completo
                  </div>
                  <div className="mt-1 text-sm font-extrabold text-[#000831]">
                    {selectedClient.name}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Usuario de acceso
                  </div>
                  <div className="mt-1 font-mono text-sm font-extrabold text-[#109173]">
                    {selectedClient.username
                      ? `@${selectedClient.username}`
                      : 'Sin usuario asignado'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Teléfono / WhatsApp
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-[#000831]">
                      {selectedClient.whatsapp}
                    </span>
                    <a
                      href={`https://wa.me/${
                        selectedClient.whatsapp.replace(/\D/g, '').length === 10
                          ? `52${selectedClient.whatsapp.replace(/\D/g, '')}`
                          : selectedClient.whatsapp.replace(/\D/g, '')
                      }`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#109173] hover:underline"
                    >
                      <span>WhatsApp</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Fecha de registro
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-[#000831]">
                    <Calendar className="h-4 w-4 text-[#5B21B6]" />
                    <span>
                      {new Date(selectedClient.createdAt).toLocaleString('es-MX')}
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Dirección de entrega registrada
                  </div>
                  <div className="mt-1 flex items-start gap-2 text-sm font-semibold text-[#000831]">
                    <MapPin className="h-4 w-4 text-[#109173] shrink-0 mt-0.5" />
                    <span>{selectedClient.address}</span>
                  </div>
                </div>
              </div>

              {/* INE photo card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <IdCard className="h-4 w-4 text-[#109173]" />
                    <h4 className="font-display text-sm font-extrabold text-[#000831]">
                      Identificación Oficial (INE — México)
                    </h4>
                  </div>

                  <input
                    ref={detailIneInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleDetailIneFile}
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={updatingDetailIne}
                      onClick={() => setCameraTarget('detail')}
                      className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-[#000831] hover:border-[#109173] cursor-pointer disabled:opacity-50"
                    >
                      <Camera className="h-3.5 w-3.5 text-[#109173]" />
                      <span>Tomar INE</span>
                    </button>
                    <button
                      type="button"
                      disabled={updatingDetailIne}
                      onClick={() => detailIneInputRef.current?.click()}
                      className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-[#000831] hover:border-[#109173] cursor-pointer disabled:opacity-50"
                    >
                      <ImageIcon className="h-3.5 w-3.5 text-[#5B21B6]" />
                      <span>
                        {updatingDetailIne ? 'Guardando...' : 'Subir / reemplazar'}
                      </span>
                    </button>
                  </div>
                </div>

                {isSafePhotoDataUrl(selectedClient.inePhotoDataUrl) ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() =>
                        setZoomedIne({
                          url: selectedClient.inePhotoDataUrl!,
                          name: selectedClient.name,
                          username: selectedClient.username,
                        })
                      }
                      className="group relative block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 cursor-zoom-in"
                    >
                      <img
                        src={selectedClient.inePhotoDataUrl}
                        alt={`Identificación INE de ${selectedClient.name}`}
                        className="max-h-72 w-full object-contain p-2"
                      />
                      <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-[#000831]/85 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                        <ZoomIn className="h-3.5 w-3.5" />
                        <span>Ampliar INE</span>
                      </span>
                    </button>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <a
                        href={selectedClient.inePhotoDataUrl}
                        download={`INE-${selectedClient.username || selectedClient.id}.jpg`}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#109173] px-4 text-xs font-bold text-white hover:bg-[#0B755C] transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Descargar imagen de INE</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                    <ImageOff className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-[#000831]">
                      Este cliente aún no tiene fotografía de INE registrada
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Puedes solicitarle que la suba desde su perfil o adjuntarla aquí mismo con los botones superiores.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen INE Lightbox */}
      {zoomedIne && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoomedIne(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`INE ampliada de ${zoomedIne.name}`}
        >
          <div
            className="relative w-full max-w-4xl flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between text-white">
              <div>
                <div className="font-display text-base font-extrabold">
                  INE · {zoomedIne.name}
                </div>
                {zoomedIne.username && (
                  <div className="font-mono text-xs text-white/75">
                    @{zoomedIne.username}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setZoomedIne(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                aria-label="Cerrar zoom"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <img
              src={zoomedIne.url}
              alt={`INE ampliada de ${zoomedIne.name}`}
              className="max-h-[82vh] w-auto max-w-full rounded-xl bg-white object-contain p-1 shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Camera modal for capturing INE (Create or Client Detail) */}
      <CameraCaptureModal
        open={cameraTarget !== null}
        title="Capturar identificación (INE)"
        subtitle="Enfoca el frente de la credencial INE con buena iluminación"
        onCapture={(dataUrl) => {
          if (cameraTarget === 'create') {
            setInePhotoDataUrl(dataUrl);
          } else if (cameraTarget === 'detail') {
            void handleSaveDetailIne(dataUrl);
          }
        }}
        onFallbackGallery={() => {
          if (cameraTarget === 'create') {
            createIneInputRef.current?.click();
          } else if (cameraTarget === 'detail') {
            detailIneInputRef.current?.click();
          }
        }}
        onClose={() => setCameraTarget(null)}
      />
    </div>
  );
};
