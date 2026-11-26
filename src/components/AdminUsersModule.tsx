import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Calendar,
  Check,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  IdCard,
  KeyRound,
  Link2,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {api} from '../lib/api';
import {isSafeGoogleMapsUrl} from '../lib/qrPayload';
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
  const [age, setAge] = useState('');
  const [idDocumentNumber, setIdDocumentNumber] = useState('');
  const [address, setAddress] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [password, setPassword] = useState(() => generateStrongPassword());
  const [showPassword, setShowPassword] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Directory state
  const [directoryTab, setDirectoryTab] = useState<'clients' | 'admins'>('clients');
  const [search, setSearch] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  // Client detail + edit modal
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [editAge, setEditAge] = useState('');
  const [editIdDoc, setEditIdDoc] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editMapsUrl, setEditMapsUrl] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);

  // Created / Reset credentials modal card
  const [latestCredentials, setLatestCredentials] =
    useState<CreatedCredentials | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId],
  );

  useEffect(() => {
    if (!selectedClient) return;
    setEditAge(selectedClient.age ? String(selectedClient.age) : '');
    setEditIdDoc(selectedClient.idDocumentNumber || '');
    setEditAddress(selectedClient.address || '');
    setEditMapsUrl(selectedClient.mapsUrl || '');
  }, [selectedClient]);

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

  const handleSaveClientDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    const trimmedMaps = editMapsUrl.trim();
    if (trimmedMaps && !isSafeGoogleMapsUrl(trimmedMaps)) {
      onPushAlert({
        title: 'Enlace de Google Maps inválido',
        message: 'Pega un enlace válido de Google Maps (https://maps.app.goo.gl/...).',
        tone: 'warning',
      });
      return;
    }
    setSavingDetail(true);
    try {
      await api.updateClientUser(selectedClient.id, {
        address: editAddress.trim(),
        mapsUrl: trimmedMaps,
        age: editAge.trim() ? Number(editAge) : undefined,
        idDocumentNumber: editIdDoc.trim().toUpperCase(),
      });
      await loadUsers();
      onPushAlert({
        title: 'Ficha actualizada',
        message: `Se guardaron los datos de ${selectedClient.name}.`,
        tone: 'success',
      });
    } catch (err) {
      onPushAlert({
        title: 'Error guardando ficha',
        message:
          err instanceof Error
            ? err.message
            : 'No se pudo actualizar la información del cliente.',
        tone: 'error',
      });
    } finally {
      setSavingDetail(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (createRole === 'client') {
      const trimmedMaps = mapsUrl.trim();
      if (trimmedMaps && !isSafeGoogleMapsUrl(trimmedMaps)) {
        setFormError(
          'El enlace de ubicación debe ser un link válido de Google Maps (https://maps.app.goo.gl/...).',
        );
        return;
      }
    }

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
          mapsUrl: mapsUrl.trim() || undefined,
          age: age.trim() ? Number(age) : undefined,
          idDocumentNumber: idDocumentNumber.trim().toUpperCase() || undefined,
          password,
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
      setAge('');
      setIdDocumentNumber('');
      setAddress('');
      setMapsUrl('');
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
        c.address.toLowerCase().includes(q) ||
        (c.idDocumentNumber || '').toLowerCase().includes(q),
    );
  }, [clients, search]);

  const clientsWithIdCount = useMemo(
    () => clients.filter((c) => Boolean(c.idDocumentNumber)).length,
    [clients],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#1A1E2A]">
            Clientes, Alumnos y Credenciales
          </h1>
          <p className="text-sm text-slate-600">
            Consulta edad, número de INE o Pasaporte, dirección y ubicación en Google Maps de tus clientes y administra accesos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#1A1E2A]">
            <IdCard className="h-4 w-4 text-[#5E7800]" />
            <span>
              INE / Pasaporte: {clientsWithIdCount}/{clients.length}
            </span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#1A1E2A]">
            <Database className="h-4 w-4 text-[#5E7800]" />
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
        <div className="rounded-2xl border-2 border-[#8BAF03] bg-[#F3F8DE]/50 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#8BAF03] text-[#1A1E2A] shrink-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-extrabold text-[#1A1E2A]">
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
              className="text-xs font-bold text-slate-500 hover:text-[#1A1E2A] cursor-pointer"
            >
              Cerrar tarjeta
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white border border-slate-200 p-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Usuario
              </div>
              <div className="mt-1 font-mono text-sm font-extrabold text-[#1A1E2A] break-all">
                {latestCredentials.identifier}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Contraseña asignada
              </div>
              <div className="mt-1 font-mono text-sm font-extrabold text-[#5E7800] break-all">
                {latestCredentials.password}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Rol de acceso
              </div>
              <div className="mt-1 text-sm font-extrabold text-[#1A1E2A]">
                {latestCredentials.role === 'admin' ? 'Administrador' : 'Cliente'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={latestCredentials.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-[#8BAF03] px-5 text-sm font-bold text-[#1A1E2A] hover:bg-[#749402] transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Compartir credenciales por WhatsApp</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              type="button"
              onClick={handleCopyCredentials}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-[#1A1E2A] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {copied ? (
                <Check className="h-4 w-4 text-[#5E7800]" />
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A1E2A] text-white shrink-0">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-extrabold text-[#1A1E2A]">
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
                  ? 'bg-white text-[#1A1E2A] shadow-xs'
                  : 'text-slate-600 hover:text-[#1A1E2A]'
              }`}
            >
              <UserCheck className="h-4 w-4 text-[#5E7800]" />
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
                  ? 'bg-white text-[#1A1E2A] shadow-xs'
                  : 'text-slate-600 hover:text-[#1A1E2A]'
              }`}
            >
              <ShieldCheck className="h-4 w-4 text-[#5E7800]" />
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
              <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
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
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
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
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 font-mono text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/20"
                />
              </div>
            </div>

            {createRole === 'admin' && (
              <div>
                <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                  Correo (opcional)
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@homeli.app"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/20"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className={createRole === 'client' ? 'sm:col-span-8' : 'sm:col-span-12'}>
                <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                  {createRole === 'admin'
                    ? 'WhatsApp del admin'
                    : 'Teléfono / WhatsApp'}
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    required={createRole === 'client'}
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="55 1234 5678"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/20"
                  />
                </div>
              </div>

              {createRole === 'client' && (
                <div className="sm:col-span-4">
                  <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                    Edad
                  </label>
                  <input
                    type="number"
                    min={12}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Ej. 24"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
                  />
                </div>
              )}
            </div>

            {createRole === 'client' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                    Número de INE o Pasaporte
                  </label>
                  <div className="relative">
                    <IdCard className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      maxLength={40}
                      value={idDocumentNumber}
                      onChange={(e) =>
                        setIdDocumentNumber(e.target.value.toUpperCase())
                      }
                      placeholder="Clave de elector / IDMEX o pasaporte"
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 font-mono text-sm uppercase text-[#1A1E2A] placeholder:font-sans placeholder:normal-case focus:border-[#8BAF03] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                    Dirección
                  </label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Calle, número, colonia y CP"
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                    Enlace de Google Maps (opcional)
                  </label>
                  <div className="relative">
                    <Link2 className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="url"
                      value={mapsUrl}
                      onChange={(e) => setMapsUrl(e.target.value)}
                      placeholder="https://maps.app.goo.gl/sL7aFF4pg11drELH9"
                      className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-[#1A1E2A]">
                  Contraseña asignada
                </label>
                <button
                  type="button"
                  onClick={() => setPassword(generateStrongPassword())}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#5E7800] hover:underline cursor-pointer"
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
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-11 font-mono text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-[#1A1E2A] cursor-pointer"
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
              className="w-full min-h-[48px] rounded-xl bg-[#8BAF03] px-5 text-sm font-bold text-[#1A1E2A] hover:bg-[#749402] disabled:opacity-60 transition-colors cursor-pointer"
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
                    ? 'bg-white text-[#1A1E2A] shadow-xs'
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
                    ? 'bg-white text-[#1A1E2A] shadow-xs'
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
                placeholder="Buscar nombre, usuario, INE o teléfono..."
                className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
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
                        <span className="font-display text-sm font-extrabold text-[#1A1E2A]">
                          {adm.name}
                        </span>
                        <span className="font-mono text-xs font-bold text-[#5E7800]">
                          @{adm.username}
                        </span>
                        <span
                          className={`text-[11px] font-bold ${
                            adm.active ? 'text-[#5E7800]' : 'text-slate-400'
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
                        className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg border border-[#8BAF03]/30 bg-[#F3F8DE] px-3 text-xs font-bold text-[#5E7800] hover:bg-[#8BAF03] hover:text-[#1A1E2A] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Nueva clave + WA</span>
                      </button>
                      {adm.id !== currentAdminId && (
                        <button
                          type="button"
                          disabled={busyUserId === adm.id}
                          onClick={() => handleToggleAdminActive(adm)}
                          className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:text-[#1A1E2A] cursor-pointer disabled:opacity-50"
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
                  <p className="text-sm font-semibold text-[#1A1E2A]">
                    Aún no hay clientes o alumnos registrados.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Cuando los clientes se registren desde la app o los des de alta aquí, aparecerán sus datos completos, INE/Pasaporte y ubicación.
                  </p>
                </div>
              ) : (
                filteredClients.map((cli) => {
                  const hasSafeMaps = isSafeGoogleMapsUrl(cli.mapsUrl);
                  return (
                    <div
                      key={cli.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-sm font-extrabold text-[#1A1E2A]">
                            {cli.name}
                          </span>
                          {cli.username && (
                            <span className="font-mono text-xs font-bold text-[#5E7800]">
                              @{cli.username}
                            </span>
                          )}
                          {cli.age && (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                              {cli.age} años
                            </span>
                          )}
                          {cli.idDocumentNumber && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#F3F8DE] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#5E7800]">
                              <IdCard className="h-3 w-3" />
                              <span>{cli.idDocumentNumber}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
                          <span className="font-mono">{cli.whatsapp}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500">
                            Alta: {new Date(cli.createdAt).toLocaleDateString('es-MX')}
                          </span>
                          {hasSafeMaps && (
                            <a
                              href={cli.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-bold text-[#5E7800] hover:underline"
                            >
                              <MapPin className="h-3 w-3" />
                              <span>Google Maps</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {cli.address}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedClientId(cli.id)}
                          className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg border border-[#1A1E2A]/20 bg-[#1A1E2A] px-3 text-xs font-bold text-white hover:bg-[#11141D] transition-colors cursor-pointer"
                        >
                          <IdCard className="h-3.5 w-3.5 text-[#FCF61C]" />
                          <span>Ver / editar ficha</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyUserId === cli.id}
                          onClick={() =>
                            handleResetPassword('client', cli.id, cli.name)
                          }
                          className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg border border-[#8BAF03]/30 bg-[#F3F8DE] px-3 text-xs font-bold text-[#5E7800] hover:bg-[#8BAF03] hover:text-[#1A1E2A] transition-colors cursor-pointer disabled:opacity-50"
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

      {/* Client Registration Details & Edit Modal */}
      {selectedClient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1E2A]/70 p-3 sm:p-5 backdrop-blur-xs"
          onClick={() => setSelectedClientId(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Ficha de registro de ${selectedClient.name}`}
        >
          <div
            className="w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 bg-[#1A1E2A] px-5 py-4 text-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8BAF03] text-[#1A1E2A] shrink-0">
                  <IdCard className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-extrabold truncate">
                    {selectedClient.name}
                  </h3>
                  <p className="text-xs text-white/75 truncate">
                    Datos de registro, identificación y ubicación
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
              {/* Static info grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Usuario de acceso
                  </div>
                  <div className="mt-1 font-mono text-sm font-extrabold text-[#5E7800]">
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
                    <span className="font-mono text-sm font-bold text-[#1A1E2A]">
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
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#5E7800] hover:underline"
                    >
                      <span>WhatsApp</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Fecha de registro
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-[#1A1E2A]">
                      <Calendar className="h-4 w-4 text-[#1A1E2A]" />
                      <span>
                        {new Date(selectedClient.createdAt).toLocaleString('es-MX')}
                      </span>
                    </div>
                  </div>
                  {isSafeGoogleMapsUrl(selectedClient.mapsUrl) && (
                    <a
                      href={selectedClient.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#8BAF03] px-3.5 text-xs font-bold text-[#1A1E2A] hover:bg-[#749402] transition-colors"
                    >
                      <MapPin className="h-4 w-4" />
                      <span>Abrir ubicación en Google Maps</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Editable Identification, Age, Address & Google Maps */}
              <form
                onSubmit={handleSaveClientDetails}
                className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3.5"
              >
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#1A1E2A]">
                  Identificación, edad y ubicación registradas
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-8">
                    <label className="block text-xs font-bold text-[#1A1E2A] mb-1">
                      Número de INE o Pasaporte
                    </label>
                    <input
                      type="text"
                      maxLength={40}
                      value={editIdDoc}
                      onChange={(e) => setEditIdDoc(e.target.value.toUpperCase())}
                      placeholder="Clave de elector / IDMEX o pasaporte"
                      className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm uppercase text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-bold text-[#1A1E2A] mb-1">
                      Edad
                    </label>
                    <input
                      type="number"
                      min={12}
                      max={120}
                      value={editAge}
                      onChange={(e) => setEditAge(e.target.value)}
                      placeholder="Ej. 24"
                      className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1A1E2A] mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    required
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1A1E2A] mb-1">
                    Enlace de ubicación en Google Maps
                  </label>
                  <input
                    type="url"
                    value={editMapsUrl}
                    onChange={(e) => setEditMapsUrl(e.target.value)}
                    placeholder="https://maps.app.goo.gl/sL7aFF4pg11drELH9"
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedClientId(null)}
                    className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-[#1A1E2A] hover:bg-slate-50 cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={savingDetail}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#8BAF03] px-4 text-xs font-bold text-[#1A1E2A] hover:bg-[#749402] disabled:opacity-60 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{savingDetail ? 'Guardando...' : 'Guardar ficha'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
