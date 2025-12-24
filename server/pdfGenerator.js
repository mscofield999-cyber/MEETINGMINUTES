const jsPDF = require('jspdf');
require('jspdf-autotable');

function generatePDF(meetingData) {
    return new Promise((resolve, reject) => {
        try {
            const JsPDFCtor = jsPDF.jsPDF || jsPDF;
            const doc = new JsPDFCtor();
            
            // Helper function for safe text
            const safeText = (text) => text || '';
            const splitLines = (text) => safeText(text).split('\n').filter(line => line.trim() !== '');

            // --- Header ---
            doc.setFillColor(44, 62, 80); // Dark Blue Header
            doc.rect(0, 0, 210, 40, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(24);
            doc.text('MEETING MINUTES', 105, 25, { align: 'center' });
            
            doc.setFontSize(10);
            doc.text('Confidential Document', 190, 10, { align: 'right' });

            // --- Watermark ---
            if (meetingData.watermarkImage) {
                try {
                    const imageFormat = (() => {
                        if (typeof meetingData.watermarkImage !== 'string') return 'PNG';
                        if (meetingData.watermarkImage.startsWith('data:image/jpeg')) return 'JPEG';
                        if (meetingData.watermarkImage.startsWith('data:image/jpg')) return 'JPEG';
                        if (meetingData.watermarkImage.startsWith('data:image/png')) return 'PNG';
                        return 'PNG';
                    })();

                    const imgProps = doc.getImageProperties(meetingData.watermarkImage);
                    const pdfWidth = doc.internal.pageSize.getWidth();
                    const pdfHeight = doc.internal.pageSize.getHeight();
                    
                    // Center and scale slightly
                    const width = 150;
                    const height = (imgProps.height * width) / imgProps.width;
                    const x = (pdfWidth - width) / 2;
                    const y = (pdfHeight - height) / 2;
                    
                    const canSetOpacity = typeof doc.setGState === 'function' && typeof doc.GState === 'function';
                    if (canSetOpacity) doc.setGState(new doc.GState({ opacity: 0.1 }));
                    doc.addImage(meetingData.watermarkImage, imageFormat, x, y, width, height, undefined, 'FAST');
                    if (canSetOpacity) doc.setGState(new doc.GState({ opacity: 1.0 }));
                } catch (e) {
                    console.error('Error adding watermark image:', e);
                }
            }

            // --- Meta Data Box ---
            let yPos = 50;
            
            doc.setTextColor(0, 0, 0);
            doc.autoTable({
                startY: yPos,
                theme: 'grid',
                headStyles: { fillColor: [236, 240, 241], textColor: 0, fontStyle: 'bold' },
                bodyStyles: { textColor: 0 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
                body: [
                    ['Reference No', safeText(meetingData.referenceNumber), 'Department', safeText(meetingData.department)],
                    ['Date', safeText(meetingData.meetingDate), 'Time', `${safeText(meetingData.meetingTime)} (${safeText(meetingData.duration)} min)`],
                    ['Location', safeText(meetingData.meetingLocation), 'Type', safeText(meetingData.meetingType)],
                    ['Chairman', safeText(meetingData.chairman), 'Secretary', safeText(meetingData.secretary)]
                ]
            });
            
            yPos = doc.lastAutoTable.finalY + 10;

            // --- Attendees Section ---
            let attendees = [];
            try {
                attendees = typeof meetingData.attendees === 'string' ? JSON.parse(meetingData.attendees) : (meetingData.attendees || []);
            } catch (e) { attendees = []; }

            const printableAttendees = [
                ...(meetingData.chairman ? [{
                    name: safeText(meetingData.chairman),
                    position: '',
                    role: 'Chairman',
                    present: true,
                    signature: meetingData.chairmanSignature || meetingData.chairman_signature || ''
                }] : []),
                ...(meetingData.secretary ? [{
                    name: safeText(meetingData.secretary),
                    position: '',
                    role: 'Secretary',
                    present: true,
                    signature: meetingData.secretarySignature || meetingData.secretary_signature || ''
                }] : []),
                ...attendees
            ];

            if (printableAttendees.length > 0) {
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text('Attendees & Participants', 14, yPos);
                yPos += 5;
                
                const attendeesBody = printableAttendees.map(a => [
                    a.name, 
                    a.position, 
                    a.role, 
                    a.present ? 'Present' : 'Absent',
                    '' // Signature placeholder column
                ]);

                doc.autoTable({
                    startY: yPos,
                    head: [['Name', 'Position', 'Role', 'Status', 'Signature']],
                    body: attendeesBody,
                    theme: 'striped',
                    headStyles: { fillColor: [52, 152, 219] },
                    margin: { left: 14, right: 14 },
                    didDrawCell: function(data) {
                        if (data.column.index === 4 && data.cell.section === 'body') {
                            const attendeeIndex = data.row.index;
                            const attendee = printableAttendees[attendeeIndex];
                            if (attendee && attendee.signature) {
                                try {
                                    doc.addImage(attendee.signature, 'PNG', data.cell.x + 2, data.cell.y + 2, 25, 10);
                                } catch(e) {}
                            }
                        }
                    },
                    columnStyles: { 4: { cellWidth: 30 } }
                });
                yPos = doc.lastAutoTable.finalY + 10;
            }

            // --- Agenda & Discussion ---
            let agendaItems = [];
            try {
                agendaItems = typeof meetingData.agendaItems === 'string' ? JSON.parse(meetingData.agendaItems) : (meetingData.agendaItems || []);
            } catch (e) { agendaItems = []; }
            
            if (agendaItems.length > 0) {
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text('Agenda Items', 14, yPos);
                yPos += 5;

                const agendaBody = agendaItems.map((item, index) => [`${index + 1}`, item.item, item.speaker]);

                doc.autoTable({
                    startY: yPos,
                    head: [['#', 'Item Description', 'Speaker']],
                    body: agendaBody,
                    theme: 'grid',
                    columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 2: { cellWidth: 40 } },
                    headStyles: { fillColor: [46, 204, 113] }
                });
                yPos = doc.lastAutoTable.finalY + 10;
            }

            // --- Decisions & Recommendations ---
            let decisions = [];
            try {
                decisions = typeof meetingData.decisions === 'string' ? JSON.parse(meetingData.decisions) : (meetingData.decisions || []);
            } catch (e) { decisions = []; }
            
            if (decisions.length > 0) {
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text('Decisions & Recommendations', 14, yPos);
                yPos += 5;

                const decisionsBody = decisions.map((item, index) => [`D-${index + 1}`, item.decision, item.responsible, item.deadline]);

                doc.autoTable({
                    startY: yPos,
                    head: [['ID', 'Decision/Recommendation', 'Responsible', 'Deadline']],
                    body: decisionsBody,
                    theme: 'grid',
                    columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' } },
                    headStyles: { fillColor: [155, 89, 182] }
                });
                yPos = doc.lastAutoTable.finalY + 15;
            }

            const executiveSummary = meetingData.executiveSummary || meetingData.executive_summary || '';
            if (safeText(executiveSummary)) {
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text('Executive Summary', 14, yPos);
                yPos += 6;

                doc.setFontSize(11);
                doc.setFont('helvetica', 'normal');
                const lines = doc.splitTextToSize(safeText(executiveSummary), 180);
                doc.text(lines, 14, yPos);
                yPos += (lines.length * 6) + 10;
            }

            // --- Footer / Signatures ---
            // Check if we need a new page for signatures
            if (yPos > 240) {
                doc.addPage();
                yPos = 20;
            }

            // Draw line before signatures
            doc.setDrawColor(200);
            doc.line(14, yPos, 196, yPos);
            yPos += 10;

            // Dual Signature Layout
            const signatureY = yPos;
            
            // Secretary Column (Right in RTL context, but Left in PDF coordinates usually)
            // Let's place them: Secretary (Right/Left), Chairman (Left/Right)
            // Standard: Secretary prepares, Chairman approves.
            
            // Secretary (Right side for Arabic feel)
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Meeting Secretary', 150, signatureY, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.text(safeText(meetingData.secretary), 150, signatureY + 7, { align: 'center' });
            
            if (meetingData.secretarySignature) {
                doc.addImage(meetingData.secretarySignature, 'PNG', 130, signatureY + 10, 40, 20);
            }
            
            // Chairman (Left side)
            doc.setFont('helvetica', 'bold');
            doc.text('Approved By (Chairman)', 60, signatureY, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.text(safeText(meetingData.chairman), 60, signatureY + 7, { align: 'center' });
            
            if (meetingData.chairmanSignature) {
                doc.addImage(meetingData.chairmanSignature, 'PNG', 40, signatureY + 10, 40, 20);
            }

            yPos += 40;
            doc.setFontSize(10);
            doc.text(`Digitally Signed on: ${new Date().toLocaleString()}`, 105, yPos, { align: 'center' });

            // Page Numbers
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`Page ${i} of ${pageCount} - Enterprise Meeting Minutes System`, 105, 290, { align: 'center' });
            }

            const pdfBuffer = doc.output('arraybuffer');
            resolve(Buffer.from(pdfBuffer));
            
        } catch (error) {
            console.error('PDF generation error details:', error);
            reject(error);
        }
    });
}

module.exports = { generatePDF };
