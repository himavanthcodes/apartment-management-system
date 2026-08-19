class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('Error:', error, errorInfo); }
  render() {
    if (this.state.hasError) return <div className="p-4 text-red-600 bg-red-50 min-h-screen">Unable to load data. Please refresh.</div>;
    return this.props.children;
  }
}

function AdminApp() {
  const [activeTab, setActiveTab] = React.useState('water');
  const [visitedTabs, setVisitedTabs] = React.useState(new Set(['water']));

  React.useEffect(() => {
    const auth = localStorage.getItem('ssn_auth');
    if (!auth || JSON.parse(auth).role !== 'admin') {
      window.location.href = 'index.html';
    }
  }, []);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setVisitedTabs(prev => new Set(prev).add(tabId));
  };

  const handleLogout = () => {
    localStorage.removeItem('ssn_auth');
    window.location.href = 'index.html';
  };

  const navItems = [
    { id: 'water', icon: 'icon-droplet', label: 'Water' },
    { id: 'expenses', icon: 'icon-list', label: 'Expenses' },
    { id: 'bills', icon: 'icon-file-text', label: 'Bills' },
    { id: 'payments', icon: 'icon-credit-card', label: 'Payments' }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Mobile Top Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="font-bold text-xl text-[var(--primary-color)]">SSN Admin</div>
        </div>
        <button onClick={handleLogout} className="text-sm text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1">
          <div className="icon-log-out"></div> Exit
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 max-w-lg mx-auto w-full">
        <div style={{ display: activeTab === 'water' ? 'block' : 'none' }}>
          {visitedTabs.has('water') && <window.WaterReadingsManager />}
        </div>
        <div style={{ display: activeTab === 'expenses' ? 'block' : 'none' }}>
          {visitedTabs.has('expenses') && <window.ExpensesManager />}
        </div>
        <div style={{ display: activeTab === 'bills' ? 'block' : 'none' }}>
          {visitedTabs.has('bills') && <window.MonthlyBillsManager />}
        </div>
        <div style={{ display: activeTab === 'payments' ? 'block' : 'none' }}>
          {visitedTabs.has('payments') && <window.PaymentsManager />}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center pb-safe z-30 shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.05)]">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleTabChange(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-3 transition-colors ${
              activeTab === item.id 
                ? 'text-[var(--primary-color)]' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className={`${item.icon} text-2xl mb-1 ${activeTab === item.id ? 'scale-110 transition-transform' : ''}`}></div>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <AdminApp />
  </ErrorBoundary>
);