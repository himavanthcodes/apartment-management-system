function ErrorAlert({ error, onRetry }) {
  if (!error) return null;

  return (
    <div className="my-4 animate-in fade-in slide-in-from-top-2 duration-300" data-name="error-alert" data-file="components/SharedUI.js">
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm shadow-sm">
        <div className="flex items-center gap-2 text-red-800 font-bold mb-2">
            <div className="icon-triangle-alert text-xl"></div> 
            <span>Notice</span>
        </div>
        <p className="text-xs mb-3">Unable to load data. Please try again.</p>
        {onRetry && (
            <button 
                onClick={onRetry}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
                <div className="icon-refresh-cw text-sm"></div>
                Retry
            </button>
        )}
      </div>
    </div>
  );
}

// Global PDF Generator to match Excel exactly
window.generateExcelStylePDF = async (month, data) => {
  const { flats, readings, summary, bills, expenses, tankers } = data;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');

  const monthLabel = new Date(month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });
  const monthShort = new Date(month + '-01').toLocaleString('default', { month: 'short' });
  const yearStr = month.split('-')[0];
  const monthNum = parseInt(month.split('-')[1], 10);
  const yearShort = yearStr.slice(-2);
  const formattedMonth = `${monthShort}'${yearShort}`;
  
  // Calculate dynamic last day of the month
  const lastDay = new Date(parseInt(yearStr, 10), monthNum, 0).getDate();

  // Exact Colors based on Excel
  const headerBlue = [0, 176, 240]; 
  const headerOrange = [255, 153, 0];
  const headerGreen = [146, 208, 80]; 
  const headerPurple = [112, 48, 160];
  const headerDarkOrange = [237, 125, 49];
  const yellowTotal = [255, 255, 0]; 
  const borderBlack = [0, 0, 0];

  // Draw Header Rectangles
  doc.setFillColor(...headerDarkOrange);
  doc.rect(10, 10, 100, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("SHIRIDI SAI NILAYAM", 60, 15.5, { align: "center" });

  doc.setFillColor(...headerPurple);
  doc.rect(187, 10, 100, 8, 'F'); 
  doc.text(`MAINTENANCE MONTH : ${formattedMonth.toUpperCase()}`, 237, 15.5, { align: "center" });

  const billableFlats = flats.filter(f => f.objectData.meter_type !== 'COMMON' && f.objectData.flat_no !== 'WATCHMAN');
  
  // Main Table Headers
  const head = [[
    'Flat No', 
    'Water Meter\nSerial No', 
    `1st ${formattedMonth}\nWater Reading`, 
    `${lastDay} ${formattedMonth}\nWater Reading`, 
    `${formattedMonth} Used\nWater Units`, 
    'Free Water\nfor Flat', 
    'Excess Water\nused Flats\n(UNITS)', 
    `Per ltr Excess Water Cost\n(${(summary?.calculated_cost_per_liter || 0).toFixed(9)})`, 
    `Total Excess\nWater Cost\n(A)`, 
    `Monthly\nMaintaince\n(B)`, 
    `Total Amount\n(A+B)`
  ]];

  let totalPrev = 0, totalCurr = 0, totalUsed = 0, totalExcess = 0, totalWaterCost = 0, totalMaint = 0, totalAmount = 0;
  const body = [];

  billableFlats.forEach((flat, index) => {
    // Insert empty row after every 3 flats to match Excel grouping
    if (index > 0 && index % 3 === 0) {
      body.push(['', '', '', '', '', '', '', '', '', '', '']);
    }

    const flatNo = flat.objectData.flat_no;
    const r = readings[flatNo] || {};
    const b = bills[flatNo]?.objectData || {};

    const prev = parseFloat(r.previous_reading || 0);
    const curr = parseFloat(r.current_reading || 0);
    const used = parseFloat(r.used_water || 0);
    const free = parseFloat(r.free_water !== undefined ? r.free_water : (summary?.calculated_free_water || 0));
    const excess = parseFloat(r.excess_water || 0);
    const costPerL = parseFloat(summary?.calculated_cost_per_liter || 0);
    
    const waterC = parseFloat(b.water_charge !== undefined ? b.water_charge : (r.water_charge || 0));
    const maintC = parseFloat(b.maintenance_charge !== undefined ? b.maintenance_charge : (summary?.maintenance_per_flat || 0));
    const totalB = Math.round(waterC + maintC);

    totalPrev += prev;
    totalCurr += curr;
    totalUsed += used;
    totalExcess += excess;
    totalWaterCost += waterC;
    totalMaint += maintC;
    totalAmount += totalB;

    body.push([
      flatNo,
      flat.objectData.water_meter_serial_no || '',
      prev.toString(),
      curr.toString(),
      Math.round(used).toString(),
      free.toFixed(6),
      Math.round(excess).toString(),
      costPerL.toFixed(9),
      waterC.toFixed(2),
      maintC.toFixed(2),
      totalB.toString()
    ]);
  });

  body.push(['', '', '', '', '', '', '', '', '', '', '']);

  // Add Watchman row
  const watchman = flats.find(f => f.objectData.flat_no === 'WATCHMAN');
  if (watchman) {
    const r = readings['WATCHMAN'] || {};
    body.push([
      'Watchman',
      watchman.objectData.water_meter_serial_no || '',
      (r.previous_reading || 0).toString(),
      (r.current_reading || 0).toString(),
      '0',
      '',
      '',
      '',
      '',
      '',
      ''
    ]);
  }

  body.push(['', '', '', '', '', '', '', '', '', '', '']);

  // Footer Row
  body.push([
    'Total', 
    '', 
    totalPrev.toString(), 
    totalCurr.toString(), 
    Math.round(totalUsed).toString(), 
    '', 
    Math.round(totalExcess).toString(), 
    '', 
    totalWaterCost.toFixed(2), 
    totalMaint.toFixed(2), 
    totalAmount.toString()
  ]);

  doc.autoTable({
    head: head,
    body: body,
    startY: 20, // Give space for header rectangles
    margin: { left: 10, right: 10 },
    theme: 'grid',
    styles: { fontSize: 8, textColor: [0, 0, 0], font: 'helvetica', cellPadding: 1.5, lineColor: borderBlack, lineWidth: 0.1, valign: 'middle' },
    headStyles: { 
      fillColor: [255, 255, 255], 
      textColor: [0, 0, 0], 
      fontStyle: 'bold', 
      halign: 'center', 
      valign: 'middle',
      minCellHeight: 12
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 20 },
      1: { halign: 'center', cellWidth: 25 },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center' },
      7: { halign: 'center' },
      8: { halign: 'center' },
      9: { halign: 'center' },
      10: { halign: 'center', fontStyle: 'bold' }
    },
    didParseCell: function(data) {
      if (data.section === 'head') {
        if (data.column.index >= 2 && data.column.index <= 4) data.cell.styles.fillColor = headerOrange;
        if (data.column.index >= 7 && data.column.index <= 8) data.cell.styles.fillColor = headerBlue;
        if (data.column.index === 9) data.cell.styles.fillColor = headerGreen;
      }
      
      // Totals highlighting
      if (data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        if (data.column.index === 0) data.cell.styles.fillColor = yellowTotal;
      }
      
      // Empty row styling
      if (data.row.raw && data.row.raw[0] === '') {
        data.cell.styles.minCellHeight = 4;
      }
    }
  });

  let finalY = doc.lastAutoTable.finalY + 6;

  // Small Summary Table
  const summaryBody = [
    ['Total Free Water', Math.round((totalUsed || 0) - (summary?.total_tanker_water || 0)).toString()],
    ['Each Flat Free Water', (summary?.calculated_free_water || 0).toFixed(6)],
    ['Per ltr Excess Water Cost', (summary?.calculated_cost_per_liter || 0).toFixed(10)]
  ];

  doc.autoTable({
    body: summaryBody,
    startY: finalY,
    theme: 'grid',
    styles: { fontSize: 8, textColor: [0, 0, 0], cellPadding: 1.5, lineColor: borderBlack, lineWidth: 0.1 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: yellowTotal, cellWidth: 50 },
      1: { halign: 'center', cellWidth: 35, fontStyle: 'bold' }
    },
    margin: { left: 45 },
    pageBreak: 'avoid'
  });

  finalY = doc.lastAutoTable.finalY + 6;

  // Expenses and Tankers side-by-side
  const expensesHead = [[`EXPENDITURE - ${formattedMonth}`, '']];
  const expensesBody = expenses.map(e => [e.objectData.category, parseFloat(e.objectData.amount || 0).toString()]);
  const totalExp = expenses.reduce((s, e) => s + parseFloat(e.objectData.amount || 0), 0);
  expensesBody.push(['Total', totalExp.toString()]);

  doc.autoTable({
    head: expensesHead,
    body: expensesBody,
    startY: finalY,
    margin: { left: 25 },
    tableWidth: 90,
    theme: 'grid',
    styles: { fontSize: 8, textColor: [0, 0, 0], cellPadding: 1.5, lineColor: borderBlack, lineWidth: 0.1 },
    headStyles: { fillColor: yellowTotal, textColor: [0, 0, 0], halign: 'center', fontStyle: 'bold' },
    columnStyles: { 
      0: { halign: 'center' },
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 25 } 
    },
    pageBreak: 'avoid',
    didParseCell: function(data) {
      if (data.row.index === expensesBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  const tankersHead = [['S NO', 'DATE', 'Ltrs', 'Cost']];
  const tankersBody = tankers.map((t, i) => [
    (i + 1).toString(), 
    t.objectData.date.split('-').reverse().join('-'), 
    t.objectData.liters.toString(), 
    t.objectData.cost.toString()
  ]);
  const totalTnkCost = tankers.reduce((s, t) => s + parseFloat(t.objectData.cost || 0), 0);
  tankersBody.push(['Water tankers amount', '', '', totalTnkCost.toString()]);

  doc.autoTable({
    head: [['WATER TANKERS', '', '', '']],
    body: [ ...tankersHead, ...tankersBody ],
    startY: finalY,
    margin: { left: 140 },
    tableWidth: 120,
    theme: 'grid',
    styles: { fontSize: 8, textColor: [0, 0, 0], cellPadding: 1.5, halign: 'center', lineColor: borderBlack, lineWidth: 0.1 },
    headStyles: { fillColor: headerBlue, textColor: [0, 0, 0], fontStyle: 'bold' },
    pageBreak: 'avoid',
    didParseCell: function(data) {
      if (data.row.index === 0) {
        data.cell.styles.fillColor = headerOrange;
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.row.index === tankersBody.length) {
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  doc.save(`SSN_Bill_${month.replace('-', '_')}.pdf`);
};

window.ErrorAlert = ErrorAlert;