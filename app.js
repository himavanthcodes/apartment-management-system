class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center card max-w-sm w-full">
            <h1 className="text-xl font-bold text-red-600 mb-2">Something went wrong</h1>
            <p className="text-slate-600 mb-4">We encountered an unexpected error.</p>
            <div className="bg-red-50 text-red-700 p-3 rounded text-sm text-left mb-6 break-words font-mono">
              {this.state.error.message}
            </div>
            <button onClick={() => window.location.reload()} className="btn-primary">
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoginApp() {
  const [role, setRole] = React.useState('user');
  const [flatNo, setFlatNo] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [flats, setFlats] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loggingIn, setLoggingIn] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const initApp = async () => {
      try {
        const auth = localStorage.getItem('ssn_auth');
        if (auth) {
          const parsed = JSON.parse(auth);
          window.location.href = parsed.role === 'admin' ? 'admin.html' : 'user.html';
          return;
        }

        const flatsData = await window.api.getFlats();
        setFlats(flatsData);
        setLoading(false);
      } catch (err) {
        console.error("Initialization failed:", err);
        setError("Could not connect to database. Please check your connection.");
        setLoading(false);
      }
    };
    initApp();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (role === 'user' && !flatNo) {
      setError('Please select your flat number');
      return;
    }
    
    if (role === 'admin') {
      if (!password) {
        setError('Please enter admin password');
        return;
      }
      
      setLoggingIn(true);
      try {
        let isValid = false;
        console.log("Password entered by the user:", password);
        
        let dbPasswordHash = null;
        let fetchFailed = false;
        try {
          const admins = await window.api.getAdminSettings();
          const adminDoc = admins.find(a => a.objectId === 'default' || a.objectData?.username === 'admin');
          if (adminDoc) {
            dbPasswordHash = adminDoc.objectData.passwordHash || adminDoc.objectData.password_hash;
          }
        } catch (e) {
          console.warn("admin_settings fetch failed.", e);
          fetchFailed = true;
        }
        
        console.log("Password value fetched from Firestore:", dbPasswordHash);
        
        if (dbPasswordHash) {
          const isPlainText = dbPasswordHash.length !== 64;
          console.log("Is the fetched value plain text?", isPlainText);
          
          if (isPlainText) {
            isValid = (password === dbPasswordHash);
          } else {
            const hashInput = await window.utils.sha256(password);
            isValid = (hashInput === dbPasswordHash);
          }
        } else {
          console.log("Is the fetched value plain text?", false);
          if (password === 'admin@1234123412341234') {
            isValid = true;
          }
        }
        
        console.log("Comparison result:", isValid);
        
        if (!isValid) {
          setError(fetchFailed ? "Invalid Admin Password (Network fetch failed)" : "Invalid Admin Password");
          setLoggingIn(false);
          return;
        }
      } catch (err) {
        console.error("DB check failed for admin", err);
        setError("Invalid Admin Password");
        setLoggingIn(false);
        return;
      }
    }

    const authData = {
      role,
      flatNo: role === 'user' ? flatNo : null
    };

    localStorage.setItem('ssn_auth', JSON.stringify(authData));
    window.location.href = role === 'admin' ? 'admin.html' : 'user.html';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="icon-loader animate-spin text-4xl text-[var(--primary-color)] mb-4 mx-auto"></div>
          <p className="text-slate-600 font-medium mb-2">Loading Shiridi Sai Nilayam...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md card">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[var(--secondary-color)] rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="icon-house text-3xl text-[var(--primary-color)]"></div>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-main)]">Shiridi Sai Nilayam</h1>
          <p className="text-[var(--text-muted)] mt-1">Apartment Management System</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--text-main)] mb-1">Select Role</label>
            <select 
              className="input-field"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setError('');
              }}
            >
              <option value="user">Flat Owner / Tenant</option>
              <option value="admin">Maintenance Incharge (Admin)</option>
            </select>
          </div>

          {role === 'admin' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-medium text-[var(--text-main)] mb-1">Admin Password</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Enter password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          {role === 'user' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-medium text-[var(--text-main)] mb-1">Select Flat</label>
              {flats.length === 0 ? (
                <div className="text-sm text-slate-500 py-2 border border-slate-200 rounded-lg px-4 bg-slate-50">No flats found in DB</div>
              ) : (
                <select 
                  className="input-field"
                  value={flatNo}
                  onChange={(e) => setFlatNo(e.target.value)}
                >
                  <option value="">-- Select Flat --</option>
                  {flats.map(f => (
                    <option key={f.objectId} value={f.objectData.flat_no}>
                      Flat {f.objectData.flat_no}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <button type="submit" disabled={loggingIn} className="btn-primary flex items-center justify-center gap-2 mt-2 disabled:opacity-70">
            {loggingIn ? (
              <div className="icon-loader animate-spin"></div>
            ) : (
              <div className="icon-arrow-right"></div>
            )}
            {loggingIn ? 'Authenticating...' : 'Continue to Dashboard'}
          </button>
        </form>
      </div>
      <div className="mt-8 text-sm text-slate-400 text-center space-y-3">
        <div>&copy; 2026 Shiridi Sai Nilayam Maintenance</div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <LoginApp />
  </ErrorBoundary>
);