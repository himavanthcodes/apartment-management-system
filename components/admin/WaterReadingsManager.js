function WaterReadingsManager() {
  const [month, setMonth] = React.useState(window.utils.getCurrentMonthStr());
  const [flats, setFlats] = React.useState([]);
  const [readings, setReadings] = React.useState({});
  const [tankers, setTankers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  
  // Billing Mode States
  const [livingFlats, setLivingFlats] = React.useState(15);
  const [calcStats, setCalcStats] = React.useState({ 
    freeWaterPerFlat: 0, costPerLiter: 0, totalUsed: 0, 
    totalTankerWater: 0, totalTankerCost: 0, totalFreeWater: 0, totalExcessWater: 0 
  });

  const [isLocked, setIsLocked] = React.useState(false);
  const [readOnlyPrev, setReadOnlyPrev] = React.useState({});
  const [summaryId, setSummaryId] = React.useState(null);
  const [hasMonthData, setHasMonthData] = React.useState(true);
  const [isInitializing, setIsInitializing] = React.useState(false);

  // New Tanker Form State
  const [showTankerForm, setShowTankerForm] = React.useState(false);
  const [tankerDate, setTankerDate] = React.useState(`${month}-01`);
  const [tankerCapacity, setTankerCapacity] = React.useState('10000');
  const [customCapacity, setCustomCapacity] = React.useState('');
  const [tankerCost, setTankerCost] = React.useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // --- ONE-TIME DATABASE REPAIR SCRIPT ---
      if (!localStorage.getItem('ssn_db_repaired_drafts_v1')) {
        console.log("Running one-time database repair for corrupted drafts...");
        const initialReadings = await window.api.getWaterReadings();
        
        // Detect all draft records where Current Reading is present (corrupted/copied data)
        const draftsToFix = initialReadings.filter(r => 
          r.objectData.status === 'draft' && 
          r.objectData.current_reading !== undefined && 
          r.objectData.current_reading !== ''
        );
        
        if (draftsToFix.length > 0) {
          console.warn(`Found ${draftsToFix.length} corrupted draft records. Repairing...`);
          for (const draft of draftsToFix) {
            console.log(`Fixing Flat ${draft.objectData.flat_no} for month ${draft.objectData.month}. Corrupted Current Reading: ${draft.objectData.current_reading}`);
            
            // Reset Current Reading and calculations, but keep Previous Reading unchanged
            await window.api.saveWaterReading({
              ...draft.objectData,
              current_reading: '',
              used_water: 0,
              excess_water: 0,
              water_charge: 0
            }, draft.objectId);
          }
          console.log("Database repair complete. Reloading clean data...");
          window.utils.invalidateCache('water_readings');
        } else {
          console.log("No corrupted draft records found.");
        }
        
        // Flag to ensure this only runs once
        localStorage.setItem('ssn_db_repaired_drafts_v1', 'true');
      }
      // --- END REPAIR SCRIPT ---

      const flatsData = await window.api.getFlats();
      let allReadings = await window.api.getWaterReadings(); 
      
      // Seed initial May 2026 WATCHMAN reading if not exists
      const watchmanMay = allReadings.find(r => r.objectData.flat_no === 'WATCHMAN' && r.objectData.month === '2026-05');
      if (!watchmanMay && flatsData.some(f => f.objectData.flat_no === 'WATCHMAN')) {
        await window.api.saveWaterReading({
          month: '2026-05',
          flat_no: 'WATCHMAN',
          previous_reading: 161715,
          current_reading: 162537,
          used_water: 822,
          status: 'published'
        });
        allReadings = await window.api.getWaterReadings();
      }

      const currentMonthReadings = allReadings.filter(r => r.objectData.month === month);
      const pastReadings = allReadings.filter(r => r.objectData.month < month);
      const summaryData = await window.api.getMonthlySummary(month);
      const tankerData = await window.api.getWaterTankers(month);
      
      setFlats(flatsData);
      setTankers(tankerData);
      setIsLocked(summaryData?.objectData?.is_locked || false);
      setSummaryId(summaryData?.objectId || null);

      const standardFlatsCount = flatsData.filter(f => f.objectData.meter_type !== 'COMMON').length;
      let currentLivingFlats = standardFlatsCount;

      if (summaryData?.objectData) {
        currentLivingFlats = summaryData.objectData.living_flats !== undefined ? summaryData.objectData.living_flats : standardFlatsCount;
      }
      setLivingFlats(currentLivingFlats);
      
      setIsInitializing(false);

      // Only get the latest PUBLISHED (Locked/Generated) billing month readings.
      // Never use draft data for initialization.
      const latestPastReadings = {};
      pastReadings.forEach(r => {
        const fno = r.objectData.flat_no;
        if (r.objectData.status === 'published') {
          if (!latestPastReadings[fno] || r.objectData.month > latestPastReadings[fno].month) {
            latestPastReadings[fno] = r.objectData;
          }
        }
      });

      const readingsMap = {};
      const readOnlyPrevMap = {};

      // Load existing readings for current month if they exist
      currentMonthReadings.forEach(r => {
        readingsMap[r.objectData.flat_no] = JSON.parse(JSON.stringify(r));
      });
      
      flatsData.forEach(f => {
        const fno = f.objectData.flat_no;
        const lastPublished = latestPastReadings[fno];
        const defaultPrevious = lastPublished ? lastPublished.current_reading : 0;
        
        if (readingsMap[fno]) {
          // If reading exists (draft or published), enforce previous reading from latest published month
          // This prevents incorrect chaining if previous months were not published.
          if (readingsMap[fno].objectData.status === 'draft') {
            readingsMap[fno].objectData.previous_reading = defaultPrevious;
            readOnlyPrevMap[fno] = !!lastPublished;
          } else {
            readOnlyPrevMap[fno] = !!lastPublished;
          }
        } else {
          // New initialization
          readingsMap[fno] = {
            objectData: {
              flat_no: fno,
              month: month,
              previous_reading: defaultPrevious,
              current_reading: '',
              used_water: 0,
              excess_water: 0,
              water_charge: 0,
              status: 'draft'
            }
          };
          readOnlyPrevMap[fno] = !!lastPublished;
        }
      });

      setHasMonthData(true);

      const initialCalc = performCalculations(
        readingsMap, flatsData, 'tanker', currentLivingFlats, tankerData
      );
      setReadings(initialCalc.readings);
      setCalcStats(initialCalc.stats);
      setReadOnlyPrev(readOnlyPrevMap);
    } catch (err) {
      console.error("Failed to fetch water readings:", err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [month]);

  const performCalculations = (currentReadings, currentFlats, mode, lFlats, currentTankers) => {
    let totalUsed = 0;
    const tempMap = JSON.parse(JSON.stringify(currentReadings)); // Deep copy

    // Calculate Used Water per flat & Total Used
    currentFlats.forEach(f => {
      const fno = f.objectData.flat_no;
      if (tempMap[fno]) {
        const r = tempMap[fno].objectData;
        const prev = parseFloat(r.previous_reading) || 0;
        const curr = parseFloat(r.current_reading) || 0;
        
        let used = Math.max(0, curr - prev);
        
        if (fno === 'WATCHMAN') {
          used = 0; // Watchman meter is for record only
        }

        r.used_water = used;
        
        // Exclude COMMON meters and WATCHMAN from total used water for billing calculations
        if (f.objectData.meter_type !== 'COMMON' && fno !== 'WATCHMAN') {
          totalUsed += used;
        }
      }
    });

    let tWater = 0;
    let tCost = 0;
    let freeWaterPerFlat = 0;
    let costPerLiter = 0;
    let totalFreeWater = 0;
    let totalExcessWater = 0;

    // Tanker Mode Calculations
    currentTankers.forEach(t => {
      tWater += parseFloat(t.objectData.liters) || 0;
      tCost += parseFloat(t.objectData.cost) || 0;
    });

    totalFreeWater = Math.max(0, totalUsed - tWater);
    freeWaterPerFlat = lFlats > 0 ? totalFreeWater / lFlats : 0;

    currentFlats.forEach(f => {
      const fno = f.objectData.flat_no;
      if (tempMap[fno]) {
        const r = tempMap[fno].objectData;
        if (f.objectData.meter_type === 'COMMON' || fno === 'WATCHMAN') {
          r.excess_water = 0;
          r.free_water = 0;
          r.water_charge = 0;
        } else {
          const excess = Math.round(Math.max(0, (r.used_water || 0) - freeWaterPerFlat));
          r.excess_water = excess;
          r.free_water = freeWaterPerFlat;
          totalExcessWater += excess;
        }
      }
    });

    costPerLiter = totalExcessWater > 0 ? tCost / totalExcessWater : 0;

    currentFlats.forEach(f => {
      const fno = f.objectData.flat_no;
      if (tempMap[fno]) {
        const r = tempMap[fno].objectData;
        if (f.objectData.meter_type !== 'COMMON' && fno !== 'WATCHMAN') {
          r.water_charge = parseFloat((r.excess_water * costPerLiter).toFixed(2));
        }
      }
    });

    return {
      readings: tempMap,
      stats: {
        freeWaterPerFlat,
        costPerLiter,
        totalUsed,
        totalTankerWater: tWater,
        totalTankerCost: tCost,
        totalFreeWater,
        totalExcessWater
      }
    };
  };

  const handleLivingFlatsChange = (val) => {
    const lFlats = parseFloat(val) || 0;
    setLivingFlats(lFlats);
    const calc = performCalculations(readings, flats, 'tanker', lFlats, tankers);
    setReadings(calc.readings);
    setCalcStats(calc.stats);
  };

  const handleReadingChange = (flatNo, field, value) => {
    const updatedReadings = { ...readings };
    if (!updatedReadings[flatNo]) updatedReadings[flatNo] = { objectData: { flat_no: flatNo, month } };
    updatedReadings[flatNo].objectData[field] = value;
    
    const calc = performCalculations(updatedReadings, flats, 'tanker', livingFlats, tankers);
    setReadings(calc.readings);
    setCalcStats(calc.stats);
  };

  const handleAddTanker = async (e) => {
    e.preventDefault();
    const liters = tankerCapacity === 'Custom' ? parseFloat(customCapacity) : parseFloat(tankerCapacity);
    const cost = parseFloat(tankerCost);
    
    if (!liters || !cost) {
      alert("Invalid tanker details");
      return;
    }

    const data = {
      month,
      date: tankerDate,
      liters,
      cost
    };

    setSaving(true);
    await window.api.saveWaterTanker(data);
    const updatedTankers = await window.api.getWaterTankers(month);
    setTankers(updatedTankers);
    
    const calc = performCalculations(readings, flats, 'tanker', livingFlats, updatedTankers);
    setReadings(calc.readings);
    setCalcStats(calc.stats);
    
    setTankerCost('');
    setCustomCapacity('');
    setShowTankerForm(false);
    setSaving(false);
  };

  const handleDeleteTanker = async (objectId) => {
    if (!confirm("Delete this tanker entry?")) return;
    setSaving(true);
    await window.api.deleteWaterTanker(objectId);
    const updatedTankers = await window.api.getWaterTankers(month);
    setTankers(updatedTankers);
    
    const calc = performCalculations(readings, flats, 'tanker', livingFlats, updatedTankers);
    setReadings(calc.readings);
    setCalcStats(calc.stats);
    setSaving(false);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    let errorOccurred = false;
    
    for (const flat of flats) {
      const flatNo = flat.objectData.flat_no;
      const r = readings[flatNo]?.objectData || {};
      if (r.current_reading !== undefined && r.current_reading !== '') {
        const curr = parseFloat(r.current_reading) || 0;
        const prev = parseFloat(r.previous_reading) || 0;
        if (curr < prev) {
          alert(`Error in Flat ${flatNo}: Current reading cannot be less than previous reading.`);
          setSaving(false);
          return;
        }
      }
    }

    const summaryData = {
      month,
      water_billing_mode: 'tanker',
      living_flats: livingFlats,
      total_tanker_water: calcStats.totalTankerWater,
      total_tanker_cost: calcStats.totalTankerCost,
      calculated_free_water: calcStats.freeWaterPerFlat,
      calculated_cost_per_liter: calcStats.costPerLiter
    };
    
    await window.api.saveMonthlySummary(summaryData, summaryId);

    for (const flat of flats) {
      const flatNo = flat.objectData.flat_no;
      const r = readings[flatNo];
      if (r && r.objectData && r.objectData.current_reading !== undefined && r.objectData.current_reading !== '') {
        const finalData = { 
          ...r.objectData, 
          month, 
          flat_no: flatNo,
          status: 'draft' 
        };
        const res = await window.api.saveWaterReading(finalData, r.objectId);
        if (!res) errorOccurred = true;
      }
    }
    
    await fetchData(); 
    setSaving(false);
    
    if (errorOccurred) {
      alert("Some readings failed to save. Please check your connection.");
    } else {
      alert("Draft readings and calculations saved successfully!");
    }
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Month & Living Flats Selection */}
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-text text-sm mb-1">Billing Month</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input-field py-2 px-3" />
          </div>
          <div>
            <label className="label-text text-sm mb-1">Living Flats</label>
            <input type="number" value={livingFlats} onChange={(e) => handleLivingFlatsChange(e.target.value)} disabled={isLocked} className="input-field py-2 px-3" />
          </div>
        </div>
      </div>

      <window.ErrorAlert error={error} onRetry={fetchData} />

      {/* Tanker Management Section */}
      {!loading && !error && (
        <div className="card space-y-3 border-sky-200 shadow-sm">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-bold text-sky-800 flex items-center gap-2"><div className="icon-truck"></div> Tanker Entries</h3>
            {!isLocked && (
              <button onClick={() => setShowTankerForm(!showTankerForm)} className="text-xs bg-sky-100 text-sky-700 px-2 py-1 rounded-md font-medium">
                {showTankerForm ? 'Cancel' : '+ Add Tanker'}
              </button>
            )}
          </div>

          {showTankerForm && !isLocked && (
            <form onSubmit={handleAddTanker} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-text text-xs">Date</label>
                  <input type="date" value={tankerDate} onChange={e => setTankerDate(e.target.value)} required className="input-field py-1.5 px-2 text-sm" />
                </div>
                <div>
                  <label className="label-text text-xs">Capacity (Liters)</label>
                  <select value={tankerCapacity} onChange={e => setTankerCapacity(e.target.value)} className="input-field py-1.5 px-2 text-sm">
                    <option value="10000">10,000</option>
                    <option value="5000">5,000</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                {tankerCapacity === 'Custom' && (
                  <div className="col-span-2">
                    <label className="label-text text-xs">Custom Capacity</label>
                    <input type="number" placeholder="Enter liters" value={customCapacity} onChange={e => setCustomCapacity(e.target.value)} required className="input-field py-1.5 px-2 text-sm" />
                  </div>
                )}
                <div className="col-span-2">
                  <label className="label-text text-xs">Cost (₹)</label>
                  <input type="number" placeholder="Enter cost" value={tankerCost} onChange={e => setTankerCost(e.target.value)} required className="input-field py-1.5 px-2 text-sm" />
                </div>
              </div>
              <button type="submit" disabled={saving} className="btn-primary py-2 text-sm">Save Tanker</button>
            </form>
          )}

          <div className="space-y-2">
            {tankers.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2">No tanker entries for this month.</p>
            ) : (
              tankers.map(t => (
                <div key={t.objectId} className="flex justify-between items-center bg-white border border-slate-100 p-2 rounded-lg text-sm">
                  <div>
                    <div className="font-medium text-slate-700">{t.objectData.date}</div>
                    <div className="text-xs text-slate-500">{t.objectData.liters} L</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-800">₹{t.objectData.cost}</span>
                    {!isLocked && <button onClick={() => handleDeleteTanker(t.objectId)} className="text-red-500 p-1"><div className="icon-trash w-4 h-4 text-base"></div></button>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Admin Summary Dashboard */}
      {!loading && !error && (
        <div className="card bg-slate-800 text-white space-y-4">
          <h3 className="font-bold text-slate-200 border-b border-slate-700 pb-2 text-sm">Calculation Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Total Used Water</div>
              <div className="text-lg font-bold">{Math.round(calcStats.totalUsed)} <span className="text-xs text-slate-400 font-normal">L</span></div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Total Tanker Water</div>
              <div className="text-lg font-bold text-sky-400">{Math.round(calcStats.totalTankerWater)} <span className="text-xs text-slate-500 font-normal">L</span></div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Total Free Water</div>
              <div className="text-lg font-bold text-emerald-400">{Math.round(calcStats.totalFreeWater)} <span className="text-xs text-slate-500 font-normal">L</span></div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Free Water Per Flat</div>
              <div className="text-lg font-bold text-emerald-400">{calcStats.freeWaterPerFlat.toFixed(6)} <span className="text-xs text-slate-500 font-normal">L</span></div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Total Excess Water</div>
              <div className="text-lg font-bold text-orange-400">{Math.round(calcStats.totalExcessWater)} <span className="text-xs text-slate-500 font-normal">L</span></div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Per Liter Excess Cost</div>
              <div className="text-lg font-bold">₹{calcStats.costPerLiter.toFixed(9)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Meter Readings List */}
      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading data...</div>
      ) : error ? null : (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-2 px-1">
            <h2 className="font-bold text-lg text-slate-800">Standard Flat Readings</h2>
            {isLocked && <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded flex items-center gap-1"><div className="icon-lock w-3 h-3"></div> Locked</span>}
          </div>

          {flats.filter(f => f.objectData.meter_type !== 'COMMON' && f.objectData.flat_no !== 'WATCHMAN').map(flat => {
            const flatNo = flat.objectData.flat_no;
            const r = readings[flatNo]?.objectData || {};
            const hasData = r.current_reading !== undefined && r.current_reading !== '';
            
            return (
              <div key={flat.objectId} className={`card p-4 space-y-4 ${hasData ? 'border-sky-200' : ''}`}>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div className="font-bold text-lg text-[var(--primary-color)]">Flat {flatNo}</div>
                  {readings[flatNo]?.objectId && (
                    <div className={`text-xs px-2 py-1 rounded-md flex items-center gap-1 ${r.status === 'published' ? 'text-blue-600 bg-blue-50' : 'text-emerald-600 bg-emerald-50'}`}>
                      <div className="icon-circle-check"></div> {r.status === 'published' ? 'Published' : 'Draft'}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text text-xs">Prev Reading</label>
                    <input 
                      type="number" 
                      className={`input-field py-2 px-3 text-sm ${readOnlyPrev[flatNo] ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                      value={r.previous_reading !== undefined ? r.previous_reading : ''}
                      onChange={(e) => handleReadingChange(flatNo, 'previous_reading', e.target.value)}
                      onWheel={(e) => e.target.blur()}
                      placeholder="0"
                      disabled={isLocked || readOnlyPrev[flatNo]}
                      readOnly={readOnlyPrev[flatNo]}
                    />
                  </div>
                  <div>
                    <label className="label-text text-xs">Curr Reading</label>
                    <input 
                      type="number" 
                      className="input-field py-2 px-3 text-sm font-semibold text-sky-800"
                      value={r.current_reading !== undefined ? r.current_reading : ''}
                      onChange={(e) => handleReadingChange(flatNo, 'current_reading', e.target.value)}
                      onWheel={(e) => e.target.blur()}
                      placeholder="0"
                      disabled={isLocked}
                    />
                  </div>
                </div>

                {hasData && (
                  <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-3 gap-3 border border-slate-200 mt-2 shadow-inner">
                    <div>
                      <label className="label-text text-[10px] uppercase tracking-wider mb-1">Used (L)</label>
                      <input type="text" readOnly className="input-field py-1.5 px-2 text-sm bg-slate-100 text-slate-600 cursor-not-allowed text-center" value={Math.round(r.used_water || 0)} />
                    </div>
                    <div>
                      <label className="label-text text-[10px] uppercase tracking-wider mb-1 text-orange-600">Excess (L)</label>
                      <input type="text" readOnly className="input-field py-1.5 px-2 text-sm bg-orange-50 border-orange-200 text-orange-700 cursor-not-allowed text-center font-medium" value={Math.round(r.excess_water || 0)} />
                    </div>
                    <div>
                      <label className="label-text text-[10px] uppercase tracking-wider mb-1 text-sky-600">Charge (₹)</label>
                      <input type="text" readOnly className="input-field py-1.5 px-2 text-sm bg-sky-50 border-sky-200 text-sky-700 font-bold cursor-not-allowed text-center" value={(r.water_charge || 0).toFixed(2)} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-between items-center mb-2 px-1 mt-6">
            <h2 className="font-bold text-lg text-slate-800">Common Meters</h2>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">
              Count: {flats.filter(f => f.objectData.meter_type === 'COMMON').length}
            </span>
          </div>

          {flats.filter(f => f.objectData.meter_type === 'COMMON' || f.objectData.flat_no === 'WATCHMAN').length === 0 ? (
            <div className="card p-4 text-center text-slate-500 text-sm">
              No Common Meters Found
            </div>
          ) : flats.filter(f => f.objectData.meter_type === 'COMMON' || f.objectData.flat_no === 'WATCHMAN').map(flat => {
            const flatNo = flat.objectData.flat_no;
            const r = readings[flatNo]?.objectData || {};
            const hasData = r.current_reading !== undefined && r.current_reading !== '';
            const serialNo = flat.objectData.water_meter_serial_no || 'N/A';
            
            return (
              <div key={flat.objectId} className={`card p-4 space-y-4 ${hasData ? 'border-purple-200' : ''}`}>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div>
                    <div className="font-bold text-lg text-purple-700 flex items-center gap-2"><div className="icon-droplet w-5 h-5"></div> {flatNo}</div>
                    <div className="text-xs text-slate-500 mt-1">Meter Serial No: {serialNo}</div>
                  </div>
                  {readings[flatNo]?.objectId && (
                    <div className={`text-xs px-2 py-1 rounded-md flex items-center gap-1 ${r.status === 'published' ? 'text-blue-600 bg-blue-50' : 'text-emerald-600 bg-emerald-50'}`}>
                      <div className="icon-circle-check"></div> {r.status === 'published' ? 'Published' : 'Draft'}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text text-xs">Prev Reading</label>
                    <input 
                      type="number" 
                      className={`input-field py-2 px-3 text-sm ${readOnlyPrev[flatNo] ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                      value={r.previous_reading !== undefined ? r.previous_reading : ''}
                      onChange={(e) => handleReadingChange(flatNo, 'previous_reading', e.target.value)}
                      onWheel={(e) => e.target.blur()}
                      placeholder="0"
                      disabled={isLocked || readOnlyPrev[flatNo]}
                      readOnly={readOnlyPrev[flatNo]}
                    />
                  </div>
                  <div>
                    <label className="label-text text-xs">Curr Reading</label>
                    <input 
                      type="number" 
                      className="input-field py-2 px-3 text-sm font-semibold text-purple-800"
                      value={r.current_reading !== undefined ? r.current_reading : ''}
                      onChange={(e) => handleReadingChange(flatNo, 'current_reading', e.target.value)}
                      onWheel={(e) => e.target.blur()}
                      placeholder="0"
                      disabled={isLocked}
                    />
                  </div>
                </div>

                {hasData && (
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-100 mt-2 flex justify-between items-center">
                    <span className="text-purple-800 text-xs font-semibold">Total Used Water:</span>
                    <span className="font-bold text-lg text-purple-900">{Math.round(r.used_water || 0)} L</span>
                  </div>
                )}
              </div>
            );
          })}

          {!isLocked && (
            <div className="fixed bottom-16 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.1)] z-40">
              <div className="max-w-lg mx-auto">
                <button 
                  onClick={handleSaveAll} 
                  disabled={saving}
                  className="btn-primary shadow-lg py-3.5"
                >
                  <div className="icon-save text-lg"></div>
                  <span className="font-semibold text-base">{saving ? 'Saving Drafts...' : 'Save Drafts'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
window.WaterReadingsManager = WaterReadingsManager;