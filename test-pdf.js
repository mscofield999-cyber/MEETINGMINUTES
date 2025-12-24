const { generatePDF } = require('./server/pdfGenerator');

// بيانات اختبارية
const testData = {
    meetingTitle: 'اجتماع اختبار',
    meetingDate: '2024-12-24',
    meetingTime: '10:00',
    meetingLocation: 'القاعة الرئيسية',
    meetingType: 'عادي',
    chairman: 'أحمد محمد',
    secretary: 'فاطمة علي',
    attendees: 'أحمد محمد\nفاطمة علي\nخالد حسن',
    agendaItems: 'مناقشة المشروع\nتقرير المبيعات',
    decisions: 'موافقة على الخطة',
    actionItems: 'إعداد التقرير النهائي',
    nextMeetingDate: '2025-01-10',
    signatureData: 'data:image/png;base64,test'
};

// اختبار إنشاء PDF
async function testPDF() {
    try {
        console.log('جاري إنشاء PDF اختباري...');
        const pdfBuffer = await generatePDF(testData);
        console.log('✅ تم إنشاء PDF بنجاح!');
        console.log(`حجم الملف: ${pdfBuffer.length} bytes`);
        
        // حفظ الملف للتحقق
        const fs = require('fs');
        fs.writeFileSync('test-output.pdf', pdfBuffer);
        console.log('✅ تم حفظ الملف كـ test-output.pdf');
        
    } catch (error) {
        console.error('❌ فشل في إنشاء PDF:', error.message);
        console.error('تفاصيل الخطأ:', error);
    }
}

testPDF();