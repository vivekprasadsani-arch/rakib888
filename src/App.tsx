import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Lock, 
  Shield, 
  Phone, 
  Plus, 
  Trash2, 
  LogOut, 
  RefreshCw, 
  Search, 
  MessageSquare, 
  Copy, 
  Check, 
  AlertTriangle, 
  Users, 
  Globe, 
  Server, 
  Smartphone,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';

// Helper function to extract OTP codes from SMS message body
function extractOtp(body: string): string | null {
  if (!body) return null;
  // 1. Look for word "code", "otp", "verification", "pin", "passcode" followed by a space, colon, or dash, and then a 4-8 digit number
  const otpKeywordsPattern = /\b(?:code|otp|verification|pin|verification\s+code|passcode)\b[^\d]*?(\b\d{4,8}\b)/i;
  const keywordMatch = body.match(otpKeywordsPattern);
  if (keywordMatch && keywordMatch[1]) {
    return keywordMatch[1];
  }

  // 2. Look for patterns like "is 123456" or "is: 123456" or "code is 123456"
  const isPattern = /\b(?:is|code\s+is|otp\s+is)[^\d]*?(\b\d{4,8}\b)/i;
  const isMatch = body.match(isPattern);
  if (isMatch && isMatch[1]) {
    return isMatch[1];
  }

  // 3. Fallback: Any standalone 4-8 digit number
  const standalonePattern = /\b\d{4,8}\b/;
  const standaloneMatch = body.match(standalonePattern);
  if (standaloneMatch) {
    return standaloneMatch[0];
  }

  return null;
}

