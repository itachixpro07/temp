import PDFDocument from 'pdfkit';

export const generateCaseSheetPDF = (caseSheet, res) => {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    info: {
      Title: `Sudha Setu Case Sheet - ${caseSheet._id}`,
      Author: 'Sudha Setu (Ministry of Ayush)',
    },
  });

  if (res) {
    doc.pipe(res);
  }

  const pageWidth = 595.28;
  const leftMargin = 40;
  const rightMargin = 40;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('SUDHA SETU - AYUSH CASE SHEET', leftMargin, 40);
  doc.font('Helvetica').fontSize(9).fillColor('#4B5563').text('Ministry of Ayush | Autonomous Clinical Case-Taking System');
  doc.moveDown(0.5);
  doc.strokeColor('#9CA3AF').lineWidth(1).moveTo(leftMargin, doc.y).lineTo(leftMargin + contentWidth, doc.y).stroke();
  doc.moveDown(0.8);

  const drawSection = (title) => {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1F2937').text(title);
    doc.strokeColor('#E5E7EB').lineWidth(0.5).moveTo(leftMargin, doc.y + 2).lineTo(leftMargin + contentWidth, doc.y + 2).stroke();
    doc.moveDown(0.4);
  };

  drawSection('PATIENT & CASE DEMOGRAPHICS');
  doc.font('Helvetica').fontSize(9).fillColor('#374151');
  const createdAtFormatted = caseSheet.createdAt ? new Date(caseSheet.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');
  doc.text(`Case ID: ${caseSheet._id}    |    Date: ${createdAtFormatted}    |    Status: ${caseSheet.status || 'unknown'}`);
  const patient = caseSheet.patientId || {};
  doc.text(`Patient Name: ${patient.name || 'N/A'}    |    Phone: ${patient.phone || 'N/A'}    |    ABHA ID: ${patient.abhaId || 'N/A'}`);
  doc.text(`Email: ${patient.email || 'N/A'}    |    Language: ${caseSheet.languageUsed || 'auto'}`);

  drawSection('TRIAGE & CLINICAL ASSESSMENT');
  const dangerLevelText = (caseSheet.dangerLevel || 'unknown').toUpperCase();
  const confidencePercent = Math.round((caseSheet.confidenceScore ?? 0) * 100);
  doc.text(`Danger Level: ${dangerLevelText}    |    Confidence Score: ${confidencePercent}%`);

  const symptomsList = Array.isArray(caseSheet.symptoms) ? caseSheet.symptoms : [];
  if (symptomsList.length > 0) {
    doc.font('Helvetica-Bold').fontSize(9).text('Chief Symptoms:');
    doc.font('Helvetica').fontSize(9);
    for (const s of symptomsList) {
      const durationStr = s.duration ? ` (Duration: ${s.duration})` : '';
      const severityStr = s.severity ? ` [Severity: ${s.severity}/10]` : '';
      doc.text(`  • ${s.name}${durationStr}${severityStr}`);
    }
  } else {
    doc.text('Chief Symptoms: None recorded');
  }

  const rawDialogue = Array.isArray(caseSheet.rawDialogue) ? caseSheet.rawDialogue : [];
  const patientDialogue = rawDialogue.filter((d) => d.sender === 'patient').map((d) => d.message).join(' | ');
  if (patientDialogue) {
    doc.font('Helvetica-Bold').fontSize(9).text('Patient Statement:');
    doc.font('Helvetica').fontSize(9).text(patientDialogue);
  }

  drawSection('AYURVEDIC PARAMETERS');
  const markers = caseSheet.ayurvedicMarkers || {};
  doc.text(`Suspected Prakriti: ${markers.suspectedPrakriti || 'unknown'}    |    Agni Status: ${markers.agniStatus || 'unknown'}`);
  doc.text(`Diet Habits: ${markers.dietHabits || 'N/A'}    |    Sleep Pattern: ${markers.sleepPattern || 'N/A'}`);

  drawSection('DOCTOR CLINICAL NOTES');
  const doctor = caseSheet.assignedDoctorId;
  const doctorName = typeof doctor === 'object' && doctor !== null ? doctor.name : (doctor ? String(doctor) : 'Unassigned');
  doc.text(`Attending Doctor: ${doctorName}`);
  doc.text(`Notes: ${caseSheet.doctorNotes || 'No notes recorded.'}`);

  drawSection('PRESCRIPTION');
  const rxList = Array.isArray(caseSheet.prescription) ? caseSheet.prescription : [];
  if (rxList.length > 0) {
    const colWidths = [25, 145, 85, 100, 160.28];
    const headers = ['#', 'Medicine Name', 'Dosage', 'Timing', 'Duration / Instructions'];
    let curY = doc.y + 4;
    let curX = leftMargin;
    for (let i = 0; i < headers.length; i++) {
      doc.rect(curX, curY, colWidths[i], 18).fillAndStroke('#F3F4F6', '#D1D5DB');
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8).text(headers[i], curX + 3, curY + 5, { width: colWidths[i] - 6 });
      curX += colWidths[i];
    }
    curY += 18;

    for (let idx = 0; idx < rxList.length; idx++) {
      const rx = rxList[idx];
      const med = rx.medicineName || rx.medicine || '-';
      const dose = rx.dosage || '-';
      const timing = rx.timing || '-';
      const instr = [rx.duration, rx.instructions].filter(Boolean).join(', ') || '-';

      doc.font('Helvetica').fontSize(8);
      const hMed = doc.heightOfString(med, { width: colWidths[1] - 6 });
      const hDose = doc.heightOfString(dose, { width: colWidths[2] - 6 });
      const hTiming = doc.heightOfString(timing, { width: colWidths[3] - 6 });
      const hInstr = doc.heightOfString(instr, { width: colWidths[4] - 6 });
      const rowHeight = Math.max(18, hMed, hDose, hTiming, hInstr) + 8;

      if (curY + rowHeight > 780) {
        doc.addPage();
        curY = 40;
      }

      curX = leftMargin;
      const rowVals = [String(idx + 1), med, dose, timing, instr];
      for (let i = 0; i < rowVals.length; i++) {
        doc.rect(curX, curY, colWidths[i], rowHeight).stroke('#E5E7EB');
        doc.fillColor('#1F2937').font(i === 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).text(rowVals[i], curX + 3, curY + 4, { width: colWidths[i] - 6 });
        curX += colWidths[i];
      }
      curY += rowHeight;
    }
    doc.y = curY;
  } else {
    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#6B7280').text('No prescription issued.');
  }

  doc.moveDown(1.5);
  doc.strokeColor('#9CA3AF').lineWidth(0.5).moveTo(leftMargin, doc.y).lineTo(leftMargin + contentWidth, doc.y).stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(7.5).fillColor('#6B7280').text('Generated by Sudha Setu (SIH26047 - Ministry of Ayush) | Official Clinical Case Sheet', leftMargin, doc.y, { align: 'center', width: contentWidth });

  if (res) {
    doc.end();
  }

  return doc;
};

export default generateCaseSheetPDF;
