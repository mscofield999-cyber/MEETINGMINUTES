import React, { useState, useRef, useEffect } from 'react'
import './App.css'

const App = () => {
  const [formData, setFormData] = useState({
    meetingTitle: '',
    meetingDate: '',
    meetingTime: '',
    meetingLocation: '',
    meetingType: 'عادي',
    chairman: '',
    secretary: '',
    attendees: '',
    agendaItems: '',
    decisions: '',
    actionItems: '',
    nextMeetingDate: '',
    signatureData: null
  })

  const [isSigned, setIsSigned] = useState(false)
  const signaturePadRef = useRef(null)
  const signatureCanvasRef = useRef(null)
  const [signaturePad, setSignaturePad] = useState(null)

  useEffect(() => {
    if (signatureCanvasRef.current) {
      const pad = new SignaturePad(signatureCanvasRef.current, {
        minWidth: 1,
        maxWidth: 3,
        penColor: 'rgb(0, 0, 0)',
        backgroundColor: 'rgb(255, 255, 255)'
      })
      setSignaturePad(pad)
    }
  }, [])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSignatureSave = () => {
    if (signaturePad && !signaturePad.isEmpty()) {
      const signatureData = signaturePad.toDataURL()
      setFormData(prev => ({
        ...prev,
        signatureData
      }))
      setIsSigned(true)
      alert('تم حفظ التوقيع بنجاح')
    } else {
      alert('يرجى التوقيع أولاً')
    }
  }

  const handleSignatureClear = () => {
    if (signaturePad) {
      signaturePad.clear()
      setFormData(prev => ({
        ...prev,
        signatureData: null
      }))
      setIsSigned(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isSigned) {
      alert('يرجى التوقيع على المحضر أولاً')
      return
    }
    
    alert('تم حفظ المحضر بنجاح وتوقيعه إلكترونياً')
    console.log('بيانات المحضر:', formData)
    generatePDF()
  }

  const generatePDF = async () => {
    const element = document.getElementById('meeting-minutes-preview')
    if (!element) return

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgWidth = 190
      const pageHeight = 280
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 10

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`محضر_اجتماع_${formData.meetingDate}.pdf`)
    } catch (error) {
      console.error('خطأ في إنشاء PDF:', error)
      alert('حدث خطأ أثناء إنشاء ملف PDF')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="container">
      <div className="header">
        <h1>نظام محاضر الاجتماعات</h1>
        <p>أدخل بيانات المحضر</p>
      </div>

      <div className="form-container">
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h2>معلومات الاجتماع الأساسية</h2>
            <div className="grid">
              <div className="form-group">
                <label>عنوان الاجتماع *</label>
                <input
                  type="text"
                  name="meetingTitle"
                  value={formData.meetingTitle}
                  onChange={handleInputChange}
                  required
                  placeholder="أدخل عنوان الاجتماع"
                />
              </div>

              <div className="form-group">
                <label>تاريخ الاجتماع *</label>
                <input
                  type="date"
                  name="meetingDate"
                  value={formData.meetingDate}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>وقت الاجتماع</label>
                <input
                  type="time"
                  name="meetingTime"
                  value={formData.meetingTime}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label>مكان الاجتماع</label>
                <input
                  type="text"
                  name="meetingLocation"
                  value={formData.meetingLocation}
                  onChange={handleInputChange}
                  placeholder="أدخل مكان الاجتماع"
                />
              </div>

              <div className="form-group">
                <label>نوع الاجتماع</label>
                <select
                  name="meetingType"
                  value={formData.meetingType}
                  onChange={handleInputChange}
                >
                  <option value="عادي">عادي</option>
                  <option value="طارئ">طارئ</option>
                  <option value="دوري">دوري</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>المشاركون في الاجتماع</h2>
            <div className="grid">
              <div className="form-group">
                <label>رئيس الاجتماع *</label>
                <input
                  type="text"
                  name="chairman"
                  value={formData.chairman}
                  onChange={handleInputChange}
                  required
                  placeholder="اسم رئيس الاجتماع"
                />
              </div>

              <div className="form-group">
                <label>مقرر الاجتماع *</label>
                <input
                  type="text"
                  name="secretary"
                  value={formData.secretary}
                  onChange={handleInputChange}
                  required
                  placeholder="اسم مقرر الاجتماع"
                />
              </div>

              <div className="form-group">
                <label>الحضور</label>
                <textarea
                  name="attendees"
                  value={formData.attendees}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="أدخل أسماء الحضور"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>بنود جدول الأعمال</h2>
            <div className="form-group">
              <textarea
                name="agendaItems"
                value={formData.agendaItems}
                onChange={handleInputChange}
                rows="4"
                placeholder="أدخل بنود جدول الأعمال"
              />
            </div>
          </div>

          <div className="form-section">
            <h2>القرارات والتوصيات</h2>
            <div className="form-group">
              <textarea
                name="decisions"
                value={formData.decisions}
                onChange={handleInputChange}
                rows="4"
                placeholder="أدخل القرارات والتوصيات"
              />
            </div>
          </div>

          <div className="form-section">
            <h2>بنود العمل والمهام</h2>
            <div className="form-group">
              <textarea
                name="actionItems"
                value={formData.actionItems}
                onChange={handleInputChange}
                rows="4"
                placeholder="أدخل بنود العمل والمهام"
              />
            </div>
          </div>

          <div className="form-section">
            <h2>التوقيع الإلكتروني *</h2>
            <div className="signature-container">
              <canvas 
                ref={signatureCanvasRef} 
                width={400} 
                height={150} 
                className="signature-pad"
                style={{ border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <div className="signature-actions">
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleSignatureSave}
                >
                  حفظ التوقيع
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleSignatureClear}
                >
                  مسح التوقيع
                </button>
              </div>
              {isSigned && (
                <div className="signature-status">
                  <span className="text-success">✓ تم التوقيع بنجاح</span>
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-success">
              حفظ المحضر
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default App