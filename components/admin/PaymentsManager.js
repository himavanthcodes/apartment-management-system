function PaymentsManager() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-800">Payments</h2>
      </div>
      <div className="card p-8 text-center flex flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50/50 mt-10">
        <div className="icon-credit-card text-5xl text-slate-300 mb-4"></div>
        <h3 className="text-lg font-medium text-slate-700 mb-2">Coming Soon</h3>
        <p className="text-sm text-slate-500">Payments module will be implemented next.</p>
      </div>
    </div>
  );
}

window.PaymentsManager = PaymentsManager;