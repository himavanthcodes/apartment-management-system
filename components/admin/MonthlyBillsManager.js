function MonthlyBillsManager() {
  const [month, setMonth] = React.useState(window.utils.getCurrentMonthStr());
  const [flats, setFlats] = React.useState([]);
  const [readings, setReadings] = React.useState({});
  const [summary, setSummary] = React.useState(null);
  const [savedBills, setSavedBills] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [generating, setGenerating] = React.useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const flatsData = await window.api.getFlats();
      const readingsData = await window.api.getWaterReadings(month);
      const summaryData = await window.api.getMonthlySummary(month);
      const billsData = await window.api.getMonthlyBills(month);
      
      setFlats(flatsData);
      
      const readingsMap = {};
      readingsData.forEach(r => {
        readingsMap[r.objectData.flat_no] = r.objectData;
      });
      setReadings(readingsMap);
      setSummary(summaryData?.objectData || null);

      const billsMap = {};
      billsData.forEach(b => {
        billsMap[b.objectData.flat_no] = b;
      });
      setSavedBills(billsMap);
    } catch (err) {
      console.error("Failed to fetch monthly bills:", err);
      setError(err.message || 'Failed to fetch bills');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [month]);

  const handleUnlockBills = async () => {
    if (!confirm("You are about to unlock this month's bills.\n\nThis should only be done to correct mistakes.\nExisting generated bills will be replaced after regeneration.\n\nContinue?")) return;
    
    setGenerating(true);
    try {
      const existingSummary = await window.api.getMonthlySummary(month);
      if (existingSummary) {
        await window.api.saveMonthlySummary({ 
          ...existingSummary.objectData, 
          is_locked: false 
        }, existingSummary.objectId);
      }
      await fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to unlock bills.");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAndSaveBills = async () => {
    if (summary?.is_locked) {
      alert("Bills for this month have already been generated.");
      return;
    }

    const billableFlats = flats.filter(f => f.objectData.meter_type !== 'COMMON' && f.objectData.flat_no !== 'WATCHMAN');

    // 1. Water Readings Validation
    for (const flat of billableFlats) {
      const r = readings[flat.objectData.flat_no];
      if (!r || r.previous_reading === undefined || r.previous_reading === '' || r.current_reading === undefined || r.current_reading === '') {
        alert("Please complete all water meter readings before generating bills.");
        return;
      }
    }

    // 2. Water Tankers Validation
    const tankers = await window.api.getWaterTankers(month);
    if (!tankers || tankers.length === 0) {
      alert("Please enter water tanker details before generating bills.");
      return;
    }

    // 3. Expenses Validation
    const expenses = await window.api.getExpenses(month);
    if (!expenses || expenses.length === 0) {
      alert("Please enter monthly expenses before generating bills.");
      return;
    }

    // 4. Apartment Settings / Summary Validation
    if (!summary || !summary.living_flats || summary.maintenance_per_flat === undefined) {
      alert("Please ensure apartment settings and living flats are properly calculated.");
      return;
    }

    const isRegeneration = !!summary?.generated_at;
    const confirmMessage = isRegeneration 
      ? "Regenerating bills will overwrite the previous generated bills for this month.\n\nContinue?"
      : "Are you sure you want to Generate Bills? This will calculate, save, lock the month and make bills visible to users immediately.";

    if (!confirm(confirmMessage)) return;
    
    setGenerating(true);
    const maintenanceCharge = summary?.maintenance_per_flat || 0;

    for (const flat of billableFlats) {
      const flatNo = flat.objectData.flat_no;
      const r = readings[flatNo] || {};
      const waterCharge = r.water_charge || 0;
      const totalBill = Math.round(waterCharge + maintenanceCharge);

      const billData = {
        month,
        flat_no: flatNo,
        water_charge: waterCharge,
        maintenance_charge: maintenanceCharge,
        total_bill: totalBill
      };

      const existingBill = savedBills[flatNo];
      await window.api.saveMonthlyBill(billData, existingBill?.objectId);

      // Publish water reading for flat
      const existingReading = await window.api.getWaterReadings(month).then(rs => rs.find(rr => rr.objectData.flat_no === flatNo));
      if (existingReading) {
        await window.api.saveWaterReading({ ...existingReading.objectData, status: 'published' }, existingReading.objectId);
      }
    }

    // Also publish COMMON meter readings and WATCHMAN
    const commonMeters = flats.filter(f => f.objectData.meter_type === 'COMMON' || f.objectData.flat_no === 'WATCHMAN');
    for (const flat of commonMeters) {
      const flatNo = flat.objectData.flat_no;
      const existingReading = await window.api.getWaterReadings(month).then(rs => rs.find(rr => rr.objectData.flat_no === flatNo));
      if (existingReading) {
        await window.api.saveWaterReading({ ...existingReading.objectData, status: 'published' }, existingReading.objectId);
      }
    }
    
    // Lock the month and record audit info
    if (summary) {
      const existingSummary = await window.api.getMonthlySummary(month);
      const now = new Date().toISOString();
      await window.api.saveMonthlySummary({ 
        ...existingSummary.objectData, 
        is_locked: true,
        generated_at: existingSummary.objectData.generated_at || now,
        last_regenerated_at: isRegeneration ? now : null
      }, existingSummary.objectId);
    }

    await fetchData();
    setGenerating(false);
    alert(isRegeneration ? "Bills successfully regenerated and published!" : "Bills successfully generated and published!");
  };

  const generatePDF = async () => {
    setLoading(true);
    try {
      const expenses = await window.api.getExpenses(month);
      const tankers = await window.api.getWaterTankers(month);
      
      const data = {
        flats,
        readings,
        summary,
        bills: savedBills,
        expenses,
        tankers
      };

      await window.generateExcelStylePDF(month, data);
    } catch (error) {
      console.error("PDF Generation Error", error);
      alert("Failed to generate PDF.");
    } finally {
      setLoading(false);
    }
  };

  const maintenanceCharge = summary?.maintenance_per_flat || 0;
  const isLocked = summary?.is_locked || false;

  return (
    <div className="space-y-5">
      <div className="card">
        <label className="label-text">Select Billing Month</label>
        <input 
          type="month" 
          value={month} 
          onChange={(e) => setMonth(e.target.value)} 
          className="input-field" 
        />
      </div>

      <window.ErrorAlert error={error} onRetry={fetchData} />

      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading data...</div>
      ) : error ? null : (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold text-lg text-slate-800">Flat Bills</h2>
            <div className="flex items-center gap-2">
              {isLocked && <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded flex items-center gap-1"><div className="icon-lock w-3 h-3"></div> Locked</span>}
              <div className="text-sm bg-sky-100 text-sky-800 px-2 py-1 rounded">Base Maint: ₹{maintenanceCharge.toFixed(2)}</div>
              <button onClick={generatePDF} className="bg-[var(--primary-color)] text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 font-medium hover:bg-sky-800">
                <div className="icon-download"></div> PDF
              </button>
            </div>
          </div>

          {flats.filter(f => f.objectData.meter_type !== 'COMMON' && f.objectData.flat_no !== 'WATCHMAN').map(flat => {
            const flatNo = flat.objectData.flat_no;
            const savedBill = savedBills[flatNo]?.objectData;
            
            // Prefer saved bill data if it exists, otherwise show calculated prediction
            const waterCharge = savedBill ? savedBill.water_charge : (readings[flatNo]?.water_charge || 0);
            const maintCharge = savedBill ? savedBill.maintenance_charge : maintenanceCharge;
            const totalBill = savedBill ? savedBill.total_bill : Math.round(waterCharge + maintCharge);
            const isSaved = !!savedBill;
            
            return (
              <div key={flat.objectId} className={`card p-0 overflow-hidden ${isSaved ? 'border-emerald-200' : ''}`}>
                <div className={`${isSaved ? 'bg-emerald-50' : 'bg-slate-50'} px-4 py-3 border-b ${isSaved ? 'border-emerald-100' : 'border-slate-100'} flex justify-between items-center`}>
                  <div className="flex items-center gap-2">
                    <div className={`font-bold text-lg ${isSaved ? 'text-emerald-700' : 'text-[var(--primary-color)]'}`}>Flat {flatNo}</div>
                    {isSaved && <div className="icon-circle-check text-emerald-600 text-sm"></div>}
                  </div>
                  <div className="font-bold text-xl text-slate-800">₹{Math.round(totalBill)}</div>
                </div>
                
                <div className="p-4 space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Maintenance Charge</span>
                    <span className="font-medium text-slate-800">₹{maintCharge.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Water Charge</span>
                    <span className="font-medium text-slate-800">₹{waterCharge.toFixed(2)}</span>
                  </div>
                  
                  {!isSaved && !readings[flatNo]?.current_reading && (
                    <div className="text-xs text-orange-500 bg-orange-50 p-2 rounded mt-2">
                      Warning: Water readings not entered for this month.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          <div className="sticky bottom-20 left-0 right-0 p-4 bg-white border-t border-slate-200 mt-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] mx-[-1rem] flex flex-col gap-3">
            {isLocked ? (
              <button 
                onClick={handleUnlockBills} 
                disabled={generating}
                className="btn-secondary shadow-lg border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                <div className="icon-unlock"></div>
                {generating ? 'Unlocking...' : 'Unlock Bills for Correction'}
              </button>
            ) : (
              <button 
                onClick={handleGenerateAndSaveBills} 
                disabled={generating || flats.filter(f => f.objectData.meter_type !== 'COMMON' && f.objectData.flat_no !== 'WATCHMAN').length === 0}
                className="btn-primary shadow-lg"
              >
                <div className="icon-send"></div>
                {generating ? 'Processing...' : (summary?.generated_at ? 'Regenerate Bills' : 'Generate Bills')}
              </button>
            )}
            {summary?.generated_at && (
              <div className="text-center text-[10px] text-slate-400">
                Generated: {new Date(summary.generated_at).toLocaleString()}
                {summary.last_regenerated_at && <br />}
                {summary.last_regenerated_at && `Last Regenerated: ${new Date(summary.last_regenerated_at).toLocaleString()}`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
window.MonthlyBillsManager = MonthlyBillsManager;