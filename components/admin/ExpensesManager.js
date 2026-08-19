function ExpensesManager() {
  const [month, setMonth] = React.useState(window.utils.getCurrentMonthStr());
  const [expenses, setExpenses] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [isEditing, setIsEditing] = React.useState(false);
  const [currentExpense, setCurrentExpense] = React.useState(null);

  const defaultCategories = [
    "Watchman Salary", "Electricity Bill", "Lift Service", "Garbage Collection", "Custom"
  ];

  const [flatCount, setFlatCount] = React.useState(1);

  const fetchExpenses = async () => {
    setLoading(true);
    setError('');
    try {
      const summary = await window.api.getMonthlySummary(month);
      const flats = await window.api.getFlats();
      const standardFlatsCount = flats.filter(f => f.objectData.meter_type !== 'COMMON').length;
      
      let count = standardFlatsCount > 0 ? standardFlatsCount : 1;
      if (summary?.objectData?.living_flats) {
        count = summary.objectData.living_flats;
      }
      setFlatCount(count);

      const data = await window.api.getExpenses(month);
      setExpenses(data);
      
      // Auto update monthly summary whenever expenses change
      const total = data.reduce((sum, item) => sum + (parseFloat(item.objectData.amount) || 0), 0);
      const maintenance_per_flat = parseFloat((total / count).toFixed(2));
      
      const existingSummary = await window.api.getMonthlySummary(month);
      await window.api.saveMonthlySummary({
        month,
        total_expenses: total,
        maintenance_per_flat
      }, existingSummary?.objectId);
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
      setError(err.message || 'Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchExpenses();
  }, [month]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    let category = formData.get('category');
    if (category === 'Custom') category = formData.get('custom_category');

    const data = {
      date: formData.get('date'),
      category: category,
      amount: parseFloat(formData.get('amount'))
    };

    const res = await window.api.saveExpense(data, currentExpense?.objectId);
    if (!res) {
      alert("Failed to save expense. Network error.");
      return;
    }
    setIsEditing(false);
    setCurrentExpense(null);
    fetchExpenses();
  };

  const handleDelete = async (objectId) => {
    if(confirm("Are you sure you want to delete this expense?")) {
      const res = await window.api.deleteExpense(objectId);
      if (res === null) {
        alert("Failed to delete expense. Network error.");
        return;
      }
      fetchExpenses();
    }
  };

  const totalAmount = expenses.reduce((sum, item) => sum + (parseFloat(item.objectData.amount) || 0), 0);

  if (isEditing) {
    const isCustomCat = currentExpense && !defaultCategories.includes(currentExpense.objectData.category);
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800">{currentExpense ? 'Edit Expense' : 'Add Expense'}</h2>
          <button onClick={() => { setIsEditing(false); setCurrentExpense(null); }} className="text-slate-500">Cancel</button>
        </div>
        <form onSubmit={handleSave} className="card space-y-4">
          <div>
            <label className="label-text">Date *</label>
            <input type="date" name="date" required defaultValue={currentExpense?.objectData.date || `${month}-01`} className="input-field" />
          </div>
          <div>
            <label className="label-text">Category *</label>
            <select 
              name="category" 
              className="input-field" 
              defaultValue={isCustomCat ? "Custom" : (currentExpense?.objectData.category || "Watchman Salary")}
              onChange={(e) => {
                const customInput = document.getElementById('custom_cat_wrapper');
                if(e.target.value === 'Custom') customInput.classList.remove('hidden');
                else customInput.classList.add('hidden');
              }}
            >
              {defaultCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div id="custom_cat_wrapper" className={isCustomCat ? "" : "hidden"}>
            <label className="label-text">Custom Category Name *</label>
            <input type="text" name="custom_category" defaultValue={isCustomCat ? currentExpense.objectData.category : ""} className="input-field" />
          </div>
          <div>
            <label className="label-text">Amount (₹) *</label>
            <input type="number" name="amount" required min="0" step="0.01" defaultValue={currentExpense?.objectData.amount} className="input-field" />
          </div>
          <div className="pt-4">
            <button type="submit" className="btn-primary">Save Expense</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <label className="label-text">Select Month</label>
        <input 
          type="month" 
          value={month} 
          onChange={(e) => setMonth(e.target.value)} 
          className="input-field" 
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card bg-sky-50 border-sky-100">
          <div className="text-sm text-slate-500 mb-1">Total Expenses</div>
          <div className="text-2xl font-bold text-sky-800">₹{totalAmount.toFixed(2)}</div>
        </div>
        <div className="card bg-emerald-50 border-emerald-100">
          <div className="text-sm text-slate-500 mb-1">Per Flat ({flatCount})</div>
          <div className="text-2xl font-bold text-emerald-800">₹{(totalAmount / flatCount).toFixed(2)}</div>
        </div>
      </div>

      <window.ErrorAlert error={error} onRetry={fetchExpenses} />

      <div className="flex justify-between items-center mt-2">
        <h2 className="font-bold text-lg text-slate-800">Expense List</h2>
        <button onClick={() => setIsEditing(true)} className="bg-[var(--primary-color)] text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1">
          <div className="icon-plus"></div> Add
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading...</div>
      ) : error ? null : expenses.length === 0 ? (
        <div className="text-center py-10 card text-slate-500">No expenses recorded for this month.</div>
      ) : (
        <div className="space-y-3">
          {expenses.map(exp => (
            <div key={exp.objectId} className="card p-4 flex justify-between items-center relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-sky-400"></div>
              <div>
                <div className="font-semibold text-slate-800">{exp.objectData.category}</div>
                <div className="text-xs text-slate-400 mt-1">{exp.objectData.date}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="font-bold text-lg">₹{exp.objectData.amount}</div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => {setCurrentExpense(exp); setIsEditing(true)}} className="text-sky-600 p-1"><div className="icon-pencil w-4 h-4 text-base"></div></button>
                  <button onClick={() => handleDelete(exp.objectId)} className="text-red-500 p-1"><div className="icon-trash w-4 h-4 text-base"></div></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
window.ExpensesManager = ExpensesManager;