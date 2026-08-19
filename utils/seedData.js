window.utils = window.utils || {};

window.utils.seedMay2026Data = async () => {
  const month = '2026-05';
  if (!confirm("This will load sample data for May 2026. Proceed?")) return;
  
  try {
    const btn = document.getElementById('seed-data-btn');
    if(btn) {
      btn.innerText = 'Loading...';
      btn.disabled = true;
    }

    console.log("Seeding data...");
    
    // 1. Tankers
    const existingTankers = await window.api.getWaterTankers(month);
    for (let t of existingTankers) {
      await window.api.deleteWaterTanker(t.objectId);
    }
    const tankers = [
      {date: '2026-05-02', liters: 10000, cost: 1200},
      {date: '2026-05-05', liters: 10000, cost: 1200},
      {date: '2026-05-07', liters: 10000, cost: 1200},
      {date: '2026-05-11', liters: 10000, cost: 1200},
      {date: '2026-05-15', liters: 10000, cost: 1200},
      {date: '2026-05-19', liters: 10000, cost: 1200},
      {date: '2026-05-20', liters: 10000, cost: 1200},
      {date: '2026-05-23', liters: 10000, cost: 1200},
      {date: '2026-05-25', liters: 10000, cost: 1200},
      {date: '2026-05-30', liters: 10000, cost: 1200}
    ];
    for (let t of tankers) {
      await window.api.saveWaterTanker({ ...t, month });
    }

    // 2. Expenses
    const existingExpenses = await window.api.getExpenses(month);
    for (let e of existingExpenses) {
      await window.api.deleteExpense(e.objectId);
    }
    const expenses = [
      {date: '2026-05-01', category: 'Watchman Salary', amount: 7000},
      {date: '2026-05-01', category: 'Electricity Bill', amount: 6613},
      {date: '2026-05-01', category: 'Lift Service', amount: 800},
      {date: '2026-05-01', category: 'Manjeera Water Bill', amount: 1923},
      {date: '2026-05-01', category: 'Garbage Collection', amount: 700},
      {date: '2026-05-01', category: 'Floor Liquid', amount: 430},
      {date: '2026-05-01', category: 'Diesel', amount: 1000},
      {date: '2026-05-01', category: 'Lights', amount: 180}
    ];
    for (let e of expenses) {
      await window.api.saveExpense(e);
    }

    // 3. Readings
    const readingsData = {
      '101': {prev: 1236707, curr: 1250350},
      '102': {prev: 1018046, curr: 1018159},
      '103': {prev: 816367, curr: 826078},
      '201': {prev: 859625, curr: 870357},
      '202': {prev: 809947, curr: 825922},
      '203': {prev: 725653, curr: 738119},
      '301': {prev: 731351, curr: 763725},
      '302': {prev: 672349, curr: 684131},
      '303': {prev: 1186482, curr: 1198200},
      '401': {prev: 977287, curr: 977297},
      '402': {prev: 894512, curr: 911469},
      '403': {prev: 1324287, curr: 1348011},
      '501': {prev: 626585, curr: 636117},
      '502': {prev: 758831, curr: 762733},
      '503': {prev: 292055, curr: 293610},
      'WATCHMAN': {prev: 161715, curr: 162537}
    };

    const existingReadings = await window.api.getWaterReadings(month);
    for (let [flat, r] of Object.entries(readingsData)) {
      const used = r.curr - r.prev;
      const existing = existingReadings.find(x => x.objectData.flat_no === flat);
      const data = {
        month,
        flat_no: flat,
        previous_reading: r.prev,
        current_reading: r.curr,
        used_water: used,
        status: 'draft'
      };
      if (existing) {
        await window.api.saveWaterReading(data, existing.objectId);
      } else {
        await window.api.saveWaterReading(data);
      }
    }
    
    if(btn) {
      btn.innerText = 'Load May Data';
      btn.disabled = false;
    }
    
    alert("May 2026 Data Loaded Successfully! Please refresh the page to see the updates.");
    window.location.reload();
  } catch (err) {
    console.error("Error seeding data:", err);
    alert("Failed to load data. See console for details.");
  }
};