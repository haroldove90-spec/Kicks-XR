import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Check,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
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
  User,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import {api} from '../lib/api';
import type {
  CreatedCredentials,
  ManagedAdminUser,
  ManagedClientUser,
  PopupAlert,
} from '../types';

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
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Directory state
  const [directoryTab, setDirectoryTab] = useState<'clients' | 'admins'>('clients');
  const [search, setSearch] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  // Created / Reset credentials modal card
  const [latestCredentials, setLatestCredentials] =
    useState<CreatedCredentials | null>(null);
  const [copied, setCopied] = useState(false);

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
        });
        setLatestCredentials(res.credentials);
        onPushAlert({
          title: 'Cliente final registrado',
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#000000]">
            Gestión de Usuarios y Credenciales
          </h1>
          <p className="text-sm text-slate-600">
            Da de alta nuevos administradores y clientes finales, genera sus credenciales y compártelas por WhatsApp.
          </p>
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
                    : 'Cuenta de Cliente final'}{' '}
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
              <span>Cliente final</span>
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
                Clientes ({clients.length})
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
                    Aún no hay clientes finales registrados.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Usa el formulario de la izquierda para dar de alta clientes y compartir sus credenciales por WhatsApp.
                  </p>
                </div>
              ) : (
                filteredClients.map((cli) => (
                  <div
                    key={cli.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                  >
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
                        <span className="font-mono text-xs text-slate-500">
                          {cli.whatsapp}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        {cli.address}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyUserId === cli.id}
                        onClick={() =>
                          handleResetPassword('client', cli.id, cli.name)
                        }
                        className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg border border-[#109173]/30 bg-[#E6F7F3] px-3 text-xs font-bold text-[#109173] hover:bg-[#109173] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Nueva clave + WhatsApp</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
