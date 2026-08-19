class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('Error:', error, errorInfo); }
  render() {
    if (this.state.hasError) return <div className="p-4 text-red-600">Unable to load data. Please refresh.</div>;
    return this.props.children;
  }
}

function UserApp() {
  const [authData, setAuthData] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState('mine');
  const [currentMonth, setCurrentMonth] = React.useState('');
  const [availableMonths, setAvailableMonths] = React.useState([]);
  
  // Data States
  const [allFlats, setAllFlats] = React.useState([]);
  const [allBills, setAllBills] = React.useState([]);
  const [allReadings, setAllReadings] = React.useState([]);
  const [summary, setSummary] = React.useState(null);
  
  // Specific user states
  const [myBill, setMyBill] = React.useState(null);
  const [myReading, setMyReading] = React.useState(null);
  
  const [isLocked, setIsLocked] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const auth = localStorage.getItem('ssn_auth');
    if (!auth || JSON.parse(auth).role !== 'user') {
      window.location.href = 'index.html';
      return;
    }
    const parsed = JSON.parse(auth);
    setAuthData(parsed);

    const initData = async () => {
      setLoading(true);
      setError('');
      try {
        const summaries = await window.api.getAllMonthlySummaries();
        const lockedMonths = summaries.filter(s => s.objectData.is_locked).map(s => s.objectData.month).sort().reverse();
        
        let initialMonth = window.utils.getCurrentMonthStr();
        if (lockedMonths.length > 0) {
            initialMonth = lockedMonths[0];
        }
        
        const flatsData = await window.api.getFlats();
        setAllFlats(flatsData);
        
        setAvailableMonths(lockedMonths.length > 0 ? lockedMonths : [initialMonth]);
        setCurrentMonth(initialMonth);
      } catch(err) {
        console.error("Failed to initialize", err);
        setError('Failed to initialize');
        setLoading(false);
      }
    };
    initData();
  }, []);

  React.useEffect(() => {
    if (!currentMonth || !authData) return;
    
    const loadUserData = async () => {
      setLoading(true);
      setError('');
      try {
        const bills = await window.api.getMonthlyBills(currentMonth);
        const readings = await window.api.getWaterReadings(currentMonth);
        const summaryData = await window.api.getMonthlySummary(currentMonth);
        
        const locked = summaryData?.objectData?.is_locked || false;
        setIsLocked(locked);
        setSummary(summaryData?.objectData || null);
        
        if (locked) {
          setAllBills(bills);
          setAllReadings(readings);
          
          const userBill = bills.find(b => b.objectData.flat_no === authData.flatNo);
          const userReading = readings.find(r => r.objectData.flat_no === authData.flatNo);
          
          setMyBill(userBill ? userBill.objectData : null);
          setMyReading((userReading && userReading.objectData.status === 'published') ? userReading.objectData : null);
        } else {
          setAllBills([]);
          setAllReadings([]);
          setMyBill(null);
          setMyReading(null);
        }
      } catch (err) {
        console.error("Failed to load user data", err);
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [currentMonth, authData]);

  const handleLogout = () => {
    localStorage.removeItem('ssn_auth');
    window.location.href = 'index.html';
  };

  const downloadMyBillPDF = () => {
    if (!myBill) return;
    
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      const monthName = new Date(currentMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });
      
      doc.setFontSize(16);
      doc.text(`Shiridi Sai Nilayam - Maintenance & Water Bill`, 14, 20);
      
      doc.setFontSize(12);
      doc.text(`Flat Number: ${authData.flatNo}`, 14, 30);
      doc.text(`Billing Month: ${monthName}`, 14, 38);
      
      const tableData = [
        ['Description', 'Amount'],
        ['Monthly Maintenance Charge', `Rs. ${myBill.maintenance_charge.toFixed(2)}`],
        ['Water Charge (Excess)', `Rs. ${myBill.water_charge.toFixed(2)}`],
        ['Total Amount Due', `Rs. ${Math.round(myBill.total_bill)}`]
      ];
      
      doc.autoTable({
        startY: 45,
        head: [['Bill Breakdown', '']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 4, lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fillColor: [180, 198, 231], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: function(data) {
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [255, 242, 204];
            data.cell.styles.textColor = [153, 0, 0];
          }
        }
      });
      
      if (myReading) {
        doc.text(`Water Consumption Details`, 14, doc.lastAutoTable.finalY + 15);
        const waterData = [
          ['Previous Reading', myReading.previous_reading],
          ['Current Reading', myReading.current_reading],
          ['Used Water (Liters)', Math.round(myReading.used_water)],
          ['Free Water Allowance (Liters)', (myReading.free_water || (summary?.calculated_free_water || 0)).toFixed(6)],
          ['Excess Water (Liters)', Math.round(myReading.excess_water || 0)]
        ];
        
        doc.autoTable({
          startY: doc.lastAutoTable.finalY + 20,
          body: waterData,
          theme: 'grid',
          styles: { fontSize: 10, cellPadding: 4, lineColor: [0, 0, 0], lineWidth: 0.1 },
          columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
        });
      }
      
      doc.save(`Bill_Flat_${authData.flatNo}_${currentMonth}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Failed to generate PDF");
    }
  };

  const downloadCompletePDF = async () => {
    if (!isLocked) return;
    setLoading(true);
    try {
      const expenses = await window.api.getExpenses(currentMonth);
      const tankers = await window.api.getWaterTankers(currentMonth);
      
      const billsMap = {};
      allBills.forEach(b => {
        billsMap[b.objectData.flat_no] = b;
      });

      const readingsMap = {};
      allReadings.forEach(r => {
        readingsMap[r.objectData.flat_no] = r.objectData;
      });

      const data = {
        flats: allFlats,
        readings: readingsMap,
        summary: summary,
        bills: billsMap,
        expenses,
        tankers
      };

      await window.generateExcelStylePDF(currentMonth, data);
    } catch (err) {
      console.error(err);
      alert("Failed to generate PDF");
    } finally {
      setLoading(false);
    }
  };

  if (!authData) return null;
  const monthDisplay = currentMonth ? new Date(currentMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' }) : '';

  return (
    <div className="min-h-screen flex flex-col pb-20">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div>
          <div className="font-bold text-lg text-[var(--primary-color)]">Flat {authData.flatNo}</div>
          <div className="text-xs text-slate-500">Resident Portal</div>
        </div>
        <button onClick={handleLogout} className="text-sm text-slate-500 flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
          <div className="icon-log-out"></div> Logout
        </button>
      </header>

      <div className="px-4 pt-4 max-w-lg mx-auto w-full">
        <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
          <button 
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'mine' ? 'bg-white shadow-sm text-sky-700' : 'text-slate-500'}`}
            onClick={() => setActiveTab('mine')}
          >
            Mine
          </button>
          <button 
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'all' ? 'bg-white shadow-sm text-sky-700' : 'text-slate-500'}`}
            onClick={() => setActiveTab('all')}
          >
            All Flats
          </button>
        </div>
      </div>

      <main className="flex-1 px-4 max-w-lg mx-auto w-full space-y-4">
        <div className="card p-4">
          <label className="block text-sm font-medium text-slate-500 mb-2">Billing Month</label>
          <div className="relative">
            <select 
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
              className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 font-semibold rounded-lg px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent transition-all"
            >
              {availableMonths.length === 0 && (
                <option value={currentMonth}>{monthDisplay || 'Loading...'}</option>
              )}
              {availableMonths.map(m => (
                <option key={m} value={m}>
                  {new Date(m + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
              <div className="icon-chevron-down"></div>
            </div>
          </div>
        </div>

        <window.ErrorAlert error={error} onRetry={() => window.location.reload()} />

        {loading ? (
          <div className="text-center py-10 text-slate-500 flex flex-col items-center gap-2">
            <div className="icon-loader animate-spin text-2xl text-sky-500"></div>
            Loading details...
          </div>
        ) : error ? null : (
          <>
            {activeTab === 'mine' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-end">
                  <h2 className="text-xl font-bold text-slate-800">My Bill</h2>
                  {myBill && (
                    <button onClick={downloadMyBillPDF} className="text-xs bg-sky-100 text-sky-700 hover:bg-sky-200 px-3 py-1.5 rounded-md font-medium flex items-center gap-1 transition-colors">
                      <div className="icon-download"></div> Download PDF
                    </button>
                  )}
                </div>

                <div className="card">
                  <div className="text-slate-500 text-sm mb-1">Total Bill Amount</div>
                  <div className="text-3xl font-bold text-[var(--text-main)]">
                    {myBill ? `₹${Math.round(myBill.total_bill)}` : 'Pending'}
                  </div>
                  <div className={`text-xs mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-md ${myBill ? 'text-blue-700 bg-blue-50' : 'text-amber-700 bg-amber-50'}`}>
                    <div className={myBill ? "icon-circle-check" : "icon-clock"}></div>
                    {myBill ? 'Bill Published' : 'Pending publication'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="card p-4 flex flex-col justify-center">
                    <div className="flex items-center gap-2 text-sky-600 mb-1">
                      <div className="icon-droplet"></div>
                      <span className="font-medium text-sm">Water Used</span>
                    </div>
                    <div className="text-xl font-semibold text-slate-800">{myReading ? `${Math.round(myReading.used_water)} L` : '-'}</div>
                  </div>
                  <div className="card p-4 flex flex-col justify-center">
                    <div className="flex items-center gap-2 text-indigo-600 mb-1">
                      <div className="icon-settings"></div>
                      <span className="font-medium text-sm">Maintenance</span>
                    </div>
                    <div className="text-xl font-semibold text-slate-800">{myBill ? `₹${myBill.maintenance_charge.toFixed(2)}` : '-'}</div>
                  </div>
                </div>
                
                {myBill && (
                  <div className="card p-4 mt-4">
                    <h3 className="font-bold text-sm text-slate-700 mb-3 border-b border-slate-100 pb-2">Bill Breakdown</h3>
                    <div className="space-y-3 text-sm text-slate-600">
                      <div className="flex justify-between">
                        <span>Maintenance Share</span>
                        <span className="font-medium">₹{myBill.maintenance_charge.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Water Charge (Excess)</span>
                        <span className="font-medium">₹{myBill.water_charge.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-800 pt-3 border-t border-slate-100 mt-3 text-base">
                        <span>Total Due</span>
                        <span className="text-[var(--primary-color)]">₹{Math.round(myBill.total_bill)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'all' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-end mb-2">
                  <h2 className="text-lg font-bold text-slate-800">All Flats</h2>
                  {isLocked && (
                    <button onClick={downloadCompletePDF} className="text-xs bg-[var(--primary-color)] text-white hover:bg-sky-800 px-3 py-1.5 rounded-md font-medium flex items-center gap-1 shadow-sm transition-colors">
                      <div className="icon-download"></div> Complete PDF
                    </button>
                  )}
                </div>

                {!isLocked ? (
                  <div className="card text-center py-8 text-slate-500">
                    <div className="icon-lock-open text-3xl mb-2 mx-auto text-slate-300"></div>
                    Bills for this month have not been generated yet.
                  </div>
                ) : (
                  <div className="card p-0 overflow-hidden divide-y divide-slate-100 border border-slate-200">
                    {allFlats.filter(f => f.objectData.meter_type !== 'COMMON').map(flat => {
                      const flatNo = flat.objectData.flat_no;
                      const b = allBills.find(x => x.objectData.flat_no === flatNo)?.objectData;
                      
                      return (
                        <div key={flatNo} className={`flex justify-between items-center p-4 hover:bg-slate-50 transition-colors ${flatNo === authData.flatNo ? 'bg-sky-50/50' : ''}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">
                              {flatNo}
                            </div>
                            {flatNo === authData.flatNo && <span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">You</span>}
                          </div>
                          <div className="font-bold text-slate-800 text-lg">
                            {b ? `₹${Math.round(b.total_bill)}` : '-'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <UserApp />
  </ErrorBoundary>
);