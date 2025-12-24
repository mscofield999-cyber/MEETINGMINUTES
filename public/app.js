class MeetingMinutesApp {
    constructor() {
        this.secretaryPad = null;
        this.chairmanPad = null;
        this.secretarySigData = null;
        this.chairmanSigData = null;
        this.currentMeetingId = null;
        this.logoDataUrl = null;
        this.watermarkDataUrl = null;
        this.allMeetings = [];
        this.currentUser = null;
        this.isApprovalMode = false;
        this.lastAiResult = null;
        this.currentSigRow = null;
        this.modalPad = null;

        this.initializeApp();
    }

    initializeApp() {
        this.checkAuth();
        this.loadDefaults();
    }

    async loadDefaults() {
        try {
            const response = await fetch('/assets/default-logo.png');
            if (response.ok) {
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    this.logoDataUrl = reader.result;
                    this.watermarkDataUrl = reader.result;
                    // Try to update UI if possible (though hidden initially)
                    console.log('Default logo loaded successfully');
                };
                reader.readAsDataURL(blob);
            }
        } catch (error) {
            console.log('No default logo found, skipping.');
        }
    }

    async checkAuth() {
        try {
            const response = await fetch('/api/check-auth', { credentials: 'include' });
            const data = await response.json();
            
            if (data.authenticated) {
                this.currentUser = data;
                this.updateUIForUser();
                this.setupEventListeners();
                this.setupNavigation();
                if (this.currentUser.role === 'secretary') {
                    this.resetForm();
                }
                if (this.currentUser.role === 'chairman') {
                    document.getElementById('navArchive').click();
                }
            } else {
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/login.html';
        }
    }

    updateUIForUser() {
        const userInfo = document.getElementById('userInfoDisplay');
        const userName = document.getElementById('userNameDisplay');
        const userRole = document.getElementById('userRoleDisplay');
        const navNew = document.getElementById('navNewMinute');
        
        userInfo.style.display = 'block';
        userName.textContent = `مرحباً، ${this.currentUser.fullName}`;
        
        const roleName = this.currentUser.role === 'secretary' ? 'مقرر' : 'رئيس';
        userRole.textContent = roleName;
        userRole.className = `badge bg-${this.currentUser.role === 'secretary' ? 'info' : 'warning'}`;

        // Hide "New Minute" for Chairman
        if (this.currentUser.role === 'chairman') {
            navNew.style.display = 'none';
        }
    }

    initializePad(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (canvas) {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d").scale(ratio, ratio);

            return new SignaturePad(canvas, {
                minWidth: 1,
                maxWidth: 2.5,
                penColor: 'rgb(0, 50, 100)',
                backgroundColor: 'rgb(255, 255, 255)'
            });
        }
        return null;
    }

    setupNavigation() {
        const navNew = document.getElementById('navNewMinute');
        const navArchive = document.getElementById('navArchive');
        const navLogout = document.getElementById('navLogout');
        const sectionNew = document.getElementById('newMinuteSection');
        const sectionArchive = document.getElementById('archiveSection');

        navNew.addEventListener('click', () => {
            if (this.currentUser.role === 'chairman') return; // Should be hidden, but extra safety
            navNew.classList.add('active');
            navArchive.classList.remove('active');
            sectionNew.style.display = 'block';
            sectionArchive.style.display = 'none';
            this.resetForm();
        });

        navArchive.addEventListener('click', () => {
            navArchive.classList.add('active');
            navNew.classList.remove('active');
            sectionNew.style.display = 'none';
            sectionArchive.style.display = 'block';
            this.loadMeetings();
        });

        navLogout.addEventListener('click', async () => {
            await fetch('/api/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/login.html';
        });
    }

    setupEventListeners() {
        const form = document.getElementById('meetingForm');
        const generatePdfBtn = document.getElementById('generatePdf');
        const previewBtn = document.getElementById('previewBtn');
        const refreshArchiveBtn = document.getElementById('refreshArchive');
        const archiveSearch = document.getElementById('archiveSearch');
        const aiReviewBtn = document.getElementById('aiReviewBtn');
        const aiModal = document.getElementById('aiModal');
        const closeAiModal = document.getElementById('closeAiModal');
        const closeAiModalBtn = document.getElementById('closeAiModalBtn');
        const applyAiChanges = document.getElementById('applyAiChanges');
        
        const logoUpload = document.getElementById('logoUpload');
        logoUpload.addEventListener('change', (e) => this.handleLogoUpload(e));

        const watermarkUpload = document.getElementById('watermarkImage');
        if (watermarkUpload) {
            watermarkUpload.addEventListener('change', (e) => this.handleWatermarkUpload(e));
        }

        this.setupSignatureLogic('secretary');
        this.setupSignatureLogic('chairman');

        const modal = document.getElementById('previewModal');
        const closeModalSpan = document.querySelector('.close-modal');
        const closeModalBtn = document.querySelector('.close-modal-btn');
        const printPreviewBtn = document.getElementById('printPreviewBtn');

        const sigModal = document.getElementById('signatureModal');
        const closeSigModal = document.getElementById('closeSigModal');
        const saveModalSig = document.getElementById('saveModalSig');
        const clearModalSig = document.getElementById('clearModalSig');
        const cancelModalSig = document.getElementById('cancelModalSig');

        form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        generatePdfBtn.addEventListener('click', () => this.generatePDF());
        refreshArchiveBtn.addEventListener('click', () => this.loadMeetings());
        
        archiveSearch.addEventListener('input', (e) => this.filterMeetings(e.target.value));
        
        previewBtn.addEventListener('click', () => this.showPreview(this.getFormData()));
        if (aiReviewBtn) aiReviewBtn.addEventListener('click', () => this.aiAssist());

        const closeAi = () => { if (aiModal) aiModal.style.display = 'none'; };
        if (closeAiModal) closeAiModal.addEventListener('click', closeAi);
        if (closeAiModalBtn) closeAiModalBtn.addEventListener('click', closeAi);
        if (applyAiChanges) applyAiChanges.addEventListener('click', () => this.applyAiResult());
        
        const closeModal = () => { modal.style.display = 'none'; };
        closeModalSpan.addEventListener('click', closeModal);
        closeModalBtn.addEventListener('click', closeModal);
        
        const closeSig = () => { sigModal.style.display = 'none'; };
        closeSigModal.addEventListener('click', closeSig);
        cancelModalSig.addEventListener('click', closeSig);
        
        saveModalSig.addEventListener('click', () => this.saveRowSignature());
        clearModalSig.addEventListener('click', () => this.modalPad && this.modalPad.clear());

        window.addEventListener('click', (e) => {
            if (e.target == modal) closeModal();
            if (e.target == sigModal) closeSig();
            if (e.target == aiModal) closeAi();
        });

        printPreviewBtn.addEventListener('click', () => {
            window.print();
        });
    }

    addAttendeeRow(data = {}) {
        const tbody = document.querySelector('#attendeesTable tbody');
        const tr = document.createElement('tr');
        
        const canSign = this.currentUser?.role === 'secretary';

        tr.innerHTML = `
            <td><input type="text" class="form-control" name="attendeeName" value="${data.name || ''}" placeholder="الاسم"></td>
            <td><input type="text" class="form-control" name="attendeePosition" value="${data.position || ''}" placeholder="المنصب"></td>
            <td><input type="text" class="form-control" name="attendeeRole" value="${data.role || ''}" placeholder="الصفة"></td>
            <td style="text-align:center;">
                <input type="checkbox" name="attendeePresent" ${data.present ? 'checked' : ''} style="width:20px; height:20px;">
            </td>
            <td style="text-align:center;" class="sig-cell">
                <img src="${data.signature || ''}" class="signature-cell-img" style="${data.signature ? '' : 'display:none;'}" onclick="app.openSignatureModal(this.parentElement)">
                <button type="button" class="signature-placeholder-btn" style="${data.signature ? 'display:none;' : ''}" onclick="app.openSignatureModal(this.parentElement)" ${canSign ? '' : 'disabled'}>توقيع</button>
                <input type="hidden" name="attendeeSignature" value="${data.signature || ''}">
            </td>
            <td style="text-align:center;">
                <button type="button" class="btn-icon delete" onclick="this.closest('tr').remove()"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    }

    addAgendaRow(data = {}) {
        const tbody = document.querySelector('#agendaTable tbody');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" class="form-control" name="agendaItem" value="${data.item || ''}" placeholder="البند"></td>
            <td><input type="text" class="form-control" name="agendaSpeaker" value="${data.speaker || ''}" placeholder="المتحدث"></td>
            <td style="text-align:center;">
                <button type="button" class="btn-icon delete" onclick="this.closest('tr').remove()"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    }

    addDecisionRow(data = {}) {
        const tbody = document.querySelector('#decisionsTable tbody');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><textarea class="form-control" name="decisionText" rows="2" placeholder="القرار / التوصية">${data.decision || ''}</textarea></td>
            <td><input type="text" class="form-control" name="decisionResponsible" value="${data.responsible || ''}" placeholder="المسؤول"></td>
            <td><input type="text" class="form-control" name="decisionDeadline" value="${data.deadline || ''}" placeholder="المدة/الموعد"></td>
            <td style="text-align:center;">
                <button type="button" class="btn-icon delete" onclick="this.closest('tr').remove()"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    }

    openSignatureModal(cellElement) {
        this.currentSigRow = cellElement;
        const modal = document.getElementById('signatureModal');
        modal.style.display = 'block';
        
        requestAnimationFrame(() => {
            this.modalPad = this.initializePad('modalCanvas');
        });

        const existing = cellElement.querySelector('input[type="hidden"]')?.value;
        const preview = document.getElementById('sigPreviewImage');
        if (preview) {
            if (existing) {
                preview.src = existing;
                preview.style.display = 'block';
            } else {
                preview.src = '';
                preview.style.display = 'none';
            }
        }

        const name = cellElement.closest('tr')?.querySelector('[name="attendeeName"]')?.value;
        const titleEl = document.getElementById('signatureModalTitle');
        if (titleEl) {
            titleEl.textContent = name ? `توقيع المشارك: ${name}` : 'توقيع المشارك';
        }
    }

    saveRowSignature() {
        if (this.modalPad && !this.modalPad.isEmpty() && this.currentSigRow) {
            const data = this.modalPad.toDataURL();
            const input = this.currentSigRow.querySelector('input[type="hidden"]');
            if (input) input.value = data;
            
            const img = this.currentSigRow.querySelector('img');
            const btn = this.currentSigRow.querySelector('button');
            if (img) {
                img.src = data;
                img.style.display = 'inline-block';
            }
            if (btn) btn.style.display = 'none';
            
            document.getElementById('signatureModal').style.display = 'none';
            this.currentSigRow = null;
        } else {
            this.showMessage('الرجاء التوقيع أولاً', 'error');
        }
    }

    setupSignatureLogic(role) {
        const area = document.getElementById(`${role}SignatureArea`);
        const controls = area.nextElementSibling;
        const saveBtn = document.getElementById(`save${role.charAt(0).toUpperCase() + role.slice(1)}Sig`);
        const clearBtn = document.getElementById(`clear${role.charAt(0).toUpperCase() + role.slice(1)}Sig`);
        const status = document.getElementById(`${role}Status`);

        const canSign = this.currentUser.role === role;
        
        if (!canSign) {
            area.style.pointerEvents = 'none';
            return;
        }

        let pad = null;

        area.addEventListener('click', () => {
            if (area.classList.contains('empty')) {
                area.style.display = 'none';
                controls.style.display = 'block';
                if (!pad) {
                    pad = this.initializePad(`${role}Canvas`);
                    if (role === 'secretary') this.secretaryPad = pad;
                    else this.chairmanPad = pad;
                }
            }
        });

        saveBtn.addEventListener('click', () => {
            if (pad && !pad.isEmpty()) {
                const data = pad.toDataURL();
                if (role === 'secretary') this.secretarySigData = data;
                else this.chairmanSigData = data;

                controls.style.display = 'none';
                area.style.display = 'flex';
                area.innerHTML = `<img src="${data}" alt="Signed">`;
                area.classList.remove('empty');
                status.innerHTML = '<span style="color:green">✓ تم التوقيع</span>';
                this.checkSubmissionStatus();
            } else {
                this.showMessage('الرجاء التوقيع أولاً', 'error');
            }
        });

        clearBtn.addEventListener('click', () => {
            pad.clear();
            if (role === 'secretary') this.secretarySigData = null;
            else this.chairmanSigData = null;
            status.innerHTML = '';
            this.checkSubmissionStatus();
        });
    }

    checkSubmissionStatus() {
        const btn = document.getElementById('submitBtn');
        // If approval mode (Chairman), only need Chairman sig (Secretary already signed)
        if (this.isApprovalMode) {
            if (this.chairmanSigData) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-check-double"></i> اعتماد نهائي';
            } else {
                btn.disabled = true;
            }
        } else {
            // Creation mode (Secretary) - Only need Secretary sig to submit as pending
            if (this.secretarySigData) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال للاعتماد';
            } else {
                btn.disabled = true;
            }
        }
    }

    handleLogoUpload(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                this.logoDataUrl = event.target.result;
                // Automatically set as watermark as requested
                this.watermarkDataUrl = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    handleWatermarkUpload(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                this.watermarkDataUrl = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    getFormData() {
        const form = document.getElementById('meetingForm');
        const formData = new FormData(form);
        const data = {};
        
        // Basic fields
        for (let [key, value] of formData.entries()) {
            if (!key.startsWith('attendee') && !key.startsWith('agenda') && !key.startsWith('decision')) {
                data[key] = value;
            }
        }
        
        // Collect Dynamic Tables Data
        
        // Attendees
        const attendees = [];
        const rows = document.querySelectorAll('#attendeesTable tbody tr');
        rows.forEach(row => {
            attendees.push({
                name: row.querySelector('[name="attendeeName"]').value,
                position: row.querySelector('[name="attendeePosition"]').value,
                role: row.querySelector('[name="attendeeRole"]').value,
                present: row.querySelector('[name="attendeePresent"]').checked,
                signature: row.querySelector('[name="attendeeSignature"]').value
            });
        });
        data.attendees = attendees;

        // Agenda
        const agenda = [];
        const agendaRows = document.querySelectorAll('#agendaTable tbody tr');
        agendaRows.forEach(row => {
            agenda.push({
                item: row.querySelector('[name="agendaItem"]').value,
                speaker: row.querySelector('[name="agendaSpeaker"]').value
            });
        });
        data.agendaItems = agenda;

        // Decisions
        const decisions = [];
        const decRows = document.querySelectorAll('#decisionsTable tbody tr');
        decRows.forEach(row => {
            decisions.push({
                decision: row.querySelector('[name="decisionText"]').value,
                responsible: row.querySelector('[name="decisionResponsible"]').value,
                deadline: row.querySelector('[name="decisionDeadline"]').value
            });
        });
        data.decisions = decisions;

        if (this.secretarySigData) data.secretarySignature = this.secretarySigData;
        if (this.chairmanSigData) data.chairmanSignature = this.chairmanSigData;
        if (this.logoDataUrl) data.logoData = this.logoDataUrl;
        if (this.watermarkDataUrl) data.watermarkImage = this.watermarkDataUrl;
        
        return data;
    }

    showPreview(data) {
        const modal = document.getElementById('previewModal');
        const content = document.getElementById('previewContent');

        const normalize = (d) => {
            return {
                meetingTitle: d.meetingTitle || d.meeting_title,
                department: d.department,
                orgName: d.orgName || d.org_name,
                executiveSummary: d.executiveSummary || d.executive_summary,
                referenceNumber: d.referenceNumber || d.reference_number,
                meetingDate: d.meetingDate || d.meeting_date,
                meetingTime: d.meetingTime || d.meeting_time,
                duration: d.duration,
                meetingLocation: d.meetingLocation || d.meeting_location,
                chairman: d.chairman,
                secretary: d.secretary,
                
                // Handle JSON strings from DB if necessary
                attendees: typeof d.attendees === 'string' ? JSON.parse(d.attendees || '[]') : (d.attendees || []),
                agendaItems: typeof d.agendaItems === 'string' ? JSON.parse(d.agendaItems || '[]') : (d.agenda_items && typeof d.agenda_items === 'string' ? JSON.parse(d.agenda_items) : (d.agendaItems || [])),
                decisions: typeof d.decisions === 'string' ? JSON.parse(d.decisions || '[]') : (d.decisions || []),
                
                secretarySignature: d.secretarySignature || d.secretary_signature,
                chairmanSignature: d.chairmanSignature || d.chairman_signature,
                logoData: d.logoData || this.logoDataUrl,
                watermarkText: d.watermarkText || (d.status === 'approved' ? 'نسخة معتمدة' : 'مسودة'),
                watermarkImage: d.watermarkImage || d.watermark_image || this.watermarkDataUrl
            };
        };

        const viewData = normalize(data);

        const printableAttendees = [
            ...(viewData.chairman ? [{
                name: viewData.chairman,
                position: '',
                role: 'رئيس الاجتماع',
                present: true,
                signature: viewData.chairmanSignature || ''
            }] : []),
            ...(viewData.secretary ? [{
                name: viewData.secretary,
                position: '',
                role: 'مقرر الاجتماع',
                present: true,
                signature: viewData.secretarySignature || ''
            }] : []),
            ...(Array.isArray(viewData.attendees) ? viewData.attendees : [])
        ];

        // Attendees HTML
        const attendeesRows = printableAttendees.map(a => `
            <tr>
                <td>${a.name}</td>
                <td>${a.position}</td>
                <td>${a.role}</td>
                <td>${a.present ? 'حاضر' : 'معتذر'}</td>
                <td style="text-align:center;">${a.signature ? '<img src="' + a.signature + '" height="30">' : '-'}</td>
            </tr>
        `).join('');

        // Agenda HTML
        const agendaRows = viewData.agendaItems.map((item, i) => `
            <tr>
                <td style="width: 50px; text-align: center;">${i + 1}</td>
                <td>${item.item}</td>
                <td>${item.speaker}</td>
            </tr>
        `).join('');

        // Decisions HTML
        const decisionRows = viewData.decisions.map((d, i) => `
            <tr>
                <td style="width: 50px; text-align: center;">${i + 1}</td>
                <td>${d.decision}</td>
                <td>${d.responsible}</td>
                <td>${d.deadline}</td>
            </tr>
        `).join('');

        const logoHtml = viewData.logoData ? `<img src="${viewData.logoData}" alt="Logo">` : '<div style="font-size: 30px; color: #ccc;"><i class="fas fa-building"></i></div>';
        
        let watermarkHtml = '';
        if (viewData.watermarkImage) {
            watermarkHtml = `<div class="watermark-img"><img src="${viewData.watermarkImage}"></div>`;
        } else if (viewData.watermarkText) {
            watermarkHtml = `<div class="watermark">${viewData.watermarkText}</div>`;
        }

        content.innerHTML = `
            <div class="print-container">
                ${watermarkHtml}
                <div class="print-header-section">
                    <div class="ph-logo">${logoHtml}</div>
                    <div class="ph-info">
                        <h1>${viewData.orgName || 'المؤسسة'}</h1>
                        <div class="ph-dept">${viewData.department || ''}</div>
                        <h2>محضر اجتماع رسمي</h2>
                    </div>
                    <div class="ph-meta">
                        <div><strong>التاريخ:</strong> ${viewData.meetingDate}</div>
                        <div><strong>الرقم:</strong> ${viewData.referenceNumber || '-'}</div>
                    </div>
                </div>

                <div class="print-content">
                    <table class="print-table">
                        <tr>
                            <th>عنوان الاجتماع</th><td>${viewData.meetingTitle}</td>
                            <th>الإدارة</th><td>${viewData.department}</td>
                        </tr>
                        <tr>
                            <th>المكان</th><td>${viewData.meetingLocation}</td>
                            <th>الوقت</th><td>${viewData.meetingTime} (${viewData.duration || 0} دقيقة)</td>
                        </tr>
                        <tr>
                            <th>رئيس الاجتماع</th><td>${viewData.chairman}</td>
                            <th>المقرر</th><td>${viewData.secretary}</td>
                        </tr>
                    </table>

                    <div class="print-section">
                        <div class="print-section-title">قائمة الحضور والمشاركين</div>
                        <table class="print-list-table">
                            <thead><tr><th>الاسم</th><th>المنصب</th><th>الصفة</th><th>الحالة</th><th>التوقيع</th></tr></thead>
                            <tbody>${attendeesRows}</tbody>
                        </table>
                    </div>

                    ${viewData.agendaItems.length > 0 ? `
                    <div class="print-section">
                        <div class="print-section-title">وقائع الاجتماع (جدول الأعمال)</div>
                        <table class="print-list-table">
                            <thead><tr><th>م</th><th>البند</th><th>المتحدث</th></tr></thead>
                            <tbody>${agendaRows}</tbody>
                        </table>
                    </div>` : ''}

                    ${viewData.decisions.length > 0 ? `
                    <div class="print-section">
                        <div class="print-section-title">القرارات والتوصيات</div>
                        <table class="print-list-table">
                            <thead><tr><th>م</th><th>القرار / التوصية</th><th>المسؤول</th><th>المدة/الموعد</th></tr></thead>
                            <tbody>${decisionRows}</tbody>
                        </table>
                    </div>` : ''}

                    ${viewData.executiveSummary ? `
                    <div class="print-section">
                        <div class="print-section-title">ملخص تنفيذي</div>
                        <div style="white-space: pre-wrap; border: 1px solid #000; padding: 10px; font-size: 13px;">${viewData.executiveSummary}</div>
                    </div>` : ''}

                    <div class="print-signature-section">
                        <div style="display: flex; justify-content: space-between; margin-top: 20px;">
                            <div style="text-align: center; width: 45%;">
                                <p><strong>مقرر الاجتماع</strong></p>
                                <p>${viewData.secretary}</p>
                                <div style="margin-top: 10px;">
                                    ${viewData.secretarySignature ? `<img src="${viewData.secretarySignature}" height="50">` : '<div style="height: 50px;"></div>'}
                                </div>
                            </div>
                            <div style="text-align: center; width: 45%;">
                                <p><strong>يعتمد / رئيس الاجتماع</strong></p>
                                <p>${viewData.chairman}</p>
                                <div style="margin-top: 10px;">
                                    ${viewData.chairmanSignature ? `<img src="${viewData.chairmanSignature}" height="50">` : '<div style="height: 50px;"></div>'}
                                </div>
                                <p style="font-size: 10px; color: #666;">تم الاعتماد إلكترونياً</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="print-footer">
                    <div>تم الإنشاء بواسطة نظام إدارة الاجتماعات</div>
                    <div>صفحة 1 من 1</div>
                    <div>${new Date().toLocaleString('en-GB')}</div>
                </div>
            </div>
        `;
        modal.style.display = 'block';
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        if (this.isApprovalMode) {
            // Approval flow (Chairman)
            if (!this.chairmanSigData) {
                this.showMessage('يرجى اعتماد المحضر (توقيع الرئيس)', 'error');
                return;
            }
            try {
                const formData = this.getFormData();
            const response = await fetch(`/api/meetings/${this.currentMeetingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    chairmanSignature: this.chairmanSigData
                }),
                credentials: 'include'
            });
                const result = await response.json();
                if (result.success) {
                    this.showMessage('تم اعتماد المحضر بنجاح', 'success');
                    document.getElementById('generatePdf').disabled = false;
                    setTimeout(() => document.getElementById('navArchive').click(), 1500);
                }
            } catch (error) {
                console.error(error);
                this.showMessage('فشل الاعتماد', 'error');
            }
        } else {
            // Creation flow (Secretary)
            if (!this.secretarySigData) {
                this.showMessage('يرجى توقيع المحضر (المقرر)', 'error');
                return;
            }
            const formData = this.getFormData();
            try {
                const response = await fetch('/api/meetings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                    credentials: 'include'
                });
                const result = await response.json();
                if (result.success) {
                    this.currentMeetingId = result.id;
                    this.showMessage('تم إرسال المحضر للاعتماد', 'success');
                    document.getElementById('submitBtn').disabled = true;
                }
            } catch (error) {
                console.error(error);
                this.showMessage('حدث خطأ أثناء الحفظ', 'error');
            }
        }
    }

    async aiAssist() {
        try {
            const payload = this.getFormData();
            this.showMessage('جاري التحليل بالذكاء الاصطناعي...', 'info');
            const response = await fetch('/api/ai/assist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'AI review failed');
            }

            this.lastAiResult = result;

            const content = document.getElementById('aiModalContent');
            const issues = Array.isArray(result.issues) ? result.issues : [];
            const summary = result.executiveSummary || '';
            const issuesHtml = issues.length ? `<ul style="margin:0; padding-right:18px;">${issues.map(i => `<li>${i}</li>`).join('')}</ul>` : '<div>لا توجد ملاحظات.</div>';

            content.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <div style="font-weight:700; margin-bottom:6px;">ملخص تنفيذي مقترح</div>
                    <div style="white-space: pre-wrap; border: 1px solid #eee; border-radius: 6px; padding: 10px;">${summary || '—'}</div>
                </div>
                <div>
                    <div style="font-weight:700; margin-bottom:6px;">ملاحظات ومقترحات</div>
                    <div style="border: 1px solid #eee; border-radius: 6px; padding: 10px;">${issuesHtml}</div>
                </div>
            `;

            document.getElementById('aiModal').style.display = 'block';
        } catch (error) {
            console.error(error);
            this.showMessage('تعذر تنفيذ التحليل بالذكاء الاصطناعي', 'error');
        }
    }

    applyAiResult() {
        const result = this.lastAiResult || {};
        if (Array.isArray(result.agendaItems)) {
            const tbody = document.querySelector('#agendaTable tbody');
            tbody.innerHTML = '';
            result.agendaItems.forEach(item => this.addAgendaRow(item));
        }

        if (Array.isArray(result.decisions)) {
            const tbody = document.querySelector('#decisionsTable tbody');
            tbody.innerHTML = '';
            result.decisions.forEach(item => this.addDecisionRow(item));
        }

        if (result.executiveSummary != null) {
            const el = document.getElementById('executiveSummary');
            if (el) el.value = result.executiveSummary;
        }

        document.getElementById('aiModal').style.display = 'none';
        this.showMessage('تم تطبيق تحسينات الذكاء الاصطناعي', 'success');
    }

    async generatePDF() {
        if (!this.currentMeetingId) return;
        const formData = this.getFormData();
        try {
            this.showMessage('جاري إنشاء ملف PDF...', 'info');
            const response = await fetch('/api/generate-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
                credentials: 'include'
            });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Meeting_Minutes_${formData.referenceNumber || 'Doc'}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                this.showMessage('تم تحميل الملف بنجاح', 'success');
            }
        } catch (error) {
            console.error(error);
            this.showMessage('خطأ في إنشاء PDF', 'error');
        }
    }

    async loadMeetings() {
        const list = document.getElementById('meetingsList');
        list.innerHTML = '<tr><td colspan="7" class="loading">جاري التحميل...</td></tr>';
        
        try {
            const response = await fetch('/api/meetings');
            this.allMeetings = await response.json();
            this.renderMeetings(this.allMeetings);
        } catch (error) {
            console.error(error);
            list.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">فشل تحميل البيانات</td></tr>';
        }
    }

    filterMeetings(searchTerm) {
        if (!searchTerm) {
            this.renderMeetings(this.allMeetings);
            return;
        }
        const lowerTerm = searchTerm.toLowerCase();
        const filtered = this.allMeetings.filter(m => 
            (m.meeting_title && m.meeting_title.toLowerCase().includes(lowerTerm)) ||
            (m.reference_number && m.reference_number.toLowerCase().includes(lowerTerm)) ||
            (m.meeting_date && m.meeting_date.includes(lowerTerm))
        );
        this.renderMeetings(filtered);
    }

    renderMeetings(meetings) {
        const list = document.getElementById('meetingsList');
        const emptyMsg = document.getElementById('emptyArchiveMessage');

        if (meetings.length === 0) {
            list.innerHTML = '';
            emptyMsg.style.display = 'block';
            return;
        }

        emptyMsg.style.display = 'none';
        list.innerHTML = meetings.map(m => {
            let statusBadge = '';
            let actionBtn = '';
            
            if (m.status === 'approved') {
                statusBadge = '<span class="status-badge success"><i class="fas fa-check-circle"></i> معتمد</span>';
                actionBtn = `<button class="btn btn-secondary btn-sm" onclick="app.viewArchivedMeeting(${m.id})"><i class="fas fa-eye"></i> عرض</button>`;
            } else {
                statusBadge = '<span class="status-badge warning"><i class="fas fa-clock"></i> بانتظار الاعتماد</span>';
                if (this.currentUser.role === 'chairman') {
                    actionBtn = `<button class="btn btn-primary btn-sm" onclick="app.openForApproval(${m.id})"><i class="fas fa-pen-nib"></i> اعتماد</button>`;
                } else {
                    actionBtn = `<button class="btn btn-secondary btn-sm" onclick="app.viewArchivedMeeting(${m.id})"><i class="fas fa-eye"></i> عرض</button>`;
                }
            }

            return `
            <tr>
                <td style="font-weight:bold;">${m.reference_number || '-'}</td>
                <td>${m.meeting_title}</td>
                <td>${m.meeting_date}</td>
                <td>${m.department || '-'}</td>
                <td>${m.chairman}</td>
                <td>${statusBadge}</td>
                <td>${actionBtn}</td>
            </tr>
        `}).join('');
    }

    async openForApproval(id) {
        this.isApprovalMode = true;
        this.currentMeetingId = id;
        
        await this.loadMeetingDataToForm(id);
        
        // Show form section
        document.getElementById('navNewMinute').classList.add('active'); // Even if hidden, logic works
        document.getElementById('navArchive').classList.remove('active');
        document.getElementById('newMinuteSection').style.display = 'block';
        document.getElementById('archiveSection').style.display = 'none';
        
        const form = document.getElementById('meetingForm');
        Array.from(form.elements).forEach(el => {
            el.disabled = false;
        });

        document.getElementById('secretarySignatureArea').style.pointerEvents = 'none';
        document.getElementById('chairmanSignatureArea').style.pointerEvents = 'auto';
        this.showMessage('وضع الاعتماد: يمكنك تعديل المحضر قبل الاعتماد', 'info');
        this.checkSubmissionStatus();
    }

    async viewArchivedMeeting(id) {
        this.showMessage('جاري تحميل المحضر...', 'info');
        try {
            const response = await fetch(`/api/meetings/${id}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Meeting not found');
            const meetingData = await response.json();
            this.showPreview(meetingData);
        } catch (error) {
            console.error('Error fetching meeting:', error);
            this.showMessage('فشل عرض المحضر', 'error');
        }
    }

    async loadMeetingDataToForm(id) {
        try {
            const response = await fetch(`/api/meetings/${id}`, { credentials: 'include' });
            const data = await response.json();
            
            // Populate basic fields
            const fields = [
                'orgName',
                'executiveSummary',
                'referenceNumber', 'department', 'meetingTitle', 'meetingDate', 'meetingTime', 
                'duration', 'meetingLocation', 'meetingType', 'chairman', 'secretary', 
                'nextMeetingDate'
            ];
            
            fields.forEach(field => {
                const dbField = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                const el = document.getElementById(field);
                if (el) el.value = data[dbField] || data[field] || '';
            });

            // Handle Dynamic Tables
            
            // Attendees
            const attendees = JSON.parse(data.attendees || '[]');
            document.querySelector('#attendeesTable tbody').innerHTML = '';
            attendees.forEach(a => this.addAttendeeRow(a));

            // Agenda
            const agenda = JSON.parse(data.agenda_items || '[]');
            document.querySelector('#agendaTable tbody').innerHTML = '';
            agenda.forEach(item => this.addAgendaRow(item));

            // Decisions
            const decisions = JSON.parse(data.decisions || '[]');
            document.querySelector('#decisionsTable tbody').innerHTML = '';
            decisions.forEach(d => this.addDecisionRow(d));

            // Handle Signatures
            const secArea = document.getElementById('secretarySignatureArea');
            if (data.secretary_signature) {
                secArea.innerHTML = `<img src="${data.secretary_signature}" alt="Secretary Sig">`;
                secArea.classList.remove('empty');
                this.secretarySigData = data.secretary_signature;
                document.getElementById('secretaryStatus').innerHTML = '<span style="color:green">✓ تم التوقيع</span>';
            }

            const chairArea = document.getElementById('chairmanSignatureArea');
            if (data.chairman_signature) {
                chairArea.innerHTML = `<img src="${data.chairman_signature}" alt="Chairman Sig">`;
                chairArea.classList.remove('empty');
                this.chairmanSigData = data.chairman_signature;
                document.getElementById('chairmanStatus').innerHTML = '<span style="color:green">✓ تم الاعتماد</span>';
            } else {
                // Clear for new signature
                chairArea.innerHTML = '<div class="placeholder-text">اضغط هنا لإضافة التوقيع</div>';
                chairArea.classList.add('empty');
                this.chairmanSigData = null;
                document.getElementById('chairmanStatus').innerHTML = '';
            }
            
            if (data.watermark_image) {
                this.watermarkDataUrl = data.watermark_image;
            }

        } catch (error) {
            console.error('Error loading data:', error);
            this.showMessage('فشل تحميل بيانات المحضر', 'error');
        }
    }

    resetForm() {
        document.getElementById('meetingForm').reset();
        this.currentMeetingId = null;
        this.isApprovalMode = false;
        this.secretarySigData = null;
        this.chairmanSigData = null;
        this.watermarkDataUrl = null;
        
        // Clear dynamic tables
        document.querySelector('#attendeesTable tbody').innerHTML = '';
        document.querySelector('#agendaTable tbody').innerHTML = '';
        document.querySelector('#decisionsTable tbody').innerHTML = '';
        
        // Add initial empty rows for UX
        this.addAttendeeRow();
        this.addAgendaRow();
        this.addDecisionRow();

        // Reset signatures
        ['secretary', 'chairman'].forEach(role => {
            const area = document.getElementById(`${role}SignatureArea`);
            area.innerHTML = '<div class="placeholder-text">اضغط هنا لإضافة التوقيع</div>';
            area.classList.add('empty');
            area.style.display = 'flex';
            document.getElementById(`${role}Status`).innerHTML = '';
            
            // Re-enable/disable based on role
            if (this.currentUser && this.currentUser.role === role) {
                area.style.pointerEvents = 'auto';
            } else {
                area.style.pointerEvents = 'none';
            }
        });

        // Enable inputs
        const form = document.getElementById('meetingForm');
        Array.from(form.elements).forEach(el => el.disabled = false);
        document.getElementById('submitBtn').disabled = true;
        document.getElementById('generatePdf').disabled = true;
    }

    showMessage(text, type) {
        const msg = document.getElementById('message');
        msg.textContent = text;
        msg.className = `message ${type}`;
        msg.style.display = 'block';
        if (type !== 'error') {
            setTimeout(() => { msg.style.display = 'none'; }, 3000);
        }
    }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new MeetingMinutesApp();
});