export default function App() {
  // Authentication & Session States
  const [accessToken, setAccessToken] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<'user' | 'admin' | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [deviceInfo, setDeviceInfo] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);

  // disguised credentials:
  // Access ID -> Twilio SID
  // Access Key -> Twilio Auth Token
  const [accessId, setAccessId] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [combinedCredentials, setCombinedCredentials] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectedName, setConnectedName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [gatewayError, setGatewayError] = useState('');
  const [showAccessKey, setShowAccessKey] = useState(false);

  // Ordinary User Tabs
  const [activeTab, setActiveTab] = useState<'numbers' | 'sms'>('numbers');
  const [activeNumbers, setActiveNumbers] = useState<any[]>([]);
  const [isLoadingNumbers, setIsLoadingNumbers] = useState(false);

  // Buy Number states
  const [searchCountry, setSearchCountry] = useState('US');
  const [searchAreaCode, setSearchAreaCode] = useState('');
  const [searchedNumbers, setSearchedNumbers] = useState<any[]>([]);
  const [isSearchingNumbers, setIsSearchingNumbers] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [purchaseSuccess, setPurchaseSuccess] = useState('');
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null);

  // Live SMS States
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [isLoadingSms, setIsLoadingSms] = useState(false);
  const [autoRefreshSms, setAutoRefreshSms] = useState(true);

  // Admin Panel States
  const [adminTokens, setAdminTokens] = useState<any[]>([]);
  const [isLoadingAdminData, setIsLoadingAdminData] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [customTokenValue, setCustomTokenValue] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [copiedOtp, setCopiedOtp] = useState<string | null>(null);
  const [copiedSearchNum, setCopiedSearchNum] = useState<string | null>(null);
  const [validityDaysOption, setValidityDaysOption] = useState<string>('30');
  const [customDays, setCustomDays] = useState<string>('15');
  const [masterTokenInput, setMasterTokenInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Generate unique device ID if not exists
  useEffect(() => {
    let id = localStorage.getItem('_sys_dev_id');
    if (!id) {
      id = 'DEV-' + Math.random().toString(36).substring(2, 15).toUpperCase();
      localStorage.setItem('_sys_dev_id', id);
    }
    setDeviceId(id);

    // Get User Agent details
    const ua = navigator.userAgent;
    let os = 'Unknown OS';
    if (ua.indexOf('Win') !== -1) os = 'Windows';
    else if (ua.indexOf('Mac') !== -1) os = 'macOS';
    else if (ua.indexOf('Linux') !== -1) os = 'Linux';
    else if (ua.indexOf('Android') !== -1) os = 'Android';
    else if (ua.indexOf('like Mac') !== -1) os = 'iOS';

    let browser = 'Unknown Browser';
    if (ua.indexOf('Chrome') !== -1) browser = 'Chrome';
    else if (ua.indexOf('Firefox') !== -1) browser = 'Firefox';
    else if (ua.indexOf('Safari') !== -1) browser = 'Safari';
    else if (ua.indexOf('Edge') !== -1) browser = 'Edge';

    setDeviceInfo(`${os} (${browser})`);

    // Check existing login session
    const storedToken = localStorage.getItem('_sys_session_token');
    const storedRole = localStorage.getItem('_sys_session_role');
    if (storedToken && storedRole) {
      setAccessToken(storedToken);
      setUserRole(storedRole as 'user' | 'admin');
      setIsLoggedIn(true);

      // Restore credentials session if any
      const cachedId = sessionStorage.getItem('_sys_acc_id');
      const cachedKey = sessionStorage.getItem('_sys_acc_key');
      if (cachedId && cachedKey) {
        setAccessId(cachedId);
        setAccessKey(cachedKey);
        setCombinedCredentials(`${cachedId}:${cachedKey}`);
        setIsConnected(true);
      }
    }
  }, []);

  // Live SMS Polling
  useEffect(() => {
    let interval: any;
    if (isLoggedIn && isConnected && autoRefreshSms && activeTab === 'sms') {
      fetchSms();
      interval = setInterval(() => {
        fetchSms();
      }, 3000); // Poll every 3 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoggedIn, isConnected, autoRefreshSms, activeTab]);

  // Handle Token User Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken.trim()) return;
    setAuthError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: accessToken.trim(),
          deviceId,
          deviceInfo
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('_sys_session_token', data.token);
      localStorage.setItem('_sys_session_role', data.type);
      setUserRole(data.type);
      setIsLoggedIn(true);
      
      // If Admin, fetch admin tokens
      if (data.type === 'admin') {
        fetchAdminTokens(data.token);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Network connection failed');
    }
  };

  // Handle System Credentials Gateway Connect
  const handleConnectGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = combinedCredentials.trim();
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) {
      setGatewayError('Invalid format. Please enter your credentials in "AccessID:AccessKey" format (separated by a colon ":").');
      return;
    }

    const idPart = trimmed.substring(0, colonIndex).trim();
    const keyPart = trimmed.substring(colonIndex + 1).trim();

    if (!idPart || !keyPart) {
      setGatewayError('Both Access ID and Access Key are required. Format: AccessID:AccessKey');
      return;
    }

    setIsConnecting(true);
    setGatewayError('');

    try {
      const res = await fetch('/api/network/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessId: idPart,
          accessKey: keyPart
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'System validation failed');
      }

      setAccessId(idPart);
      setAccessKey(keyPart);

      sessionStorage.setItem('_sys_acc_id', idPart);
      sessionStorage.setItem('_sys_acc_key', keyPart);
      setIsConnected(true);
      let rawName = data.name || 'Secure Hub';
      let cleanName = rawName.replace(/twilio/gi, '').replace(/\s+/g, ' ').trim();
      if (!cleanName || cleanName.length < 2) {
        cleanName = 'Secure Hub';
      }
      setConnectedName(cleanName);
      
      // Fetch initial data passing the new values directly to avoid asynchronous state delay
      fetchActiveNumbers(idPart, keyPart);
    } catch (err: any) {
      setGatewayError(err.message || 'Access credential mismatch');
    } finally {
      setIsConnecting(false);
    }
  };

  // Logout/Reset
  const handleLogout = () => {
    localStorage.removeItem('_sys_session_token');
    localStorage.removeItem('_sys_session_role');
    sessionStorage.removeItem('_sys_acc_id');
    sessionStorage.removeItem('_sys_acc_key');
    
    setIsLoggedIn(false);
    setUserRole(null);
    setIsConnected(false);
    setAccessId('');
    setAccessKey('');
    setCombinedCredentials('');
    setActiveNumbers([]);
    setSearchedNumbers([]);
    setSmsLogs([]);
    setAuthError('');
  };

  // Disconnect credentials gateway only
  const handleDisconnectGateway = () => {
    sessionStorage.removeItem('_sys_acc_id');
    sessionStorage.removeItem('_sys_acc_key');
    setIsConnected(false);
    setAccessId('');
    setAccessKey('');
    setCombinedCredentials('');
    setActiveNumbers([]);
    setSearchedNumbers([]);
    setSmsLogs([]);
  };

  // Fetch Admin tokens
  const fetchAdminTokens = async (token = accessToken) => {
    setIsLoadingAdminData(true);
    try {
      const res = await fetch('/api/admin/tokens', {
        headers: { 'Authorization': token }
      });
      const data = await res.json();
      if (res.ok) {
        setAdminTokens(data.tokens || []);
      }
    } catch (err) {
      console.error('Failed to load admin logs', err);
    } finally {
      setIsLoadingAdminData(false);
    }
  };

  // Generate standard token
  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMessage('');

    try {
      let finalValidityDays: number | string = 30;
      if (validityDaysOption === 'unlimited') {
        finalValidityDays = -1;
      } else if (validityDaysOption === 'custom') {
        const parsed = parseInt(customDays);
        if (isNaN(parsed) || parsed <= 0) {
          throw new Error('Please enter a valid number of days for custom validity');
        }
        finalValidityDays = parsed;
      } else {
        finalValidityDays = parseInt(validityDaysOption);
      }

      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': accessToken
        },
        body: JSON.stringify({
          type: newRole,
          customToken: customTokenValue.trim() || undefined,
          validityDays: finalValidityDays
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Token creation failed');
      }

      setAdminMessage(`Token created: ${data.token.token}`);
      setNewLabel('');
      setCustomTokenValue('');
      fetchAdminTokens();
    } catch (err: any) {
      setAdminMessage(`Error: ${err.message}`);
    }
  };

  // Edit token (Reset device, Disable, Enable)
  const handleTokenAction = async (tokenVal: string, action: string) => {
    setAdminMessage('');
    try {
      const res = await fetch(`/api/admin/tokens/${tokenVal}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': accessToken
        },
        body: JSON.stringify({ action })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Action failed');
      }

      setAdminMessage(`Token ${tokenVal} updated successfully`);
      fetchAdminTokens();
    } catch (err: any) {
      setAdminMessage(`Error: ${err.message}`);
    }
  };

  // Delete Token
  const handleDeleteToken = (tokenVal: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Revoke Access Token',
      message: `Are you sure you want to permanently delete token "${tokenVal}"? This action cannot be undone.`,
      confirmText: 'Revoke Token',
      cancelText: 'Keep Token',
      isDanger: true,
      onConfirm: () => executeDeleteToken(tokenVal)
    });
  };

  const executeDeleteToken = async (tokenVal: string) => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    setAdminMessage('');
    try {
      const res = await fetch(`/api/admin/tokens/${tokenVal}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': accessToken
        }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }

      setAdminMessage(`Token deleted successfully`);
      fetchAdminTokens();
    } catch (err: any) {
      setAdminMessage(`Error: ${err.message}`);
    }
  };

  // Update Master Admin Token
  const handleUpdateMasterToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterTokenInput.trim()) return;
    setAdminMessage('');
    try {
      const res = await fetch('/api/admin/master-token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': accessToken
        },
        body: JSON.stringify({ newMasterToken: masterTokenInput.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error);
      }

      setAdminMessage('Master admin token updated! Re-login with the new token.');
      setMasterTokenInput('');
      setTimeout(() => {
        handleLogout();
      }, 2000);
    } catch (err: any) {
      setAdminMessage(`Error: ${err.message}`);
    }
  };

  // Active Numbers Logic
  const fetchActiveNumbers = async (overrideId?: string, overrideKey?: string) => {
    setIsLoadingNumbers(true);
    try {
      const res = await fetch('/api/network/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accessId: overrideId || accessId, 
          accessKey: overrideKey || accessKey 
        })
      });
      const data = await res.json();
      if (res.ok) {
        setActiveNumbers(data.numbers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingNumbers(false);
    }
  };

  // Disassociate/Delete Phone Number
  const handleDeleteNumber = (numberSid: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Disassociate Phone Number',
      message: 'Are you sure you want to permanently disassociate and delete this phone number from your active registry?',
      confirmText: 'Release Line',
      cancelText: 'Keep Line',
      isDanger: true,
      onConfirm: () => executeDeleteNumber(numberSid)
    });
  };

  const executeDeleteNumber = async (numberSid: string) => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    setDeleteError('');
    setDeleteSuccess('');
    try {
      const res = await fetch('/api/network/numbers/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessId, accessKey, numberSid })
      });
      const data = await res.json();
      if (res.ok) {
        setDeleteSuccess('Active number successfully removed from account registry.');
        fetchActiveNumbers();
      } else {
        setDeleteError(data.error || 'Failed to delete resource');
      }
    } catch (err: any) {
      setDeleteError('Network error: ' + err.message);
    }
  };

  // Scan / Search for new available numbers
  const handleSearchNumbers = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearchingNumbers(true);
    setSearchError('');
    setPurchaseSuccess('');
    try {
      const res = await fetch('/api/network/search-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessId,
          accessKey,
          country: searchCountry,
          areaCode: searchAreaCode.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSearchedNumbers(data.numbers || []);
        if (data.numbers.length === 0) {
          setSearchError('No available signals matched your country/area query.');
        }
      } else {
        setSearchError(data.error || 'Failed to request signal search.');
      }
    } catch (err: any) {
      setSearchError('Network error: ' + err.message);
    } finally {
      setIsSearchingNumbers(false);
    }
  };

  // Buy Selected Number
  const handleBuyNumber = (phoneNumber: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Acquire Signal Line',
      message: `Confirm purchase and active leasing of number: ${phoneNumber}`,
      confirmText: 'Secure Lease',
      cancelText: 'Cancel',
      isDanger: false,
      onConfirm: () => executeBuyNumber(phoneNumber)
    });
  };

  const executeBuyNumber = async (phoneNumber: string) => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    setIsPurchasing(phoneNumber);
    setSearchError('');
    setPurchaseSuccess('');
    try {
      const res = await fetch('/api/network/buy-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessId, accessKey, phoneNumber })
      });
      const data = await res.json();
      if (res.ok) {
        setPurchaseSuccess(`Successfully purchased: ${data.phoneNumber}`);
        // Remove from search results
        setSearchedNumbers(prev => prev.filter(num => num.phoneNumber !== phoneNumber));
        // Refresh active numbers list
        fetchActiveNumbers();
      } else {
        setSearchError(data.error || 'Failed to complete acquisition.');
      }
    } catch (err: any) {
      setSearchError('Acquisition error: ' + err.message);
    } finally {
      setIsPurchasing(null);
    }
  };

  // Fetch Live SMS (BD Time conversions)
  const fetchSms = async () => {
    setIsLoadingSms(true);
    try {
      const res = await fetch('/api/network/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessId, accessKey })
      });
      const data = await res.json();
      if (res.ok) {
        setSmsLogs(data.sms || []);
      }
    } catch (err) {
      console.error('Error loading logs', err);
    } finally {
      setIsLoadingSms(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(text);
    setTimeout(() => {
      setCopiedToken(null);
    }, 2000);
  };

  // Tab change triggers fetch
  const handleTabChange = (tab: 'numbers' | 'sms') => {
    setActiveTab(tab);
    if (tab === 'numbers') fetchActiveNumbers();
    if (tab === 'sms') fetchSms();
  };

  return (
    <div id="app-root" className="min-h-screen bg-sky-500 text-neutral-100 font-sans flex flex-col selection:bg-cyan-500/30 selection:text-cyan-300">
      
      {/* HEADER NAVBAR */}
      <header id="nav-header" className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold tracking-wider uppercase text-neutral-200">AeroGateway</span>
              <span className="text-xs block text-neutral-500 font-mono">Secure Node Management</span>
            </div>
          </div>

          {isLoggedIn && (
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs text-neutral-500 font-mono">Device Bounded:</span>
                <span className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5 font-mono">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  {deviceId}
                </span>
              </div>
              
              <button 
                id="btn-logout"
                onClick={handleLogout}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-rose-400 hover:border-rose-900/40 hover:bg-rose-950/10 transition-all duration-200 text-xs sm:text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col justify-center">

        {!isLoggedIn ? (
          /* LOGIN PANEL WITH ACCESS TOKEN */
          <div className="max-w-md w-full mx-auto my-12">
            <div className="border border-neutral-900 bg-neutral-900/40 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-violet-500"></div>
              
              <div className="text-center mb-6">
                <div className="mx-auto w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4 text-cyan-400">
                  <Shield className="w-6 h-6 animate-pulse" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white uppercase">System Access Portal</h1>
                <p className="text-xs text-neutral-400 mt-1.5">Provide a secure access key token to unlock telemetry node views</p>
              </div>

              {/* Explicit Role Selector / Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-950 border border-neutral-900 rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setAccessToken('');
                    setAuthError('');
                    setIsAdminMode(false);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold font-mono tracking-wider transition-all duration-150 flex items-center justify-center space-x-1.5 ${
                    !isAdminMode
                      ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Ordinary User</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccessToken('');
                    setAuthError('');
                    setIsAdminMode(true);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold font-mono tracking-wider transition-all duration-150 flex items-center justify-center space-x-1.5 ${
                    isAdminMode
                      ? 'bg-violet-500/10 border border-violet-500/30 text-violet-400'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Admin Console</span>
                </button>
              </div>

              {authError && (
                <div className="mb-6 p-4 rounded-xl border border-rose-950 bg-rose-950/10 text-rose-300 text-xs sm:text-sm flex gap-3 items-start animate-fade-in">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Authorization Refused</span>
                    {authError}
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    {isAdminMode ? 'Admin Passkey Token' : 'User Passkey Token'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-500">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={accessToken}
                      onChange={(e) => {
                        setAccessToken(e.target.value);
                        // Dynamically update isAdminMode visual highlight if they type admin token directly
                        if (e.target.value === 'adminRakib017@#$' || e.target.value.startsWith('ADMIN-')) {
                          setIsAdminMode(true);
                        } else if (e.target.value.startsWith('USER-')) {
                          setIsAdminMode(false);
                        }
                      }}
                      placeholder={isAdminMode ? "Enter admin passkey" : "USER-XXXX-XXXX"}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl py-3 pl-10 pr-4 text-white placeholder-neutral-700 outline-none transition-all duration-200 font-mono text-center tracking-wider text-sm sm:text-base"
                    />
                  </div>
                </div>

                <div className="p-3 bg-neutral-950 border border-neutral-900 rounded-xl text-[11px] text-neutral-500 font-mono space-y-1">
                  <div className="flex justify-between">
                    <span>Fingerprint:</span>
                    <span className="text-neutral-400">{deviceId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Client Spec:</span>
                    <span className="text-neutral-400 truncate max-w-[200px]">{deviceInfo}</span>
                  </div>
                  <p className="text-cyan-600/70 text-center pt-1.5 border-t border-neutral-900/50">🔒 Bound to 1 physical host browser only.</p>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-95 transition-all duration-150 flex items-center justify-center space-x-2"
                >
                  <span>Initialize Connection</span>
                </button>
              </form>
            </div>
          </div>
        ) : userRole === 'admin' ? (
          /* ========================================== */
          /* ADMIN DASHBOARD CONSOLE */
          /* ========================================== */
          <div className="space-y-6 my-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border border-neutral-900 bg-neutral-900/30 p-6 rounded-2xl gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-400 text-xs font-mono font-bold tracking-wider uppercase">Console Mode</span>
                  <span className="text-xs text-neutral-500 font-mono">Admin Master Root</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white mt-1 uppercase tracking-tight">Root Administration</h1>
                <p className="text-sm text-neutral-400 mt-1">Issue secure tokens, control browser hardware bindings, and manage user licenses.</p>
              </div>

              <div className="flex items-center space-x-3 self-start sm:self-center">
                <button
                  onClick={() => fetchAdminTokens()}
                  className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-all duration-200"
                >
                  <RefreshCw className={`w-5 h-5 ${isLoadingAdminData ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-sm font-bold rounded-xl transition-all duration-150 flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Exit Session</span>
                </button>
              </div>
            </div>

            {adminMessage && (
              <div className="p-4 rounded-xl border border-cyan-950 bg-cyan-950/20 text-cyan-300 text-xs sm:text-sm font-mono flex items-center justify-between">
                <span>{adminMessage}</span>
                <button onClick={() => setAdminMessage('')} className="text-neutral-500 hover:text-white">✕</button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Token Generation Form */}
              <div className="border border-neutral-900 bg-neutral-900/40 backdrop-blur-sm rounded-2xl p-6 h-fit space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase tracking-tight">Generate Key</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">Mint new authenticated access credentials</p>
                </div>

                <form onSubmit={handleCreateToken} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase mb-2">Access Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewRole('user')}
                        className={`py-2 px-3 rounded-lg text-xs font-mono font-bold border transition-all duration-150 ${
                          newRole === 'user'
                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:text-neutral-300'
                        }`}
                      >
                        Ordinary User
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewRole('admin')}
                        className={`py-2 px-3 rounded-lg text-xs font-mono font-bold border transition-all duration-150 ${
                          newRole === 'admin'
                            ? 'bg-violet-500/10 border-violet-500 text-violet-400'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:text-neutral-300'
                        }`}
                      >
                        Administrator
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase mb-2">Optional Custom Token Value</label>
                    <input
                      type="text"
                      value={customTokenValue}
                      onChange={(e) => setCustomTokenValue(e.target.value)}
                      placeholder="e.g. VIP-TOK-999 (blank for random)"
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg p-2.5 text-xs text-white placeholder-neutral-700 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase mb-2">Token Validity Period</label>
                    <select
                      value={validityDaysOption}
                      onChange={(e) => setValidityDaysOption(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg p-2.5 text-xs text-white outline-none font-mono"
                    >
                      <option value="30">1 Month (Default)</option>
                      <option value="1">1 Day</option>
                      <option value="7">7 Days</option>
                      <option value="15">15 Days</option>
                      <option value="90">3 Months</option>
                      <option value="180">6 Months</option>
                      <option value="365">1 Year</option>
                      <option value="unlimited">Unlimited / No Expiry</option>
                      <option value="custom">Custom Days...</option>
                    </select>
                  </div>

                  {validityDaysOption === 'custom' && (
                    <div className="space-y-1.5 animate-fade-in">
                      <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-mono">Custom Duration (Days)</label>
                      <input
                        type="number"
                        min="1"
                        value={customDays}
                        onChange={(e) => setCustomDays(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 45"
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg p-2.5 text-xs text-white placeholder-neutral-800 outline-none font-mono"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-bold text-xs hover:from-cyan-500 hover:to-indigo-500 active:scale-95 transition-all duration-150"
                  >
                    Generate Access Key
                  </button>
                </form>

                {/* Master admin token upgrade */}
                <div className="pt-6 border-t border-neutral-900 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-tight">Upgrade Master admin Key</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">Modify the master passkey token (Requires restart)</p>
                  </div>

                  <form onSubmit={handleUpdateMasterToken} className="space-y-3">
                    <input
                      type="text"
                      value={masterTokenInput}
                      onChange={(e) => setMasterTokenInput(e.target.value)}
                      placeholder="New Master Passkey Token"
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-lg p-2.5 text-xs text-white placeholder-neutral-700 outline-none font-mono"
                    />
                    <button
                      type="submit"
                      className="w-full py-2 px-3 rounded-lg border border-violet-950 bg-violet-950/20 text-violet-400 hover:bg-violet-900/30 text-xs font-bold transition-all duration-150"
                    >
                      Override Master Token
                    </button>
                  </form>
                </div>
              </div>

              {/* Tokens registry list */}
              <div className="lg:col-span-2 border border-neutral-900 bg-neutral-900/40 backdrop-blur-sm rounded-2xl p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase tracking-tight">Access Registry List</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">Display active licenses, device lock statures, and telemetry signatures</p>
                </div>

                {isLoadingAdminData ? (
                  <div className="flex flex-col items-center justify-center py-16 space-y-3">
                    <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin" />
                    <span className="text-xs text-neutral-500 font-mono">Retrieving database logs...</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-900 text-neutral-500 text-xs uppercase font-mono">
                          <th className="py-3 px-2">Access Token ID</th>
                          <th className="py-3 px-2">Type</th>
                          <th className="py-3 px-2">Hardware binding</th>
                          <th className="py-3 px-2">Validity</th>
                          <th className="py-3 px-2">Status</th>
                          <th className="py-3 px-2 text-right">Telemetry Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900 text-xs">
                        {adminTokens.map((tok: any) => (
                          <tr key={tok.token} className="hover:bg-neutral-900/20 transition-all duration-150">
                            {/* Token */}
                            <td className="py-3.5 px-2 font-mono">
                              <div className="flex items-center space-x-2">
                                <span className="text-white font-bold tracking-wider">{tok.token}</span>
                                <button
                                  onClick={() => copyToClipboard(tok.token)}
                                  className="p-1 rounded bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-all duration-150"
                                  title="Copy token ID"
                                >
                                  {copiedToken === tok.token ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </td>

                            {/* Type */}
                            <td className="py-3.5 px-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase ${
                                tok.type === 'admin' 
                                  ? 'bg-violet-950/40 text-violet-400 border border-violet-900/30' 
                                  : 'bg-cyan-950/40 text-cyan-400 border border-cyan-900/30'
                              }`}>
                                {tok.type}
                              </span>
                            </td>

                            {/* Hardware device lock fingerprint */}
                            <td className="py-3.5 px-2 font-mono text-neutral-400 max-w-[200px]">
                              {tok.deviceFingerprint ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center text-emerald-400 space-x-1">
                                    <Smartphone className="w-3 h-3" />
                                    <span className="font-semibold">{tok.deviceFingerprint}</span>
                                  </div>
                                  <div className="text-[10px] text-neutral-500 truncate" title={tok.deviceInfo}>
                                    {tok.deviceInfo}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-neutral-600 italic">No Device Bound</span>
                              )}
                            </td>

                            {/* Validity */}
                            <td className="py-3.5 px-2 font-mono text-[11px] text-neutral-400">
                              {tok.expiresAt ? (
                                <div className="space-y-0.5">
                                  <span>{new Date(tok.expiresAt).toLocaleDateString()}</span>
                                  {new Date() > new Date(tok.expiresAt) ? (
                                    <span className="text-[10px] text-rose-500 block font-semibold">Expired</span>
                                  ) : (
                                    <span className="text-[10px] text-emerald-500 block">
                                      {Math.ceil((new Date(tok.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} Days left
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-neutral-600 italic">No Limit</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                tok.status === 'active' 
                                  ? 'bg-emerald-500/10 text-emerald-400' 
                                  : tok.status === 'expired'
                                  ? 'bg-amber-500/10 text-amber-400'
                                  : 'bg-rose-500/10 text-rose-400'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  tok.status === 'active' 
                                    ? 'bg-emerald-400' 
                                    : tok.status === 'expired'
                                    ? 'bg-amber-400'
                                    : 'bg-rose-400'
                                }`}></span>
                                {tok.status}
                              </span>
                            </td>

                            {/* Telemetry Actions */}
                            <td className="py-3.5 px-2 text-right space-x-1">
                              {tok.deviceFingerprint && (
                                <button
                                  onClick={() => handleTokenAction(tok.token, 'reset')}
                                  className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-bold text-amber-400 hover:text-amber-300 rounded transition-all duration-150"
                                  title="Reset Device lock so user can login on another device"
                                >
                                  Reset lock
                                </button>
                              )}
                              
                              {tok.status === 'active' ? (
                                <button
                                  onClick={() => handleTokenAction(tok.token, 'disable')}
                                  className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-bold text-rose-400 hover:text-rose-300 rounded transition-all duration-150"
                                >
                                  Disable
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleTokenAction(tok.token, 'enable')}
                                  className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 rounded transition-all duration-150"
                                >
                                  Enable
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteToken(tok.token)}
                                className="p-1 text-rose-500 hover:text-white bg-rose-950/10 hover:bg-rose-600/20 border border-rose-950 rounded transition-all duration-150 inline-flex items-center align-middle"
                                title="Delete Token"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ========================================== */
          /* ORDINARY USER VIEW */
          /* ========================================== */
          <div className="space-y-6 my-6">
            
            {!isConnected ? (
              /* GATEWAY LOGIN SCREEN WITH EXACTLY 2 BOXES */
              <div className="max-w-md w-full mx-auto my-6">
                <div className="border border-neutral-900 bg-neutral-900/40 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"></div>
                  
                  <div className="text-center mb-8">
                    <div className="mx-auto w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4 text-emerald-400 animate-pulse">
                      <Server className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase">AeroGateway Connection</h2>
                    <p className="text-xs sm:text-sm text-neutral-400 mt-1">Submit server authorization code details to connect communication streams</p>
                  </div>

                  {gatewayError && (
                    <div className="mb-6 p-4 rounded-xl border border-rose-950 bg-rose-950/10 text-rose-300 text-xs sm:text-sm flex gap-3 items-start">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
                      <div>
                        <span className="font-semibold block">Gateway Refusal</span>
                        {gatewayError}
                      </div>
                    </div>
                  )}

                  {/* FORM WITH A SINGLE COMBINED BOX (ID:Token) - NO MENTION OF "TWILIO", "SID" or "TOKEN" IN SYSTEM TITLES */}
                  <form onSubmit={handleConnectGateway} className="space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                        Account Connection String (ID:Token)
                      </label>
                      <div className="relative">
                        <input
                          type={showAccessKey ? 'text' : 'password'}
                          value={combinedCredentials}
                          onChange={(e) => setCombinedCredentials(e.target.value)}
                          placeholder="e.g. AC887F1D97B...:e201736b4..."
                          required
                          className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl py-3 pl-4 pr-10 text-white placeholder-neutral-800 outline-none transition-all duration-200 font-mono text-xs tracking-wide"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAccessKey(!showAccessKey)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-white"
                          title={showAccessKey ? "Hide credentials" : "Show credentials"}
                        >
                          {showAccessKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-neutral-500 mt-2 leading-relaxed">
                        Input format must be your <span className="text-neutral-400 font-bold font-mono">Account ID</span> and <span className="text-neutral-400 font-bold font-mono">Access Token</span> separated by a single colon <code className="bg-neutral-900 px-1 py-0.5 rounded text-emerald-400 font-bold">:</code>.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={isConnecting}
                      className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-teal-500/20 active:scale-95 transition-all duration-150 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:scale-100"
                    >
                      {isConnecting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Establishing Security Tunnel...</span>
                        </>
                      ) : (
                        <span>Verify & Connect Signal Hub</span>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              /* ACTIVE STREAM CONTROLS & TABS (AFTER CONNECTION) */
              <div className="space-y-6">
                
                {/* Connection Status Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border border-emerald-900/30 bg-emerald-950/10 p-5 rounded-2xl gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono block">Gateway Tunnel established</span>
                      <span className="text-lg font-bold text-white uppercase">{connectedName}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleDisconnectGateway}
                      className="px-4 py-2 border border-neutral-800 hover:border-rose-950 bg-neutral-900 hover:bg-rose-950/20 text-neutral-400 hover:text-rose-400 text-xs sm:text-sm font-bold rounded-xl transition-all duration-150"
                    >
                      Disconnect Gateway
                    </button>
                  </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-neutral-900 space-x-2 sm:space-x-4 overflow-x-auto pb-px">
                  <button
                    onClick={() => handleTabChange('numbers')}
                    className={`pb-3 px-2 font-bold text-xs sm:text-sm tracking-wider uppercase border-b-2 transition-all duration-200 flex items-center space-x-2 flex-shrink-0 ${
                      activeTab === 'numbers'
                        ? 'border-emerald-500 text-emerald-400'
                        : 'border-transparent text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    <Phone className="w-4 h-4" />
                    <span>Registry Workspace</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('sms')}
                    className={`pb-3 px-2 font-bold text-xs sm:text-sm tracking-wider uppercase border-b-2 transition-all duration-200 flex items-center space-x-2 flex-shrink-0 ${
                      activeTab === 'sms'
                        ? 'border-emerald-500 text-emerald-400'
                        : 'border-transparent text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Live Signal Feed</span>
                  </button>
                </div>

                {/* TAB PANELS */}
                <div className="min-h-[400px]">
                  
                  {/* UNIFIED REGISTRY WORKSPACE (COMBINED ACTIVE REGISTRIES & LINE PROCUREMENT) */}
                  {activeTab === 'numbers' && (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                      
                      {/* COLUMN 1: LINE PROCUREMENT (SCAN & LEASE) */}
                      <div className="xl:col-span-5 space-y-6">
                        <div className="border border-neutral-900 bg-neutral-900/20 rounded-2xl p-6 space-y-6">
                          <div>
                            <div className="flex items-center space-x-2 text-emerald-400 mb-1">
                              <Plus className="w-4 h-4" />
                              <span className="text-xs font-bold font-mono uppercase tracking-wider">Acquisition Node</span>
                            </div>
                            <h2 className="text-lg font-bold text-white uppercase tracking-tight">Line Procurement</h2>
                            <p className="text-xs text-neutral-500 mt-0.5">Scan available telephony identifier codes in selected geo-zones and secure leases</p>
                          </div>

                          {searchError && (
                            <div className="p-4 rounded-xl border border-rose-950 bg-rose-950/10 text-rose-300 text-xs font-mono">
                              ⚠️ {searchError}
                            </div>
                          )}

                          {purchaseSuccess && (
                            <div className="p-4 rounded-xl border border-emerald-950 bg-emerald-950/10 text-emerald-300 text-xs font-mono flex items-center space-x-2">
                              <CheckCircle className="w-5 h-5 text-emerald-400" />
                              <span>{purchaseSuccess}</span>
                            </div>
                          )}

                          <form onSubmit={handleSearchNumbers} className="space-y-4 bg-neutral-900/30 p-4 rounded-xl border border-neutral-900">
                            <div>
                              <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2 font-mono">Target Region</label>
                              <select
                                value={searchCountry}
                                onChange={(e) => setSearchCountry(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg p-2.5 text-xs text-white font-mono outline-none"
                              >
                                <option value="US">United States (US)</option>
                                <option value="CA">Canada (CA)</option>
                                <option value="PR">Puerto Rico (PR)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2 font-mono">Area Prefix Search</label>
                              <input
                                type="text"
                                maxLength={3}
                                value={searchAreaCode}
                                onChange={(e) => setSearchAreaCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="e.g. 212"
                                className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg p-2.5 text-xs text-white placeholder-neutral-850 outline-none font-mono"
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={isSearchingNumbers}
                              className="w-full py-2.5 px-4 rounded-lg font-bold text-xs bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white transition-all duration-150 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:scale-100 cursor-pointer"
                            >
                              <Search className="w-4 h-4" />
                              <span>{isSearchingNumbers ? 'Scanning Geo-Lines...' : 'Scan Geo-Lines'}</span>
                            </button>
                          </form>

                          {/* Search Results */}
                          {isSearchingNumbers ? (
                            <div className="flex flex-col items-center justify-center py-10 space-y-3">
                              <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
                              <span className="text-xs text-neutral-500 font-mono text-center">Querying live communications directory...</span>
                            </div>
                          ) : searchedNumbers.length > 0 ? (
                            <div className="space-y-4">
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono">Available Identifiers Found:</h3>
                              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-800">
                                {searchedNumbers.map((num) => (
                                  <div key={num.phoneNumber} className="border border-neutral-900 bg-neutral-900/10 p-3.5 rounded-xl flex items-center justify-between hover:border-emerald-900/40 transition-all duration-150">
                                    <div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-base font-bold text-white font-mono block tracking-wide">{num.phoneNumber}</span>
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(num.phoneNumber);
                                            setCopiedSearchNum(num.phoneNumber);
                                            setTimeout(() => setCopiedSearchNum(null), 2000);
                                          }}
                                          className="p-1 text-neutral-500 hover:text-emerald-400 hover:bg-neutral-900 rounded transition-all duration-150 cursor-pointer flex items-center justify-center"
                                          title="Copy phone number"
                                        >
                                          {copiedSearchNum === num.phoneNumber ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                                          ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                      </div>
                                      <span className="text-[10px] text-neutral-500 block uppercase font-mono">{num.locality || 'US/CA/PR'}, {num.region || 'Region'}</span>
                                    </div>
                                    <button
                                      onClick={() => handleBuyNumber(num.phoneNumber)}
                                      disabled={isPurchasing !== null}
                                      className="px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-900/50 hover:border-emerald-500 text-xs font-bold rounded-lg transition-all duration-150 disabled:opacity-50 flex items-center space-x-1 cursor-pointer"
                                    >
                                      {isPurchasing === num.phoneNumber ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                      <span>Lease</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            searchCountry && (
                              <div className="text-center py-8 border border-dashed border-neutral-900 rounded-xl">
                                <Globe className="w-6 h-6 text-neutral-700 mx-auto mb-2" />
                                <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">Provide an area prefix code and hit scan to locate available telephone identifiers.</p>
                              </div>
                            )
                          )}
                        </div>
                      </div>

                      {/* COLUMN 2: ACTIVE REGISTRIES */}
                      <div className="xl:col-span-7 space-y-6">
                        <div className="border border-neutral-900 bg-neutral-900/20 rounded-2xl p-6 space-y-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center space-x-2 text-cyan-400 mb-1">
                                <Phone className="w-4 h-4" />
                                <span className="text-xs font-bold font-mono uppercase tracking-wider">Active Inventory</span>
                              </div>
                              <h2 className="text-lg font-bold text-white uppercase tracking-tight">Active Registries</h2>
                              <p className="text-xs text-neutral-500 mt-0.5">Displays currently leased phone identification signals and routing codes</p>
                            </div>
                            <button
                              onClick={fetchActiveNumbers}
                              className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white hover:border-neutral-700 transition-all duration-150 cursor-pointer"
                              title="Refresh active lines"
                            >
                              <RefreshCw className={`w-4 h-4 ${isLoadingNumbers ? 'animate-spin' : ''}`} />
                            </button>
                          </div>

                          {deleteError && (
                            <div className="p-4 rounded-xl border border-rose-950 bg-rose-950/10 text-rose-300 text-xs font-mono">
                              ⚠️ {deleteError}
                            </div>
                          )}

                          {deleteSuccess && (
                            <div className="p-4 rounded-xl border border-emerald-950 bg-emerald-950/10 text-emerald-300 text-xs font-mono flex items-center space-x-2 animate-fade-in">
                              <CheckCircle className="w-5 h-5 text-emerald-400" />
                              <span>{deleteSuccess}</span>
                            </div>
                          )}

                          {isLoadingNumbers ? (
                            <div className="flex flex-col items-center justify-center py-20 space-y-3">
                              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                              <span className="text-xs text-neutral-500 font-mono">Scanning signal registries...</span>
                            </div>
                          ) : activeNumbers.length === 0 ? (
                            <div className="text-center py-20 border border-dashed border-neutral-900 rounded-xl">
                              <Phone className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
                              <h3 className="text-white font-bold uppercase tracking-wide text-sm">No Active Registries Found</h3>
                              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">Acquire and lease phone numbers on the left panel to populate this registry.</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-neutral-900 text-neutral-500 text-xs font-mono uppercase">
                                    <th className="py-3 px-3">Allocated Phone Number</th>
                                    <th className="py-3 px-3">Friendly Name</th>
                                    <th className="py-3 px-3">Locality / region</th>
                                    <th className="py-3 px-3 text-right font-mono">Operational Release</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-900 text-sm">
                                  {activeNumbers.map((num) => (
                                    <tr key={num.sid} className="hover:bg-neutral-900/10 transition-all duration-150">
                                      <td className="py-4 px-3 font-mono font-bold text-white tracking-wide text-sm sm:text-base">
                                        <div className="flex items-center space-x-2">
                                          <span>{num.phoneNumber}</span>
                                          <button
                                            onClick={() => {
                                              navigator.clipboard.writeText(num.phoneNumber);
                                              setCopiedNumber(num.phoneNumber);
                                              setTimeout(() => setCopiedNumber(null), 2000);
                                            }}
                                            className="p-1 text-neutral-500 hover:text-cyan-400 hover:bg-neutral-900 rounded transition-all duration-150 cursor-pointer flex items-center justify-center"
                                            title="Copy phone number"
                                          >
                                            {copiedNumber === num.phoneNumber ? (
                                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                                            ) : (
                                              <Copy className="w-3.5 h-3.5" />
                                            )}
                                          </button>
                                        </div>
                                      </td>
                                      <td className="py-4 px-3 text-neutral-300 text-xs sm:text-sm">
                                        {num.friendlyName || <span className="text-neutral-600 italic">No Label</span>}
                                      </td>
                                      <td className="py-4 px-3 text-neutral-400 text-[11px] sm:text-xs">
                                        <div className="font-semibold">{num.locality ? `${num.locality}, ${num.region}` : <span className="text-neutral-600 font-mono">Global Zone</span>}</div>
                                        <div className="text-[10px] text-neutral-500 uppercase font-mono mt-0.5">{num.country}</div>
                                      </td>
                                      <td className="py-4 px-3 text-right">
                                        <button
                                          onClick={() => handleDeleteNumber(num.sid)}
                                          className="px-2.5 py-1.5 bg-rose-950/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-950/50 hover:border-rose-500 text-xs font-bold rounded-lg transition-all duration-150 inline-flex items-center gap-1.5 cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          <span className="hidden sm:inline">Release</span>
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* TAB 2: LIVE SMS LOGGER */}
                  {activeTab === 'sms' && (
                    <div className="border border-neutral-900 bg-neutral-900/20 rounded-2xl p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-xl font-bold text-white uppercase tracking-tight">Signal Feed Logs</h2>
                          <p className="text-xs text-neutral-500 mt-0.5">Streaming transmission data records converted to Bangladesh standard time (BD time, GMT+6)</p>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center space-x-2 text-xs font-mono text-neutral-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={autoRefreshSms}
                              onChange={(e) => setAutoRefreshSms(e.target.checked)}
                              className="accent-emerald-500"
                            />
                            <span>Auto Refresh (3s)</span>
                          </label>

                          <button
                            onClick={fetchSms}
                            className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white hover:border-neutral-700 transition-all duration-150 cursor-pointer"
                            title="Force Feed Refresh"
                          >
                            <RefreshCw className={`w-4 h-4 ${isLoadingSms ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {(() => {
                        const inboundSmsLogs = smsLogs.filter(msg => msg.direction && msg.direction.toLowerCase().includes('inbound'));
                        if (isLoadingSms && inboundSmsLogs.length === 0) {
                          return (
                            <div className="flex flex-col items-center justify-center py-20 space-y-3">
                              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                              <span className="text-xs text-neutral-500 font-mono">Syncing incoming messages...</span>
                            </div>
                          );
                        }
                        if (inboundSmsLogs.length === 0) {
                          return (
                            <div className="text-center py-20 border border-dashed border-neutral-900 rounded-xl">
                              <MessageSquare className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
                              <h3 className="text-white font-bold uppercase tracking-wide text-sm">No Incoming Messages</h3>
                              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">Active incoming signals will populate this logger list as soon as they are intercepted.</p>
                            </div>
                          );
                        }
                        return (
                          <div className="space-y-3">
                            {inboundSmsLogs.map((msg) => (
                              <div key={msg.sid} className="border border-neutral-900 bg-neutral-900/30 p-4 rounded-xl hover:border-neutral-800 transition-all duration-150 flex flex-col md:flex-row md:items-start justify-between gap-4">
                                <div className="space-y-2 max-w-4xl">
                                  <div className="flex flex-wrap gap-2 items-center">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-neutral-900 text-neutral-400 border border-neutral-800">
                                      From: <span className="text-emerald-400">{msg.from}</span>
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-neutral-900 text-neutral-400 border border-neutral-800">
                                      To: <span className="text-cyan-400">{msg.to}</span>
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-blue-950/40 text-blue-400 border border-blue-900/30`}>
                                      {msg.direction}
                                    </span>
                                  </div>
                                  <p className="text-sm text-neutral-100 whitespace-pre-wrap select-all font-sans leading-relaxed">
                                    {msg.body}
                                  </p>
                                  {(() => {
                                    const otp = extractOtp(msg.body);
                                    if (otp) {
                                      return (
                                        <div className="mt-2.5 inline-flex items-center gap-2 bg-emerald-950/30 border border-emerald-900/50 rounded-lg px-2.5 py-1">
                                          <span className="text-xs text-emerald-400 font-mono font-medium">OTP:</span>
                                          <span className="text-xs font-mono font-bold text-white tracking-wider bg-black/40 px-2 py-0.5 rounded">{otp}</span>
                                          <button
                                            onClick={() => {
                                              navigator.clipboard.writeText(otp);
                                              setCopiedOtp(msg.sid);
                                              setTimeout(() => setCopiedOtp(null), 2000);
                                            }}
                                            className="p-1 text-emerald-400 hover:text-white hover:bg-emerald-900/50 rounded transition-all duration-150 cursor-pointer flex items-center gap-1 text-[10px] font-bold font-mono uppercase"
                                            title="Copy OTP"
                                          >
                                            {copiedOtp === msg.sid ? (
                                              <>
                                                <Check className="w-3 h-3 text-emerald-400" />
                                                <span>Copied</span>
                                              </>
                                            ) : (
                                              <>
                                                <Copy className="w-3 h-3" />
                                                <span>Copy OTP</span>
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>

                                <div className="text-right flex flex-row md:flex-col justify-between items-center md:items-end flex-shrink-0 pt-1 md:pt-0 border-t md:border-t-0 border-neutral-900/80">
                                  <span className="text-xs font-semibold text-emerald-400 font-mono" title="Bangladesh Local Time (UTC+6)">
                                    {msg.bdTime}
                                  </span>
                                  <span className="text-[10px] text-neutral-500 font-mono uppercase block mt-1">
                                    Status: <span className="text-neutral-400 font-bold">{msg.status}</span>
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-start space-x-3 text-amber-500">
              <AlertTriangle className={`w-6 h-6 flex-shrink-0 ${confirmModal.isDanger ? 'text-rose-500' : 'text-emerald-500'}`} />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white uppercase tracking-wide">
                  {confirmModal.title}
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider text-neutral-400 hover:text-white bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 rounded-xl transition-all duration-150 cursor-pointer"
              >
                {confirmModal.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider text-white rounded-xl transition-all duration-150 cursor-pointer ${
                  confirmModal.isDanger 
                    ? 'bg-rose-600 hover:bg-rose-500' 
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {confirmModal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER CONTROLS */}
      <footer id="nav-footer" className="border-t border-neutral-900 bg-neutral-950/80 py-6 text-center text-xs text-neutral-500 font-mono mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 AeroGateway Network Systems. All Rights Reserved.</p>
          <div className="flex items-center space-x-4">
            <span className="text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Secure Socket Connected
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
